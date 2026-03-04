"""
retomY — Azure Blob Storage Service
"""
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions, ContentSettings
from azure.core.exceptions import HttpResponseError
from pathlib import Path
import os
from azure.storage.queue import QueueServiceClient
from datetime import datetime, timedelta, timezone
from core.config import get_settings
import structlog
import uuid

logger = structlog.get_logger()
settings = get_settings()

# Container names
CONTAINER_DATASETS = "datasets"
CONTAINER_SAMPLES = "samples"
CONTAINER_THUMBNAILS = "thumbnails"
CONTAINER_AVATARS = "avatars"
CONTAINER_EXPORTS = "exports"
CONTAINER_REPOS = "repos"

CONTAINERS = [CONTAINER_DATASETS, CONTAINER_SAMPLES, CONTAINER_THUMBNAILS, CONTAINER_AVATARS, CONTAINER_EXPORTS, CONTAINER_REPOS]


def get_blob_service_client() -> BlobServiceClient:
    """Create a BlobServiceClient for Azurite."""
    conn_str = settings.AZURE_STORAGE_CONNECTION_STRING
    if not conn_str:
        conn_str = (
            f"DefaultEndpointsProtocol=http;"
            f"AccountName={settings.AZURE_STORAGE_ACCOUNT_NAME};"
            f"AccountKey={settings.AZURE_STORAGE_ACCOUNT_KEY};"
            f"BlobEndpoint={settings.AZURE_BLOB_ENDPOINT};"
            f"QueueEndpoint={settings.AZURE_QUEUE_ENDPOINT};"
            f"TableEndpoint={settings.AZURE_TABLE_ENDPOINT};"
        )
    # Allow overriding API version for Azurite compatibility
    api_version = getattr(settings, "AZURE_STORAGE_API_VERSION", None)
    if api_version:
        return BlobServiceClient.from_connection_string(conn_str, api_version=api_version)
    return BlobServiceClient.from_connection_string(conn_str)


def get_queue_service_client() -> QueueServiceClient:
    """Create a QueueServiceClient for Azurite."""
    conn_str = settings.AZURE_STORAGE_CONNECTION_STRING
    if not conn_str:
        conn_str = (
            f"DefaultEndpointsProtocol=http;"
            f"AccountName={settings.AZURE_STORAGE_ACCOUNT_NAME};"
            f"AccountKey={settings.AZURE_STORAGE_ACCOUNT_KEY};"
            f"BlobEndpoint={settings.AZURE_BLOB_ENDPOINT};"
            f"QueueEndpoint={settings.AZURE_QUEUE_ENDPOINT};"
            f"TableEndpoint={settings.AZURE_TABLE_ENDPOINT};"
        )
    api_version = getattr(settings, "AZURE_STORAGE_API_VERSION", None)
    if api_version:
        return QueueServiceClient.from_connection_string(conn_str, api_version=api_version)
    return QueueServiceClient.from_connection_string(conn_str)


def ensure_containers():
    """Create all required blob containers if they don't exist."""
    try:
        client = get_blob_service_client()
        for container_name in CONTAINERS:
            try:
                container_client = client.get_container_client(container_name)
                if not container_client.exists():
                    client.create_container(container_name)
                    logger.info("container_created", container=container_name)
            except Exception as e:
                logger.warning("container_create_warning", container=container_name, error=str(e))
        logger.info("all_containers_ensured")
    except Exception as e:
        logger.error("ensure_containers_failed", error=str(e))


async def upload_blob(
    container: str,
    blob_name: str,
    data: bytes,
    content_type: str = "application/octet-stream",
    metadata: dict = None,
) -> str:
    """Upload data to a blob. Returns the blob path."""
    client = get_blob_service_client()
    blob_client = client.get_blob_client(container=container, blob=blob_name)

    try:
        blob_client.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
            metadata=metadata,
        )
        logger.info("blob_uploaded", container=container, blob=blob_name)
        # Mirror a local copy for dev so the app can serve a static URL without SAS
        try:
            static_root = Path(__file__).resolve().parent.parent / "static"
            target_path = static_root / container / blob_name
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with open(target_path, "wb") as f:
                f.write(data)
            logger.info("blob_mirrored_local", path=str(target_path))
        except Exception:
            logger.debug("blob_mirror_failed", blob=blob_name)

        return f"{container}/{blob_name}"
    except HttpResponseError as e:
        logger.warning("blob_upload_failed_azure", container=container, blob=blob_name, error=str(e))
        # Fallback for local development: write file to backend/static/<container>/<blob_name>
        static_root = Path(__file__).resolve().parent.parent / "static"
        target_path = static_root / container / blob_name
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(data)
        logger.info("blob_written_local", path=str(target_path))
        # Return a local static URL
        api_port = getattr(settings, "API_PORT", 8000)
        return f"http://127.0.0.1:{api_port}/static/{container}/{blob_name}"
    except Exception as e:
        logger.error("blob_upload_unexpected_error", error=str(e))
        raise


async def download_blob(container: str, blob_name: str) -> bytes:
    """Download a blob's content."""
    client = get_blob_service_client()
    blob_client = client.get_blob_client(container=container, blob=blob_name)
    return blob_client.download_blob().readall()


async def delete_blob(container: str, blob_name: str):
    """Delete a blob."""
    client = get_blob_service_client()
    blob_client = client.get_blob_client(container=container, blob=blob_name)
    blob_client.delete_blob()
    logger.info("blob_deleted", container=container, blob=blob_name)


def generate_presigned_url(
    container: str,
    blob_name: str,
    expiry_hours: int = 1,
    permission: str = "read",
) -> str:
    """Generate a presigned URL for blob access."""
    from azure.storage.blob import AccountSasPermissions, generate_account_sas, ResourceTypes

    sas_token = generate_blob_sas(
        account_name=settings.AZURE_STORAGE_ACCOUNT_NAME,
        container_name=container,
        blob_name=blob_name,
        account_key=settings.AZURE_STORAGE_ACCOUNT_KEY,
        permission=BlobSasPermissions(read=True) if permission == "read" else BlobSasPermissions(read=True, write=True),
        expiry=datetime.now(timezone.utc) + timedelta(hours=expiry_hours),
    )

    blob_url = f"{settings.AZURE_BLOB_ENDPOINT}/{container}/{blob_name}?{sas_token}"
    return blob_url


def generate_upload_url(container: str, blob_name: str = None, expiry_hours: int = 2) -> tuple[str, str]:
    """Generate a presigned upload URL. Returns (url, blob_name)."""
    if not blob_name:
        blob_name = f"{uuid.uuid4()}"

    url = generate_presigned_url(container, blob_name, expiry_hours, "write")
    return url, blob_name


async def list_blobs(container: str, prefix: str = None) -> list[dict]:
    """List blobs in a container."""
    client = get_blob_service_client()
    container_client = client.get_container_client(container)

    blobs = []
    for blob in container_client.list_blobs(name_starts_with=prefix):
        blobs.append({
            "name": blob.name,
            "size": blob.size,
            "content_type": blob.content_settings.content_type if blob.content_settings else None,
            "last_modified": blob.last_modified.isoformat() if blob.last_modified else None,
            "metadata": blob.metadata,
        })
    return blobs
