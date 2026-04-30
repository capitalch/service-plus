"""
Helper functions and logic for the authentication router.
"""
from fastapi import HTTPException

from app.config import settings
from app.core.audit_log import AuditAction, audit_logger
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.db.psycopg_driver import exec_sql
from app.db.sql_store import SqlStore
from app.exceptions import AppMessages, AuthorizationException
from app.logger import logger
from app.schemas.auth_schema import (
    ClientResponse,
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    SetPasswordRequest,
    SetPasswordResponse,
    ValidateResetTokenResponse,
)


async def get_clients_helper(criteria: str = "") -> list[ClientResponse]:
    """Retrieve clients from the database, optionally filtered by name prefix."""
    logger.debug("get_clients_helper called with criteria='%s'", criteria)
    rows = await exec_sql(
        db_name=None,
        sql=SqlStore.GET_ALL_CLIENTS_ON_CRITERIA,
        sql_args={"criteria": criteria},
    )
    logger.debug("get_clients_helper returned %d clients", len(rows))
    return [ClientResponse(**row) for row in rows]


async def login_helper(body: LoginRequest) -> LoginResponse:
    """Authenticate a user and return a JWT access token."""

    # [1] SuperAdmin check
    if body.identity == settings.super_admin_username:
        if not verify_password(body.password, settings.super_admin_password_hash):
            await audit_logger.log(
                action=AuditAction.LOGIN_FAILED,
                actor_username=body.identity,
                detail="Invalid password for super admin",
                outcome="failure",
                resource_type="session",
            )
            raise AuthorizationException(AppMessages.INVALID_CREDENTIALS)
        access_token = create_access_token({
            "sub": "S",
            "user_type": "S",
            "client_id": body.client_id,
            "db_name": None,
        })
        refresh_token = create_refresh_token({
            "sub": "S",
            "user_type": "S",
            "client_id": body.client_id,
            "db_name": None,
        })
        logger.info(AppMessages.LOGIN_SUCCESSFUL)
        await audit_logger.log(
            action=AuditAction.LOGIN,
            actor_username=body.identity,
            resource_type="session",
        )
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            access_rights=[],
            email=settings.super_admin_email,
            full_name="Super Admin",
            id=None,
            mobile=settings.super_admin_mobile,
            role_name="",
            username=settings.super_admin_username,
            user_type="S",
        )

    # [2] Resolve tenant
    client_rows = await exec_sql(
        db_name=None,
        sql=SqlStore.GET_CLIENT_DB_NAME,
        sql_args={"client_id": body.client_id},
    )
    if not client_rows:
        await audit_logger.log(
            action=AuditAction.LOGIN_FAILED,
            actor_username=body.identity,
            detail="Client not found",
            outcome="failure",
            resource_type="session",
        )
        raise AuthorizationException(AppMessages.INVALID_CREDENTIALS)
    db_name: str | None = client_rows[0]["db_name"]
    if not db_name:
        await audit_logger.log(
            action=AuditAction.LOGIN_FAILED,
            actor_username=body.identity,
            detail="Client database not initialized",
            outcome="failure",
            resource_type="session",
        )
        raise AuthorizationException(AppMessages.INVALID_CREDENTIALS)

    # [3] Authenticate user
    user_rows = await exec_sql(
        db_name=db_name,
        schema="security",
        sql=SqlStore.GET_USER_BY_IDENTITY,
        sql_args={"identity": body.identity},
    )
    if not user_rows:
        await audit_logger.log(
            action=AuditAction.LOGIN_FAILED,
            actor_username=body.identity,
            detail="User not found",
            outcome="failure",
            resource_type="session",
        )
        raise AuthorizationException(AppMessages.INVALID_CREDENTIALS)
    user = user_rows[0]
    if not user["is_active"]:
        await audit_logger.log(
            action=AuditAction.LOGIN_FAILED,
            actor_username=body.identity,
            detail="Account inactive",
            outcome="failure",
            resource_type="session",
        )
        raise AuthorizationException(AppMessages.FORBIDDEN)

    # [4] Verify password
    if not verify_password(body.password, user["password_hash"]):
        await audit_logger.log(
            action=AuditAction.LOGIN_FAILED,
            actor_username=body.identity,
            detail="Invalid password",
            outcome="failure",
            resource_type="session",
        )
        raise AuthorizationException(AppMessages.INVALID_CREDENTIALS)

    # [5] Determine user type
    user_type = "A" if user["is_admin"] else "B"

    # [6] Create JWT
    token_claims = {
        "sub": str(user["id"]),
        "user_type": user_type,
        "client_id": body.client_id,
        "db_name": db_name,
    }
    access_token = create_access_token(token_claims)
    refresh_token = create_refresh_token(token_claims)

    # [7] Log success
    logger.info("%s: user_id=%s, client_id=%s",
        AppMessages.LOGIN_SUCCESSFUL, user['id'], body.client_id)
    await audit_logger.log(
        action=AuditAction.LOGIN,
        actor_type="admin_user" if user["is_admin"] else "user",
        actor_username=user.get("username", body.identity),
        resource_name=db_name,
        resource_type="session",
    )

    # [8] Fetch available BUs for this user (only for non-super-admin)
    available_bus = []
    if user.get("id"):
        user_bus_rows = await exec_sql(
            db_name=db_name,
            schema="security",
            sql=SqlStore.GET_USER_BUS,
            sql_args={"user_id": user["id"]},
        )
        available_bus = [dict(row) for row in (user_bus_rows or [])]

    # [9] Return response
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        access_rights=user["access_rights"] or [],
        available_bus=available_bus,
        db_name=db_name,
        email=user["email"],
        full_name=user["full_name"],
        id=user["id"],
        last_used_branch_id=user.get("last_used_branch_id"),
        last_used_bu_id=user.get("last_used_bu_id"),
        mobile=user["mobile"] or "",
        role_name=user["role_name"] or "",
        user_type=user_type,
        username=user["username"],
    )


