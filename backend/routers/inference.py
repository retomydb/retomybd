"""
retomY — Inference Router
Proxy to HuggingFace Inference API so users can run models directly from the platform.

Supports multiple tasks: text-generation, text-classification, summarization,
translation, fill-mask, question-answering, image-classification, 
text-to-image, feature-extraction, zero-shot-classification,
sentence-similarity, and more.
"""

from fastapi import APIRouter, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Any
from core.config import get_settings
from core.database import execute_query
import structlog
import httpx
import asyncio
import time
import os
import json
from collections import defaultdict

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/inference", tags=["Inference"])

# ── HF API config ──────────────────────────────────────────────────────────────

HF_API_URL = "https://api-inference.huggingface.co"
HF_TOKEN = os.environ.get("HF_TOKEN", os.environ.get("HUGGING_FACE_HUB_TOKEN", ""))

# Local inference URL (self-hosted servers like text-generation-webui, TGI, etc.)
LOCAL_INFERENCE_URL = os.environ.get("LOCAL_INFERENCE_URL", "")

# Load from file if not in env
if not HF_TOKEN:
    _token_paths = [
        os.path.expanduser("~/.cache/huggingface/token"),
        os.path.join(os.path.dirname(__file__), "../../scraper/.hftoken"),
    ]
    for _p in _token_paths:
        try:
            HF_TOKEN = open(_p).read().strip()
            if HF_TOKEN:
                break
        except FileNotFoundError:
            continue

# Try huggingface_hub library as last resort
if not HF_TOKEN:
    try:
        from huggingface_hub import get_token as _hf_get_token
        HF_TOKEN = _hf_get_token() or ""
    except Exception:
        pass

# Per-model rate limiting (simple in-memory)
_rate_limits: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 30     # requests per window per model

# Shared async client — connection pooling for performance
_http_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=10.0),
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
            follow_redirects=True,
        )
    return _http_client


# ── Task → HF pipeline mapping ────────────────────────────────────────────────

SUPPORTED_TASKS = {
    "text-generation": {
        "label": "Text Generation",
        "input_type": "text",
        "description": "Generate text from a prompt",
        "default_params": {"max_new_tokens": 200, "temperature": 0.7, "top_p": 0.9},
    },
    "text2text-generation": {
        "label": "Text-to-Text Generation",
        "input_type": "text",
        "description": "Transform text (translate, summarize, etc.)",
        "default_params": {"max_new_tokens": 200},
    },
    "summarization": {
        "label": "Summarization",
        "input_type": "text",
        "description": "Summarize long text",
        "default_params": {"max_length": 150, "min_length": 30},
    },
    "text-classification": {
        "label": "Text Classification",
        "input_type": "text",
        "description": "Classify text into categories (sentiment, topic, etc.)",
        "default_params": {},
    },
    "token-classification": {
        "label": "Token Classification (NER)",
        "input_type": "text",
        "description": "Named entity recognition — identify people, places, orgs in text",
        "default_params": {},
    },
    "question-answering": {
        "label": "Question Answering",
        "input_type": "qa",
        "description": "Answer questions given a context paragraph",
        "default_params": {},
    },
    "fill-mask": {
        "label": "Fill Mask",
        "input_type": "text",
        "description": "Predict missing word(s) in a sentence (use [MASK])",
        "default_params": {},
    },
    "translation": {
        "label": "Translation",
        "input_type": "text",
        "description": "Translate text between languages",
        "default_params": {},
    },
    "zero-shot-classification": {
        "label": "Zero-Shot Classification",
        "input_type": "zero-shot",
        "description": "Classify text using custom labels without training",
        "default_params": {},
    },
    "feature-extraction": {
        "label": "Feature Extraction (Embeddings)",
        "input_type": "text",
        "description": "Get vector embeddings for text",
        "default_params": {},
    },
    "sentence-similarity": {
        "label": "Sentence Similarity",
        "input_type": "similarity",
        "description": "Compare how similar two texts are",
        "default_params": {},
    },
    "image-classification": {
        "label": "Image Classification",
        "input_type": "image",
        "description": "Classify images into categories",
        "default_params": {},
    },
    "object-detection": {
        "label": "Object Detection",
        "input_type": "image",
        "description": "Detect and locate objects in images",
        "default_params": {},
    },
    "image-segmentation": {
        "label": "Image Segmentation",
        "input_type": "image",
        "description": "Segment images into regions",
        "default_params": {},
    },
    "text-to-image": {
        "label": "Text to Image",
        "input_type": "text",
        "description": "Generate images from text descriptions",
        "default_params": {"num_inference_steps": 25},
    },
    "automatic-speech-recognition": {
        "label": "Speech to Text",
        "input_type": "audio",
        "description": "Transcribe spoken audio to text",
        "default_params": {},
    },
    "conversational": {
        "label": "Conversational",
        "input_type": "conversational",
        "description": "Multi-turn conversation with a model",
        "default_params": {},
    },
}


