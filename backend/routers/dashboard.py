"""
retomY — Dashboard Router
Buyer/Seller/Admin dashboards
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from core.security import get_current_user, require_role
from core.database import execute_sp, execute_query
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def serialize_results(results):
    """Serialize datetime/decimal objects in result sets."""
    if isinstance(results, list):
        for item in results:
            if isinstance(item, dict):
                for k, v in item.items():
                    if hasattr(v, "isoformat"):
                        item[k] = v.isoformat()
                    elif hasattr(v, "__float__"):
                        item[k] = float(v)
            elif isinstance(item, list):
                serialize_results(item)
    elif isinstance(results, dict):
        for k, v in results.items():
            if hasattr(v, "isoformat"):
                results[k] = v.isoformat()
            elif hasattr(v, "__float__"):
                results[k] = float(v)
    return results


@router.get("/buyer")
async def buyer_dashboard(user: dict = Depends(get_current_user)):
    """Get buyer dashboard data."""
    try:
        results = execute_sp("retomy.sp_GetBuyerDashboard", {
            "UserId": str(user["UserId"]),
        }, fetch="multi")

        return {
            "user_summary": serialize_results(results[0][0]) if results and results[0] else {},
            "recent_purchases": serialize_results(results[1]) if len(results) > 1 else [],
            "notifications": serialize_results(results[2]) if len(results) > 2 else [],
            "wishlist_count": results[3][0].get("WishlistCount", 0) if len(results) > 3 and results[3] else 0,
        }
    except Exception as e:
        logger.error("buyer_dashboard_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to load dashboard")


@router.get("/seller")
async def seller_dashboard(
    user: dict = Depends(get_current_user),
):
    """Get seller dashboard data."""
    try:
        results = execute_sp("retomy.sp_GetSellerDashboard", {
            "SellerId": str(user["UserId"]),
        }, fetch="multi")

        return {
            "seller_summary": serialize_results(results[0][0]) if results and results[0] else {},
            "recent_sales": serialize_results(results[1]) if len(results) > 1 else [],
            "revenue_by_month": serialize_results(results[2]) if len(results) > 2 else [],
            "dataset_performance": serialize_results(results[3]) if len(results) > 3 else [],
        }
    except Exception as e:
        logger.error("seller_dashboard_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to load seller dashboard")


@router.get("/admin")
async def admin_dashboard(
    user: dict = Depends(require_role("admin", "superadmin")),
):
    """Get admin/platform dashboard data."""
    try:
        results = execute_sp("retomy.sp_GetPlatformStats", fetch="multi")

        return {
            "platform_stats": serialize_results(results[0][0]) if results and results[0] else {},
            "users_by_day": serialize_results(results[1]) if len(results) > 1 else [],
            "revenue_by_day": serialize_results(results[2]) if len(results) > 2 else [],
        }
    except Exception as e:
        logger.error("admin_dashboard_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to load admin dashboard")


@router.get("/notifications")
async def get_notifications(
    page: int = Query(1, ge=1),
    user: dict = Depends(get_current_user),
):
    """Get user notifications."""
    try:
        results = execute_sp("retomy.sp_GetNotifications", {
            "UserId": str(user["UserId"]),
            "PageSize": 20,
            "PageNumber": page,
        }, fetch="multi")

        summary = results[0][0] if results and results[0] else {"TotalCount": 0, "UnreadCount": 0}
        notifications = serialize_results(results[1]) if len(results) > 1 else []

        return {
            "total_count": summary.get("TotalCount", 0),
            "unread_count": summary.get("UnreadCount", 0),
            "notifications": notifications,
        }
    except Exception as e:
        logger.error("notifications_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to load notifications")


@router.post("/notifications/read")
async def mark_notifications_read(
    notification_id: str = Query(None),
    user: dict = Depends(get_current_user),
):
    """Mark notifications as read."""
    execute_sp("retomy.sp_MarkNotificationsRead", {
        "UserId": str(user["UserId"]),
        "NotificationId": notification_id,
    }, fetch="none")
    return {"message": "Notifications marked as read"}


@router.get("/admin/datasets/pending")
async def get_pending_datasets(
    user: dict = Depends(require_role("admin", "superadmin")),
):
    """Get datasets pending review."""
    datasets = execute_query(
        """SELECT d.DatasetId, d.Title, d.ShortDescription, d.Price, d.FileFormat,
                  d.CreatedAt, d.Status,
                  u.DisplayName AS SellerName, u.Email AS SellerEmail
           FROM retomy.Datasets d
           INNER JOIN retomy.Users u ON d.SellerId = u.UserId
           WHERE d.Status = 'pending_review' AND d.DeletedAt IS NULL
           ORDER BY d.CreatedAt ASC"""
    )
    return {"datasets": serialize_results(datasets)}


@router.post("/admin/datasets/{dataset_id}/approve")
async def approve_dataset(
    dataset_id: str,
    user: dict = Depends(require_role("admin", "superadmin")),
):
    """Approve a pending dataset for publishing."""
    execute_query(
        """UPDATE retomy.Datasets SET Status = 'published', PublishedAt = SYSUTCDATETIME(),
           UpdatedAt = SYSUTCDATETIME() WHERE DatasetId = ? AND Status = 'pending_review'""",
        [dataset_id], fetch="none"
    )

    # Notify seller
    seller = execute_query(
        "SELECT SellerId, Title FROM retomy.Datasets WHERE DatasetId = ?",
        [dataset_id], fetch="one"
    )
    if seller:
        execute_query(
            """INSERT INTO retomy.Notifications (UserId, Type, Title, Message, ActionUrl)
               VALUES (?, 'system', 'Dataset Approved', ?, ?)""",
            [str(seller["SellerId"]), f'Your dataset "{seller["Title"]}" has been approved and published!',
             f'/datasets/{dataset_id}'], fetch="none"
        )

    return {"message": "Dataset approved and published"}


@router.post("/admin/datasets/{dataset_id}/reject")
async def reject_dataset(
    dataset_id: str,
    reason: str = Query(...),
    user: dict = Depends(require_role("admin", "superadmin")),
):
    """Reject a pending dataset."""
    execute_query(
        """UPDATE retomy.Datasets SET Status = 'draft', ReviewNotes = ?,
           UpdatedAt = SYSUTCDATETIME() WHERE DatasetId = ?""",
        [reason, dataset_id], fetch="none"
    )
    return {"message": "Dataset rejected"}


@router.get("/admin/users")
async def admin_list_users(
    page: int = Query(1, ge=1),
    role: str = Query(None),
    user: dict = Depends(require_role("admin", "superadmin")),
):
    """List all users (admin)."""
    offset = (page - 1) * 50
    query = """SELECT UserId, Email, DisplayName, Role, CreditsBalance,
                      IsEmailVerified, IsSellerVerified, IsSuspended, CreatedAt, LastLoginAt
               FROM retomy.Users WHERE DeletedAt IS NULL"""
    params = []

    if role:
        query += " AND Role = ?"
        params.append(role)

    query += " ORDER BY CreatedAt DESC OFFSET ? ROWS FETCH NEXT 50 ROWS ONLY"
    params.append(offset)

    users = execute_query(query, params)
    return {"users": serialize_results(users)}
