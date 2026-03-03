"""
retomY — Pydantic Models for Request/Response
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID
import re


# =============================================================================
# AUTH MODELS
# =============================================================================

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    display_name: Optional[str] = Field(None, max_length=150)
    role: str = Field(default="user")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# =============================================================================
# USER MODELS
# =============================================================================

class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    first_name: str
    last_name: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None
    role: str
    credits_balance: float = 0.0
    is_email_verified: bool = False
    is_seller_verified: bool = False
    created_at: Optional[str] = None
    published_datasets: int = 0
    total_purchases: int = 0
    follower_count: int = 0
    following_count: int = 0


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    display_name: Optional[str] = Field(None, max_length=150)
    bio: Optional[str] = Field(None, max_length=2000)
    company: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, max_length=255)


# =============================================================================
# DATASET MODELS
# =============================================================================

class CreateDatasetRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    short_description: str = Field(..., min_length=10, max_length=500)
    full_description: Optional[str] = None
    category_id: Optional[int] = None
    price: float = Field(default=0.0, ge=0)
    pricing_model: str = Field(default="one-time")
    license_type: str = Field(default="standard")
    file_format: Optional[str] = None
    tags: Optional[str] = None  # JSON array string

    @field_validator("pricing_model")
    @classmethod
    def validate_pricing_model(cls, v):
        if v not in ("one-time", "subscription", "freemium", "free"):
            raise ValueError("Invalid pricing model")
        return v

    @field_validator("full_description")
    @classmethod
    def validate_full_description(cls, v):
        if v is None:
            return v
        # Count words conservatively
        words = len(re.findall(r"\w+", v))
        if words < 100:
            raise ValueError("Full description must be at least 100 words")
        return v


class UpdateDatasetRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=300)
    short_description: Optional[str] = Field(None, max_length=500)
    full_description: Optional[str] = None
    category_id: Optional[int] = None
    price: Optional[float] = Field(None, ge=0)
    pricing_model: Optional[str] = None
    license_type: Optional[str] = None
    file_format: Optional[str] = None
    tags: Optional[str] = None
    status: Optional[str] = None


class DatasetListResponse(BaseModel):
    datasets: list
    total_count: int
    page: int
    page_size: int
    total_pages: int


# =============================================================================
# PURCHASE MODELS
# =============================================================================

class PurchaseRequest(BaseModel):
    dataset_id: str
    payment_method: str = Field(default="credits")
    payment_ref: Optional[str] = None


# =============================================================================
# REVIEW MODELS
# =============================================================================

class ReviewRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = None


# =============================================================================
# CART MODELS
# =============================================================================

class CartItemRequest(BaseModel):
    dataset_id: str


# =============================================================================
# SEARCH MODELS
# =============================================================================

class SearchParams(BaseModel):
    query: Optional[str] = None
    category_id: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    file_format: Optional[str] = None
    pricing_model: Optional[str] = None
    sort_by: str = "relevance"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


# =============================================================================
# GENERIC RESPONSES
# =============================================================================

class MessageResponse(BaseModel):
    message: str
    status: str = "success"


class ErrorResponse(BaseModel):
    detail: str
    status: str = "error"
    error_code: Optional[str] = None
