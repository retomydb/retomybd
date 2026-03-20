"""
retomY — Agent Router
Agentic code generation: user describes what they want to build,
the agent orchestrates Ollama to generate full project files
(folders, code, configs), then lets users download as ZIP or deploy to GitHub.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Any
from core.config import get_settings
import structlog
import httpx
import json
import os
import re
import uuid
import tempfile
import shutil
import zipfile
import io
import time

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/agent", tags=["Agent"])

OLLAMA_URL = settings.OLLAMA_BASE_URL

# ── In-memory session store ───────────────────────────────────────────────────

_sessions: dict[str, dict] = {}

# ── Shared HTTP client ────────────────────────────────────────────────────────

_http_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(600.0, connect=10.0),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            follow_redirects=True,
        )
    return _http_client


# ── System prompt for structured code generation ──────────────────────────────

AGENT_SYSTEM_PROMPT = """You are an expert full-stack software engineer and project generator.
When the user describes what they want to build, you MUST generate a complete, working project.

You MUST output your response in this EXACT format — no other text outside the markers:

1. First, output a brief project description wrapped in <PROJECT_INFO> tags:
<PROJECT_INFO>
{"name": "project-name", "description": "Brief description of what this project does"}
</PROJECT_INFO>

2. Then, for EACH file in the project, output it wrapped in <FILE> tags:
<FILE path="relative/path/to/file.ext">
file content here (raw code, no escaping)
</FILE>

RULES:
- Generate ALL necessary files: source code, configs, package.json/requirements.txt, README.md, .gitignore, etc.
- Use modern best practices and proper project structure
- Include proper error handling and logging
- Include helpful comments in the code
- Make the project ready to run with clear setup instructions in README.md
- Use the appropriate language/framework based on the user's request
- If unspecified, default to a modern stack (React + TypeScript for frontend, Python/FastAPI or Node/Express for backend)
- Generate file paths using forward slashes (/)
- Do NOT wrap code in markdown code blocks — output raw file content between the FILE tags
- Generate a complete, working project — do not skip files or leave placeholders

