"""
retomY — Hub Schemas (Repositories, Models, Spaces, Discussions, Orgs, Collections)
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# =============================================================================
# REPOSITORY
# =============================================================================

class CreateRepoRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    repo_type: str = Field(..., pattern="^(model|dataset|space)$")
    description: Optional[str] = Field(None, max_length=1000)
    private: bool = False
    license_type: Optional[str] = Field(None, max_length=50)
    tags: Optional[str] = None  # JSON array
    pricing_model: str = Field(default="free")
    price: float = Field(default=0.0, ge=0)


class UpdateRepoRequest(BaseModel):
    description: Optional[str] = Field(None, max_length=1000)
    private: Optional[bool] = None
    gated: Optional[str] = None
    license_type: Optional[str] = None
    tags: Optional[str] = None
    pricing_model: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)


class RepoResponse(BaseModel):
    repo_id: str
    owner_id: str
    owner_type: str
    owner_name: Optional[str] = None
    repo_type: str
    name: str
    slug: str
    description: Optional[str] = None
    private: bool = False
    gated: str = "none"
    pricing_model: str = "free"
    price: float = 0.0
    license_type: Optional[str] = None
    tags: Optional[str] = None
    total_downloads: int = 0
    total_likes: int = 0
    total_views: int = 0
    trending: float = 0.0
    last_commit_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RepoListResponse(BaseModel):
    repos: list
    total_count: int
    page: int
    page_size: int


# =============================================================================
# MODEL METADATA
# =============================================================================

class ModelMetadataRequest(BaseModel):
    framework: Optional[str] = None
    task: Optional[str] = None
    library: Optional[str] = None
    architecture: Optional[str] = None
    language: Optional[str] = None
    base_model: Optional[str] = None
    parameter_count: Optional[int] = None
    tensor_type: Optional[str] = None
    pipeline_tag: Optional[str] = None


# =============================================================================
# SPACE METADATA
# =============================================================================

class SpaceMetadataRequest(BaseModel):
    sdk: Optional[str] = None
    sdk_version: Optional[str] = None
    app_port: int = 7860
    hardware: str = "cpu-basic"
    embed_url: Optional[str] = None
    linked_models: Optional[str] = None
    linked_datasets: Optional[str] = None


# =============================================================================
# DISCUSSIONS
# =============================================================================

class CreateDiscussionRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    content: Optional[str] = None


class CreateCommentRequest(BaseModel):
    content: str = Field(..., min_length=1)


# =============================================================================
# ORGANIZATIONS
# =============================================================================

class CreateOrgRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=100, pattern="^[a-z0-9][a-z0-9-]*$")
    description: Optional[str] = Field(None, max_length=1000)
    website: Optional[str] = Field(None, max_length=300)


class UpdateOrgRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    website: Optional[str] = Field(None, max_length=300)


class AddOrgMemberRequest(BaseModel):
    user_id: str
    role: str = Field(default="member", pattern="^(owner|admin|write|read|member)$")


# =============================================================================
# COLLECTIONS
# =============================================================================

class CreateCollectionRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    is_public: bool = True


class AddCollectionItemRequest(BaseModel):
    repo_id: str
    note: Optional[str] = Field(None, max_length=500)


# =============================================================================
# FILE UPLOAD / COMMIT
# =============================================================================

class CommitRequest(BaseModel):
    message: str = Field(default="Update files")
    branch: str = Field(default="main")
