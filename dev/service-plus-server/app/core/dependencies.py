"""
FastAPI dependency injection helpers for authentication.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_token
from app.db.database import get_db_connection
from app.db.auth_queries import AuthQueries
from app.exceptions import AppMessages, AuthorizationException
from app.logger import logger

# Reads the Bearer token from the Authorization header.
# tokenUrl is used only for OpenAPI docs — login accepts JSON, not form data.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    FastAPI dependency that extracts and validates the JWT from the
    Authorization header and returns the corresponding user record.

    Raises:
        HTTPException 401: If the token is missing, expired, or invalid.
        HTTPException 403: If the user account is inactive.
        HTTPException 404: If the user no longer exists in the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=AppMessages.TOKEN_INVALID,
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
    except AuthorizationException as e:
        logger.warning(f"Token validation failed: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_raw = payload.get("sub")
    if user_id_raw is None:
        raise credentials_exception

    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError):
        raise credentials_exception

    async with get_db_connection() as conn:
        user = await AuthQueries.get_user_by_id(conn, user_id)

    if user is None:
        logger.warning(f"Authenticated token references non-existent user ID: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=AppMessages.USER_NOT_FOUND,
        )

    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=AppMessages.FORBIDDEN,
        )

    return user
