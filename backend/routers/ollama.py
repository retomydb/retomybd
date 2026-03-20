"""
retomY — Ollama Router
Proxy to a local Ollama instance (Docker container) for running large LLMs
like Llama 3, DeepSeek Coder, Qwen 2.5, etc.

The frontend never talks to Ollama directly — all requests go through this
backend proxy so we can enforce rate-limits, logging, and keep the Ollama
endpoint hidden.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Any
from core.config import get_settings
import structlog
import httpx
import json
import time
from collections import defaultdict

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/ollama", tags=["Ollama"])

OLLAMA_URL = settings.OLLAMA_BASE_URL  # e.g. http://localhost:11434

# ── Rate limiting (simple in-memory) ──────────────────────────────────────────

_rate_limits: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60   # seconds
RATE_LIMIT_MAX = 20      # requests per window per model


def _check_rate_limit(model: str) -> None:
    now = time.time()
    bucket = _rate_limits[model]
    _rate_limits[model] = [t for t in bucket if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limits[model]) >= RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for model '{model}'. Try again in a minute.",
        )
    _rate_limits[model].append(now)


# ── Shared HTTP client ────────────────────────────────────────────────────────

_http_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(300.0, connect=10.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            follow_redirects=True,
        )
    return _http_client


# ── Request schemas ───────────────────────────────────────────────────────────

class OllamaGenerateRequest(BaseModel):
    model: str = Field(..., description="Ollama model name, e.g. llama3:8b")
    prompt: str = Field(..., min_length=1)
    stream: bool = Field(False)
    system: Optional[str] = None
    temperature: Optional[float] = Field(0.7, ge=0, le=2)
    top_p: Optional[float] = Field(0.9, ge=0, le=1)
    max_tokens: Optional[int] = Field(512, ge=1, le=8192)


class OllamaChatMessage(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str


class OllamaChatRequest(BaseModel):
    model: str = Field(..., description="Ollama model name, e.g. llama3:8b")
    messages: list[OllamaChatMessage]
    stream: bool = Field(False)
    temperature: Optional[float] = Field(0.7, ge=0, le=2)
    top_p: Optional[float] = Field(0.9, ge=0, le=1)
    max_tokens: Optional[int] = Field(512, ge=1, le=8192)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/models")
async def list_ollama_models():
    """List models available in the connected Ollama instance, with load-ability check."""
    client = _get_client()
    try:
        resp = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
        models = data.get("models", [])

        # Check available system memory via Ollama's running models hint
        # Models that are too large for remaining RAM get marked as unavailable
        try:
            # Get currently loaded models to estimate available memory
            ps_resp = await client.get(f"{OLLAMA_URL}/api/ps", timeout=3.0)
            running_models = ps_resp.json().get("models", []) if ps_resp.status_code == 200 else []
        except Exception:
            running_models = []

        # Estimate available memory: total - used by system/docker (~32GB usable on 48GB)
        # Allow models up to ~36GB so 32B-param quantised models (e.g. qwen2.5-coder:32b) are selectable
        loaded_names = {m.get("name", "") for m in running_models}

        result_models = []
        for m in models:
            model_size = m.get("size", 0)
            model_name = m.get("name", "")
            # Mark as "too_large" only if model exceeds ~36GB and isn't currently loaded
            can_load = model_size < 36e9 or model_name in loaded_names
            result_models.append({
                "name": model_name,
                "model": m.get("model", m.get("name", "")),
                "size": model_size,
                "size_human": _fmt_size(model_size),
                "digest": m.get("digest", ""),
                "modified_at": m.get("modified_at", ""),
                "family": m.get("details", {}).get("family", ""),
                "parameter_size": m.get("details", {}).get("parameter_size", ""),
                "quantization": m.get("details", {}).get("quantization_level", ""),
                "can_load": can_load,
            })

        return {
            "models": result_models,
            "count": len(result_models),
            "loadable_count": sum(1 for m in result_models if m["can_load"]),
            "ollama_url": OLLAMA_URL,
        }
    except httpx.ConnectError:
        raise HTTPException(502, "Cannot reach Ollama server. Is the container running?")
    except Exception as e:
        logger.error("ollama_list_error", error=str(e))
        raise HTTPException(502, f"Ollama error: {str(e)}")


@router.get("/models/{model_name:path}/info")
async def model_info(model_name: str):
    """Get detailed info about a specific Ollama model."""
    client = _get_client()
    try:
        resp = await client.post(f"{OLLAMA_URL}/api/show", json={"name": model_name})
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(404, f"Model '{model_name}' not found in Ollama")
        raise HTTPException(502, f"Ollama error: {str(e)}")
    except httpx.ConnectError:
        raise HTTPException(502, "Cannot reach Ollama server")


@router.post("/generate")
async def generate(req: OllamaGenerateRequest):
    """Generate text (completion mode). Supports streaming."""
    _check_rate_limit(req.model)
    client = _get_client()

    payload: dict[str, Any] = {
        "model": req.model,
        "prompt": req.prompt,
        "stream": req.stream,
        "options": {},
    }
    if req.system:
        payload["system"] = req.system
    if req.temperature is not None:
        payload["options"]["temperature"] = req.temperature
    if req.top_p is not None:
        payload["options"]["top_p"] = req.top_p
    if req.max_tokens is not None:
        payload["options"]["num_predict"] = req.max_tokens

    try:
        if req.stream:
            return StreamingResponse(
                _stream_ollama(client, f"{OLLAMA_URL}/api/generate", payload),
                media_type="text/event-stream",
            )
        else:
            resp = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return {
                "response": data.get("response", ""),
                "model": data.get("model", req.model),
                "done": data.get("done", True),
                "total_duration": data.get("total_duration"),
                "eval_count": data.get("eval_count"),
                "eval_duration": data.get("eval_duration"),
            }
    except httpx.ConnectError:
        raise HTTPException(502, "Cannot reach Ollama server. Is the container running?")
    except httpx.HTTPStatusError as e:
        err_text = e.response.text[:500] if e.response else str(e)
        logger.error("ollama_generate_error", model=req.model, error=err_text)
        raise HTTPException(502, f"Ollama error: {err_text}")


@router.post("/chat")
async def chat(req: OllamaChatRequest):
    """Chat completion mode (multi-turn). Supports streaming."""
    _check_rate_limit(req.model)
    client = _get_client()

    payload: dict[str, Any] = {
        "model": req.model,
        "messages": [{"role": m.role, "content": m.content} for m in req.messages],
        "stream": req.stream,
        "options": {},
    }
    if req.temperature is not None:
        payload["options"]["temperature"] = req.temperature
    if req.top_p is not None:
        payload["options"]["top_p"] = req.top_p
    if req.max_tokens is not None:
        payload["options"]["num_predict"] = req.max_tokens

    try:
        if req.stream:
            return StreamingResponse(
                _stream_ollama(client, f"{OLLAMA_URL}/api/chat", payload),
                media_type="text/event-stream",
            )
        else:
            resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return {
                "message": data.get("message", {}),
                "model": data.get("model", req.model),
                "done": data.get("done", True),
                "total_duration": data.get("total_duration"),
                "eval_count": data.get("eval_count"),
                "eval_duration": data.get("eval_duration"),
            }
    except httpx.ConnectError:
        raise HTTPException(502, "Cannot reach Ollama server. Is the container running?")
    except httpx.HTTPStatusError as e:
        err_text = e.response.text[:500] if e.response else str(e)
        logger.error("ollama_chat_error", model=req.model, error=err_text)
        raise HTTPException(502, f"Ollama error: {err_text}")


@router.get("/health")
async def ollama_health():
    """Check if Ollama is reachable."""
    client = _get_client()
    try:
        resp = await client.get(f"{OLLAMA_URL}/api/tags")
        resp.raise_for_status()
        model_count = len(resp.json().get("models", []))
        return {"status": "ok", "ollama_url": OLLAMA_URL, "model_count": model_count}
    except Exception as e:
        return {"status": "unreachable", "ollama_url": OLLAMA_URL, "error": str(e)}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _stream_ollama(client: httpx.AsyncClient, url: str, payload: dict):
    """Stream SSE-formatted chunks from Ollama."""
    payload["stream"] = True
    async with client.stream("POST", url, json=payload) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line.strip():
                continue
            yield f"data: {line}\n\n"
    yield "data: [DONE]\n\n"


def _fmt_size(n: int) -> str:
    if n >= 1e12:
        return f"{n / 1e12:.1f} TB"
    if n >= 1e9:
        return f"{n / 1e9:.1f} GB"
    if n >= 1e6:
        return f"{n / 1e6:.0f} MB"
    return f"{n} B"
