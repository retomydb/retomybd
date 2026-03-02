"""
retomY — Purchases & Cart Router
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from models.schemas import PurchaseRequest, CartItemRequest, MessageResponse
from core.security import get_current_user
from core.database import execute_sp, execute_query
from core.storage import generate_presigned_url, CONTAINER_THUMBNAILS
from urllib.parse import urlparse
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/purchases", tags=["Purchases & Cart"])


def _refresh_thumbnail_url(url: str | None) -> str | None:
    """Regenerate SAS token for a stored thumbnail URL."""
    if not url or not url.startswith("http"):
        return url
    try:
        parsed = urlparse(url)
        parts = parsed.path.lstrip("/").split("/", 1)
        if len(parts) == 2:
            remainder = parts[1]
            container_and_blob = remainder.split("/", 1)
            if len(container_and_blob) == 2:
                return generate_presigned_url(container_and_blob[0], container_and_blob[1], expiry_hours=24)
    except Exception:
        pass
    return url


@router.post("")
async def purchase_dataset(
    request: Request,
    body: PurchaseRequest,
    user: dict = Depends(get_current_user),
):
    """Purchase a dataset — handles free datasets directly, paid datasets via Stripe redirect."""
    user_id = str(user["UserId"])

    # Check if dataset is free — if so, process instantly
    dataset = execute_query(
        "SELECT DatasetId, Price, PricingModel, SellerId, Title FROM retomy.Datasets WHERE DatasetId = ? AND DeletedAt IS NULL",
        [body.dataset_id], fetch="one"
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not available for purchase")

    price = float(dataset.get("Price", 0))
    is_free = price == 0 or dataset.get("PricingModel") == "free"

    if not is_free:
        # For paid datasets, redirect to Stripe checkout
        raise HTTPException(
            status_code=402,
            detail="This is a paid dataset. Use /payments/create-checkout-session for Stripe checkout."
        )

    # Process free dataset
    ip_address = request.client.host if request.client else None

    try:
        result = execute_sp("retomy.sp_PurchaseDataset", {
            "BuyerId": user_id,
            "DatasetId": body.dataset_id,
            "PaymentMethod": "free",
            "PaymentRef": "free",
            "IpAddress": ip_address,
        }, fetch="one")

        if result:
            for k, v in result.items():
                if hasattr(v, "isoformat"):
                    result[k] = v.isoformat()
                elif hasattr(v, "__float__"):
                    result[k] = float(v)

            # Generate download URL
            if result.get("FullBlobPath"):
                parts = result["FullBlobPath"].split("/", 1)
                if len(parts) == 2:
                    result["download_url"] = generate_presigned_url(parts[0], parts[1], expiry_hours=24)

        return {"purchase": result, "message": "Access granted successfully"}
    except Exception as e:
        error_msg = str(e)
        if "not available" in error_msg:
            raise HTTPException(status_code=404, detail="Dataset not available for purchase")
        if "already purchased" in error_msg:
            raise HTTPException(status_code=409, detail="You already own this dataset")
        if "own dataset" in error_msg:
            raise HTTPException(status_code=400, detail="Cannot purchase your own dataset")
        logger.error("purchase_failed", error=error_msg)
        raise HTTPException(status_code=500, detail="Purchase failed")


@router.get("/my-purchases")
async def get_my_purchases(
    page: int = Query(1, ge=1),
    user: dict = Depends(get_current_user),
):
    """Get current user's purchase history."""
    purchases = execute_query(
        """SELECT p.PurchaseId, p.Amount, p.Currency, p.Status, p.CompletedAt, p.InvoiceNumber,
                  d.DatasetId, d.Title, d.Slug, d.ThumbnailUrl, d.FileFormat,
                  e.DownloadCount, e.LastAccessedAt, e.IsActive as EntitlementActive
           FROM retomy.Purchases p
           INNER JOIN retomy.Datasets d ON p.DatasetId = d.DatasetId
           LEFT JOIN retomy.Entitlements e ON e.PurchaseId = p.PurchaseId
           WHERE p.BuyerId = ?
           ORDER BY p.CompletedAt DESC
           OFFSET ? ROWS FETCH NEXT 20 ROWS ONLY""",
        [str(user["UserId"]), (page - 1) * 20]
    )

    for p in purchases:
        for k, v in p.items():
            if hasattr(v, "isoformat"):
                p[k] = v.isoformat()
            elif hasattr(v, "__float__"):
                p[k] = float(v)
        if "ThumbnailUrl" in p:
            p["ThumbnailUrl"] = _refresh_thumbnail_url(p["ThumbnailUrl"])

    return {"purchases": purchases}


