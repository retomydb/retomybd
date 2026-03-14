"""
retomY — Enterprise Dataset Marketplace
Main FastAPI Application
"""
import sys
import os
from pathlib import Path

# Ensure backend directory is in path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse
from contextlib import asynccontextmanager
import structlog
import time

import asyncio
import concurrent.futures

from core.config import get_settings
from core.storage import ensure_containers
from routers import auth, datasets, users, purchases, dashboard, payments
from routers import repos, models, spaces, discussions, organizations, collections
from routers import model_analytics
from routers import inference
from fastapi.staticfiles import StaticFiles

settings = get_settings()
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("retomY_starting", environment=settings.ENVIRONMENT)

    # Initialize Azure Blob Storage containers (with timeout so server starts even if Azure is unreachable)
    try:
        with concurrent.futures.ThreadPoolExecutor() as pool:
            await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(pool, ensure_containers),
                timeout=10,
            )
        logger.info("azure_storage_initialized")
    except asyncio.TimeoutError:
        logger.warning("azure_storage_init_timeout", msg="Timed out after 10s — starting without Azure")
    except Exception as e:
        logger.warning("azure_storage_init_warning", error=str(e))

    yield

    logger.info("retomY_shutting_down")


# Create FastAPI app
app = FastAPI(
    title="retomY API",
    description="Enterprise Dataset Marketplace — Retomy Db",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id", "X-Response-Time"],
)


# Request logging middleware
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start_time = time.time()
    request_id = request.headers.get("X-Request-Id", str(time.time_ns()))

    response = await call_next(request)

    process_time = time.time() - start_time
    response.headers["X-Request-Id"] = request_id
    response.headers["X-Response-Time"] = f"{process_time:.4f}s"

    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration=f"{process_time:.4f}s",
    )

    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", path=request.url.path, error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal error occurred. Please try again.", "status": "error"},
    )


# Register routers
API_PREFIX = f"/api/{settings.API_VERSION}"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(datasets.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(purchases.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(payments.router, prefix=API_PREFIX)

# Hub routers (HuggingFace-style)
# inference & model_analytics MUST come before models — models has /{owner}/{slug} catch-all
app.include_router(repos.router, prefix=API_PREFIX)
app.include_router(inference.router, prefix=API_PREFIX)
app.include_router(model_analytics.router, prefix=API_PREFIX)
app.include_router(models.router, prefix=API_PREFIX)
app.include_router(spaces.router, prefix=API_PREFIX)
app.include_router(discussions.router, prefix=API_PREFIX)
app.include_router(organizations.router, prefix=API_PREFIX)
app.include_router(collections.router, prefix=API_PREFIX)

# Serve local static files (used as a fallback for Azurite in development)
static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "retomY API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/")
async def root():
    return {
        "name": "retomY",
            "tagline": "Retomy Db — Buy, Sell, and Discover Data at Scale",
        "version": "1.0.0",
        "docs": "/api/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.API_DEBUG,
    )