# ── Request / Response schemas ─────────────────────────────────────────────────

class InferenceRequest(BaseModel):
    inputs: Any = Field(..., description="The input payload — text string, object, or base64-encoded data")
    parameters: Optional[dict] = Field(default=None, description="Model-specific parameters (temperature, max_tokens, etc.)")
    options: Optional[dict] = Field(default=None, description="API options (wait_for_model, use_cache, etc.)")


class InferenceResponse(BaseModel):
    model_id: str
    task: str | None
    outputs: Any
    compute_time_ms: float
    cached: bool = False


# ── Helper: rate-limit check ──────────────────────────────────────────────────

def _check_rate_limit(model_id: str) -> bool:
    """Return True if request is allowed."""
    now = time.time()
    window = _rate_limits[model_id]
    # Prune old entries
    _rate_limits[model_id] = [t for t in window if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limits[model_id]) >= RATE_LIMIT_MAX:
        return False
    _rate_limits[model_id].append(now)
    return True


# ── Helper: resolve retomY slug → HF model_id ────────────────────────────────

def _resolve_model_id(owner: str, model: str) -> dict | None:
    """Look up OriginalModelId + task from the DB for an {owner}/{model} slug."""
    row = execute_query(
        """
        SELECT TOP 1
            r.RepoId,
            r.Name,
            mm.OriginalModelId,
            mm.Task,
            mm.PipelineTag,
            mm.HostingType,
            mm.Framework,
            mm.InferenceEnabled
        FROM retomy.Repositories r WITH (NOLOCK)
        LEFT JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        WHERE r.DeletedAt IS NULL
          AND r.RepoType = 'model'
          AND (
               -- Match by owner_slug / repo slug
               (r.Slug = ? AND EXISTS (
                   SELECT 1 FROM retomy.Users u WHERE u.UserId = r.OwnerId AND u.Slug = ?
               ))
               -- Or match by OriginalModelId directly
               OR mm.OriginalModelId = ?
          )
        """,
        [model, owner, f"{owner}/{model}"],
        fetch="one",
    )
    return row


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/supported-tasks")
async def list_supported_tasks():
    """List all inference tasks the platform supports."""
    return {
        "tasks": {
            k: {"label": v["label"], "input_type": v["input_type"], "description": v["description"]}
            for k, v in SUPPORTED_TASKS.items()
        },
        "total": len(SUPPORTED_TASKS),
        "hf_api_available": bool(HF_TOKEN),
    }


class SetTokenRequest(BaseModel):
    token: str = Field(..., min_length=1, description="HuggingFace API token (hf_...)")


@router.post("/set-token")
async def set_hf_token(body: SetTokenRequest):
    """Set the HuggingFace API token at runtime (admin only in production)."""
    global HF_TOKEN
    HF_TOKEN = body.token.strip()
    # Verify it works
    client = _get_client()
    try:
        resp = await client.get(
            "https://huggingface.co/api/whoami-v2",
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
        )
        if resp.status_code == 200:
            user_info = resp.json()
            return {"status": "ok", "user": user_info.get("name", "unknown"), "message": "Token set successfully"}
        else:
            HF_TOKEN = ""
            raise HTTPException(401, "Invalid token — HuggingFace rejected it")
    except httpx.HTTPError:
        return {"status": "ok", "message": "Token saved (could not verify — network issue)"}


class SetLocalURLRequest(BaseModel):
    url: str = Field(..., min_length=5, description="Local inference server URL, e.g. http://127.0.0.1:5000/api/v1/generate")


