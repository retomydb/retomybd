"""
retomY — Spaces Router
CRUD for HuggingFace-style Spaces (Gradio / Streamlit / Docker apps).
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from models.hub_schemas import SpaceMetadataRequest, CreateRepoRequest
from core.security import get_current_user, get_current_user_optional
from core.database import execute_query
from core.config import get_settings
import structlog
import uuid
import re

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/spaces", tags=["Spaces"])


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


# ─── BROWSE SPACES ────────────────────────────────────────────────────────────

@router.get("")
async def browse_spaces(
    search: str = Query(None),
    sdk: str = Query(None),
    hardware: str = Query(None),
    sort: str = Query("trending", pattern="^(trending|likes|created|updated)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user_optional),
):
    """Browse space repositories."""
    conditions = ["r.DeletedAt IS NULL", "r.RepoType = 'space'"]
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
    if sdk:
        conditions.append("sm.Sdk = ?")
        params.append(sdk)
    if hardware:
        conditions.append("sm.Hardware = ?")
        params.append(hardware)

    sort_col = {
        "trending": "r.Trending DESC",
        "likes": "r.TotalLikes DESC",
        "created": "r.CreatedAt DESC",
        "updated": "r.UpdatedAt DESC",
    }.get(sort, "r.Trending DESC")

    where = " AND ".join(conditions)

    count_sql = f"""
        SELECT COUNT(*) AS cnt
        FROM retomy.Repositories r
        LEFT JOIN retomy.SpaceMetadata sm ON sm.RepoId = r.RepoId
        WHERE {where}
    """
    total = execute_query(count_sql, params[:], fetch="one")
    total_count = total["cnt"] if total else 0

    offset = (page - 1) * page_size
    data_sql = f"""
        SELECT r.RepoId, r.OwnerId, r.OwnerType, r.Name, r.Slug,
               r.Description, r.Private, r.TotalLikes, r.TotalViews,
               r.Trending, r.CreatedAt,
               sm.Sdk, sm.SdkVersion, sm.Hardware, sm.AppPort, sm.Status AS SpaceStatus,
               u.DisplayName AS owner_name, u.Slug AS owner_slug
        FROM retomy.Repositories r
        LEFT JOIN retomy.SpaceMetadata sm ON sm.RepoId = r.RepoId
        LEFT JOIN retomy.Users u ON u.UserId = r.OwnerId AND r.OwnerType = 'user'
        WHERE {where}
        ORDER BY {sort_col}
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    """
    params += [offset, page_size]
    rows = execute_query(data_sql, params, fetch="all")

    return {
        "spaces": rows,
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
    }


# ─── CREATE SPACE ─────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_space(
    name: str = Query(...),
    description: str = Query(None),
    private: bool = Query(False),
    sdk: str = Query("gradio"),
    sdk_version: str = Query(None),
    hardware: str = Query("cpu-basic"),
    user: dict = Depends(get_current_user),
):
    """Create a new Space repository."""
    repo_id = str(uuid.uuid4()).upper()
    slug = _slugify(name)
    user_id = str(user["UserId"])

    existing = execute_query(
        "SELECT RepoId FROM retomy.Repositories WHERE OwnerId = ? AND Slug = ? AND DeletedAt IS NULL",
        [user_id, slug], fetch="one",
    )
    if existing:
        raise HTTPException(status_code=409, detail="Space slug already exists")

    execute_query(
        """INSERT INTO retomy.Repositories
           (RepoId, OwnerId, OwnerType, RepoType, Name, Slug, Description, Private)
           VALUES (?, ?, 'user', 'space', ?, ?, ?, ?)""",
        [repo_id, user_id, name, slug, description, 1 if private else 0],
        fetch="none",
    )

    # Insert space metadata
    meta_id = str(uuid.uuid4()).upper()
    execute_query(
        """INSERT INTO retomy.SpaceMetadata
           (MetaId, RepoId, Sdk, SdkVersion, Hardware, AppPort)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [meta_id, repo_id, sdk, sdk_version, hardware, 7860],
        fetch="none",
    )

    return {"repo_id": repo_id, "slug": slug, "message": "Space created"}


# ─── SPACE DETAIL ─────────────────────────────────────────────────────────────

@router.get("/{owner}/{space_slug}")
async def get_space(owner: str, space_slug: str, user: dict = Depends(get_current_user_optional)):
    """Get space detail with metadata."""
    row = execute_query(
        """SELECT r.*, sm.Sdk, sm.SdkVersion, sm.Hardware, sm.AppPort,
                  sm.EmbedUrl, sm.Status AS SpaceStatus,
                  sm.LinkedModels, sm.LinkedDatasets,
                  u.DisplayName AS owner_name, u.Slug AS owner_slug, u.AvatarUrl
           FROM retomy.Repositories r
           LEFT JOIN retomy.SpaceMetadata sm ON sm.RepoId = r.RepoId
           LEFT JOIN retomy.Users u ON u.UserId = r.OwnerId AND r.OwnerType = 'user'
           WHERE (u.Slug = ? OR r.OwnerId = ?) AND r.Slug = ? AND r.RepoType = 'space' AND r.DeletedAt IS NULL""",
        [owner, owner, space_slug], fetch="one",
    )
    if not row:
        raise HTTPException(status_code=404, detail="Space not found")

    user_id = str(user["UserId"]) if user else None
    if row.get("Private") and str(row.get("OwnerId")) != user_id:
        if not (user and user.get("Role") in ("admin", "superadmin")):
            raise HTTPException(status_code=404, detail="Space not found")

    # Increment views
    execute_query(
        "UPDATE retomy.Repositories SET TotalViews = TotalViews + 1 WHERE RepoId = ?",
        [row["RepoId"]], fetch="none",
    )

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


# ─── UPDATE SPACE METADATA ────────────────────────────────────────────────────

@router.patch("/{repo_id}/metadata")
async def update_space_metadata(repo_id: str, body: SpaceMetadataRequest, user: dict = Depends(get_current_user)):
    user_id = str(user["UserId"])
    repo = execute_query(
        "SELECT OwnerId FROM retomy.Repositories WHERE RepoId = ? AND RepoType = 'space' AND DeletedAt IS NULL",
        [repo_id], fetch="one",
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Space not found")
    if str(repo["OwnerId"]) != user_id and user.get("Role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    sets, vals = [], []
    field_map = {
        "sdk": "Sdk", "sdk_version": "SdkVersion", "app_port": "AppPort",
        "hardware": "Hardware", "embed_url": "EmbedUrl",
        "linked_models": "LinkedModels", "linked_datasets": "LinkedDatasets",
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
        f"UPDATE retomy.SpaceMetadata SET {', '.join(sets)} WHERE RepoId = ?",
        vals, fetch="none",
    )
    return {"message": "Space metadata updated"}


# ─── FILTER OPTIONS ───────────────────────────────────────────────────────────

@router.get("/filters/options")
async def space_filter_options():
    sdks = execute_query(
        "SELECT DISTINCT sm.Sdk FROM retomy.SpaceMetadata sm WHERE sm.Sdk IS NOT NULL ORDER BY sm.Sdk",
        fetch="all",
    )
    return {
        "sdks": [r["Sdk"] for r in sdks],
        "hardware_options": ["cpu-basic", "cpu-upgrade", "t4-small", "t4-medium", "a10g-small", "a10g-large", "a100-large"],
    }
