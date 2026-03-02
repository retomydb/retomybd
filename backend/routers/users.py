"""
retomY — Users Router
Profile management, user public profiles
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from models.schemas import UpdateProfileRequest, MessageResponse
from core.security import get_current_user
from core.database import execute_sp, execute_query
from core.storage import upload_blob, generate_presigned_url, CONTAINER_AVATARS
from core.config import get_settings
import structlog
import uuid

logger = structlog.get_logger()
router = APIRouter(prefix="/users", tags=["Users"])


@router.put("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    user: dict = Depends(get_current_user),
):
    """Update current user's profile."""
    user_id = str(user["UserId"])

    result = execute_sp("retomy.sp_UpdateUserProfile", {
        "UserId": user_id,
        "FirstName": body.first_name,
        "LastName": body.last_name,
        "DisplayName": body.display_name,
        "Bio": body.bio,
        "Company": body.company,
        "Website": body.website,
        "Location": body.location,
    }, fetch="one")

    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    # Serialize
    for k, v in result.items():
        if hasattr(v, "isoformat"):
            result[k] = v.isoformat()
        elif hasattr(v, "__float__"):
            result[k] = float(v)

    return {"user": result, "message": "Profile updated successfully"}


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload user avatar."""
    user_id = str(user["UserId"])
    content = await file.read()
    ext = file.filename.split(".")[-1].lower() if file.filename else "png"
    blob_name = f"{user_id}/avatar.{ext}"

    # Upload blob (will mirror locally on failure). The helper returns either
    # a blob path like "container/blobname" on success or a local static URL
    # (starting with http://) when Azure returned an error and we mirrored locally.
    upload_result = await upload_blob(CONTAINER_AVATARS, blob_name, content, file.content_type or "image/png")
    settings = get_settings()

    # If upload_result is already a full URL (fallback), use it directly.
    if isinstance(upload_result, str) and upload_result.startswith("http"):
        avatar_url = upload_result
    else:
        # upload_result is expected to be "container/blob_name" — generate a SAS URL
        try:
            parts = (upload_result or f"{CONTAINER_AVATARS}/{blob_name}").split('/', 1)
            container = parts[0]
            blob = parts[1] if len(parts) > 1 else blob_name
            # For avatars keep a long-lived read SAS so frontends can load images in dev
            avatar_url = generate_presigned_url(container, blob, expiry_hours=8760)
        except Exception:
            # Fallback to serving the mirrored static file from backend
            avatar_url = f"http://127.0.0.1:{settings.API_PORT}/static/{CONTAINER_AVATARS}/{blob_name}"

    execute_query(
        "UPDATE retomy.Users SET AvatarUrl = ?, UpdatedAt = SYSUTCDATETIME() WHERE UserId = ?",
        [avatar_url, user_id], fetch="none"
    )

    return {"avatar_url": avatar_url, "message": "Avatar uploaded"}


@router.get("/{user_id}/public")
async def get_public_profile(user_id: str):
    """Get a user's public profile."""
    user = execute_sp("retomy.sp_GetUserProfile", {"UserId": user_id}, fetch="one")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Serialize and filter public fields
    profile = {
        "user_id": str(user["UserId"]),
        "display_name": user.get("DisplayName"),
        "avatar_url": user.get("AvatarUrl"),
        "bio": user.get("Bio"),
        "company": user.get("Company"),
        "website": user.get("Website"),
        "location": user.get("Location"),
        "is_seller_verified": bool(user.get("IsSellerVerified", False)),
        "created_at": str(user.get("CreatedAt", "")),
        "published_datasets": user.get("PublishedDatasets", 0),
        "follower_count": user.get("FollowerCount", 0),
    }
    return {"profile": profile}


@router.post("/{user_id}/follow")
async def toggle_follow(user_id: str, user: dict = Depends(get_current_user)):
    """Follow or unfollow a user."""
    current_user_id = str(user["UserId"])
    if current_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    existing = execute_query(
        "SELECT 1 FROM retomy.Followers WHERE FollowerId = ? AND FollowingId = ?",
        [current_user_id, user_id], fetch="one"
    )

    if existing:
        execute_query(
            "DELETE FROM retomy.Followers WHERE FollowerId = ? AND FollowingId = ?",
            [current_user_id, user_id], fetch="none"
        )
        return {"action": "unfollowed"}
    else:
        execute_query(
            "INSERT INTO retomy.Followers (FollowerId, FollowingId) VALUES (?, ?)",
            [current_user_id, user_id], fetch="none"
        )
        return {"action": "followed"}
