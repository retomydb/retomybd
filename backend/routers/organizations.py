"""
retomY — Organizations Router
Team / Org management.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from models.hub_schemas import CreateOrgRequest, UpdateOrgRequest, AddOrgMemberRequest
from core.security import get_current_user, get_current_user_optional
from core.database import execute_query
from core.config import get_settings
import structlog
import uuid

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/organizations", tags=["Organizations"])


# ─── LIST ORGS ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_orgs(
    search: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List public organisations."""
    conditions = ["1=1"]
    params = []

    if search:
        conditions.append("(o.Name LIKE ? OR o.Slug LIKE ?)")
        params += [f"%{search}%", f"%{search}%"]

    where = " AND ".join(conditions)
    offset = (page - 1) * page_size

    count_row = execute_query(
        f"SELECT COUNT(*) AS cnt FROM retomy.Organizations o WHERE {where}",
        params[:], fetch="one",
    )
    total = count_row["cnt"] if count_row else 0

    rows = execute_query(
        f"""SELECT o.OrgId, o.Name, o.Slug, o.Description, o.AvatarUrl,
                   o.Website, o.Verified, o.CreatedAt,
                   (SELECT COUNT(*) FROM retomy.OrgMembers om WHERE om.OrgId = o.OrgId) AS member_count,
                   (SELECT COUNT(*) FROM retomy.Repositories r WHERE r.OwnerId = o.OrgId AND r.OwnerType = 'org' AND r.DeletedAt IS NULL) AS repo_count
            FROM retomy.Organizations o
            WHERE {where}
            ORDER BY o.CreatedAt DESC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY""",
        params + [offset, page_size], fetch="all",
    )
    return {"organizations": rows, "total_count": total, "page": page}