async def set_password_helper(body: SetPasswordRequest) -> SetPasswordResponse:
    """Hash the new password and persist it; token must be a valid reset token."""

    # [1] Decode and validate token
    try:
        payload = decode_token(body.token)
    except AuthorizationException as exc:
        raise HTTPException(status_code=400, detail=AppMessages.RESET_TOKEN_INVALID) from exc

    if payload.get("type") != "reset":
        raise HTTPException(status_code=400, detail=AppMessages.RESET_TOKEN_WRONG_TYPE)

    # [2] Validate new password length
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail=AppMessages.PASSWORD_TOO_SHORT)

    user_id  = payload.get("sub")
    db_name  = payload.get("db_name")

    # [3] Confirm user still active
    rows = await exec_sql(
        db_name=db_name, schema="security",
        sql=SqlStore.GET_USER_BY_ID_FOR_RESET,
        sql_args={"id": user_id},
    )
    if not rows or not rows[0].get("is_active"):
        raise HTTPException(status_code=400, detail=AppMessages.RESET_TOKEN_INVALID)

    # [4] Hash and persist
    password_hash = hash_password(body.new_password)
    await exec_sql(
        db_name=db_name, schema="security",
        sql=SqlStore.SET_USER_PASSWORD,
        sql_args={"id": user_id, "password_hash": password_hash},
    )
    logger.info("Password reset for user_id=%s in %s", user_id, db_name)

    # [5] Audit
    await audit_logger.log(
        action=AuditAction.PASSWORD_RESET,
        actor_type="admin_user",
        actor_username=rows[0].get("username", ""),
        resource_id=str(user_id),
        resource_type="admin_user",
    )

    return SetPasswordResponse(success=True, message=AppMessages.PASSWORD_RESET_SUCCESS)


async def validate_reset_token_helper(token: str) -> ValidateResetTokenResponse:
    """Decode the reset token and return user display info without changing anything."""

    # [1] Decode and validate token
    try:
        payload = decode_token(token)
    except AuthorizationException as exc:
        raise HTTPException(status_code=400, detail=AppMessages.RESET_TOKEN_INVALID) from exc

    if payload.get("type") != "reset":
        raise HTTPException(status_code=400, detail=AppMessages.RESET_TOKEN_WRONG_TYPE)

    user_id = payload.get("sub")
    db_name = payload.get("db_name")

    # [2] Fetch user and confirm active
    rows = await exec_sql(
        db_name=db_name, schema="security",
        sql=SqlStore.GET_USER_BY_ID_FOR_RESET,
        sql_args={"id": user_id},
    )
    if not rows or not rows[0].get("is_active"):
        raise HTTPException(status_code=400, detail=AppMessages.RESET_TOKEN_INVALID)

    user = rows[0]
    return ValidateResetTokenResponse(
        full_name=user["full_name"],
        username=user["username"],
        valid=True,
    )


async def refresh_token_helper(body: RefreshTokenRequest) -> RefreshTokenResponse:
    """Validate a refresh token and issue a new access/refresh token pair."""

    # [1] Decode and validate refresh token
    try:
        payload = decode_token(body.refresh_token)
    except AuthorizationException as exc:
        raise HTTPException(
            status_code=401,
            detail=AppMessages.TOKEN_EXPIRED if "expir" in str(exc).lower() else AppMessages.TOKEN_INVALID,
        ) from exc

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=401,
            detail=AppMessages.TOKEN_INVALID,
        )

    user_id_raw: str | None = payload.get("sub")
    user_type: str = payload.get("user_type", "")
    client_id: str | None = payload.get("client_id")
    db_name: str | None = payload.get("db_name")

    if user_id_raw is None:
        raise HTTPException(status_code=401, detail=AppMessages.TOKEN_INVALID)

    # [2] Super-admin can refresh without DB lookup
    if user_id_raw == "S" or user_type == "S":
        token_claims = {
            "sub": "S",
            "user_type": "S",
            "client_id": client_id,
            "db_name": None,
        }
        access_token = create_access_token(token_claims)
        refresh_token = create_refresh_token(token_claims)
        return RefreshTokenResponse(access_token=access_token, refresh_token=refresh_token)

    # [3] Verify user still exists and is active
    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail=AppMessages.TOKEN_INVALID)

    if not db_name:
        raise HTTPException(status_code=401, detail=AppMessages.TOKEN_INVALID)

    rows = await exec_sql(
        db_name=db_name,
        schema="security",
        sql=SqlStore.GET_USER_BY_ID_FOR_RESET,
        sql_args={"id": user_id},
    )
    if not rows or not rows[0].get("is_active"):
        raise HTTPException(status_code=401, detail=AppMessages.TOKEN_INVALID)

    # [4] Issue new token pair
    token_claims = {
        "sub": user_id_raw,
        "user_type": user_type,
        "client_id": client_id,
        "db_name": db_name,
    }
    access_token = create_access_token(token_claims)
    refresh_token = create_refresh_token(token_claims)

    logger.info("Token refreshed for user_id=%s in %s", user_id, db_name)
    return RefreshTokenResponse(access_token=access_token, refresh_token=refresh_token)
