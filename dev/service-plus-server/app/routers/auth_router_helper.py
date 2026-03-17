from fastapi import HTTPException

from app.config import settings
from app.core.audit_log import AuditAction, audit_logger
from app.core.security import create_access_token, decode_token, hash_password, verify_password
from app.db.psycopg_driver import exec_sql
from app.db.sql_auth import SqlAuth
from app.exceptions import AppMessages, AuthorizationException
from app.logger import logger
from app.schemas.auth_schema import (
    ClientResponse,
    LoginRequest,
    LoginResponse,
    SetPasswordRequest,
    SetPasswordResponse,
    ValidateResetTokenResponse,
)


async def get_clients_helper(criteria: str = "") -> list[ClientResponse]:
    """Retrieve clients from the database, optionally filtered by name prefix."""
    rows = await exec_sql(
        db_name=None,
        sql=SqlAuth.GET_ALL_CLIENTS_ON_CRITERIA,
        sql_args={"criteria": criteria},
    )
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
        logger.info(AppMessages.LOGIN_SUCCESSFUL)
        await audit_logger.log(
            action=AuditAction.LOGIN,
            actor_username=body.identity,
            resource_type="session",
        )
        return LoginResponse(
            access_token=access_token,
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
        sql=SqlAuth.GET_CLIENT_DB_NAME,
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
        sql=SqlAuth.GET_USER_BY_IDENTITY,
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
    access_token = create_access_token({
        "sub": str(user["id"]),
        "user_type": user_type,
        "client_id": body.client_id,
        "db_name": db_name,
    })

    # [7] Log success
    logger.info(f"{AppMessages.LOGIN_SUCCESSFUL}: user_id={user['id']}, client_id={body.client_id}")
    await audit_logger.log(
        action=AuditAction.LOGIN,
        actor_type="admin_user" if user["is_admin"] else "user",
        actor_username=user.get("username", body.identity),
        resource_name=db_name,
        resource_type="session",
    )

    # [8] Return response
    return LoginResponse(
        access_token=access_token,
        access_rights=user["access_rights"] or [],
        db_name=db_name,
        email=user["email"],
        full_name=user["full_name"],
        id=user["id"],
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
    except AuthorizationException:
        raise HTTPException(status_code=400, detail=AppMessages.RESET_TOKEN_INVALID)

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
        sql=SqlAuth.GET_USER_BY_ID_FOR_RESET,
        sql_args={"id": user_id},
    )
    if not rows or not rows[0].get("is_active"):
        raise HTTPException(status_code=400, detail=AppMessages.RESET_TOKEN_INVALID)

    # [4] Hash and persist
    password_hash = hash_password(body.new_password)
    await exec_sql(
        db_name=db_name, schema="security",
        sql=SqlAuth.SET_USER_PASSWORD,
        sql_args={"id": user_id, "password_hash": password_hash},
    )
    logger.info(f"Password reset for user_id={user_id} in {db_name}")

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
    except AuthorizationException:
        raise HTTPException(status_code=400, detail=AppMessages.RESET_TOKEN_INVALID)

    if payload.get("type") != "reset":
        raise HTTPException(status_code=400, detail=AppMessages.RESET_TOKEN_WRONG_TYPE)

    user_id = payload.get("sub")
    db_name = payload.get("db_name")

    # [2] Fetch user and confirm active
    rows = await exec_sql(
        db_name=db_name, schema="security",
        sql=SqlAuth.GET_USER_BY_ID_FOR_RESET,
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