@router.post("/set-local-url")
async def set_local_inference_url(body: SetLocalURLRequest):
    """Set a runtime local inference URL for self-hosted models.

    The platform will proxy inference requests for non-HF-hosted models
    to this URL. The local server should accept a JSON payload with
    at least `model_id` and `inputs`.
    """
    global LOCAL_INFERENCE_URL
    LOCAL_INFERENCE_URL = body.url.strip()
    # Try a lightweight probe if possible
    client = _get_client()
    try:
        probe = await client.options(LOCAL_INFERENCE_URL, timeout=5.0)
        return {"status": "ok", "url": LOCAL_INFERENCE_URL, "probe_status": probe.status_code}
    except Exception:
        return {"status": "ok", "url": LOCAL_INFERENCE_URL, "probe_status": "unverified"}


@router.get("/status/{owner}/{model}")
async def inference_status(owner: str, model: str):
    """Check if a model supports inference and what task it performs."""
    row = _resolve_model_id(owner, model)
    if not row:
        raise HTTPException(404, "Model not found")

    hf_model_id = row.get("OriginalModelId") or f"{owner}/{model}"
    task = row.get("PipelineTag") or row.get("Task")
    hosting = row.get("HostingType") or "unknown"
    inference_enabled = row.get("InferenceEnabled")

    # Only HF-hosted models are supported for inference right now
    can_infer = hosting == "huggingface" and bool(HF_TOKEN)

    task_info = SUPPORTED_TASKS.get(task, None) if task else None

    return {
        "model_id": hf_model_id,
        "hosting_type": hosting,
        "inference_available": can_infer,
        "inference_enabled_on_hf": inference_enabled,
        "task": task,
        "task_label": task_info["label"] if task_info else None,
        "input_type": task_info["input_type"] if task_info else None,
        "description": task_info["description"] if task_info else None,
        "default_parameters": task_info["default_params"] if task_info else {},
        "supported": task in SUPPORTED_TASKS if task else False,
    }


