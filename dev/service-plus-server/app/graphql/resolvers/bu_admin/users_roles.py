"""BU-admin user/role mutation resolvers: create admin/business user, set
user BU role. Split from mutation_helper.py — see plans/plan.md Step 4.

Manager-created-users rule (plans/plan.md, Steps 4/6/8): an Admin ('A') creates
any role for any BU in their own tenant, unchanged. A business user ('B') needs
the USERS_MANAGE_OWN_BU access right (granted to the MANAGER role only, see
seed_security_data.py) to create a user at all, and even then only for a BU
they themselves hold a MANAGER row for, and never role MANAGER. A Basic-tier
client is capped at exactly one business user, role MANAGER, checked first and
unconditionally — before either of the above, and regardless of who's asking."""

import secrets
from typing import Any

import psycopg.sql as pgsql
from psycopg.rows import dict_row

from app.core.audit_log import AuditAction, audit_logger
from app.core.email import send_email
from app.core.security import create_reset_token, hash_password
from app.db.connection.psycopg_driver import (
    exec_sql,
    exec_sql_object,
    get_service_db_connection,
    process_details,
)
from app.db.sql.sql_base import SqlStore
from app.core.exceptions import AppMessages, AuthorizationException, ValidationException
from app.graphql.resolvers.bu_admin.mailers import _build_reset_link
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger

MANAGER_ROLE_ID = 1
USERS_MANAGE_OWN_BU_RIGHT = "USERS_MANAGE_OWN_BU"


async def _get_subscription_tier(db_name: str) -> str:
    """The caller's own tenant's subscription tier, looked up by db_name (not by a
    client_id round trip) against the shared client registry database."""
    rows = await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlStore.GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME,
        sql_args={"db_name": db_name},
    )
    return rows[0]["subscription_tier"] if rows else "BASIC"


async def _check_basic_tier_user_cap(db_name: str, schema_name: str, role_id: int) -> None:
    """Basic tier: exactly one business user, and it must be role MANAGER. Checked
    first, unconditionally — before the caller-identity rule below, and regardless
    of whether the caller is Admin or a Manager."""
    tier = await _get_subscription_tier(db_name)
    if tier != "BASIC":
        return
    count_rows = await exec_sql(
        db_name=db_name, schema=schema_name, sql=SqlStore.COUNT_BUSINESS_USERS, sql_args={}
    )
    existing = count_rows[0]["business_user_count"] if count_rows else 0
    if existing >= 1:
        raise ValidationException(message=AppMessages.BASIC_TIER_USER_LIMIT)
    if role_id != MANAGER_ROLE_ID:
        raise ValidationException(message=AppMessages.BASIC_TIER_ROLE_RESTRICTED)


async def _require_can_create_business_user(
    info, db_name: str, role_id: int, bu_ids: list
) -> None:
    """The caller-identity half of the rule (the Basic-tier cap is checked
    separately, first, by the caller). Admin/Super Admin: unrestricted, matching
    today. A 'B' caller needs USERS_MANAGE_OWN_BU and may only name BUs they
    themselves manage, and never role MANAGER."""
    context = info.context or {}
    user_type = context.get("user_type")
    if user_type in ("A", "S"):
        return
    if user_type != "B" or USERS_MANAGE_OWN_BU_RIGHT not in (context.get("access_rights") or []):
        raise AuthorizationException(
            message=AppMessages.FORBIDDEN,
            extensions={"required_access_right": USERS_MANAGE_OWN_BU_RIGHT},
        )
    if role_id == MANAGER_ROLE_ID:
        raise AuthorizationException(message=AppMessages.MANAGER_ROLE_RESTRICTED)
    managed_rows = await exec_sql(
        db_name=db_name,
        schema="security",
        sql=SqlStore.GET_MANAGER_BU_IDS_FOR_USER,
        sql_args={"user_id": context.get("user_id")},
    )
    managed_bu_ids = {row["bu_id"] for row in managed_rows}
    if not set(bu_ids) <= managed_bu_ids:
        raise AuthorizationException(message=AppMessages.MANAGER_BU_NOT_OWNED)


async def _validate_and_save_branch_restrictions(
    cur, db_name: str, user_id: int, branch_ids_by_bu: dict
) -> None:
    """branch_ids_by_bu: { bu_id: [branch_id, ...] }. Empty/absent for a bu_id means
    unrestricted (no rows written) — every existing user's default. A branch_id is
    validated against the BU's OWN schema before being written, since branches live
    outside `security` and Postgres can't enforce that FK directly (see
    scripts/user_bu_role_branch_schema.sql)."""
    for bu_id, branch_ids in (branch_ids_by_bu or {}).items():
        if not branch_ids:
            continue
        bu_code_rows = await exec_sql(
            db_name=db_name, schema="security", sql=SqlStore.GET_BU_CODE_BY_ID, sql_args={"id": bu_id}
        )
        if not bu_code_rows:
            raise ValidationException(message=AppMessages.NOT_FOUND, extensions={"field": "bu_id"})
        bu_schema = bu_code_rows[0]["code"]
        found_rows = await exec_sql(
            db_name=db_name,
            schema=bu_schema,
            sql=SqlStore.CHECK_BRANCH_IDS_EXIST,
            sql_args={"ids": branch_ids},
        )
        found_ids = {row["id"] for row in found_rows}
        if set(branch_ids) - found_ids:
            raise ValidationException(
                message=AppMessages.BRANCH_NOT_IN_BU, extensions={"field": "branch_ids"}
            )
        for branch_id in branch_ids:
            await cur.execute(
                "INSERT INTO user_bu_role_branch (user_id, bu_id, branch_id) VALUES (%s, %s, %s)",
                (user_id, bu_id, branch_id),
            )


