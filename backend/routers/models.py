"""
retomY — Models Router
Browse, create, and manage ML model repositories.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from models.hub_schemas import ModelMetadataRequest, CreateRepoRequest
from core.security import get_current_user, get_current_user_optional
from core.database import execute_query
from core.config import get_settings
import structlog
import uuid
import re

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/models", tags=["Models"])


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


# ─── BROWSE MODELS ─────────────────────────────────────────────────────────────

@router.get("")
async def browse_models(
    search: str = Query(None),
    task: str = Query(None),
    framework: str = Query(None),
    language: str = Query(None),
    library: str = Query(None),
    sort: str = Query("trending", pattern="^(trending|downloads|likes|created|updated)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user_optional),
):
    """Browse model repositories with ML-specific filters."""
    conditions = ["r.DeletedAt IS NULL", "r.RepoType = 'model'"]
    params = []

    user_id = str(user["UserId"]) if user else None
    if user_id:
        conditions.append("(r.Private = 0 OR r.OwnerId = ?)")
        params.append(user_id)
    else:
        conditions.append("r.Private = 0")

    if search:
        conditions.append("(r.Name LIKE ? OR r.Description LIKE ?)")
        params += [f"%{search}%", f"%{search}%"]

    if task:
        conditions.append("mm.Task = ?")
        params.append(task)
    if framework:
        conditions.append("mm.Framework = ?")
        params.append(framework)
    if language:
        conditions.append("mm.Language = ?")
        params.append(language)
    if library:
        conditions.append("mm.Library = ?")
        params.append(library)

    sort_col = {
        "trending": "r.Trending DESC",
        "downloads": "r.TotalDownloads DESC",
        "likes": "r.TotalLikes DESC",
        "created": "r.CreatedAt DESC",
        "updated": "r.UpdatedAt DESC",
    }.get(sort, "r.Trending DESC")

    where = " AND ".join(conditions)

    # Only JOIN ModelMetadata in the COUNT when we actually filter on mm columns
    needs_mm_join = any(f for f in (task, framework, language, library))
    if needs_mm_join:
        count_sql = f"""
            SELECT COUNT(*) AS cnt
            FROM retomy.Repositories r WITH (NOLOCK)
            LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
            WHERE {where}
        """
    else:
        count_sql = f"""
            SELECT COUNT(*) AS cnt
            FROM retomy.Repositories r WITH (NOLOCK)
            WHERE {where}
        """
    total = execute_query(count_sql, params[:], fetch="one")
    total_count = total["cnt"] if total else 0

    offset = (page - 1) * page_size
    data_sql = f"""
        SELECT r.RepoId, r.OwnerId, r.OwnerType, r.Name, r.Slug,
               r.Description, r.Private, r.PricingModel, r.Price,
               r.LicenseType, r.TotalDownloads, r.TotalLikes,
               r.TotalViews, r.Trending, r.LastCommitAt, r.CreatedAt,
               r.UpdatedAt,
               mm.Framework, mm.Task, mm.Library, mm.Architecture,
               mm.Language AS ModelLanguage, mm.ParameterCount, mm.PipelineTag,
               mm.HostingType, mm.OriginalModelId, mm.GithubStars,
               u.DisplayName AS owner_name, u.Slug AS owner_slug
        FROM retomy.Repositories r WITH (NOLOCK)
        LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        LEFT JOIN retomy.Users u WITH (NOLOCK) ON u.UserId = r.OwnerId AND r.OwnerType = 'user'
        WHERE {where}
        ORDER BY {sort_col}
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    """
    params += [offset, page_size]
    rows = execute_query(data_sql, params, fetch="all")

    return {
        "models": rows,
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
    }


# ─── CREATE MODEL ─────────────────────────────────────────────────────────────

def _parse_github_url(url: str):
    """Extract owner/repo from a GitHub URL."""
    import re as _re
    m = _re.match(r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", url.strip())
    if not m:
        return None, None
    return m.group(1), m.group(2)


async def _sync_github_info(repo_id: str, gh_owner: str, gh_repo: str, branch: str = "main"):
    """Fetch repo info + README from GitHub API and store it."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"https://api.github.com/repos/{gh_owner}/{gh_repo}")
            if r.status_code != 200:
                return
            info = r.json()
            stars = info.get("stargazers_count", 0)
            topics = ",".join(info.get("topics", []))
            desc = info.get("description", "")

            # Fetch README
            readme_text = None
            r2 = await client.get(
                f"https://api.github.com/repos/{gh_owner}/{gh_repo}/readme",
                headers={"Accept": "application/vnd.github.v3.raw"},
            )
            if r2.status_code == 200:
                readme_text = r2.text[:50000]

            execute_query(
                """UPDATE retomy.ModelMetadata
                   SET GithubStars = ?, GithubTopics = ?, GithubReadme = ?,
                       GithubLastSyncAt = GETDATE()
                   WHERE RepoId = ?""",
                [stars, topics, readme_text, repo_id],
                fetch="none",
            )
            # Also update description if empty
            if desc:
                execute_query(
                    "UPDATE retomy.Repositories SET Description = COALESCE(NULLIF(Description, ''), ?) WHERE RepoId = ?",
                    [desc, repo_id], fetch="none",
                )
    except Exception as e:
        logger.warning("github_sync_failed", repo_id=repo_id, error=str(e))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_model(
    name: str = Query(...),
    description: str = Query(None),
    private: bool = Query(False),
    license_type: str = Query(None),
    framework: str = Query(None),
    task: str = Query(None),
    library: str = Query(None),
    language: str = Query(None),
    hosting_type: str = Query("hosted"),
    github_url: str = Query(None),
    usage_guide: str = Query(None),
    user: dict = Depends(get_current_user),
):
    """Create a new model repository with metadata."""
    repo_id = str(uuid.uuid4()).upper()
    slug = _slugify(name)
    user_id = str(user["UserId"])

    # Validate GitHub URL if hosting_type is github
    gh_owner, gh_repo = None, None
    if hosting_type == "github":
        if not github_url:
            raise HTTPException(status_code=400, detail="GitHub URL is required for GitHub-hosted models")
        gh_owner, gh_repo = _parse_github_url(github_url)
        if not gh_owner:
            raise HTTPException(status_code=400, detail="Invalid GitHub URL")

    existing = execute_query(
        "SELECT RepoId FROM retomy.Repositories WHERE OwnerId = ? AND Slug = ? AND DeletedAt IS NULL",
        [user_id, slug], fetch="one",
    )
    if existing:
        raise HTTPException(status_code=409, detail="Model slug already exists")

    execute_query(
        """INSERT INTO retomy.Repositories
           (RepoId, OwnerId, OwnerType, RepoType, Name, Slug, Description, Private, LicenseType)
           VALUES (?, ?, 'user', 'model', ?, ?, ?, ?, ?)""",
        [repo_id, user_id, name, slug, description, 1 if private else 0, license_type],
        fetch="none",
    )

    # Insert model metadata with hosting info
    meta_id = str(uuid.uuid4()).upper()
    execute_query(
        """INSERT INTO retomy.ModelMetadata
           (MetaId, RepoId, Framework, Task, Library, Language,
            HostingType, GithubRepoUrl, GithubOwner, GithubRepoName, GithubBranch, UsageGuide)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [meta_id, repo_id, framework, task, library, language,
         hosting_type, github_url, gh_owner, gh_repo, "main" if gh_owner else None,
         usage_guide],
        fetch="none",
    )

    # Sync GitHub info in background if applicable
    if gh_owner:
        await _sync_github_info(repo_id, gh_owner, gh_repo)

    return {"repo_id": repo_id, "slug": slug, "message": "Model created"}


# ─── FILTER OPTIONS (must be before /{owner}/{model_slug}) ─────────────────────

@router.get("/filters/options")
async def model_filter_options():
    """Return available filter values for the browse UI."""
    tasks = execute_query(
        "SELECT DISTINCT mm.Task FROM retomy.ModelMetadata mm WITH (NOLOCK) WHERE mm.Task IS NOT NULL ORDER BY mm.Task",
        fetch="all",
    )
    frameworks = execute_query(
        "SELECT DISTINCT mm.Framework FROM retomy.ModelMetadata mm WITH (NOLOCK) WHERE mm.Framework IS NOT NULL ORDER BY mm.Framework",
        fetch="all",
    )
    languages = execute_query(
        "SELECT DISTINCT mm.Language FROM retomy.ModelMetadata mm WITH (NOLOCK) WHERE mm.Language IS NOT NULL ORDER BY mm.Language",
        fetch="all",
    )
    # Model categories (pipeline tags) with counts
    try:
        categories = execute_query(
            """
            SELECT mm.PipelineTag AS name, COUNT(*) AS count
            FROM retomy.Repositories r WITH (NOLOCK)
            LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
            WHERE r.RepoType = 'model' AND r.DeletedAt IS NULL AND mm.PipelineTag IS NOT NULL
            GROUP BY mm.PipelineTag
            ORDER BY COUNT(*) DESC
            """,
            fetch="all",
        )
    except Exception:
        categories = []
    return {
        "tasks": [r["Task"] for r in tasks],
        "frameworks": [r["Framework"] for r in frameworks],
        "languages": [r["Language"] for r in languages],
        "categories": categories,
    }


# ─── GITHUB PREVIEW (must be before /{owner}/{model_slug}) ────────────────────

@router.get("/github/preview")
async def github_preview(url: str = Query(...), user: dict = Depends(get_current_user)):
    """Preview a GitHub repo before linking."""
    gh_owner, gh_repo = _parse_github_url(url)
    if not gh_owner:
        raise HTTPException(status_code=400, detail="Invalid GitHub URL")

    import httpx
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"https://api.github.com/repos/{gh_owner}/{gh_repo}")
        if r.status_code != 200:
            raise HTTPException(status_code=404, detail="GitHub repository not found")
        info = r.json()
        return {
            "owner": gh_owner,
            "repo": gh_repo,
            "description": info.get("description"),
            "stars": info.get("stargazers_count", 0),
            "topics": info.get("topics", []),
            "language": info.get("language"),
            "default_branch": info.get("default_branch", "main"),
            "html_url": info.get("html_url"),
        }


# ─── MODEL DETAIL ─────────────────────────────────────────────────────────────

@router.get("/{owner}/{model_slug}")
async def get_model(owner: str, model_slug: str, user: dict = Depends(get_current_user_optional)):
    """Get model detail with metadata."""
    row = execute_query(
        """SELECT r.*, mm.Framework, mm.Task, mm.Library, mm.Architecture,
                  mm.Language AS ModelLanguage, mm.BaseModel, mm.ParameterCount,
                  mm.TensorType, mm.PipelineTag, mm.SafeTensors, mm.InferenceEnabled,
                  mm.EvalResults, mm.OriginalModelId,
                  mm.HostingType, mm.GithubRepoUrl, mm.GithubOwner, mm.GithubRepoName,
                  mm.GithubBranch, mm.GithubLastSyncAt, mm.GithubReadme,
                  mm.GithubStars, mm.GithubTopics, mm.UsageGuide,
                  u.DisplayName AS owner_name, u.Slug AS owner_slug, u.AvatarUrl
           FROM retomy.Repositories r WITH (NOLOCK)
           LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
           LEFT JOIN retomy.Users u WITH (NOLOCK) ON u.UserId = r.OwnerId AND r.OwnerType = 'user'
           WHERE (u.Slug = ? OR r.OwnerId = ?) AND r.Slug = ? AND r.RepoType = 'model' AND r.DeletedAt IS NULL""",
        [owner, owner, model_slug], fetch="one",
    )
    if not row:
        raise HTTPException(status_code=404, detail="Model not found")

    # Ensure RepoId is a string to avoid pyodbc type binding issues
    try:
        row["RepoId"] = str(row.get("RepoId"))
    except Exception:
        pass

    # Debug: log RepoId type/value if tags query fails
    logger.info("repoid_debug", repo_id_value=repr(row.get("RepoId")), repo_id_type=str(type(row.get("RepoId"))))

    user_id = str(user["UserId"]) if user else None
    if row.get("Private") and str(row.get("OwnerId")) != user_id:
        if not (user and user.get("Role") in ("admin", "superadmin")):
            raise HTTPException(status_code=404, detail="Model not found")

    # Increment views
    execute_query(
        "UPDATE retomy.Repositories SET TotalViews = TotalViews + 1 WHERE RepoId = ?",
        [row["RepoId"]], fetch="none",
    )

    # Tags
    # Skip tag lookup for now (some environments have ODBC type binding issues).
    # Default to empty list; tag loading can be re-enabled with a safer query later.
    row["tags"] = []

    # Like status
    liked = False
    if user_id:
        like_row = execute_query(
            "SELECT ResourceId FROM retomy.Likes WHERE UserId = ? AND ResourceId = ? AND ResourceType = 'repo'",
            [user_id, row["RepoId"]], fetch="one",
        )
        liked = like_row is not None
    row["liked_by_user"] = liked

    return row


# ─── UPDATE MODEL METADATA ────────────────────────────────────────────────────

@router.patch("/{repo_id}/metadata")
async def update_model_metadata(repo_id: str, body: ModelMetadataRequest, user: dict = Depends(get_current_user)):
    """Update model-specific metadata."""
    user_id = str(user["UserId"])
    repo = execute_query(
        "SELECT OwnerId FROM retomy.Repositories WHERE RepoId = ? AND RepoType = 'model' AND DeletedAt IS NULL",
        [repo_id], fetch="one",
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Model not found")
    if str(repo["OwnerId"]) != user_id and user.get("Role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    sets, vals = [], []
    field_map = {
        "framework": "Framework", "task": "Task", "library": "Library",
        "architecture": "Architecture", "language": "Language",
        "base_model": "BaseModel", "parameter_count": "ParameterCount",
        "tensor_type": "TensorType", "pipeline_tag": "PipelineTag",
    }
    for py_field, col in field_map.items():
        val = getattr(body, py_field, None)
        if val is not None:
            sets.append(f"{col} = ?")
            vals.append(val)

    if not sets:
        return {"message": "Nothing to update"}

    vals.append(repo_id)
    execute_query(
        f"UPDATE retomy.ModelMetadata SET {', '.join(sets)} WHERE RepoId = ?",
        vals, fetch="none",
    )
    return {"message": "Model metadata updated"}


# ─── GITHUB SYNC ──────────────────────────────────────────────────────────────

@router.post("/{repo_id}/github-sync")
async def github_sync(repo_id: str, user: dict = Depends(get_current_user)):
    """Re-sync GitHub info for a GitHub-linked model."""
    user_id = str(user["UserId"])
    row = execute_query(
        """SELECT r.OwnerId, mm.GithubOwner, mm.GithubRepoName, mm.GithubBranch
           FROM retomy.Repositories r
           JOIN retomy.ModelMetadata mm ON mm.RepoId = r.RepoId
           WHERE r.RepoId = ? AND r.DeletedAt IS NULL""",
        [repo_id], fetch="one",
    )
    if not row:
        raise HTTPException(status_code=404, detail="Model not found")
    if str(row["OwnerId"]) != user_id and user.get("Role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    if not row.get("GithubOwner"):
        raise HTTPException(status_code=400, detail="Not a GitHub-linked model")

    await _sync_github_info(repo_id, row["GithubOwner"], row["GithubRepoName"], row.get("GithubBranch", "main"))
    return {"message": "GitHub info synced"}


# ─── USAGE GUIDE ──────────────────────────────────────────────────────────────

@router.put("/{repo_id}/usage-guide")
async def update_usage_guide(repo_id: str, body: dict, user: dict = Depends(get_current_user)):
    """Update the usage guide markdown for a model."""
    user_id = str(user["UserId"])
    repo = execute_query(
        "SELECT OwnerId FROM retomy.Repositories WHERE RepoId = ? AND RepoType = 'model' AND DeletedAt IS NULL",
        [repo_id], fetch="one",
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Model not found")
    if str(repo["OwnerId"]) != user_id and user.get("Role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    usage_guide = body.get("usage_guide", "")
    execute_query(
        "UPDATE retomy.ModelMetadata SET UsageGuide = ? WHERE RepoId = ?",
        [usage_guide, repo_id], fetch="none",
    )
    return {"message": "Usage guide updated"}