@router.get("/{purchase_id}/download")
async def get_download_url(
    purchase_id: str,
    user: dict = Depends(get_current_user),
):
    """Get a download URL for a purchased dataset."""
    user_id = str(user["UserId"])

    purchase = execute_query(
        """SELECT p.PurchaseId, p.BuyerId, d.FullBlobPath
           FROM retomy.Purchases p
           INNER JOIN retomy.Datasets d ON p.DatasetId = d.DatasetId
           WHERE p.PurchaseId = ? AND p.BuyerId = ? AND p.Status = 'completed'""",
        [purchase_id, user_id], fetch="one"
    )

    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    if not purchase.get("FullBlobPath"):
        raise HTTPException(status_code=404, detail="Dataset file not available")

    parts = purchase["FullBlobPath"].split("/", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=500, detail="Invalid blob path")

    download_url = generate_presigned_url(parts[0], parts[1], expiry_hours=4)

    # Update download count
    execute_query(
        """UPDATE retomy.Entitlements SET DownloadCount = DownloadCount + 1,
           LastAccessedAt = SYSUTCDATETIME() WHERE PurchaseId = ?""",
        [purchase_id], fetch="none"
    )

    return {"download_url": download_url}


@router.get("/download-by-dataset/{dataset_id}")
async def download_by_dataset(
    dataset_id: str,
    user: dict = Depends(get_current_user),
):
    """Get a download URL for a dataset the user has access to (by dataset ID)."""
    user_id = str(user["UserId"])

    # Check if user owns (is seller of) this dataset
    record = execute_query(
        """SELECT d.FullBlobPath, d.SellerId, d.Title
           FROM retomy.Datasets d
           WHERE d.DatasetId = ? AND d.DeletedAt IS NULL""",
        [dataset_id], fetch="one"
    )

    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    is_owner = str(record.get("SellerId", "")) == user_id

    if not is_owner:
        # Check entitlement via purchase
        entitlement = execute_query(
            """SELECT p.PurchaseId
               FROM retomy.Purchases p
               INNER JOIN retomy.Entitlements e ON e.PurchaseId = p.PurchaseId
               WHERE p.DatasetId = ? AND p.BuyerId = ? AND p.Status = 'completed' AND e.IsActive = 1""",
            [dataset_id, user_id], fetch="one"
        )
        if not entitlement:
            raise HTTPException(status_code=403, detail="You don't have access to this dataset")

        # Update download count
        execute_query(
            """UPDATE retomy.Entitlements SET DownloadCount = DownloadCount + 1,
               LastAccessedAt = SYSUTCDATETIME() WHERE PurchaseId = ?""",
            [entitlement["PurchaseId"]], fetch="none"
        )

    if not record.get("FullBlobPath"):
        raise HTTPException(status_code=404, detail="Dataset file not available yet")

    parts = record["FullBlobPath"].split("/", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=500, detail="Invalid blob path")

    download_url = generate_presigned_url(parts[0], parts[1], expiry_hours=4)
    return {"download_url": download_url, "title": record.get("Title", "dataset")}


# =============================================================================
# CART
# =============================================================================

@router.get("/cart")
async def get_cart(user: dict = Depends(get_current_user)):
    """Get user's shopping cart."""
    items = execute_query(
        """SELECT ci.CartItemId, ci.AddedAt,
                  d.DatasetId, d.Title, d.Slug, d.ThumbnailUrl, d.Price, d.Currency, d.PricingModel,
                  u.DisplayName AS SellerName
           FROM retomy.CartItems ci
           INNER JOIN retomy.Datasets d ON ci.DatasetId = d.DatasetId
           INNER JOIN retomy.Users u ON d.SellerId = u.UserId
           WHERE ci.UserId = ?
           ORDER BY ci.AddedAt DESC""",
        [str(user["UserId"])]
    )

    total = sum(float(i.get("Price", 0)) for i in items)

    for item in items:
        for k, v in item.items():
            if hasattr(v, "isoformat"):
                item[k] = v.isoformat()
            elif hasattr(v, "__float__"):
                item[k] = float(v)

    return {"items": items, "total": total, "item_count": len(items)}


@router.post("/cart")
async def add_to_cart(
    body: CartItemRequest,
    user: dict = Depends(get_current_user),
):
    """Add a dataset to the shopping cart."""
    try:
        items = execute_sp("retomy.sp_AddToCart", {
            "UserId": str(user["UserId"]),
            "DatasetId": body.dataset_id,
        })

        for item in items:
            for k, v in item.items():
                if hasattr(v, "isoformat"):
                    item[k] = v.isoformat()
                elif hasattr(v, "__float__"):
                    item[k] = float(v)

        return {"items": items, "message": "Added to cart"}
    except Exception as e:
        error_msg = str(e)
        if "not available" in error_msg:
            raise HTTPException(status_code=404, detail="Dataset not available")
        if "already own" in error_msg:
            raise HTTPException(status_code=409, detail="You already own this dataset")
        raise HTTPException(status_code=500, detail="Failed to add to cart")


@router.delete("/cart/{dataset_id}")
async def remove_from_cart(
    dataset_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove a dataset from the cart."""
    execute_query(
        "DELETE FROM retomy.CartItems WHERE UserId = ? AND DatasetId = ?",
        [str(user["UserId"]), dataset_id], fetch="none"
    )
    return {"message": "Removed from cart"}