async def resolve_create_admin_user_helper(
    db_name: str, schema: str, value: str, request: Any = None
) -> dict:
    """
    Decode value payload, create an admin user (is_admin=True) with a random unusable
    password, then email a 48-hour reset link so the admin sets their own password.

    Value payload (URL-encoded JSON): { client_id, email, full_name, mobile, username }
    """
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "createAdminUser")

    client_id = payload.get("client_id")
    email = payload.get("email", "")
    full_name = payload.get("full_name", "")
    mobile = payload.get("mobile") or None
    username = payload.get("username", "")

    if not email or not full_name or not username:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"fields": ["email", "full_name", "username"]},
        )

    # Store a random unusable hash — admin cannot log in until they set a password
    password_hash = hash_password(secrets.token_urlsafe(32))

    logger.info("Creating admin user '%s' in database '%s'", username, db_name)

    sql_object = {
        "tableName": "user",
        "xData": {
            "email": email,
            "full_name": full_name,
            "is_active": True,
            "is_admin": True,
            "mobile": mobile,
            "password_hash": password_hash,
            "username": username,
        },
    }
    record_id = await exec_sql_object(db_name, schema or "security", sql_object)
    logger.info("Admin user '%s' created with id=%s", username, record_id)

    # Generate reset link so admin can set their own password
    token = create_reset_token(
        {
            "sub": str(record_id),
            "db_name": db_name,
            "client_id": client_id,
        }
    )
    reset_link = _build_reset_link(request, token)

    email_sent = False
    try:
        await send_email(
            to=email,
            subject=AppMessages.EMAIL_NEW_ADMIN_LINK_SUBJECT,
            body=AppMessages.EMAIL_NEW_ADMIN_LINK_BODY.format(
                full_name=full_name,
                reset_link=reset_link,
                username=username,
            ),
        )
        email_sent = True
    except Exception as mail_err:  # pylint: disable=broad-except
        logger.warning("Failed to send welcome email to %s: %s", email, mail_err)

    await audit_logger.log(
        action=AuditAction.CREATE_ADMIN_USER,
        resource_id=str(record_id),
        resource_name=username,
        resource_type="admin_user",
    )
    return {"email_sent": email_sent, "id": record_id}

