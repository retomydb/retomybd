"""
retomY — Datasets Router
Handles CRUD, search, and management for datasets
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, UploadFile, File, Form
from models.schemas import (
    CreateDatasetRequest, UpdateDatasetRequest, DatasetListResponse,
    MessageResponse, ReviewRequest, PurchaseRequest
)
from core.security import get_current_user, get_current_user_optional
from core.database import execute_sp, execute_query
from core.storage import upload_blob, generate_presigned_url, CONTAINER_DATASETS, CONTAINER_SAMPLES, CONTAINER_THUMBNAILS
from core.config import get_settings
import structlog
import uuid
import json
from urllib.parse import urlparse
import re

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/datasets", tags=["Datasets"])


def _refresh_thumbnail_url(url: str | None) -> str | None:
    """Regenerate SAS token for a stored thumbnail URL so it stays valid."""
    if not url or not url.startswith("http"):
        return url
    try:
        parsed = urlparse(url)
        # Path looks like: /devstoreaccount1/thumbnails/<id>/thumb.png
        parts = parsed.path.lstrip("/").split("/", 1)  # ['devstoreaccount1', 'thumbnails/…']
        if len(parts) == 2:
            remainder = parts[1]  # 'thumbnails/<id>/thumb.png'
            container_and_blob = remainder.split("/", 1)
            if len(container_and_blob) == 2:
                return generate_presigned_url(container_and_blob[0], container_and_blob[1], expiry_hours=24)
    except Exception:
        pass
    return url


def _refresh_thumbnails_in_list(items: list[dict]) -> None:
    """Refresh ThumbnailUrl SAS tokens for a list of dataset dicts in-place."""
    for d in items:
        if "ThumbnailUrl" in d:
            d["ThumbnailUrl"] = _refresh_thumbnail_url(d["ThumbnailUrl"])


@router.get("")
async def search_datasets(
    query: str = Query(None),
    category_id: int = Query(None),
    min_price: float = Query(None),
    max_price: float = Query(None),
    file_format: str = Query(None),
    pricing_model: str = Query(None),
    sort_by: str = Query("relevance"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Search and browse published datasets."""
    try:
        results = execute_sp("retomy.sp_SearchDatasets", {
            "Query": query,
            "CategoryId": category_id,
            "MinPrice": min_price,
            "MaxPrice": max_price,
            "FileFormat": file_format,
            "PricingModel": pricing_model,
            "SortBy": sort_by,
            "PageNumber": page,
            "PageSize": page_size,
        }, fetch="multi")

        total_count = results[0][0]["TotalCount"] if results and results[0] else 0
        datasets = results[1] if len(results) > 1 else []

        # Serialize datetime/decimal objects
        for d in datasets:
            for k, v in d.items():
                if hasattr(v, "isoformat"):
                    d[k] = v.isoformat()
                elif hasattr(v, "__float__"):
                    d[k] = float(v)

        _refresh_thumbnails_in_list(datasets)

        return {
            "datasets": datasets,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, -(-total_count // page_size)),
        }
    except Exception as e:
        logger.error("search_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Search failed")


@router.get("/featured")
async def get_homepage_data():
    """Get homepage data: featured, trending, new arrivals, categories."""
    try:
        results = execute_sp("retomy.sp_GetHomepageData", fetch="multi")

        def serialize_list(items):
            for d in items:
                for k, v in d.items():
                    if hasattr(v, "isoformat"):
                        d[k] = v.isoformat()
                    elif hasattr(v, "__float__"):
                        d[k] = float(v)
            return items

        featured = serialize_list(results[0]) if len(results) > 0 else []
        trending = serialize_list(results[1]) if len(results) > 1 else []
        new_arrivals = serialize_list(results[2]) if len(results) > 2 else []
        _refresh_thumbnails_in_list(featured)
        _refresh_thumbnails_in_list(trending)
        _refresh_thumbnails_in_list(new_arrivals)

        return {
            "featured": featured,
            "trending": trending,
            "new_arrivals": new_arrivals,
            "categories": serialize_list(results[3]) if len(results) > 3 else [],
            "platform_stats": results[4][0] if len(results) > 4 and results[4] else {},
        }
    except Exception as e:
        logger.error("homepage_data_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to load homepage data")


@router.get("/categories")
async def get_categories():
    """Get all active categories."""
    try:
        categories = execute_query(
            "SELECT CategoryId, ParentId, Name, Slug, Description, IconUrl, SortOrder "
            "FROM retomy.Categories WHERE IsActive = 1 ORDER BY SortOrder"
        )
        return {"categories": categories}
    except Exception as e:
        logger.error("categories_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to load categories")


@router.get("/{dataset_id}")
async def get_dataset_detail(
    dataset_id: str,
    user: dict = Depends(get_current_user_optional),
):
    """Get detailed dataset information."""
    viewer_id = str(user["UserId"]) if user else None

    try:
        results = execute_sp("retomy.sp_GetDatasetDetail", {
            "DatasetId": dataset_id,
            "ViewerId": viewer_id,
        }, fetch="multi")

        if not results or not results[0]:
            raise HTTPException(status_code=404, detail="Dataset not found")

        dataset = results[0][0]
        reviews = results[1] if len(results) > 1 else []

        # Serialize
        for k, v in dataset.items():
            if hasattr(v, "isoformat"):
                dataset[k] = v.isoformat()
            elif hasattr(v, "__float__"):
                dataset[k] = float(v)

        for r in reviews:
            for k, v in r.items():
                if hasattr(v, "isoformat"):
                    r[k] = v.isoformat()
                elif hasattr(v, "__float__"):
                    r[k] = float(v)

        # Generate sample URL if available
        if dataset.get("SampleBlobPath"):
            parts = dataset["SampleBlobPath"].split("/", 1)
            if len(parts) == 2:
                dataset["sample_url"] = generate_presigned_url(parts[0], parts[1])

        # Refresh thumbnail SAS token
        if "ThumbnailUrl" in dataset:
            dataset["ThumbnailUrl"] = _refresh_thumbnail_url(dataset["ThumbnailUrl"])

        return {
            "dataset": dataset,
            "reviews": reviews,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("dataset_detail_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to load dataset")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_dataset(
    body: CreateDatasetRequest,
    user: dict = Depends(get_current_user),
):
    """Create a new dataset listing."""
    try:
        # Enforce full description minimum word count on creation
        if not body.full_description or len(re.findall(r"\w+", body.full_description)) < 100:
            raise HTTPException(status_code=400, detail="Full description must be at least 100 words")
        dataset = execute_sp("retomy.sp_CreateDataset", {
            "SellerId": str(user["UserId"]),
            "Title": body.title,
            "ShortDescription": body.short_description,
            "FullDescription": body.full_description,
            "CategoryId": body.category_id,
            "Price": body.price,
            "PricingModel": body.pricing_model,
            "LicenseType": body.license_type,
            "FileFormat": body.file_format,
            "Tags": body.tags,
        }, fetch="one")

        if dataset:
            for k, v in dataset.items():
                if hasattr(v, "isoformat"):
                    dataset[k] = v.isoformat()
                elif hasattr(v, "__float__"):
                    dataset[k] = float(v)

        return {"dataset": dataset, "message": "Dataset created successfully"}
    except Exception as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail="User not found")
        logger.error("create_dataset_failed", error=error_msg)
        raise HTTPException(status_code=500, detail="Failed to create dataset")


@router.post("/{dataset_id}/upload")
async def upload_dataset_file(
    dataset_id: str,
    file: UploadFile = File(...),
    file_category: str = Query("primary"),  # primary | sample | documentation | preview
    user: dict = Depends(get_current_user),
):
    """Upload a file to a dataset. Accepts ANY file type.

    file_category controls where the file is stored and how it's treated:
      - primary: the actual dataset (CSV, Parquet, images, videos, ZIP, etc.)
      - sample: a free preview slice buyers can download before purchase
      - documentation: README, data dictionary, methodology PDF, etc.
      - preview: screenshots, charts, images shown on the listing page
    """
    import hashlib

    user_id = str(user["UserId"])

    # Validate category
    valid_categories = ("primary", "sample", "documentation", "preview")
    if file_category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"file_category must be one of {valid_categories}")

    # Verify ownership
    dataset = execute_query(
        "SELECT SellerId, Status FROM retomy.Datasets WHERE DatasetId = ? AND DeletedAt IS NULL",
        [dataset_id], fetch="one"
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if str(dataset["SellerId"]) != user_id and user["Role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Read file — no file-type restriction; accept anything
    content = await file.read()
    file_size = len(content)

    if file_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    # Determine container and blob name
    container = CONTAINER_SAMPLES if file_category == "sample" else CONTAINER_DATASETS
    original_name = file.filename or "upload"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    blob_name = f"{dataset_id}/{uuid.uuid4()}{('.' + ext) if ext else ''}"
    content_type = file.content_type or "application/octet-stream"

    # Upload to blob storage
    blob_path = await upload_blob(container, blob_name, content, content_type, {"dataset_id": dataset_id})

    # Compute checksum
    checksum = hashlib.sha256(content).hexdigest()

    # Insert into DatasetFiles table
    file_id = str(uuid.uuid4())
    execute_query(
        """INSERT INTO retomy.DatasetFiles
           (FileId, DatasetId, FileName, BlobPath, FileSize, MimeType, FileCategory, Checksum, SortOrder)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                   ISNULL((SELECT MAX(SortOrder) + 1 FROM retomy.DatasetFiles WHERE DatasetId = ?), 0))""",
        [file_id, dataset_id, original_name, blob_path, file_size, content_type, file_category, checksum, dataset_id],
        fetch="none"
    )

    # Also update legacy columns on Datasets for backward compatibility
    if file_category == "sample":
        execute_query(
            "UPDATE retomy.Datasets SET SampleBlobPath = ?, UpdatedAt = SYSUTCDATETIME() WHERE DatasetId = ?",
            [blob_path, dataset_id], fetch="none"
        )
    elif file_category == "primary":
        # Aggregate total size of all primary files
        total = execute_query(
            "SELECT ISNULL(SUM(FileSize), 0) AS TotalSize FROM retomy.DatasetFiles WHERE DatasetId = ? AND FileCategory = 'primary'",
            [dataset_id], fetch="one"
        )
        total_size = total["TotalSize"] if total else file_size
        execute_query(
            "UPDATE retomy.Datasets SET FullBlobPath = ?, FileSize = ?, UpdatedAt = SYSUTCDATETIME() WHERE DatasetId = ?",
            [blob_path, total_size, dataset_id], fetch="none"
        )

    logger.info("dataset_file_uploaded", dataset_id=dataset_id, file_id=file_id, blob_path=blob_path, size=file_size, category=file_category)

    return {
        "message": "File uploaded successfully",
        "file_id": file_id,
        "file_name": original_name,
        "blob_path": blob_path,
        "file_size": file_size,
        "file_category": file_category,
        "content_type": content_type,
        "checksum": checksum,
    }


@router.get("/{dataset_id}/files")
async def list_dataset_files(
    dataset_id: str,
    user: dict = Depends(get_current_user_optional),
):
    """List all files attached to a dataset.
    Sellers see all files; buyers only see sample/documentation/preview.
    """
    dataset = execute_query(
        "SELECT SellerId, Status FROM retomy.Datasets WHERE DatasetId = ? AND DeletedAt IS NULL",
        [dataset_id], fetch="one"
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    is_owner = user and (str(user["UserId"]) == str(dataset["SellerId"]) or user["Role"] in ("admin", "superadmin"))

    if is_owner:
        files = execute_query(
            "SELECT FileId, FileName, BlobPath, FileSize, MimeType, FileCategory, Checksum, SortOrder, UploadedAt "
            "FROM retomy.DatasetFiles WHERE DatasetId = ? ORDER BY FileCategory, SortOrder",
            [dataset_id]
        )
    else:
        # Non-owners only see non-primary files (samples, docs, previews)
        # Include BlobPath so we can return a presigned URL for allowed preview/sample files.
        files = execute_query(
            "SELECT FileId, FileName, BlobPath, FileSize, MimeType, FileCategory, SortOrder, UploadedAt "
            "FROM retomy.DatasetFiles WHERE DatasetId = ? AND FileCategory != 'primary' ORDER BY FileCategory, SortOrder",
            [dataset_id]
        )

    for f in files:
        # Serialize datetimes
        for k, v in list(f.items()):
            if hasattr(v, "isoformat"):
                f[k] = v.isoformat()

        # If a BlobPath is present, convert it to a presigned URL so the frontend can fetch it.
        bp = f.get("BlobPath")
        if bp and isinstance(bp, str):
            if bp.startswith("http"):
                # already a full URL
                f["BlobPath"] = bp
            elif "/" in bp:
                try:
                    parts = bp.split("/", 1)
                    container = parts[0]
                    blob_name = parts[1]
                    # Only expose presigned URLs for non-primary files (samples/previews) or to owners
                    if is_owner or f.get("FileCategory") != 'primary':
                        f["BlobPath"] = generate_presigned_url(container, blob_name, expiry_hours=1)
                    else:
                        # remove raw blob path for non-authorized consumers
                        f.pop("BlobPath", None)
                except Exception:
                    # leave BlobPath as-is if presigned generation fails
                    pass

    return {"files": files, "dataset_id": dataset_id}


@router.delete("/{dataset_id}/files/{file_id}")
async def delete_dataset_file(
    dataset_id: str,
    file_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a file from a dataset."""
    from core.storage import delete_blob

    user_id = str(user["UserId"])

    dataset = execute_query(
        "SELECT SellerId FROM retomy.Datasets WHERE DatasetId = ? AND DeletedAt IS NULL",
        [dataset_id], fetch="one"
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if str(dataset["SellerId"]) != user_id and user["Role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    file_record = execute_query(
        "SELECT BlobPath, FileCategory FROM retomy.DatasetFiles WHERE FileId = ? AND DatasetId = ?",
        [file_id, dataset_id], fetch="one"
    )
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Try to delete from blob storage
    blob_path = file_record["BlobPath"]
    if "/" in blob_path and not blob_path.startswith("http"):
        parts = blob_path.split("/", 1)
        try:
            await delete_blob(parts[0], parts[1])
        except Exception:
            logger.warning("blob_delete_failed", blob_path=blob_path)

    execute_query("DELETE FROM retomy.DatasetFiles WHERE FileId = ?", [file_id], fetch="none")

    logger.info("dataset_file_deleted", dataset_id=dataset_id, file_id=file_id)
    return {"message": "File deleted"}


@router.post("/{dataset_id}/thumbnail")
async def upload_thumbnail(
    dataset_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a dataset thumbnail image."""
    user_id = str(user["UserId"])

    dataset = execute_query(
        "SELECT SellerId FROM retomy.Datasets WHERE DatasetId = ? AND DeletedAt IS NULL",
        [dataset_id], fetch="one"
    )
    if not dataset or (str(dataset["SellerId"]) != user_id and user["Role"] not in ("admin", "superadmin")):
        raise HTTPException(status_code=403, detail="Not authorized")

    content = await file.read()
    ext = file.filename.split(".")[-1].lower() if file.filename else "png"
    blob_name = f"{dataset_id}/thumb.{ext}"

    blob_path = await upload_blob(CONTAINER_THUMBNAILS, blob_name, content, file.content_type or "image/png")

    # Generate URL and update
    thumb_url = generate_presigned_url(CONTAINER_THUMBNAILS, blob_name, expiry_hours=8760)
    execute_query(
        "UPDATE retomy.Datasets SET ThumbnailUrl = ?, UpdatedAt = SYSUTCDATETIME() WHERE DatasetId = ?",
        [thumb_url, dataset_id], fetch="none"
    )

    return {"message": "Thumbnail uploaded", "thumbnail_url": thumb_url}


@router.post("/{dataset_id}/publish")
async def publish_dataset(
    dataset_id: str,
    user: dict = Depends(get_current_user),
):
    """Submit dataset for review / publish."""
    user_id = str(user["UserId"])

    dataset = execute_query(
        "SELECT SellerId, Status, FullBlobPath, FullDescription FROM retomy.Datasets WHERE DatasetId = ? AND DeletedAt IS NULL",
        [dataset_id], fetch="one"
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if str(dataset["SellerId"]) != user_id and user["Role"] not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    new_status = "published" if user["Role"] in ("admin", "superadmin") else "pending_review"

    # Require a full description of at least 100 words before allowing publish/submit for review
    full_desc = dataset.get("FullDescription") if dataset else None
    if not full_desc or len(re.findall(r"\w+", full_desc)) < 100:
        raise HTTPException(status_code=400, detail="Full description must be at least 100 words before publishing")

    execute_query(
        "UPDATE retomy.Datasets SET Status = ?, PublishedAt = CASE WHEN ? = 'published' THEN SYSUTCDATETIME() ELSE PublishedAt END, UpdatedAt = SYSUTCDATETIME() WHERE DatasetId = ?",
        [new_status, new_status, dataset_id], fetch="none"
    )

    return {"message": f"Dataset status set to '{new_status}'", "status": new_status}


@router.delete("/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    user: dict = Depends(get_current_user),
):
    """Soft-delete a dataset. Only the seller or admins may delete."""
    try:
        user_id = str(user["UserId"])
        dataset = execute_query(
            "SELECT SellerId FROM retomy.Datasets WHERE DatasetId = ? AND DeletedAt IS NULL",
            [dataset_id], fetch="one"
        )
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        if str(dataset["SellerId"]) != user_id and user["Role"] not in ("admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Not authorized")
        # Perform a full hard delete: remove related rows and try to delete blobs
        from core.storage import delete_blob

        # 1) delete blobs for dataset files (best-effort)
        try:
            files = execute_query("SELECT FileId, BlobPath FROM retomy.DatasetFiles WHERE DatasetId = ?", [dataset_id])
            for f in files:
                bp = f.get("BlobPath")
                if bp and isinstance(bp, str) and "/" in bp and not bp.startswith("http"):
                    parts = bp.split("/", 1)
                    try:
                        await delete_blob(parts[0], parts[1])
                    except Exception:
                        logger.warning("blob_delete_failed", blob_path=bp)
        except Exception:
            # continue even if we cannot enumerate files
            logger.exception("failed_enumerating_files_for_delete")

        # 2) delete dependent DB records in order (to satisfy FK constraints)
        try:
            execute_query("DELETE FROM retomy.Entitlements WHERE DatasetId = ?", [dataset_id], fetch="none")
            execute_query("DELETE FROM retomy.Purchases WHERE DatasetId = ?", [dataset_id], fetch="none")
            execute_query("DELETE FROM retomy.Reviews WHERE DatasetId = ?", [dataset_id], fetch="none")
            execute_query("DELETE FROM retomy.DatasetVersions WHERE DatasetId = ?", [dataset_id], fetch="none")
            execute_query("DELETE FROM retomy.DatasetTags WHERE DatasetId = ?", [dataset_id], fetch="none")
            execute_query("DELETE FROM retomy.Wishlists WHERE DatasetId = ?", [dataset_id], fetch="none")
            execute_query("DELETE FROM retomy.CartItems WHERE DatasetId = ?", [dataset_id], fetch="none")
            execute_query("DELETE FROM retomy.DatasetFiles WHERE DatasetId = ?", [dataset_id], fetch="none")
            # Finally delete dataset
            execute_query("DELETE FROM retomy.Datasets WHERE DatasetId = ?", [dataset_id], fetch="none")
        except Exception as e:
            logger.error("delete_dataset_db_failed", error=str(e))
            raise HTTPException(status_code=500, detail="Failed to delete dataset records")

        logger.info("dataset_hard_deleted", dataset_id=dataset_id, deleted_by=user_id)
        return {"message": "Dataset and related records deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_dataset_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete dataset")


@router.post("/{dataset_id}/reviews")
async def submit_review(
    dataset_id: str,
    body: ReviewRequest,
    user: dict = Depends(get_current_user),
):
    """Submit a review for a dataset."""
    try:
        execute_sp("retomy.sp_SubmitReview", {
            "UserId": str(user["UserId"]),
            "DatasetId": dataset_id,
            "Rating": body.rating,
            "Title": body.title,
            "Content": body.content,
        }, fetch="one")
        return {"message": "Review submitted successfully"}
    except Exception as e:
        if "UNIQUE" in str(e) or "UQ_" in str(e):
            raise HTTPException(status_code=409, detail="You have already reviewed this dataset")
        raise HTTPException(status_code=500, detail="Failed to submit review")


@router.post("/{dataset_id}/wishlist")
async def toggle_wishlist(
    dataset_id: str,
    user: dict = Depends(get_current_user),
):
    """Add or remove dataset from wishlist."""
    result = execute_sp("retomy.sp_ToggleWishlist", {
        "UserId": str(user["UserId"]),
        "DatasetId": dataset_id,
    }, fetch="one")
    return {"action": result["Action"] if result else "unknown"}
