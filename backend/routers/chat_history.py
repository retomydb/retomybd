"""
retomY — Chat History Router
CRUD endpoints for Ollama conversation persistence (ChatGPT-style threads).
Authenticated users can create, list, load, and delete conversations.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Optional
from core.database import execute_query, get_db
from core.security import get_current_user, get_current_user_optional
import structlog
import uuid

logger = structlog.get_logger()
router = APIRouter(prefix="/chat-history", tags=["Chat History"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateConversationRequest(BaseModel):
    model: str = Field(..., min_length=1, description="Ollama model name")
    title: Optional[str] = Field(None, max_length=300)
    system_prompt: Optional[str] = None


class SaveMessageRequest(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str = Field(..., min_length=1)
    token_count: Optional[int] = None
    duration_secs: Optional[float] = None


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=300)
    system_prompt: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(
    model: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(get_current_user),
):
    """List all conversations for the current user, newest first."""
    user_id = user.get("UserId") or user.get("user_id")
    params = [str(user_id)]
    sql = """
        SELECT
            CONVERT(NVARCHAR(36), c.ConversationId) AS conversation_id,
            c.Model AS model,
            c.Title AS title,
            c.SystemPrompt AS system_prompt,
            c.CreatedAt AS created_at,
            c.UpdatedAt AS updated_at,
            (SELECT COUNT(*) FROM retomy.OllamaMessages m
             WHERE m.ConversationId = c.ConversationId) AS message_count
        FROM retomy.OllamaConversations c
        WHERE c.UserId = ?
          AND c.DeletedAt IS NULL
    """
    if model:
        sql += " AND c.Model = ?"
        params.append(model)
    sql += " ORDER BY c.UpdatedAt DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
    params.extend([offset, limit])

    rows = execute_query(sql, params, fetch="all")
    return {"conversations": rows, "count": len(rows)}


@router.post("/conversations", status_code=201)
async def create_conversation(
    req: CreateConversationRequest,
    user: dict = Depends(get_current_user),
):
    """Create a new conversation thread."""
    user_id = user.get("UserId") or user.get("user_id")
    conv_id = str(uuid.uuid4())

    execute_query(
        """
        INSERT INTO retomy.OllamaConversations
            (ConversationId, UserId, Model, Title, SystemPrompt)
        VALUES (?, ?, ?, ?, ?)
        """,
        [conv_id, str(user_id), req.model, req.title, req.system_prompt],
        fetch="none",
    )

    return {"conversation_id": conv_id, "model": req.model, "title": req.title}


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user),
):
    """Load a conversation with all its messages."""
    user_id = user.get("UserId") or user.get("user_id")

    # Verify ownership
    conv = execute_query(
        """
        SELECT
            CONVERT(NVARCHAR(36), ConversationId) AS conversation_id,
            Model AS model,
            Title AS title,
            SystemPrompt AS system_prompt,
            CreatedAt AS created_at,
            UpdatedAt AS updated_at
        FROM retomy.OllamaConversations
        WHERE ConversationId = ? AND UserId = ? AND DeletedAt IS NULL
        """,
        [conversation_id, str(user_id)],
        fetch="one",
    )
    if not conv:
        raise HTTPException(404, "Conversation not found")

    # Fetch messages in order
    messages = execute_query(
        """
        SELECT
            CONVERT(NVARCHAR(36), MessageId) AS message_id,
            Role AS role,
            Content AS content,
            TokenCount AS token_count,
            DurationSecs AS duration_secs,
            CreatedAt AS created_at
        FROM retomy.OllamaMessages
        WHERE ConversationId = ?
        ORDER BY CreatedAt ASC
        """,
        [conversation_id],
        fetch="all",
    )

    conv["messages"] = messages
    return conv


@router.post("/conversations/{conversation_id}/messages", status_code=201)
async def add_message(
    conversation_id: str,
    req: SaveMessageRequest,
    user: dict = Depends(get_current_user),
):
    """Save a single message (user or assistant) to a conversation."""
    user_id = user.get("UserId") or user.get("user_id")

    # Verify ownership
    conv = execute_query(
        "SELECT ConversationId FROM retomy.OllamaConversations "
        "WHERE ConversationId = ? AND UserId = ? AND DeletedAt IS NULL",
        [conversation_id, str(user_id)],
        fetch="one",
    )
    if not conv:
        raise HTTPException(404, "Conversation not found")

    msg_id = str(uuid.uuid4())
    execute_query(
        """
        INSERT INTO retomy.OllamaMessages
            (MessageId, ConversationId, Role, Content, TokenCount, DurationSecs)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [msg_id, conversation_id, req.role, req.content, req.token_count, req.duration_secs],
        fetch="none",
    )

    # Update conversation timestamp + auto-title from first user message
    execute_query(
        """
        UPDATE retomy.OllamaConversations
        SET UpdatedAt = SYSUTCDATETIME(),
            Title = CASE
                WHEN Title IS NULL AND ? = 'user'
                THEN LEFT(?, 100)
                ELSE Title
            END
        WHERE ConversationId = ?
        """,
        [req.role, req.content, conversation_id],
        fetch="none",
    )

    return {"message_id": msg_id}


@router.patch("/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    req: UpdateConversationRequest,
    user: dict = Depends(get_current_user),
):
    """Update conversation title or system prompt."""
    user_id = user.get("UserId") or user.get("user_id")

    sets = []
    params = []
    if req.title is not None:
        sets.append("Title = ?")
        params.append(req.title)
    if req.system_prompt is not None:
        sets.append("SystemPrompt = ?")
        params.append(req.system_prompt)

    if not sets:
        raise HTTPException(400, "Nothing to update")

    sets.append("UpdatedAt = SYSUTCDATETIME()")
    params.extend([conversation_id, str(user_id)])

    execute_query(
        f"UPDATE retomy.OllamaConversations SET {', '.join(sets)} "
        f"WHERE ConversationId = ? AND UserId = ? AND DeletedAt IS NULL",
        params,
        fetch="none",
    )
    return {"ok": True}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user),
):
    """Soft-delete a conversation."""
    user_id = user.get("UserId") or user.get("user_id")

    execute_query(
        "UPDATE retomy.OllamaConversations SET DeletedAt = SYSUTCDATETIME() "
        "WHERE ConversationId = ? AND UserId = ? AND DeletedAt IS NULL",
        [conversation_id, str(user_id)],
        fetch="none",
    )
    return {"ok": True}
