"""
retomY — Models Analytics Router
Leaderboards, trends, comparisons, quality scores, and recommendations.
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from core.database import execute_query
from core.security import get_current_user_optional
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/models/analytics", tags=["Model Analytics"])


# ─── LEADERBOARDS ──────────────────────────────────────────────────────────────

@router.get("/leaderboards")
async def model_leaderboards(
    task: str = Query(None),
    framework: str = Query(None),
    metric: str = Query("downloads", pattern="^(downloads|likes|trending|stars|params)$"),
    limit: int = Query(50, ge=1, le=200),
):
    """Get ranked model leaderboards by various metrics."""
    conditions = ["r.DeletedAt IS NULL", "r.RepoType = 'model'", "r.Private = 0"]
    params = []

    if task:
        conditions.append("mm.Task = ?")
        params.append(task)
    if framework:
        conditions.append("mm.Framework = ?")
        params.append(framework)

    sort_col = {
        "downloads": "r.TotalDownloads DESC",
        "likes": "r.TotalLikes DESC",
        "trending": "r.Trending DESC",
        "stars": "ISNULL(mm.GithubStars, 0) DESC",
        "params": "ISNULL(mm.ParameterCount, 0) DESC",
    }.get(metric, "r.TotalDownloads DESC")

    where = " AND ".join(conditions)
    sql = f"""
        SELECT TOP (?)
               r.RepoId, r.Name, r.Slug, r.Description,
               r.TotalDownloads, r.TotalLikes, r.TotalViews, r.Trending,
               mm.Framework, mm.Task, mm.Library, mm.Architecture,
               mm.ParameterCount, mm.PipelineTag, mm.HostingType,
               mm.OriginalModelId, mm.GithubStars,
               u.DisplayName AS owner_name, u.Slug AS owner_slug
        FROM retomy.Repositories r WITH (NOLOCK)
        LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        LEFT JOIN retomy.Users u WITH (NOLOCK) ON u.UserId = r.OwnerId AND r.OwnerType = 'user'
        WHERE {where}
        ORDER BY {sort_col}
    """
    params.insert(0, limit)
    rows = execute_query(sql, params, fetch="all")
    # Add rank
    for i, row in enumerate(rows):
        row["rank"] = i + 1
    return {"leaderboard": rows, "metric": metric, "count": len(rows)}


# ─── TREND ANALYTICS ──────────────────────────────────────────────────────────

@router.get("/trends")
async def model_trends():
    """Get trend analytics — framework distribution, task distribution, growth, etc."""

    # Framework distribution
    frameworks = execute_query("""
        SELECT ISNULL(mm.Framework, 'Unknown') AS name, COUNT(*) AS count
        FROM retomy.Repositories r WITH (NOLOCK)
        LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        WHERE r.RepoType = 'model' AND r.DeletedAt IS NULL AND r.Private = 0
        GROUP BY mm.Framework
        ORDER BY COUNT(*) DESC
    """, fetch="all")

    # Task distribution
    tasks = execute_query("""
        SELECT ISNULL(mm.Task, 'Unknown') AS name, COUNT(*) AS count
        FROM retomy.Repositories r WITH (NOLOCK)
        LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        WHERE r.RepoType = 'model' AND r.DeletedAt IS NULL AND r.Private = 0
        GROUP BY mm.Task
        ORDER BY COUNT(*) DESC
    """, fetch="all")

    # Library distribution
    libraries = execute_query("""
        SELECT ISNULL(mm.Library, 'Unknown') AS name, COUNT(*) AS count
        FROM retomy.Repositories r WITH (NOLOCK)
        LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        WHERE r.RepoType = 'model' AND r.DeletedAt IS NULL AND r.Private = 0
        GROUP BY mm.Library
        ORDER BY COUNT(*) DESC
    """, fetch="all")

    # Hosting source distribution
    sources = execute_query("""
        SELECT ISNULL(mm.HostingType, 'Unknown') AS name, COUNT(*) AS count
        FROM retomy.Repositories r WITH (NOLOCK)
        LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        WHERE r.RepoType = 'model' AND r.DeletedAt IS NULL AND r.Private = 0
        GROUP BY mm.HostingType
        ORDER BY COUNT(*) DESC
    """, fetch="all")

    # Parameter size distribution (buckets)
    size_dist = execute_query("""
        SELECT
            CASE
                WHEN mm.ParameterCount IS NULL OR mm.ParameterCount = 0 THEN 'Unknown'
                WHEN mm.ParameterCount < 1000000 THEN '<1M'
                WHEN mm.ParameterCount < 100000000 THEN '1M-100M'
                WHEN mm.ParameterCount < 1000000000 THEN '100M-1B'
                WHEN mm.ParameterCount < 10000000000 THEN '1B-10B'
                WHEN mm.ParameterCount < 100000000000 THEN '10B-100B'
                ELSE '100B+'
            END AS bucket,
            COUNT(*) AS count
        FROM retomy.Repositories r WITH (NOLOCK)
        LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        WHERE r.RepoType = 'model' AND r.DeletedAt IS NULL AND r.Private = 0
        GROUP BY
            CASE
                WHEN mm.ParameterCount IS NULL OR mm.ParameterCount = 0 THEN 'Unknown'
                WHEN mm.ParameterCount < 1000000 THEN '<1M'
                WHEN mm.ParameterCount < 100000000 THEN '1M-100M'
                WHEN mm.ParameterCount < 1000000000 THEN '100M-1B'
                WHEN mm.ParameterCount < 10000000000 THEN '1B-10B'
                WHEN mm.ParameterCount < 100000000000 THEN '10B-100B'
                ELSE '100B+'
            END
        ORDER BY COUNT(*) DESC
    """, fetch="all")

    # License distribution
    licenses = execute_query("""
        SELECT ISNULL(r.LicenseType, 'Unknown') AS name, COUNT(*) AS count
        FROM retomy.Repositories r WITH (NOLOCK)
        WHERE r.RepoType = 'model' AND r.DeletedAt IS NULL AND r.Private = 0
        GROUP BY r.LicenseType
        ORDER BY COUNT(*) DESC
    """, fetch="all")

    # Total stats
    stats = execute_query("""
        SELECT
            COUNT(*) AS total_models,
            SUM(r.TotalDownloads) AS total_downloads,
            SUM(r.TotalLikes) AS total_likes,
            SUM(r.TotalViews) AS total_views,
            COUNT(DISTINCT mm.Framework) AS unique_frameworks,
            COUNT(DISTINCT mm.Task) AS unique_tasks,
            COUNT(DISTINCT mm.Library) AS unique_libraries
        FROM retomy.Repositories r WITH (NOLOCK)
        LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        WHERE r.RepoType = 'model' AND r.DeletedAt IS NULL AND r.Private = 0
    """, fetch="one")

    return {
        "frameworks": frameworks[:20],
        "tasks": tasks[:30],
        "libraries": libraries[:20],
        "sources": sources,
        "size_distribution": size_dist,
        "licenses": licenses[:20],
        "stats": stats,
    }


# ─── MODEL COMPARISON ─────────────────────────────────────────────────────────

@router.get("/compare")
async def compare_models(
    ids: str = Query(..., description="Comma-separated RepoIds (2-6)"),
):
    """Compare 2-6 models side by side."""
    id_list = [x.strip() for x in ids.split(",") if x.strip()]
    if len(id_list) < 2:
        raise HTTPException(400, "Need at least 2 model IDs")
    if len(id_list) > 6:
        raise HTTPException(400, "Max 6 models for comparison")

    placeholders = ",".join(["?"] * len(id_list))
    rows = execute_query(f"""
        SELECT r.RepoId, r.Name, r.Slug, r.Description,
               r.TotalDownloads, r.TotalLikes, r.TotalViews, r.Trending,
               r.LicenseType, r.CreatedAt, r.UpdatedAt,
               mm.Framework, mm.Task, mm.Library, mm.Architecture,
               mm.Language AS ModelLanguage, mm.BaseModel, mm.ParameterCount,
               mm.TensorType, mm.PipelineTag, mm.HostingType,
               mm.OriginalModelId, mm.GithubStars, mm.SafeTensors,
               mm.InferenceEnabled,
               u.DisplayName AS owner_name, u.Slug AS owner_slug
        FROM retomy.Repositories r WITH (NOLOCK)
        LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        LEFT JOIN retomy.Users u WITH (NOLOCK) ON u.UserId = r.OwnerId AND r.OwnerType = 'user'
        WHERE r.RepoId IN ({placeholders}) AND r.DeletedAt IS NULL
    """, id_list, fetch="all")

    return {"models": rows, "count": len(rows)}


# ─── SIMILAR / RECOMMENDATIONS ────────────────────────────────────────────────

@router.get("/similar/{repo_id}")
async def similar_models(
    repo_id: str,
    limit: int = Query(12, ge=1, le=50),
):
    """Find models similar to a given model (same task + framework + library)."""
    # Get the reference model's metadata
    ref = execute_query("""
        SELECT mm.Task, mm.Framework, mm.Library, mm.PipelineTag
        FROM retomy.ModelMetadata mm WITH (NOLOCK)
        WHERE mm.RepoId = ?
    """, [repo_id], fetch="one")
    if not ref:
        raise HTTPException(404, "Model not found")

    # Build similarity query — score based on matching fields
    conditions = ["r.DeletedAt IS NULL", "r.RepoType = 'model'", "r.Private = 0", "r.RepoId != ?"]
    params = [repo_id]
    score_parts = []

    if ref.get("Task"):
        score_parts.append("CASE WHEN mm.Task = ? THEN 3 ELSE 0 END")
        params.append(ref["Task"])
    if ref.get("Framework"):
        score_parts.append("CASE WHEN mm.Framework = ? THEN 2 ELSE 0 END")
        params.append(ref["Framework"])
    if ref.get("Library"):
        score_parts.append("CASE WHEN mm.Library = ? THEN 2 ELSE 0 END")
        params.append(ref["Library"])
    if ref.get("PipelineTag"):
        score_parts.append("CASE WHEN mm.PipelineTag = ? THEN 1 ELSE 0 END")
        params.append(ref["PipelineTag"])

    if not score_parts:
        return {"models": [], "count": 0}

    score_expr = " + ".join(score_parts)
    where = " AND ".join(conditions)

    sql = f"""
        SELECT TOP (?)
               r.RepoId, r.Name, r.Slug, r.Description,
               r.TotalDownloads, r.TotalLikes, r.Trending,
               mm.Framework, mm.Task, mm.Library, mm.ParameterCount,
               mm.PipelineTag, mm.OriginalModelId, mm.GithubStars,
               ({score_expr}) AS similarity_score,
               u.DisplayName AS owner_name, u.Slug AS owner_slug
        FROM retomy.Repositories r WITH (NOLOCK)
        LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        LEFT JOIN retomy.Users u WITH (NOLOCK) ON u.UserId = r.OwnerId AND r.OwnerType = 'user'
        WHERE {where} AND ({score_expr}) > 0
        ORDER BY ({score_expr}) DESC, r.TotalDownloads DESC
    """
    params.append(limit)
    rows = execute_query(sql, params, fetch="all")
    return {"models": rows, "count": len(rows)}


# ─── QUALITY SCORES ───────────────────────────────────────────────────────────

@router.get("/quality-scores")
async def model_quality_scores(
    sort: str = Query("score_desc", pattern="^(score_desc|score_asc|downloads|name)$"),
    min_score: int = Query(0, ge=0, le=100),
    task: str = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """
    Calculate documentation quality scores for models.
    Score is based on: has description, has README, has task, has framework,
    has license, has parameter count, has architecture, has usage guide.
    """
    conditions = ["r.DeletedAt IS NULL", "r.RepoType = 'model'", "r.Private = 0"]
    params = []
    if task:
        conditions.append("mm.Task = ?")
        params.append(task)

    where = " AND ".join(conditions)

    sort_col = {
        "score_desc": "quality_score DESC",
        "score_asc": "quality_score ASC",
        "downloads": "TotalDownloads DESC",
        "name": "Name ASC",
    }.get(sort, "quality_score DESC")

    sql = f"""
        SELECT TOP (?) * FROM (
            SELECT r.RepoId, r.Name, r.Slug, r.Description,
               r.TotalDownloads, r.TotalLikes, r.LicenseType,
               mm.Framework, mm.Task, mm.Library, mm.Architecture,
               mm.ParameterCount, mm.PipelineTag, mm.OriginalModelId,
               mm.GithubReadme, mm.UsageGuide, mm.GithubStars,
               u.DisplayName AS owner_name, u.Slug AS owner_slug,
               (
                   CASE WHEN r.Description IS NOT NULL AND LEN(r.Description) > 10 THEN 15 ELSE 0 END +
                   CASE WHEN mm.GithubReadme IS NOT NULL AND DATALENGTH(mm.GithubReadme) > 50 THEN 20 ELSE 0 END +
                   CASE WHEN mm.Task IS NOT NULL THEN 10 ELSE 0 END +
                   CASE WHEN mm.Framework IS NOT NULL THEN 10 ELSE 0 END +
                   CASE WHEN r.LicenseType IS NOT NULL AND r.LicenseType != '' THEN 15 ELSE 0 END +
                   CASE WHEN mm.ParameterCount IS NOT NULL AND mm.ParameterCount > 0 THEN 10 ELSE 0 END +
                   CASE WHEN mm.Architecture IS NOT NULL THEN 10 ELSE 0 END +
                   CASE WHEN mm.UsageGuide IS NOT NULL AND DATALENGTH(mm.UsageGuide) > 20 THEN 10 ELSE 0 END
               ) AS quality_score
            FROM retomy.Repositories r WITH (NOLOCK)
            LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
            LEFT JOIN retomy.Users u WITH (NOLOCK) ON u.UserId = r.OwnerId AND r.OwnerType = 'user'
            WHERE {where}
        ) sub
        WHERE sub.quality_score >= ?
        ORDER BY {sort_col}
    """
    params = [limit] + params + [min_score]
    rows = execute_query(sql, params, fetch="all")

    # Strip large text fields from list view
    for row in rows:
        row.pop("GithubReadme", None)
        row.pop("UsageGuide", None)

    # Compute distribution summary
    score_buckets = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
    for row in rows:
        s = row.get("quality_score", 0)
        if s >= 80:
            score_buckets["excellent"] += 1
        elif s >= 50:
            score_buckets["good"] += 1
        elif s >= 25:
            score_buckets["fair"] += 1
        else:
            score_buckets["poor"] += 1

    return {"models": rows, "count": len(rows), "distribution": score_buckets}


# ─── API EXPLORER — SCHEMA DOCS ───────────────────────────────────────────────

@router.get("/api-schema")
async def model_api_schema():
    """Return API schema documentation for the model endpoints."""
    return {
        "endpoints": [
            {
                "method": "GET", "path": "/api/v1/models",
                "description": "Browse models with filters and pagination",
                "params": [
                    {"name": "search", "type": "string", "required": False, "description": "Full-text search query"},
                    {"name": "task", "type": "string", "required": False, "description": "Filter by ML task (e.g. text-generation)"},
                    {"name": "framework", "type": "string", "required": False, "description": "Filter by framework (e.g. pytorch)"},
                    {"name": "language", "type": "string", "required": False, "description": "Filter by language"},
                    {"name": "library", "type": "string", "required": False, "description": "Filter by library (e.g. transformers)"},
                    {"name": "sort", "type": "string", "required": False, "description": "Sort: trending|downloads|likes|created|updated"},
                    {"name": "page", "type": "integer", "required": False, "description": "Page number (1-based)"},
                    {"name": "page_size", "type": "integer", "required": False, "description": "Results per page (max 100)"},
                ],
                "example_response": '{"models": [...], "total_count": 970000, "page": 1, "page_size": 20}',
            },
            {
                "method": "GET", "path": "/api/v1/models/{owner}/{slug}",
                "description": "Get full model details with metadata",
                "params": [
                    {"name": "owner", "type": "string", "required": True, "description": "Owner slug or ID"},
                    {"name": "slug", "type": "string", "required": True, "description": "Model slug"},
                ],
            },
            {
                "method": "GET", "path": "/api/v1/models/analytics/leaderboards",
                "description": "Ranked model leaderboards",
                "params": [
                    {"name": "task", "type": "string", "required": False},
                    {"name": "framework", "type": "string", "required": False},
                    {"name": "metric", "type": "string", "required": False, "description": "downloads|likes|trending|stars|params"},
                    {"name": "limit", "type": "integer", "required": False, "description": "Max results (default 50)"},
                ],
            },
            {
                "method": "GET", "path": "/api/v1/models/analytics/trends",
                "description": "Trend analytics: framework/task/library distributions, size buckets, license breakdown",
            },
            {
                "method": "GET", "path": "/api/v1/models/analytics/compare",
                "description": "Compare 2-6 models side by side",
                "params": [
                    {"name": "ids", "type": "string", "required": True, "description": "Comma-separated RepoIds"},
                ],
            },
            {
                "method": "GET", "path": "/api/v1/models/analytics/similar/{repo_id}",
                "description": "Find similar models based on task/framework/library matching",
                "params": [
                    {"name": "repo_id", "type": "string", "required": True},
                    {"name": "limit", "type": "integer", "required": False},
                ],
            },
            {
                "method": "GET", "path": "/api/v1/models/analytics/quality-scores",
                "description": "Documentation quality scores for models",
                "params": [
                    {"name": "sort", "type": "string", "required": False, "description": "score_desc|score_asc|downloads|name"},
                    {"name": "min_score", "type": "integer", "required": False, "description": "Min quality score 0-100"},
                    {"name": "task", "type": "string", "required": False},
                    {"name": "limit", "type": "integer", "required": False},
                ],
            },
            {
                "method": "GET", "path": "/api/v1/models/filters/options",
                "description": "Available filter values (tasks, frameworks, languages, categories)",
            },
        ],
        "base_url": "/api/v1",
        "auth": "Bearer token in Authorization header (optional for public endpoints)",
    }
