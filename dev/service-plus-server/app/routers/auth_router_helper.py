from app.config import settings
from app.core.audit_log import AuditAction, audit_logger
from app.core.security import create_access_token, verify_password
from app.db.psycopg_driver import exec_sql
from app.db.sql_auth import SqlAuth
from app.exceptions import AppMessages, AuthorizationException
from app.logger import logger
from app.schemas.auth_schema import ClientResponse, LoginRequest, LoginResponse


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
    db_name: str = client_rows[0]["db_name"]

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
        email=user["email"],
        full_name=user["full_name"],
        mobile=user["mobile"] or "",
        role_name=user["role_name"] or "",
        user_type=user_type,
    )
