from app.config import settings
from app.core.security import create_access_token, verify_password
from app.db.database import exec_sql
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
    if body.identity == settings.superadmin_username:
        if not verify_password(body.password, settings.superadmin_password_hash):
            raise AuthorizationException(AppMessages.INVALID_CREDENTIALS)
        access_token = create_access_token({
            "sub": "S",
            "user_type": "S",
            "client_id": body.client_id,
            "db_name": None,
        })
        logger.info(AppMessages.LOGIN_SUCCESSFUL)
        return LoginResponse(
            access_token=access_token,
            access_rights=[],
            email="",
            full_name="Super Admin",
            mobile="",
            role_name="",
            user_type="S",
        )

    # [2] Resolve tenant
    client_rows = await exec_sql(
        db_name=None,
        sql=SqlAuth.GET_CLIENT_DB_NAME,
        sql_args={"client_id": body.client_id},
    )
    if not client_rows:
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
        raise AuthorizationException(AppMessages.INVALID_CREDENTIALS)
    user = user_rows[0]
    if not user["is_active"]:
        raise AuthorizationException(AppMessages.FORBIDDEN)

    # [4] Verify password
    if not verify_password(body.password, user["password_hash"]):
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
