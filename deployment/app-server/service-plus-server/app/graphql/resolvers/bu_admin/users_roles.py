"""BU-admin user/role mutation resolvers: create admin/business user, set
user BU role. Split from mutation_helper.py — see plans/plan.md Step 4."""

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
from app.core.exceptions import AppMessages, ValidationException
from app.graphql.resolvers.bu_admin.mailers import _build_reset_link
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger


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
    db_name: str, schema: str, value: str, request: Any = None
) -> dict:
    """
    Decode value payload, hash a temp password, create a business user (is_admin=False)
    in the specified client database, atomically assign the given BU/role associations,
    and email credentials.

    Value payload (URL-encoded JSON): { email, full_name, mobile, username, bu_ids, role_id }
    """
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "createBusinessUser")

    email = payload.get("email", "")
    full_name = payload.get("full_name", "")
    mobile = payload.get("mobile") or None
    username = payload.get("username", "")
    bu_ids = payload.get("bu_ids") or []
    role_id = payload.get("role_id")

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
    db_name: str, schema: str, value: str
) -> dict:
    """
    Decode value payload and replace all BU/role associations for a business user.
    Transaction: DELETE all user_bu_role rows for user_id, then INSERT one per bu_id.

    Value payload (URL-encoded JSON): { user_id, bu_ids, role_id }
    """
    payload = _decode_value(value, "setUserBuRole")

    user_id = payload.get("user_id")
    bu_ids = payload.get("bu_ids", [])
    role_id = payload.get("role_id")

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

    logger.info("Setting BU/role associations for user_id=%s in %s", user_id, db_name)

    connection = get_service_db_connection(db_name)
    async with connection as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            # Delete existing associations
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

    await audit_logger.log(
        action=AuditAction.UPDATE_ADMIN_USER,
        resource_id=str(user_id),
        resource_type="business_user",
    )
    return {"user_id": user_id}