@router.post("/run/{owner}/{model}")
async def run_inference(owner: str, model: str, body: InferenceRequest):
    """
    Run inference on a model via the HuggingFace Inference API.
    
    This proxies the request to HF's serverless inference endpoint and returns
    the result. Works with any HF-hosted model that has inference enabled.
    """
    if not HF_TOKEN:
        raise HTTPException(
            503,
            "Inference API not configured. Set HF_TOKEN environment variable with a HuggingFace API token.",
        )

    # Resolve model
    row = _resolve_model_id(owner, model)
    if not row:
        raise HTTPException(404, "Model not found in retomY database")

    hf_model_id = row.get("OriginalModelId") or f"{owner}/{model}"
    hosting = row.get("HostingType") or "unknown"

    # If HF-hosted, prefer HF API. If model is hosted elsewhere but a local
    # inference server is configured, proxy to the local server instead.
    if hosting != "huggingface":
        if not LOCAL_INFERENCE_URL:
            raise HTTPException(
                400,
                f"Inference is currently only supported for HuggingFace-hosted models or a configured local server. This model is hosted on '{hosting}'.",
            )
        # Build local payload and proxy
        local_payload = {"model_id": hf_model_id, "inputs": body.inputs}
        if body.parameters:
            local_payload["parameters"] = body.parameters
        if body.options:
            local_payload["options"] = body.options

        client = _get_client()
        t0 = time.time()
        try:
            resp = await client.post(LOCAL_INFERENCE_URL, json=local_payload)
        except httpx.TimeoutException:
            raise HTTPException(504, f"Local inference server timed out for model {hf_model_id}.")
        except httpx.ConnectError:
            raise HTTPException(502, "Could not connect to local inference server. Check server status.")

        compute_time = (time.time() - t0) * 1000

        if resp.status_code >= 400:
            try:
                err_detail = resp.json()
            except Exception:
                err_detail = resp.text[:500]
            logger.warning("local_inference_error", model=hf_model_id, status=resp.status_code, detail=err_detail)
            raise HTTPException(resp.status_code, {"error": "local_inference_error", "detail": err_detail})

        content_type = resp.headers.get("content-type", "")
        if "image" in content_type:
            return StreamingResponse(iter([resp.content]), media_type=content_type, headers={"X-Compute-Time-Ms": f"{compute_time:.0f}"})

        try:
            result = resp.json()
        except Exception:
            result = resp.text

        asyncio.create_task(_track_inference_usage(row.get("RepoId"), hf_model_id, task, compute_time))

        return InferenceResponse(model_id=hf_model_id, task=task or None, outputs=result, compute_time_ms=round(compute_time, 1), cached=False)

    # Rate limit
    if not _check_rate_limit(hf_model_id):
        raise HTTPException(
            429,
            f"Rate limit exceeded for {hf_model_id}. Max {RATE_LIMIT_MAX} requests per {RATE_LIMIT_WINDOW}s.",
        )

    task = row.get("PipelineTag") or row.get("Task") or ""

    # Build request payload
    payload: dict[str, Any] = {"inputs": body.inputs}
    if body.parameters:
        payload["parameters"] = body.parameters
    else:
        # Apply sane defaults for the task
        task_info = SUPPORTED_TASKS.get(task)
        if task_info and task_info["default_params"]:
            payload["parameters"] = task_info["default_params"]

    options = body.options or {}
    options.setdefault("wait_for_model", True)
    options.setdefault("use_cache", True)
    payload["options"] = options

    # Call HF Inference API
    url = f"{HF_API_URL}/models/{hf_model_id}"
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json",
    }

    t0 = time.time()
    client = _get_client()

    try:
        resp = await client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException:
        raise HTTPException(504, f"HuggingFace API timed out for model {hf_model_id}. The model may be loading — try again in a minute.")
    except httpx.ConnectError:
        raise HTTPException(502, "Could not connect to HuggingFace Inference API. Check network connectivity.")

    compute_time = (time.time() - t0) * 1000  # ms

    # Handle HF error responses
    if resp.status_code == 503:
        # Model is loading
        try:
            err = resp.json()
            estimated_time = err.get("estimated_time", 60)
        except Exception:
            estimated_time = 60
        raise HTTPException(
            503,
            {
                "error": "model_loading",
                "message": f"Model {hf_model_id} is loading. Estimated time: {estimated_time:.0f}s.",
                "estimated_time": estimated_time,
                "retry_after": max(5, int(estimated_time)),
            },
        )

    if resp.status_code == 429:
        raise HTTPException(429, f"HuggingFace rate limit reached for {hf_model_id}. Please wait and try again.")

    if resp.status_code == 404:
        raise HTTPException(404, f"Model {hf_model_id} not found on HuggingFace or does not support inference.")

    if resp.status_code >= 400:
        try:
            err_detail = resp.json()
        except Exception:
            err_detail = resp.text[:500]
        logger.warning("hf_inference_error", model=hf_model_id, status=resp.status_code, detail=err_detail)
        raise HTTPException(resp.status_code, {"error": "hf_api_error", "detail": err_detail})

    # For text-to-image, the response is binary (image bytes)
    content_type = resp.headers.get("content-type", "")
    if "image" in content_type:
        return StreamingResponse(
            iter([resp.content]),
            media_type=content_type,
            headers={"X-Compute-Time-Ms": f"{compute_time:.0f}"},
        )

    # JSON response
    try:
        result = resp.json()
    except Exception:
        result = resp.text

    # Track usage asynchronously (fire-and-forget)
    asyncio.create_task(_track_inference_usage(row.get("RepoId"), hf_model_id, task, compute_time))

    return InferenceResponse(
        model_id=hf_model_id,
        task=task or None,
        outputs=result,
        compute_time_ms=round(compute_time, 1),
        cached="x-cache" in resp.headers,
    )


