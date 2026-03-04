"""
retomY — Discussions Router
Community discussions (PRs, issues, general) on any repository.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from models.hub_schemas import CreateDiscussionRequest, CreateCommentRequest
from core.security import get_current_user, get_current_user_optional
from core.database import execute_query
from core.config import get_settings
import structlog
import uuid

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/discussions", tags=["Discussions"])


# ─── LIST DISCUSSIONS ──────────────────────────────────────────────────────────

@router.get("/repo/{repo_id}")
async def list_discussions(
    repo_id: str,
    disc_type: str = Query(None, pattern="^(discussion|pull_request|issue)$"),
    disc_status: str = Query(None, pattern="^(open|closed|merged)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List discussions for a repo."""
    conditions = ["d.RepoId = ?"]
    params = [repo_id]

    if disc_type:
        conditions.append("d.Type = ?")
        params.append(disc_type)
    if disc_status:
        conditions.append("d.Status = ?")
        params.append(disc_status)

    where = " AND ".join(conditions)
    offset = (page - 1) * page_size

    count_row = execute_query(
        f"SELECT COUNT(*) AS cnt FROM retomy.Discussions d WHERE {where}",
        params[:], fetch="one",
    )
    total = count_row["cnt"] if count_row else 0

    rows = execute_query(
        f"""SELECT d.DiscussionId, d.Title, d.Type, d.Status, d.CreatedAt,
                   u.DisplayName AS author_name, u.Slug AS author_slug,
                   (SELECT COUNT(*) FROM retomy.DiscussionComments dc WHERE dc.DiscussionId = d.DiscussionId) AS comment_count
            FROM retomy.Discussions d
            LEFT JOIN retomy.Users u ON u.UserId = d.AuthorId
            WHERE {where}
            ORDER BY d.CreatedAt DESC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY""",
        params + [offset, page_size], fetch="all",
    )
    return {"discussions": rows, "total_count": total, "page": page}


# ─── CREATE DISCUSSION ────────────────────────────────────────────────────────

@router.post("/repo/{repo_id}", status_code=status.HTTP_201_CREATED)
async def create_discussion(
    repo_id: str,
    body: CreateDiscussionRequest,
    disc_type: str = Query("discussion", pattern="^(discussion|pull_request|issue)$"),
    user: dict = Depends(get_current_user),
):
    """Open a new discussion on a repo."""
    # Verify repo exists
    repo = execute_query(
        "SELECT RepoId FROM retomy.Repositories WHERE RepoId = ? AND DeletedAt IS NULL",
        [repo_id], fetch="one",
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    disc_id = str(uuid.uuid4()).upper()
    user_id = str(user["UserId"])

    execute_query(
        """INSERT INTO retomy.Discussions
           (DiscussionId, RepoId, AuthorId, Title, Type, Status)
           VALUES (?, ?, ?, ?, ?, 'open')""",
        [disc_id, repo_id, user_id, body.title, disc_type],
        fetch="none",
    )

    # If there's initial content, add first comment
    if body.content:
        comment_id = str(uuid.uuid4()).upper()
        execute_query(
            """INSERT INTO retomy.DiscussionComments
               (CommentId, DiscussionId, AuthorId, Content)
               VALUES (?, ?, ?, ?)""",
            [comment_id, disc_id, user_id, body.content],
            fetch="none",
        )

    return {"discussion_id": disc_id, "message": "Discussion created"}


# ─── GET DISCUSSION ───────────────────────────────────────────────────────────

@router.get("/{discussion_id}")
async def get_discussion(discussion_id: str, user: dict = Depends(get_current_user_optional)):
    """Get a discussion with its comments."""
    disc = execute_query(
        """SELECT d.*, u.DisplayName AS author_name, u.Slug AS author_slug, u.AvatarUrl
           FROM retomy.Discussions d
           LEFT JOIN retomy.Users u ON u.UserId = d.AuthorId
           WHERE d.DiscussionId = ?""",
        [discussion_id], fetch="one",
    )
    if not disc:
        raise HTTPException(status_code=404, detail="Discussion not found")

    comments = execute_query(
        """SELECT dc.CommentId, dc.Content, dc.CreatedAt, dc.UpdatedAt,
                  u.DisplayName AS author_name, u.Slug AS author_slug, u.AvatarUrl
           FROM retomy.DiscussionComments dc
           LEFT JOIN retomy.Users u ON u.UserId = dc.AuthorId
           WHERE dc.DiscussionId = ?
           ORDER BY dc.CreatedAt ASC""",
        [discussion_id], fetch="all",
    )
    disc["comments"] = comments
    return disc


# ─── ADD COMMENT ──────────────────────────────────────────────────────────────

@router.post("/{discussion_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(discussion_id: str, body: CreateCommentRequest, user: dict = Depends(get_current_user)):
    """Add a comment to a discussion."""
    disc = execute_query(
        "SELECT DiscussionId, Status FROM retomy.Discussions WHERE DiscussionId = ?",
        [discussion_id], fetch="one",
    )
    if not disc:
        raise HTTPException(status_code=404, detail="Discussion not found")

    comment_id = str(uuid.uuid4()).upper()
    user_id = str(user["UserId"])

    execute_query(
        """INSERT INTO retomy.DiscussionComments
           (CommentId, DiscussionId, AuthorId, Content)
           VALUES (?, ?, ?, ?)""",
        [comment_id, discussion_id, user_id, body.content],
        fetch="none",
    )
    return {"comment_id": comment_id, "message": "Comment added"}


# ─── CLOSE / REOPEN ──────────────────────────────────────────────────────────

@router.patch("/{discussion_id}/status")
async def update_discussion_status(
    discussion_id: str,
    new_status: str = Query(..., pattern="^(open|closed|merged)$"),
    user: dict = Depends(get_current_user),
):
    """Close, reopen, or merge a discussion."""
    disc = execute_query(
        "SELECT AuthorId, RepoId FROM retomy.Discussions WHERE DiscussionId = ?",
        [discussion_id], fetch="one",
    )
    if not disc:
        raise HTTPException(status_code=404, detail="Discussion not found")

    user_id = str(user["UserId"])
    # Author or repo owner can change status
    is_author = user_id == str(disc["AuthorId"])
    repo_owner = execute_query(
        "SELECT OwnerId FROM retomy.Repositories WHERE RepoId = ?",
        [disc["RepoId"]], fetch="one",
    )
    is_owner = repo_owner and user_id == str(repo_owner["OwnerId"])
    is_admin = user.get("Role") in ("admin", "superadmin")

    if not (is_author or is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Forbidden")

    execute_query(
        "UPDATE retomy.Discussions SET Status = ?, ClosedAt = CASE WHEN ? IN ('closed','merged') THEN SYSUTCDATETIME() ELSE NULL END WHERE DiscussionId = ?",
        [new_status, new_status, discussion_id], fetch="none",
    )
    return {"message": f"Discussion {new_status}"}
