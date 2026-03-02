"""
retomY — Auth Router
Handles signup, login, token refresh, password management
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends
from models.schemas import (
    SignupRequest, LoginRequest, TokenResponse,
    RefreshTokenRequest, MessageResponse
)
from core.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, get_current_user
)
from core.database import execute_sp, execute_query
from core.config import get_settings
import structlog

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: Request, body: SignupRequest):
    """Register a new user account."""
    ip_address = request.client.host if request.client else None

    # Hash password
    password_hash, password_salt = hash_password(body.password)

    try:
        user = execute_sp("retomy.sp_RegisterUser", {
            "Email": body.email,
            "PasswordHash": password_hash,
            "PasswordSalt": password_salt,
            "FirstName": body.first_name,
            "LastName": body.last_name,
            "DisplayName": body.display_name,
            "Role": body.role,
            "IpAddress": ip_address,
        }, fetch="one")
    except Exception as e:
        import traceback
        error_msg = str(e)
        tb = traceback.format_exc()
        logger.error("signup_exception", error=error_msg, traceback=tb)
        if "Email already registered" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

    user_id = str(user["UserId"])

    # Generate tokens
    access_token = create_access_token({"sub": user_id, "email": user["Email"], "role": user["Role"]})
    refresh_token = create_refresh_token({"sub": user_id})

    # Store refresh token
    execute_sp("retomy.sp_RecordLoginSuccess", {"UserId": user_id, "IpAddress": ip_address}, fetch="none")

    logger.info("user_registered", user_id=user_id, email=user["Email"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "user_id": user_id,
            "email": user["Email"],
            "first_name": user["FirstName"],
            "last_name": user["LastName"],
            "display_name": user["DisplayName"],
            "role": user["Role"],
            "credits_balance": float(user.get("CreditsBalance", 0)),
        }
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, body: LoginRequest):
    """Authenticate and get access token."""
    ip_address = request.client.host if request.client else None

    try:
        user_data = execute_sp("retomy.sp_AuthenticateUser", {
            "Email": body.email,
            "IpAddress": ip_address,
        }, fetch="one")
    except Exception as e:
        error_msg = str(e)
        if "Invalid credentials" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        if "temporarily locked" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account is temporarily locked due to too many failed attempts. Try again in 15 minutes."
            )
        if "suspended" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is suspended. Contact support."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Verify password
    if not verify_password(body.password, user_data["PasswordHash"], user_data["PasswordSalt"]):
        # Record failed attempt
        try:
            execute_sp("retomy.sp_RecordLoginFailure", {"Email": body.email, "IpAddress": ip_address}, fetch="none")
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    user_id = str(user_data["UserId"])

    # Record success
    execute_sp("retomy.sp_RecordLoginSuccess", {"UserId": user_id, "IpAddress": ip_address}, fetch="none")

    # Generate tokens
    access_token = create_access_token({"sub": user_id, "email": user_data["Email"], "role": user_data["Role"]})
    refresh_token = create_refresh_token({"sub": user_id})

    logger.info("user_logged_in", user_id=user_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "user_id": user_id,
            "email": user_data["Email"],
            "first_name": user_data["FirstName"],
            "last_name": user_data["LastName"],
            "display_name": user_data["DisplayName"],
            "avatar_url": user_data.get("AvatarUrl"),
            "role": user_data["Role"],
            "credits_balance": float(user_data.get("CreditsBalance", 0)),
            "is_seller_verified": bool(user_data.get("IsSellerVerified", False)),
        }
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshTokenRequest):
    """Refresh an access token using a refresh token."""
    payload = decode_token(body.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    user_id = payload.get("sub")
    user = execute_sp("retomy.sp_GetUserProfile", {"UserId": user_id}, fetch="one")

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    access_token = create_access_token({"sub": user_id, "email": user["Email"], "role": user["Role"]})
    new_refresh_token = create_refresh_token({"sub": user_id})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "user_id": str(user["UserId"]),
            "email": user["Email"],
            "first_name": user["FirstName"],
            "last_name": user["LastName"],
            "display_name": user.get("DisplayName"),
            "avatar_url": user.get("AvatarUrl"),
            "role": user["Role"],
            "credits_balance": float(user.get("CreditsBalance", 0)),
        }
    )


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user profile."""
    return {
        "user_id": str(user["UserId"]),
        "email": user["Email"],
        "first_name": user["FirstName"],
        "last_name": user["LastName"],
        "display_name": user.get("DisplayName"),
        "avatar_url": user.get("AvatarUrl"),
        "bio": user.get("Bio"),
        "company": user.get("Company"),
        "website": user.get("Website"),
        "location": user.get("Location"),
        "role": user["Role"],
        "credits_balance": float(user.get("CreditsBalance", 0)),
        "is_email_verified": bool(user.get("IsEmailVerified", False)),
        "is_seller_verified": bool(user.get("IsSellerVerified", False)),
        "created_at": str(user.get("CreatedAt", "")),
        "published_datasets": user.get("PublishedDatasets", 0),
        "total_purchases": user.get("TotalPurchases", 0),
        "follower_count": user.get("FollowerCount", 0),
        "following_count": user.get("FollowingCount", 0),
    }


@router.post("/logout", response_model=MessageResponse)
async def logout(user: dict = Depends(get_current_user)):
    """Logout user (invalidate refresh tokens on client side)."""
    logger.info("user_logged_out", user_id=str(user["UserId"]))
    return MessageResponse(message="Logged out successfully")