Remember: Your ENTIRE response must consist of <PROJECT_INFO>...</PROJECT_INFO> followed by one or more <FILE path="...">...</FILE> blocks. Nothing else."""


# ── Request/Response schemas ──────────────────────────────────────────────────

class AgentGenerateRequest(BaseModel):
    model: str = Field(..., description="Ollama model to use for generation")
    prompt: str = Field(..., description="Description of what to build")
    temperature: float = Field(0.3, ge=0, le=2)
    max_tokens: int = Field(8192, ge=256, le=65536)
    follow_up: Optional[str] = Field(None, description="Follow-up instruction to modify existing project")
    session_id: Optional[str] = Field(None, description="Session ID for follow-up requests")


class AgentDeployRequest(BaseModel):
    session_id: str
    repo_name: str
    github_token: str
    private: bool = True
    description: Optional[str] = None


class FileUpdate(BaseModel):
    path: str
    content: str


class AgentUpdateRequest(BaseModel):
    session_id: str
    files: list[FileUpdate]


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_agent_output(raw: str) -> tuple[dict, list[dict]]:
    """Parse the structured agent output into project info and files."""
    project_info = {"name": "untitled-project", "description": ""}
    files = []

    # Extract project info
    info_match = re.search(r'<PROJECT_INFO>\s*(.*?)\s*</PROJECT_INFO>', raw, re.DOTALL)
    if info_match:
        try:
            project_info = json.loads(info_match.group(1).strip())
        except json.JSONDecodeError:
            # Try to extract name from the text
            project_info["description"] = info_match.group(1).strip()

    # Extract files
    file_pattern = re.compile(r'<FILE\s+path="([^"]+)">\s*(.*?)\s*</FILE>', re.DOTALL)
    for match in file_pattern.finditer(raw):
        file_path = match.group(1).strip()
        content = match.group(2)
        # Detect language from extension
        ext = os.path.splitext(file_path)[1].lstrip('.')
        lang_map = {
            'py': 'python', 'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescriptreact',
            'jsx': 'javascriptreact', 'html': 'html', 'css': 'css', 'scss': 'scss',
            'json': 'json', 'yml': 'yaml', 'yaml': 'yaml', 'md': 'markdown',
            'sh': 'shell', 'bash': 'shell', 'sql': 'sql', 'rs': 'rust',
            'go': 'go', 'java': 'java', 'cpp': 'cpp', 'c': 'c', 'h': 'c',
            'rb': 'ruby', 'php': 'php', 'swift': 'swift', 'kt': 'kotlin',
            'toml': 'toml', 'xml': 'xml', 'env': 'dotenv', 'dockerfile': 'dockerfile',
            'gitignore': 'gitignore', 'txt': 'plaintext',
        }
        language = lang_map.get(ext, 'plaintext')
        # Special cases for dotfiles
        basename = os.path.basename(file_path).lower()
        if basename == 'dockerfile':
            language = 'dockerfile'
        elif basename == '.gitignore':
            language = 'gitignore'
        elif basename == '.env' or basename == '.env.example':
            language = 'dotenv'

        files.append({
            "path": file_path,
            "content": content,
            "language": language,
        })

    return project_info, files


def detect_language(ext: str) -> str:
    """Detect language from file extension."""
    lang_map = {
        'py': 'python', 'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescriptreact',
        'jsx': 'javascriptreact', 'html': 'html', 'css': 'css', 'json': 'json',
        'md': 'markdown', 'yml': 'yaml', 'yaml': 'yaml', 'sh': 'shell',
    }
    return lang_map.get(ext.lstrip('.'), 'plaintext')


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate")
async def agent_generate(req: AgentGenerateRequest):
    """
    Generate a full project from a prompt description.
    Streams SSE events:
      - data: {"type":"chunk", "content":"..."} — raw LLM text chunks
      - data: {"type":"status", "message":"..."} — status updates
      - data: {"type":"files", "session_id":"...", "project":..., "files":[...]} — final parsed files
      - data: {"type":"error", "message":"..."} — if something goes wrong
    """
    client = _get_client()

    # If follow-up, include existing files as context
    messages = [{"role": "system", "content": AGENT_SYSTEM_PROMPT}]

    if req.session_id and req.session_id in _sessions:
        session = _sessions[req.session_id]
        # Build context of existing project
        existing_context = f"Here is the current project '{session['project']['name']}':\n\n"
        for f in session['files']:
            existing_context += f"<FILE path=\"{f['path']}\">\n{f['content']}\n</FILE>\n\n"
        messages.append({"role": "assistant", "content": existing_context})
        messages.append({"role": "user", "content": f"Modify the project with these changes: {req.prompt}"})
    else:
        messages.append({"role": "user", "content": req.prompt})

    async def event_stream():
        try:
            yield f"data: {json.dumps({'type': 'status', 'message': 'Generating project...'})}\n\n"

            # Call Ollama chat endpoint (streaming)
            resp = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": req.model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": req.temperature,
                        "num_predict": req.max_tokens,
                    },
                },
                timeout=httpx.Timeout(600.0, connect=10.0),
            )

            if resp.status_code != 200:
                error_text = resp.text
                yield f"data: {json.dumps({'type': 'error', 'message': f'Ollama error: {error_text}'})}\n\n"
                return

            accumulated = ""
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                    if chunk.get("message", {}).get("content"):
                        token = chunk["message"]["content"]
                        accumulated += token
                        yield f"data: {json.dumps({'type': 'chunk', 'content': token})}\n\n"
                    if chunk.get("done"):
                        break
                except json.JSONDecodeError:
                    continue

            yield f"data: {json.dumps({'type': 'status', 'message': 'Parsing generated files...'})}\n\n"

            # Parse the structured output
            project_info, files = parse_agent_output(accumulated)

            if not files:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No files were generated. The model may need a more specific prompt.'})}\n\n"
                return

            # Create session
            session_id = req.session_id or str(uuid.uuid4())
            _sessions[session_id] = {
                "project": project_info,
                "files": files,
                "raw_output": accumulated,
                "model": req.model,
                "prompt": req.prompt,
                "created_at": time.time(),
            }

            yield f"data: {json.dumps({'type': 'files', 'session_id': session_id, 'project': project_info, 'files': files})}\n\n"
            yield f"data: {json.dumps({'type': 'status', 'message': f'Generated {len(files)} files successfully!'})}\n\n"

        except httpx.ConnectError:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Cannot connect to Ollama. Is it running?'})}\n\n"
        except Exception as e:
            logger.error("agent_generate_error", error=str(e))
            yield f"data: {json.dumps({'type': 'error', 'message': f'Generation error: {str(e)}'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/workspace/{session_id}")
async def get_workspace(session_id: str):
    """Get the generated files for a session."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = _sessions[session_id]
    return JSONResponse({
        "session_id": session_id,
        "project": session["project"],
        "files": session["files"],
        "model": session["model"],
        "prompt": session["prompt"],
    })


@router.put("/workspace/{session_id}")
async def update_workspace(session_id: str, req: AgentUpdateRequest):
    """Update files in a workspace (user edits)."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = _sessions[session_id]
    for update in req.files:
        # Find and update existing file, or add new
        found = False
        for f in session["files"]:
            if f["path"] == update.path:
                f["content"] = update.content
                found = True
                break
        if not found:
            ext = os.path.splitext(update.path)[1].lstrip('.')
            session["files"].append({
                "path": update.path,
                "content": update.content,
                "language": detect_language(ext),
            })

    return JSONResponse({"status": "updated", "file_count": len(session["files"])})


@router.get("/download/{session_id}")
async def download_workspace(session_id: str):
    """Download the generated project as a ZIP file."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = _sessions[session_id]
    project_name = session["project"].get("name", "project")

    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file_info in session["files"]:
            file_path = os.path.join(project_name, file_info["path"])
            zf.writestr(file_path, file_info["content"])

    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{project_name}.zip"',
        },
    )


