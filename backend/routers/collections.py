"""
retomY — Collections Router
Curated lists of repos (like HuggingFace Collections).
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from models.hub_schemas import CreateCollectionRequest, AddCollectionItemRequest
from core.security import get_current_user, get_current_user_optional
from core.database import execute_query
from core.config import get_settings
import structlog
import uuid

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/collections", tags=["Collections"])


# ─── LIST COLLECTIONS ─────────────────────────────────────────────────────────

@router.get("")
async def list_collections(
    search: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user_optional),
):
    """Browse public collections."""
    conditions = ["c.IsPublic = 1"]
    params = []

    if search:
        conditions.append("(c.Title LIKE ? OR c.Description LIKE ?)")
        params += [f"%{search}%", f"%{search}%"]

    where = " AND ".join(conditions)
    offset = (page - 1) * page_size

    count_row = execute_query(
        f"SELECT COUNT(*) AS cnt FROM retomy.Collections c WHERE {where}",
        params[:], fetch="one",
    )
    total = count_row["cnt"] if count_row else 0

    rows = execute_query(
        f"""SELECT c.CollectionId, c.Title, c.Description, c.IsPublic, c.CreatedAt,
                   u.DisplayName AS owner_name, u.Slug AS owner_slug,
                   (SELECT COUNT(*) FROM retomy.CollectionItems ci WHERE ci.CollectionId = c.CollectionId) AS item_count
            FROM retomy.Collections c
            LEFT JOIN retomy.Users u ON u.UserId = c.OwnerId
            WHERE {where}
            ORDER BY c.CreatedAt DESC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY""",
        params + [offset, page_size], fetch="all",
    )
    return {"collections": rows, "total_count": total, "page": page}


# ─── CREATE COLLECTION ───────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_collection(body: CreateCollectionRequest, user: dict = Depends(get_current_user)):
    coll_id = str(uuid.uuid4()).upper()
    user_id = str(user["UserId"])

    execute_query(
        """INSERT INTO retomy.Collections
           (CollectionId, OwnerId, Title, Description, IsPublic)
           VALUES (?, ?, ?, ?, ?)""",
        [coll_id, user_id, body.title, body.description, 1 if body.is_public else 0],
        fetch="none",
    )
    return {"collection_id": coll_id, "message": "Collection created"}


# ─── GET COLLECTION ──────────────────────────────────────────────────────────

@router.get("/{collection_id}")
async def get_collection(collection_id: str, user: dict = Depends(get_current_user_optional)):
    coll = execute_query(
        """SELECT c.*, u.DisplayName AS owner_name, u.Slug AS owner_slug
           FROM retomy.Collections c
           LEFT JOIN retomy.Users u ON u.UserId = c.OwnerId
           WHERE c.CollectionId = ?""",
        [collection_id], fetch="one",
    )
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")

    user_id = str(user["UserId"]) if user else None
    if not coll.get("IsPublic") and str(coll.get("OwnerId")) != user_id:
        raise HTTPException(status_code=404, detail="Collection not found")

    items = execute_query(
        """SELECT ci.ItemId, ci.Note, ci.Position, ci.AddedAt,
                  r.RepoId, r.Name, r.Slug, r.RepoType, r.Description,
                  r.TotalDownloads, r.TotalLikes
           FROM retomy.CollectionItems ci
           JOIN retomy.Repositories r ON r.RepoId = ci.RepoId
           WHERE ci.CollectionId = ?
           ORDER BY ci.Position""",
        [collection_id], fetch="all",
    )
    coll["items"] = items
    return coll


# ─── ADD ITEM ─────────────────────────────────────────────────────────────────

@router.post("/{collection_id}/items", status_code=status.HTTP_201_CREATED)
async def add_item(collection_id: str, body: AddCollectionItemRequest, user: dict = Depends(get_current_user)):
    user_id = str(user["UserId"])
    coll = execute_query(
        "SELECT OwnerId FROM retomy.Collections WHERE CollectionId = ?",
        [collection_id], fetch="one",
    )
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")
    if str(coll["OwnerId"]) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Get next position
    max_pos = execute_query(
        "SELECT ISNULL(MAX(Position), 0) AS mx FROM retomy.CollectionItems WHERE CollectionId = ?",
        [collection_id], fetch="one",
    )
    pos = max_pos["mx"] + 1 if max_pos else 1

    item_id = str(uuid.uuid4()).upper()
    execute_query(
        """INSERT INTO retomy.CollectionItems
           (ItemId, CollectionId, RepoId, Note, Position)
           VALUES (?, ?, ?, ?, ?)""",
        [item_id, collection_id, body.repo_id, body.note, pos],
        fetch="none",
    )
    return {"item_id": item_id, "message": "Item added to collection"}


# ─── REMOVE ITEM ─────────────────────────────────────────────────────────────

@router.delete("/{collection_id}/items/{item_id}")
async def remove_item(collection_id: str, item_id: str, user: dict = Depends(get_current_user)):
    user_id = str(user["UserId"])
    coll = execute_query(
        "SELECT OwnerId FROM retomy.Collections WHERE CollectionId = ?",
        [collection_id], fetch="one",
    )
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")
    if str(coll["OwnerId"]) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    execute_query("DELETE FROM retomy.CollectionItems WHERE ItemId = ? AND CollectionId = ?", [item_id, collection_id], fetch="none")
    return {"message": "Item removed"}


# ─── DELETE COLLECTION ────────────────────────────────────────────────────────

@router.delete("/{collection_id}")
async def delete_collection(collection_id: str, user: dict = Depends(get_current_user)):
    user_id = str(user["UserId"])
    coll = execute_query(
        "SELECT OwnerId FROM retomy.Collections WHERE CollectionId = ?",
        [collection_id], fetch="one",
    )
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")
    if str(coll["OwnerId"]) != user_id and user.get("Role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    execute_query("DELETE FROM retomy.CollectionItems WHERE CollectionId = ?", [collection_id], fetch="none")
    execute_query("DELETE FROM retomy.Collections WHERE CollectionId = ?", [collection_id], fetch="none")
    return {"message": "Collection deleted"}
