"""
FastAPI dependency injection helpers for authentication.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_token
from app.db.psycopg_driver import exec_sql
from app.db.sql_store import SqlStore
from app.exceptions import AppMessages, AuthorizationException
from app.logger import logger

# Reads the Bearer token from the Authorization header.
# tokenUrl is used only for OpenAPI docs — login accepts JSON, not form data.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    FastAPI dependency that extracts and validates the JWT from the
    Authorization header and returns the corresponding user record.

    For super-admin tokens (sub == "S") no DB lookup is performed —
    a synthetic user dict is returned directly.

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

    payload: dict = {}
    try:
        payload = decode_token(token)
    except AuthorizationException as exc:
        logger.warning("Token validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from None

    user_id_raw: str | None = payload.get("sub")
    user_type: str = payload.get("user_type", "")

    if user_id_raw is None:
        raise credentials_exception

    # Super-admin tokens carry sub="S" — no DB row to look up.
    if user_id_raw == "S" or user_type == "S":
        return {
            "id": None,
            "username": payload.get("username", "super_admin"),
            "is_active": True,
            "is_admin": True,
            "user_type": "S",
            "db_name": None,
            "client_id": payload.get("client_id"),
        }

    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError):
        raise credentials_exception from None

    db_name: str | None = payload.get("db_name")
    if not db_name:
        # A non-super-admin token must always carry a db_name.
        logger.warning("Token for user_id=%s is missing db_name claim", user_id_raw)
        raise credentials_exception

    # Look up the user in the appropriate service database via exec_sql + SqlStore —
    # the same pattern used by every other DB call in the codebase.
    rows = await exec_sql(
        db_name=db_name,
        schema="security",
        sql=SqlStore.GET_USER_BY_ID_FOR_RESET,
        sql_args={"id": user_id},
    )
    user: dict | None = dict(rows[0]) if rows else None

    if user is None:
        logger.warning("Authenticated token references non-existent user ID: %d", user_id)
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
