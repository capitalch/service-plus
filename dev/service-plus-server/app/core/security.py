"""
Security utilities: password hashing (bcrypt) and JWT token management (PyJWT).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from app.config import settings
from app.logger import logger
from app.exceptions import AppMessages, AuthorizationException


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


# ---------------------------------------------------------------------------
# JWT token management
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT access token.

    Args:
        data: Claims to embed (must include 'sub' for subject / user ID).
        expires_delta: Custom expiry; defaults to ACCESS_TOKEN_EXPIRE_MINUTES.
    """
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload.update({"exp": expire, "type": "access"})
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    logger.debug(f"Access token created for subject: {data.get('sub')}")
    return token


def create_refresh_token(data: dict) -> str:
    """
    Create a signed JWT refresh token.

    Args:
        data: Claims to embed (must include 'sub' for subject / user ID).
    """
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    payload.update({"exp": expire, "type": "refresh"})
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    logger.debug(f"Refresh token created for subject: {data.get('sub')}")
    return token


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.

    Returns:
        The token payload dict.

    Raises:
        AuthorizationException: If the token is expired or otherwise invalid.
    """
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token has expired")
        raise AuthorizationException(AppMessages.TOKEN_EXPIRED)
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        raise AuthorizationException(AppMessages.TOKEN_INVALID)
