"""
retomY — Repositories Router
Unified repository CRUD for Models, Spaces, and Dataset repos.
Does NOT touch existing Datasets table or router.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, UploadFile, File, Form
from models.hub_schemas import (
    CreateRepoRequest, UpdateRepoRequest, RepoResponse, RepoListResponse,
    CommitRequest, ModelMetadataRequest, SpaceMetadataRequest,
)
from core.security import get_current_user, get_current_user_optional
from core.database import execute_query
from core.storage import upload_blob, generate_presigned_url, list_blobs, delete_blob
from core.config import get_settings
import structlog
import uuid
import json
import re
import hashlib
from datetime import datetime, timezone

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/repos", tags=["Repositories"])

CONTAINER_REPOS = "repos"


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


# ─── LIST REPOS ────────────────────────────────────────────────────────────────

@router.get("")
async def list_repos(
    repo_type: str = Query(None, pattern="^(model|dataset|space)$"),
    search: str = Query(None),
    sort: str = Query("trending", pattern="^(trending|downloads|likes|created|updated)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    task: str = Query(None),
    framework: str = Query(None),
    language: str = Query(None),
    sdk: str = Query(None),
    user: dict = Depends(get_current_user_optional),
):
    """List / browse repositories with filters."""
    conditions = ["r.DeletedAt IS NULL"]
    params = []

    if repo_type:
        conditions.append("r.RepoType = ?")
        params.append(repo_type)

    if search:
        conditions.append("(r.Name LIKE ? OR r.Description LIKE ?)")
        params += [f"%{search}%", f"%{search}%"]

    # Privacy filter: show public repos + own private repos
    user_id = str(user["UserId"]) if user else None
    if user_id:
        conditions.append("(r.Private = 0 OR r.OwnerId = ?)")
        params.append(user_id)
    else:
        conditions.append("r.Private = 0")

    # Sub-type filters (join ModelMetadata / SpaceMetadata)
    join_model = ""
    join_space = ""
    if task or framework or language:
        join_model = "LEFT JOIN retomy.ModelMetadata mm ON mm.RepoId = r.RepoId"
        if task:
            conditions.append("mm.Task = ?")
            params.append(task)
        if framework:
            conditions.append("mm.Framework = ?")
            params.append(framework)
        if language:
            conditions.append("mm.Language = ?")
            params.append(language)

    if sdk:
        join_space = "LEFT JOIN retomy.SpaceMetadata sm ON sm.RepoId = r.RepoId"
        conditions.append("sm.Sdk = ?")
        params.append(sdk)

    sort_col = {
        "trending": "r.Trending DESC",
        "downloads": "r.TotalDownloads DESC",
        "likes": "r.TotalLikes DESC",
        "created": "r.CreatedAt DESC",
        "updated": "r.UpdatedAt DESC",
    }.get(sort, "r.Trending DESC")
    where = " AND ".join(conditions)

    # Count
    count_sql = f"""
        SELECT COUNT(*) AS cnt
        FROM retomy.Repositories r
        {join_model} {join_space}
        WHERE {where}
    """
    total = execute_query(count_sql, params, fetch="one")
    total_count = total["cnt"] if total else 0

    offset = (page - 1) * page_size
    data_sql = f"""
        SELECT r.RepoId, r.OwnerId, r.OwnerType, r.RepoType, r.Name, r.Slug,
               r.Description, r.Private, r.Gated, r.PricingModel, r.Price,
               r.LicenseType, r.Tags, r.TotalDownloads, r.TotalLikes,
               r.TotalViews, r.Trending, r.LastCommitAt, r.CreatedAt, r.UpdatedAt,
               u.DisplayName AS owner_name
        FROM retomy.Repositories r
        LEFT JOIN retomy.Users u ON u.UserId = r.OwnerId AND r.OwnerType = 'user'
        {join_model} {join_space}
        WHERE {where}
        ORDER BY {sort_col}
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    """
    params += [offset, page_size]
    rows = execute_query(data_sql, params, fetch="all")

    return {
        "repos": rows,
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
    }


# ─── CREATE REPO ──────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_repo(body: CreateRepoRequest, user: dict = Depends(get_current_user)):
    """Create a new repository (model, dataset-repo, or space)."""
    repo_id = str(uuid.uuid4()).upper()
    slug = _slugify(body.name)
    user_id = str(user["UserId"])

    # Unique slug per owner
    existing = execute_query(
        "SELECT RepoId FROM retomy.Repositories WHERE OwnerId = ? AND Slug = ? AND DeletedAt IS NULL",
        [user_id, slug], fetch="one",
    )
    if existing:
        raise HTTPException(status_code=409, detail="You already have a repo with this slug")

    execute_query(
        """INSERT INTO retomy.Repositories
           (RepoId, OwnerId, OwnerType, RepoType, Name, Slug, Description,
            Private, Gated, LicenseType, Tags, PricingModel, Price)
           VALUES (?, ?, 'user', ?, ?, ?, ?, ?, 'none', ?, ?, ?, ?)""",
        [
            repo_id, user_id, body.repo_type, body.name, slug,
            body.description, 1 if body.private else 0,
            body.license_type, body.tags,
            body.pricing_model, body.price,
        ],
        fetch="none",
    )

    return {"repo_id": repo_id, "slug": slug, "message": "Repository created"}


# ─── GET SINGLE REPO ──────────────────────────────────────────────────────────

@router.get("/{owner}/{repo_slug}")
async def get_repo(owner: str, repo_slug: str, user: dict = Depends(get_current_user_optional)):
    """Get repo detail by owner/slug."""
    row = execute_query(
        """SELECT r.*, u.DisplayName AS owner_name, u.Slug AS owner_slug
           FROM retomy.Repositories r
           LEFT JOIN retomy.Users u ON u.UserId = r.OwnerId AND r.OwnerType = 'user'
           WHERE (u.Slug = ? OR r.OwnerId = ?) AND r.Slug = ? AND r.DeletedAt IS NULL""",
        [owner, owner, repo_slug], fetch="one",
    )
    if not row:
        # Try org owner
        row = execute_query(
            """SELECT r.*, o.Name AS owner_name, o.Slug AS owner_slug
               FROM retomy.Repositories r
               LEFT JOIN retomy.Organizations o ON o.OrgId = r.OwnerId AND r.OwnerType = 'org'
               WHERE o.Slug = ? AND r.Slug = ? AND r.DeletedAt IS NULL""",
            [owner, repo_slug], fetch="one",
        )
    if not row:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Private check
    user_id = str(user["UserId"]) if user else None
    if row.get("Private") and str(row.get("OwnerId")) != user_id:
        if not (user and user.get("Role") in ("admin", "superadmin")):
            raise HTTPException(status_code=404, detail="Repository not found")

    # Increment views
    execute_query(
        "UPDATE retomy.Repositories SET TotalViews = TotalViews + 1 WHERE RepoId = ?",
        [row["RepoId"]], fetch="none",
    )

    # Extra metadata
    meta = None
    if row.get("RepoType") == "model":
        meta = execute_query(
            "SELECT * FROM retomy.ModelMetadata WHERE RepoId = ?",
            [row["RepoId"]], fetch="one",
        )
    elif row.get("RepoType") == "space":
        meta = execute_query(
            "SELECT * FROM retomy.SpaceMetadata WHERE RepoId = ?",
            [row["RepoId"]], fetch="one",
        )

    # Tags
    tags = execute_query(
        "SELECT t.Name FROM retomy.RepoTags rt JOIN retomy.Tags t ON t.TagId = rt.TagId WHERE rt.RepoId = ?",
        [row["RepoId"]], fetch="all",
    )

    # Like count from user
    liked = False
    if user_id:
        like_row = execute_query(
            "SELECT LikeId FROM retomy.Likes WHERE UserId = ? AND RepoId = ?",
            [user_id, row["RepoId"]], fetch="one",
        )
        liked = like_row is not None

    row["metadata"] = meta
    row["tags"] = [t["Name"] for t in tags] if tags else []
    row["liked_by_user"] = liked
    return row


# ─── UPDATE REPO ──────────────────────────────────────────────────────────────

@router.patch("/{repo_id}")
async def update_repo(repo_id: str, body: UpdateRepoRequest, user: dict = Depends(get_current_user)):
    """Update a repository's settings."""
    user_id = str(user["UserId"])
    repo = execute_query(
        "SELECT OwnerId FROM retomy.Repositories WHERE RepoId = ? AND DeletedAt IS NULL",
        [repo_id], fetch="one",
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if str(repo["OwnerId"]) != user_id and user.get("Role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    sets, vals = [], []
    field_map = {
        "description": "Description",
        "private": "Private",
        "gated": "Gated",
        "license_type": "LicenseType",
        "tags": "Tags",
        "pricing_model": "PricingModel",
        "price": "Price",
    }
    for py_field, col in field_map.items():
        val = getattr(body, py_field, None)
        if val is not None:
            if py_field == "private":
                val = 1 if val else 0
            sets.append(f"{col} = ?")
            vals.append(val)

    if not sets:
        return {"message": "Nothing to update"}

    sets.append("UpdatedAt = SYSUTCDATETIME()")
    vals.append(repo_id)
    execute_query(
        f"UPDATE retomy.Repositories SET {', '.join(sets)} WHERE RepoId = ?",
        vals, fetch="none",
    )
    return {"message": "Repository updated"}


# ─── DELETE (soft) ─────────────────────────────────────────────────────────────

@router.delete("/{repo_id}")
async def delete_repo(repo_id: str, user: dict = Depends(get_current_user)):
    user_id = str(user["UserId"])
    repo = execute_query(
        "SELECT OwnerId FROM retomy.Repositories WHERE RepoId = ? AND DeletedAt IS NULL",
        [repo_id], fetch="one",
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if str(repo["OwnerId"]) != user_id and user.get("Role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    execute_query(
        "UPDATE retomy.Repositories SET DeletedAt = SYSUTCDATETIME() WHERE RepoId = ?",
        [repo_id], fetch="none",
    )
    return {"message": "Repository deleted"}


# ─── FILE TREE ─────────────────────────────────────────────────────────────────

@router.get("/{repo_id}/tree")
async def repo_file_tree(repo_id: str, branch: str = Query("main"), user: dict = Depends(get_current_user_optional)):
    """List files in a repo at a given branch."""
    # Get latest commit on branch
    commit = execute_query(
        """SELECT TOP 1 CommitId FROM retomy.Commits
           WHERE RepoId = ? AND Branch = ?
           ORDER BY CommittedAt DESC""",
        [repo_id, branch], fetch="one",
    )
    if not commit:
        return {"files": [], "commit": None}

    files = execute_query(
        """SELECT rf.FileId, rf.Path, rf.SizeBytes, rf.ContentType,
                  b.Sha256, rf.CreatedAt
           FROM retomy.RepoFiles rf
           LEFT JOIN retomy.Blobs b ON b.BlobId = rf.BlobId
           WHERE rf.CommitId = ?
           ORDER BY rf.Path""",
        [commit["CommitId"]], fetch="all",
    )
    return {"files": files, "commit_id": commit["CommitId"]}


# ─── UPLOAD FILE ───────────────────────────────────────────────────────────────

@router.post("/{repo_id}/upload")
async def upload_file(
    repo_id: str,
    file: UploadFile = File(...),
    path: str = Form(...),
    message: str = Form("Upload file"),
    branch: str = Form("main"),
    user: dict = Depends(get_current_user),
):
    """Upload a file to a repo, creating a commit."""
    user_id = str(user["UserId"])
    repo = execute_query(
        "SELECT OwnerId, RepoType FROM retomy.Repositories WHERE RepoId = ? AND DeletedAt IS NULL",
        [repo_id], fetch="one",
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if str(repo["OwnerId"]) != user_id and user.get("Role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    data = await file.read()
    size = len(data)
    sha256 = hashlib.sha256(data).hexdigest()

    # Content-addressable blob
    existing_blob = execute_query(
        "SELECT BlobId FROM retomy.Blobs WHERE Sha256 = ? AND SizeBytes = ?",
        [sha256, size], fetch="one",
    )
    if existing_blob:
        blob_id = existing_blob["BlobId"]
    else:
        blob_id = str(uuid.uuid4()).upper()
        blob_name = f"{blob_id}/{file.filename}"
        blob_path = await upload_blob(CONTAINER_REPOS, blob_name, data, file.content_type or "application/octet-stream")
        execute_query(
            """INSERT INTO retomy.Blobs (BlobId, Sha256, SizeBytes, ContentType, StoragePath)
               VALUES (?, ?, ?, ?, ?)""",
            [blob_id, sha256, size, file.content_type or "application/octet-stream", blob_path],
            fetch="none",
        )

    # Create commit
    commit_id = str(uuid.uuid4()).upper()
    parent = execute_query(
        "SELECT TOP 1 CommitId FROM retomy.Commits WHERE RepoId = ? AND Branch = ? ORDER BY CommittedAt DESC",
        [repo_id, branch], fetch="one",
    )
    parent_id = parent["CommitId"] if parent else None
    execute_query(
        """INSERT INTO retomy.Commits (CommitId, RepoId, AuthorId, Message, Branch, ParentCommitId)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [commit_id, repo_id, user_id, message, branch, parent_id],
        fetch="none",
    )

    # Insert repo file
    file_id = str(uuid.uuid4()).upper()
    execute_query(
        """INSERT INTO retomy.RepoFiles (FileId, CommitId, BlobId, Path, SizeBytes, ContentType)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [file_id, commit_id, blob_id, path, size, file.content_type or "application/octet-stream"],
        fetch="none",
    )

    # Update repo timestamp
    execute_query(
        "UPDATE retomy.Repositories SET LastCommitAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE RepoId = ?",
        [repo_id], fetch="none",
    )

    return {"file_id": file_id, "commit_id": commit_id, "blob_id": blob_id, "sha256": sha256, "size": size}


# ─── DOWNLOAD FILE ─────────────────────────────────────────────────────────────

@router.get("/{repo_id}/files/{file_id}/download")
async def download_file(repo_id: str, file_id: str, user: dict = Depends(get_current_user_optional)):
    """Get presigned download URL for a repo file."""
    repo = execute_query(
        "SELECT OwnerId, Private, PricingModel, Price FROM retomy.Repositories WHERE RepoId = ? AND DeletedAt IS NULL",
        [repo_id], fetch="one",
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    user_id = str(user["UserId"]) if user else None
    is_owner = user_id and (user_id == str(repo["OwnerId"]) or user.get("Role") in ("admin", "superadmin"))

    if repo.get("Private") and not is_owner:
        raise HTTPException(status_code=403, detail="Private repo")

    # Paid repo check
    if repo.get("PricingModel") == "one_time" and not is_owner:
        if not user_id:
            raise HTTPException(status_code=401, detail="Auth required")
        purchase = execute_query(
            "SELECT PurchaseId FROM retomy.RepoPurchases WHERE RepoId = ? AND BuyerId = ? AND Status = 'completed'",
            [repo_id, user_id], fetch="one",
        )
        if not purchase:
            raise HTTPException(status_code=403, detail="Purchase required")

    file_row = execute_query(
        """SELECT rf.Path, b.StoragePath
           FROM retomy.RepoFiles rf
           JOIN retomy.Blobs b ON b.BlobId = rf.BlobId
           WHERE rf.FileId = ?""",
        [file_id], fetch="one",
    )
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")

    sp = file_row.get("StoragePath", "")
    if sp.startswith("http"):
        url = sp
    else:
        parts = sp.split("/", 1)
        url = generate_presigned_url(parts[0], parts[1], expiry_hours=4)

    # Increment downloads
    execute_query(
        "UPDATE retomy.Repositories SET TotalDownloads = TotalDownloads + 1 WHERE RepoId = ?",
        [repo_id], fetch="none",
    )

    return {"download_url": url, "file_id": file_id}


# ─── LIKE / UNLIKE ─────────────────────────────────────────────────────────────

@router.post("/{repo_id}/like")
async def toggle_like(repo_id: str, user: dict = Depends(get_current_user)):
    user_id = str(user["UserId"])
    existing = execute_query(
        "SELECT LikeId FROM retomy.Likes WHERE UserId = ? AND RepoId = ?",
        [user_id, repo_id], fetch="one",
    )
    if existing:
        execute_query("DELETE FROM retomy.Likes WHERE LikeId = ?", [existing["LikeId"]], fetch="none")
        execute_query(
            "UPDATE retomy.Repositories SET TotalLikes = CASE WHEN TotalLikes > 0 THEN TotalLikes - 1 ELSE 0 END WHERE RepoId = ?",
            [repo_id], fetch="none",
        )
        return {"liked": False}
    else:
        like_id = str(uuid.uuid4()).upper()
        execute_query(
            "INSERT INTO retomy.Likes (LikeId, UserId, RepoId) VALUES (?, ?, ?)",
            [like_id, user_id, repo_id], fetch="none",
        )
        execute_query(
            "UPDATE retomy.Repositories SET TotalLikes = TotalLikes + 1 WHERE RepoId = ?",
            [repo_id], fetch="none",
        )
        return {"liked": True}


# ─── COMMITS LOG ───────────────────────────────────────────────────────────────

@router.get("/{repo_id}/commits")
async def list_commits(repo_id: str, branch: str = Query("main"), page: int = Query(1, ge=1)):
    commits = execute_query(
        """SELECT c.CommitId, c.Message, c.Branch, c.CommittedAt,
                  u.DisplayName AS author_name
           FROM retomy.Commits c
           LEFT JOIN retomy.Users u ON u.UserId = c.AuthorId
           WHERE c.RepoId = ? AND c.Branch = ?
           ORDER BY c.CommittedAt DESC
           OFFSET ? ROWS FETCH NEXT 20 ROWS ONLY""",
        [repo_id, branch, (page - 1) * 20], fetch="all",
    )
    return {"commits": commits, "page": page}
