"""
retomY — Security & Auth Utilities
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.config import get_settings
from core.database import execute_sp
import secrets
import hashlib
import structlog

logger = structlog.get_logger()
settings = get_settings()

# Password hashing
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
security_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> tuple[str, str]:
    """Hash a password with a random salt. Returns (hash, salt)."""
    salt = secrets.token_hex(32)
    salted_password = password + salt
    # Truncate salted password bytes to 72 bytes to avoid backend limits.
    password_bytes = salted_password.encode("utf-8")
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
        salted_password = password_bytes.decode("utf-8", errors="ignore")

    password_hash = pwd_context.hash(salted_password)
    return password_hash, salt


def verify_password(plain_password: str, hashed_password: str, salt: str) -> bool:
    """Verify a password against its hash."""
    salted_password = plain_password + salt
    try:
        # Truncate incoming bytes similarly to hashing
        password_bytes = salted_password.encode("utf-8")
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
            salted_password = password_bytes.decode("utf-8", errors="ignore")
        return pwd_context.verify(salted_password, hashed_password)
    except Exception as e:
        logger.warning("password verification failed", error=str(e))
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def generate_api_key() -> tuple[str, str, str]:
    """Generate an API key. Returns (full_key, key_hash, key_prefix)."""
    key = f"rtmy_{secrets.token_urlsafe(48)}"
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    key_prefix = key[:12]
    return key, key_hash, key_prefix


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> dict:
    """Get the current authenticated user from JWT token."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Fetch user from database
    try:
        user = execute_sp("retomy.sp_GetUserProfile", {"UserId": user_id}, fetch="one")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> Optional[dict]:
    """Get the current user if authenticated, None otherwise."""
    if not credentials:
        return None

    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_role(*roles: str):
    """Dependency to require specific roles."""
    async def role_checker(user: dict = Depends(get_current_user)):
        if user.get("Role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user
    return role_checker