@router.post("/deploy-github")
async def deploy_to_github(req: AgentDeployRequest):
    """Deploy the generated project to a GitHub repository."""
    if req.session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = _sessions[req.session_id]

    try:
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(60.0),
            headers={
                "Authorization": f"token {req.github_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )

        # 1. Create repository
        create_resp = await client.post(
            "https://api.github.com/user/repos",
            json={
                "name": req.repo_name,
                "description": req.description or session["project"].get("description", ""),
                "private": req.private,
                "auto_init": True,
            },
        )

        if create_resp.status_code not in (201, 422):
            raise HTTPException(
                status_code=create_resp.status_code,
                detail=f"GitHub error: {create_resp.text}",
            )

        # If repo already exists (422), that's okay — we'll push to it
        if create_resp.status_code == 201:
            repo_data = create_resp.json()
            repo_full_name = repo_data["full_name"]
        else:
            # Get user info to construct repo name
            user_resp = await client.get("https://api.github.com/user")
            user_data = user_resp.json()
            repo_full_name = f"{user_data['login']}/{req.repo_name}"

        # 2. Get default branch ref
        ref_resp = await client.get(
            f"https://api.github.com/repos/{repo_full_name}/git/ref/heads/main",
        )

        if ref_resp.status_code == 200:
            base_sha = ref_resp.json()["object"]["sha"]
        else:
            # Try 'master' branch
            ref_resp = await client.get(
                f"https://api.github.com/repos/{repo_full_name}/git/ref/heads/master",
            )
            if ref_resp.status_code == 200:
                base_sha = ref_resp.json()["object"]["sha"]
            else:
                raise HTTPException(status_code=500, detail="Cannot find default branch")

        # 3. Create blobs for each file
        tree_items = []
        for file_info in session["files"]:
            import base64
            blob_resp = await client.post(
                f"https://api.github.com/repos/{repo_full_name}/git/blobs",
                json={
                    "content": base64.b64encode(file_info["content"].encode()).decode(),
                    "encoding": "base64",
                },
            )
            if blob_resp.status_code != 201:
                logger.warning("blob_create_failed", file=file_info["path"], status=blob_resp.status_code)
                continue

            tree_items.append({
                "path": file_info["path"],
                "mode": "100644",
                "type": "blob",
                "sha": blob_resp.json()["sha"],
            })

        # 4. Create tree
        tree_resp = await client.post(
            f"https://api.github.com/repos/{repo_full_name}/git/trees",
            json={
                "base_tree": base_sha,
                "tree": tree_items,
            },
        )
        if tree_resp.status_code != 201:
            raise HTTPException(status_code=500, detail=f"Tree creation failed: {tree_resp.text}")

        tree_sha = tree_resp.json()["sha"]

        # 5. Create commit
        commit_resp = await client.post(
            f"https://api.github.com/repos/{repo_full_name}/git/commits",
            json={
                "message": f"Generated by retomY Agent: {session['project'].get('name', 'project')}",
                "tree": tree_sha,
                "parents": [base_sha],
            },
        )
        if commit_resp.status_code != 201:
            raise HTTPException(status_code=500, detail=f"Commit creation failed: {commit_resp.text}")

        commit_sha = commit_resp.json()["sha"]

        # 6. Update reference
        update_resp = await client.patch(
            f"https://api.github.com/repos/{repo_full_name}/git/refs/heads/main",
            json={"sha": commit_sha},
        )
        if update_resp.status_code != 200:
            # Try master
            await client.patch(
                f"https://api.github.com/repos/{repo_full_name}/git/refs/heads/master",
                json={"sha": commit_sha},
            )

        await client.aclose()

        return JSONResponse({
            "status": "deployed",
            "repo_url": f"https://github.com/{repo_full_name}",
            "files_pushed": len(tree_items),
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error("github_deploy_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Deploy failed: {str(e)}")


@router.delete("/workspace/{session_id}")
async def delete_workspace(session_id: str):
    """Delete a workspace session."""
    if session_id in _sessions:
        del _sessions[session_id]
        return JSONResponse({"status": "deleted"})
    raise HTTPException(status_code=404, detail="Session not found")


@router.get("/sessions")
async def list_sessions():
    """List all active agent sessions."""
    return JSONResponse({
        "sessions": [
            {
                "session_id": sid,
                "project": s["project"],
                "model": s["model"],
                "file_count": len(s["files"]),
                "created_at": s["created_at"],
            }
            for sid, s in _sessions.items()
        ]
    })