async def resolve_create_business_user_helper(
    info, db_name: str, schema: str, value: str, request: Any = None
) -> dict:
    """
    Decode value payload, hash a temp password, create a business user (is_admin=False)
    in the specified client database, atomically assign the given BU/role associations
    (and optional branch restrictions), and email credentials.

    Value payload (URL-encoded JSON):
        { email, full_name, mobile, username, bu_ids, role_id, branch_ids }
    branch_ids is optional: { "<bu_id>": [branch_id, ...] } — a bu_id with no entry
    (or an empty list) is unrestricted, same as every existing user today.

    Caller-identity rule (see module docstring) is enforced here, not just by a flat
    access-right check at the GraphQL field level, since it depends on which BUs the
    caller themselves manages and on the target client's subscription tier — see
    _check_basic_tier_user_cap / _require_can_create_business_user.
    """
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "createBusinessUser")

    email = payload.get("email", "")
    full_name = payload.get("full_name", "")
    mobile = payload.get("mobile") or None
    username = payload.get("username", "")
    bu_ids = payload.get("bu_ids") or []
    role_id = payload.get("role_id")
    branch_ids_by_bu = payload.get("branch_ids") or {}

    if not email or not full_name or not username:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"fields": ["email", "full_name", "username"]},
        )

    # A business user must be associated with at least one BU and a role, or they
    # would log in with no BU context and see empty master/config grids.
    if not bu_ids or not role_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"fields": ["bu_ids", "role_id"]},
        )

    schema_name = schema or "security"

    # The Basic-tier cap is checked first and unconditionally — before who's asking.
    await _check_basic_tier_user_cap(db_name, schema_name, role_id)
    await _require_can_create_business_user(info, db_name, role_id, bu_ids)

    # Check username uniqueness
    uname_rows = await exec_sql(
        db_name=db_name,
        schema=schema_name,
        sql=SqlStore.CHECK_BUSINESS_USER_USERNAME_EXISTS,
        sql_args={"username": username},
    )
    if uname_rows and uname_rows[0].get("exists"):
        raise ValidationException(
            message=AppMessages.BUSINESS_USER_USERNAME_EXISTS,
            extensions={"field": "username"},
        )

    # Check email uniqueness
    email_rows = await exec_sql(
        db_name=db_name,
        schema=schema_name,
        sql=SqlStore.CHECK_BUSINESS_USER_EMAIL_EXISTS,
        sql_args={"email": email},
    )
    if email_rows and email_rows[0].get("exists"):
        raise ValidationException(
            message=AppMessages.BUSINESS_USER_EMAIL_EXISTS,
            extensions={"field": "email"},
        )

    # Store a random unusable hash — user cannot log in until they set a password via reset link
    password_hash = hash_password(secrets.token_urlsafe(32))

    logger.info("Creating business user '%s' in database '%s'", username, db_name)

    sql_object = {
        "tableName": "user",
        "xData": {
            "email": email,
            "full_name": full_name,
            "is_active": True,
            "is_admin": False,
            "mobile": mobile,
            "password_hash": password_hash,
            "username": username,
        },
    }

    # Insert the user and its BU/role associations in a single transaction so a user is
    # never left without an association (the connection commits on clean exit, rolls
    # back on error).
    connection = get_service_db_connection(db_name)
    async with connection as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            record_id = await process_details(sql_object, cur)
            for bu_id in bu_ids:
                await cur.execute(
                    "INSERT INTO user_bu_role (user_id, bu_id, role_id) VALUES (%s, %s, %s)",
                    (record_id, bu_id, role_id),
                )
            await _validate_and_save_branch_restrictions(cur, db_name, record_id, branch_ids_by_bu)
    logger.info(
        "Business user created with id=%s and %d BU association(s)", record_id, len(bu_ids)
    )

    # Generate reset link so user can set their own password
    token = create_reset_token({"sub": str(record_id), "db_name": db_name})
    reset_link = _build_reset_link(request, token)

    email_sent = False
    try:
        await send_email(
            to=email,
            subject=AppMessages.EMAIL_NEW_BU_USER_LINK_SUBJECT,
            body=AppMessages.EMAIL_NEW_BU_USER_LINK_BODY.format(
                full_name=full_name,
                reset_link=reset_link,
                username=username,
            ),
        )
        email_sent = True
    except Exception as mail_err:  # pylint: disable=broad-except
        logger.warning("Failed to send setup link email to %s: %s", email, mail_err)

    await audit_logger.log(
        action=AuditAction.CREATE_ADMIN_USER,
        resource_id=str(record_id),
        resource_name=username,
        resource_type="business_user",
    )
    return {"email_sent": email_sent, "id": record_id}

async def resolve_set_user_bu_role_helper(
    info, db_name: str, schema: str, value: str
) -> dict:
    """
    Decode value payload and replace all BU/role (and branch restriction) associations
    for a business user. Transaction: DELETE all user_bu_role rows for user_id (which
    cascades to user_bu_role_branch — see scripts/user_bu_role_branch_schema.sql), then
    INSERT one user_bu_role row per bu_id and any branch restrictions for it.

    Value payload (URL-encoded JSON): { user_id, bu_ids, role_id, branch_ids }
    branch_ids: { "<bu_id>": [branch_id, ...] }, same shape as createBusinessUser.

    Caller-identity rule (module docstring): same as createBusinessUser — a Manager
    editing a user's BU/role is subject to the same "own BU, never role MANAGER" rule
    as creating one, so "edit" can't be used to route around "create".
    """
    payload = _decode_value(value, "setUserBuRole")

    user_id = payload.get("user_id")
    bu_ids = payload.get("bu_ids", [])
    role_id = payload.get("role_id")
    branch_ids_by_bu = payload.get("branch_ids") or {}

    if not user_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "user_id"},
        )

    schema_name = schema or "security"

    # Verify user exists and is a business user
    user_rows = await exec_sql(
        db_name=db_name,
        schema=schema_name,
        sql=SqlStore.GET_BUSINESS_USER_BY_ID,
        sql_args={"id": user_id},
    )
    if not user_rows:
        raise ValidationException(
            message=AppMessages.NOT_FOUND,
            extensions={"field": "user_id"},
        )

    if bu_ids and role_id:
        await _require_can_create_business_user(info, db_name, role_id, bu_ids)

    logger.info("Setting BU/role associations for user_id=%s in %s", user_id, db_name)

    connection = get_service_db_connection(db_name)
    async with connection as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            # Delete existing associations (cascades to user_bu_role_branch)
            await cur.execute(
                "DELETE FROM user_bu_role WHERE user_id = %s",
                (user_id,),
            )
            # Insert new associations (one per BU with the single role)
            if bu_ids and role_id:
                for bu_id in bu_ids:
                    await cur.execute(
                        "INSERT INTO user_bu_role (user_id, bu_id, role_id) VALUES (%s, %s, %s)",
                        (user_id, bu_id, role_id),
                    )
                await _validate_and_save_branch_restrictions(cur, db_name, user_id, branch_ids_by_bu)

    await audit_logger.log(
        action=AuditAction.UPDATE_ADMIN_USER,
        resource_id=str(user_id),
        resource_type="business_user",
    )
    return {"user_id": user_id}