# ─── CREATE ORG ───────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_org(body: CreateOrgRequest, user: dict = Depends(get_current_user)):
    """Create a new organisation."""
    existing = execute_query(
        "SELECT OrgId FROM retomy.Organizations WHERE Slug = ?",
        [body.slug], fetch="one",
    )
    if existing:
        raise HTTPException(status_code=409, detail="Organization slug taken")

    org_id = str(uuid.uuid4()).upper()
    user_id = str(user["UserId"])

    execute_query(
        """INSERT INTO retomy.Organizations
           (OrgId, Name, Slug, Description, Website, CreatedById)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [org_id, body.name, body.slug, body.description, body.website, user_id],
        fetch="none",
    )

    # Creator becomes owner
    member_id = str(uuid.uuid4()).upper()
    execute_query(
        "INSERT INTO retomy.OrgMembers (MemberId, OrgId, UserId, Role) VALUES (?, ?, ?, 'owner')",
        [member_id, org_id, user_id], fetch="none",
    )

    return {"org_id": org_id, "slug": body.slug, "message": "Organization created"}


# ─── GET ORG ──────────────────────────────────────────────────────────────────

@router.get("/{slug}")
async def get_org(slug: str, user: dict = Depends(get_current_user_optional)):
    """Get organisation profile."""
    org = execute_query(
        """SELECT o.*, u.DisplayName AS created_by_name
           FROM retomy.Organizations o
           LEFT JOIN retomy.Users u ON u.UserId = o.CreatedById
           WHERE o.Slug = ?""",
        [slug], fetch="one",
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    members = execute_query(
        """SELECT om.Role, u.UserId, u.DisplayName, u.Slug AS user_slug, u.AvatarUrl
           FROM retomy.OrgMembers om
           JOIN retomy.Users u ON u.UserId = om.UserId
           WHERE om.OrgId = ?
           ORDER BY om.JoinedAt""",
        [org["OrgId"]], fetch="all",
    )

    repos = execute_query(
        """SELECT r.RepoId, r.Name, r.Slug, r.RepoType, r.Description,
                  r.TotalDownloads, r.TotalLikes, r.CreatedAt
           FROM retomy.Repositories r
           WHERE r.OwnerId = ? AND r.OwnerType = 'org' AND r.DeletedAt IS NULL
           AND r.Private = 0
           ORDER BY r.Trending DESC""",
        [org["OrgId"]], fetch="all",
    )

    org["members"] = members
    org["repos"] = repos
    return org


# ─── UPDATE ORG ───────────────────────────────────────────────────────────────

@router.patch("/{slug}")
async def update_org(slug: str, body: UpdateOrgRequest, user: dict = Depends(get_current_user)):
    """Update org profile. Owner/admin only."""
    org = execute_query("SELECT OrgId FROM retomy.Organizations WHERE Slug = ?", [slug], fetch="one")
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    user_id = str(user["UserId"])
    membership = execute_query(
        "SELECT Role FROM retomy.OrgMembers WHERE OrgId = ? AND UserId = ?",
        [org["OrgId"], user_id], fetch="one",
    )
    if not membership or membership["Role"] not in ("owner", "admin"):
        if user.get("Role") not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Forbidden")

    sets, vals = [], []
    if body.name:
        sets.append("Name = ?")
        vals.append(body.name)
    if body.description is not None:
        sets.append("Description = ?")
        vals.append(body.description)
    if body.website is not None:
        sets.append("Website = ?")
        vals.append(body.website)

    if not sets:
        return {"message": "Nothing to update"}

    vals.append(org["OrgId"])
    execute_query(f"UPDATE retomy.Organizations SET {', '.join(sets)} WHERE OrgId = ?", vals, fetch="none")
    return {"message": "Organization updated"}


# ─── ADD MEMBER ───────────────────────────────────────────────────────────────

@router.post("/{slug}/members", status_code=status.HTTP_201_CREATED)
async def add_member(slug: str, body: AddOrgMemberRequest, user: dict = Depends(get_current_user)):
    """Add a member to the org."""
    org = execute_query("SELECT OrgId FROM retomy.Organizations WHERE Slug = ?", [slug], fetch="one")
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    user_id = str(user["UserId"])
    membership = execute_query(
        "SELECT Role FROM retomy.OrgMembers WHERE OrgId = ? AND UserId = ?",
        [org["OrgId"], user_id], fetch="one",
    )
    if not membership or membership["Role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Check target user exists
    target = execute_query("SELECT UserId FROM retomy.Users WHERE UserId = ?", [body.user_id], fetch="one")
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Already member?
    already = execute_query(
        "SELECT MemberId FROM retomy.OrgMembers WHERE OrgId = ? AND UserId = ?",
        [org["OrgId"], body.user_id], fetch="one",
    )
    if already:
        raise HTTPException(status_code=409, detail="User already a member")

    member_id = str(uuid.uuid4()).upper()
    execute_query(
        "INSERT INTO retomy.OrgMembers (MemberId, OrgId, UserId, Role) VALUES (?, ?, ?, ?)",
        [member_id, org["OrgId"], body.user_id, body.role], fetch="none",
    )
    return {"message": "Member added"}


# ─── REMOVE MEMBER ───────────────────────────────────────────────────────────

@router.delete("/{slug}/members/{member_user_id}")
async def remove_member(slug: str, member_user_id: str, user: dict = Depends(get_current_user)):
    org = execute_query("SELECT OrgId FROM retomy.Organizations WHERE Slug = ?", [slug], fetch="one")
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    user_id = str(user["UserId"])
    membership = execute_query(
        "SELECT Role FROM retomy.OrgMembers WHERE OrgId = ? AND UserId = ?",
        [org["OrgId"], user_id], fetch="one",
    )
    if not membership or membership["Role"] not in ("owner", "admin"):
        if user.get("Role") not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Forbidden")

    execute_query(
        "DELETE FROM retomy.OrgMembers WHERE OrgId = ? AND UserId = ?",
        [org["OrgId"], member_user_id], fetch="none",
    )
    return {"message": "Member removed"}