@router.post("/run-direct")
async def run_inference_direct(
    model_id: str = Query(..., description="HuggingFace model ID, e.g. 'meta-llama/Llama-3-8B'"),
    body: InferenceRequest = ...,
):
    """
    Run inference by HF model_id directly (skip DB lookup).
    Useful for models the user knows by name.
    """
    if not HF_TOKEN:
        # If HF_TOKEN not configured but a local inference URL is set, proxy there
        if not LOCAL_INFERENCE_URL:
            raise HTTPException(503, "HF_TOKEN not configured")

    if not _check_rate_limit(model_id):
        raise HTTPException(429, "Rate limit exceeded")

    payload: dict[str, Any] = {"inputs": body.inputs}
    if body.parameters:
        payload["parameters"] = body.parameters
    payload["options"] = {"wait_for_model": True, "use_cache": True, **(body.options or {})}

    url = f"{HF_API_URL}/models/{model_id}"
    headers = {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"}

    t0 = time.time()
    client = _get_client()

    # If HF_TOKEN present prefer HF API, otherwise proxy to local server if configured
    try:
        if HF_TOKEN:
            resp = await client.post(url, json=payload, headers=headers)
        else:
            # Proxy to local inference server
            resp = await client.post(LOCAL_INFERENCE_URL, json={"model_id": model_id, **payload})
    except httpx.TimeoutException:
        raise HTTPException(504, "Inference API timed out")
    except httpx.ConnectError:
        raise HTTPException(502, "Cannot reach inference API")

    compute_time = (time.time() - t0) * 1000

    if resp.status_code == 503:
        try:
            err = resp.json()
            et = err.get("estimated_time", 60)
        except Exception:
            et = 60
        raise HTTPException(503, {"error": "model_loading", "estimated_time": et})

    if resp.status_code >= 400:
        try:
            err_detail = resp.json()
        except Exception:
            err_detail = resp.text[:500]
        raise HTTPException(resp.status_code, err_detail)

    content_type = resp.headers.get("content-type", "")
    if "image" in content_type:
        return StreamingResponse(iter([resp.content]), media_type=content_type)

    try:
        result = resp.json()
    except Exception:
        result = resp.text

    return InferenceResponse(
        model_id=model_id,
        task=None,
        outputs=result,
        compute_time_ms=round(compute_time, 1),
        cached="x-cache" in resp.headers,
    )


@router.get("/popular")
async def popular_inference_models(limit: int = Query(20, ge=1, le=100)):
    """
    Return popular models that support inference — good for the "Try It" showcase.
    Filters to HF-hosted models with InferenceEnabled = 1 and a known task.
    """
    rows = execute_query(
        """
        SELECT TOP (?)
            r.Slug,
            r.Name,
            r.Description,
            r.TotalDownloads,
            r.TotalLikes,
            mm.OriginalModelId,
            mm.Task,
            mm.PipelineTag,
            mm.Framework,
            mm.ParameterCount,
            u.Slug AS owner_slug
        FROM retomy.Repositories r WITH (NOLOCK)
        JOIN retomy.ModelMetadata mm WITH (NOLOCK) ON mm.RepoId = r.RepoId
        LEFT JOIN retomy.Users u WITH (NOLOCK) ON u.UserId = r.OwnerId
        WHERE r.DeletedAt IS NULL
          AND r.RepoType = 'model'
          AND mm.HostingType = 'huggingface'
          AND mm.InferenceEnabled = 1
          AND COALESCE(mm.PipelineTag, mm.Task) IS NOT NULL
        ORDER BY r.TotalDownloads DESC
        """,
        [limit],
    )

    return {
        "models": [
            {
                "owner": r["owner_slug"],
                "slug": r["Slug"],
                "name": r["Name"],
                "model_id": r["OriginalModelId"],
                "task": r["PipelineTag"] or r["Task"],
                "framework": r["Framework"],
                "downloads": r["TotalDownloads"],
                "likes": r["TotalLikes"],
                "parameters": r["ParameterCount"],
                "description": (r["Description"] or "")[:200],
            }
            for r in rows
        ],
        "total": len(rows),
    }


# ── Usage tracking ────────────────────────────────────────────────────────────

async def _track_inference_usage(repo_id: str | None, model_id: str, task: str, compute_ms: float):
    """Best-effort logging of inference usage for analytics."""
    try:
        if repo_id:
            execute_query(
                """
                UPDATE retomy.Repositories
                SET TotalViews = ISNULL(TotalViews, 0) + 1
                WHERE RepoId = ?
                """,
                [repo_id],
                fetch="none",
            )
        logger.info("inference_usage", model=model_id, task=task, compute_ms=f"{compute_ms:.0f}")
    except Exception as e:
        logger.warning("inference_tracking_failed", error=str(e))
