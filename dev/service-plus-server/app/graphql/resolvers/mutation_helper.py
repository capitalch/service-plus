"""Helper functions for GraphQL mutation resolvers."""
# pylint: disable=too-many-lines

import json
import re
import secrets
from datetime import date, datetime
from typing import Any
from urllib.parse import quote, unquote

import httpx  # pylint: disable=import-error

from psycopg import sql as pgsql  # pylint: disable=import-error
from psycopg.rows import dict_row  # pylint: disable=import-error

from app.core.audit_log import AuditAction, audit_logger
from app.core.email import send_email
from app.core.security import create_reset_token, hash_password
from app.config import settings
from app.db.psycopg_driver import (
    bulk_insert_records,
    exec_sql,
    exec_sql_dml,
    exec_sql_object,
    get_service_db_connection,
    process_data,
    process_details,
)
from app.db.sql_store import SqlStore
from app.db.sql_bu import SqlBu
from app.db.sql_security import SqlSecurity
from app.db.seed_bu_data import SeedBuData
from app.db.seed_security_data import SeedSecurityData
from app.exceptions import AppMessages, ValidationException
from app.graphql.pubsub import pubsub
from app.logger import logger


def _decode_value(value: str, context: str) -> dict:
    """Decode a URL-encoded JSON value string into a dict."""
    if not value:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "value"},
        )
    try:
        return json.loads(unquote(value))
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Invalid JSON in %s value: %s", context, e)
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_VALUE},
        ) from e


def _serialize_row(row: dict) -> dict:
    return {k: v.isoformat() if isinstance(v, (date, datetime)) else v for k, v in row.items()}


async def resolve_create_admin_user_helper(
    db_name: str, schema: str, value: str
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
    reset_link = f"{settings.frontend_url}/reset-password?token={token}"

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


async def resolve_create_bu_schema_and_feed_seed_data_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Create a new BU row in security.bu, then create a new schema named after the BU code,
    create all tables (from BU_SCHEMA_DDL), and seed lookup tables (BU_SEED_SQL).

    Value payload (URL-encoded JSON): { code, name }
    """
    # pylint: disable=unused-argument
    payload = _decode_value(value, "createBuSchemaAndFeedSeedData")

    code: str = (payload.get("code") or "").lower().strip()
    name: str = (payload.get("name") or "").strip()

    # 1. Validate presence
    if not code or not name:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"fields": ["code", "name"]},
        )

    # 2. Validate code format: alphanumeric + underscore, 3–9 chars
    if not re.match(r"^[a-z0-9_]{3,9}$", code):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={
                "detail": "Code must be 3–9 alphanumeric/underscore characters",
                "field": "code",
            },
        )

    # 3. Validate name format: alphanumeric + spaces, min 3 chars
    if not re.match(r"^[a-zA-Z0-9 ]{3,}$", name):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={
                "detail": "Name must be at least 3 alphanumeric characters",
                "field": "name",
            },
        )

    # 4. If id supplied, BU row already exists — skip uniqueness checks and INSERT
    raw_id = payload.get("id")
    if raw_id:
        bu_id = int(raw_id)
        logger.info(
            "Schema-repair path: using existing BU id=%d for code='%s'", bu_id, code
        )
    else:
        # 4a. Check code uniqueness
        rows = await exec_sql(
            db_name=db_name,
            schema="security",
            sql=SqlStore.CHECK_BU_CODE_EXISTS,
            sql_args={"code": code},
        )
        if rows and rows[0].get("exists"):
            raise ValidationException(
                message=AppMessages.BU_CODE_EXISTS,
                extensions={"field": "code"},
            )

        # 4b. Check name uniqueness
        rows = await exec_sql(
            db_name=db_name,
            schema="security",
            sql=SqlStore.CHECK_BU_NAME_EXISTS,
            sql_args={"name": name},
        )
        if rows and rows[0].get("exists"):
            raise ValidationException(
                message=AppMessages.BU_NAME_EXISTS,
                extensions={"field": "name"},
            )

        # 4c. Insert BU row into security.bu
        logger.info("Creating BU '%s' / '%s' in db '%s'", code, name, db_name)
        rows = await exec_sql(
            db_name=db_name,
            schema="security",
            sql=SqlStore.INSERT_BU,
            sql_args={"code": code, "name": name},
        )
        bu_id = rows[0]["id"] if rows else None

    # 7. Create schema <code>
    logger.info("Creating schema '%s' in db '%s'", code, db_name)
    await exec_sql(
        db_name=db_name,
        schema="security",
        sql=pgsql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(pgsql.Identifier(code)),
    )

    # 8. Create all BU tables in the new schema
    logger.info("Running BU_SCHEMA_DDL in schema '%s'", code)
    await exec_sql(
        db_name=db_name,
        schema=code,
        sql=SqlBu.BU_SCHEMA_DDL,
    )

    # 9. Seed lookup data
    logger.info("Seeding lookup data in schema '%s'", code)
    await exec_sql(
        db_name=db_name,
        schema=code,
        sql=SeedBuData.BU_SEED_SQL,
    )

    # 10. Audit log
    await audit_logger.log(
        action=AuditAction.CREATE_BU_SCHEMA,
        resource_name=code,
        resource_type="bu_schema",
    )

    logger.info("BU '%s' created successfully with schema and seed data", code)
    return {"code": code, "id": bu_id, "name": name}


async def resolve_create_business_user_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Decode value payload, hash a temp password, create a business user (is_admin=False)
    in the specified client database, and email credentials.

    Value payload (URL-encoded JSON): { email, full_name, mobile, username }
    """
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "createBusinessUser")

    email = payload.get("email", "")
    full_name = payload.get("full_name", "")
    mobile = payload.get("mobile") or None
    username = payload.get("username", "")

    if not email or not full_name or not username:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"fields": ["email", "full_name", "username"]},
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
    record_id = await exec_sql_object(db_name, schema_name, sql_object)
    logger.info("Business user created with id=%s", record_id)

    # Generate reset link so user can set their own password
    token = create_reset_token({"sub": str(record_id), "db_name": db_name})
    reset_link = f"{settings.frontend_url}/reset-password?token={token}"

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


async def resolve_create_client_helper(db_name: str, schema: str, value: str) -> dict:
    """
    Decode value payload, insert a new client row, and optionally send a welcome
    email to the client's email address if one was provided.

    Value payload (URL-encoded JSON): { address_line1?, address_line2?, city?,
        code, country_code?, email?, gstin?, is_active, name, pan?, phone?,
        pincode?, state? }
    """
    # pylint: disable=unused-argument
    payload = _decode_value(value, "createClient")

    code = payload.get("code", "")
    name = payload.get("name", "")
    email = payload.get("email") or None

    if not code or not name:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"fields": ["code", "name"]},
        )

    x_data: dict = {
        "code": code,
        "name": name,
        "is_active": payload.get("is_active", True),
    }
    for field in (
        "address_line1",
        "address_line2",
        "city",
        "country_code",
        "email",
        "gstin",
        "pan",
        "phone",
        "pincode",
        "state",
    ):
        val = payload.get(field)
        if val:
            x_data[field] = val

    sql_object = {"tableName": "client", "xData": x_data}
    record_id = await exec_sql_object(None, "public", sql_object)
    logger.info("Client '%s' created with id=%s", name, record_id)

    email_sent = False
    if email:
        try:
            await send_email(
                to=email,
                subject=AppMessages.EMAIL_CLIENT_WELCOME_SUBJECT,
                body=AppMessages.EMAIL_CLIENT_WELCOME_BODY.format(code=code, name=name),
            )
            email_sent = True
        except Exception as mail_err:  # pylint: disable=broad-except
            logger.warning("Failed to send welcome email to %s: %s", email, mail_err)

    await audit_logger.log(
        action=AuditAction.CREATE_CLIENT,
        resource_id=str(record_id),
        resource_name=name,
        resource_type="client",
    )
    return {"email_sent": email_sent, "id": record_id}


async def resolve_create_service_db_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Decode value payload, create a new PostgreSQL service database with the security
    schema for a client, then record the db_name on the client row.

    Value payload (URL-encoded JSON): { client_id, new_db_name }
    """
    # pylint: disable=unused-argument
    payload = _decode_value(value, "createServiceDb")

    client_id = payload.get("client_id")
    new_db_name = payload.get("new_db_name", "")

    if not client_id or not new_db_name:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"fields": ["client_id", "new_db_name"]},
        )

    # 1. Validate new_db_name format
    if not re.match(r"^service_plus_[a-z0-9_]+$", new_db_name):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={
                "detail": "Database name must match ^service_plus_[a-z0-9_]+$",
                "field": "new_db_name",
            },
        )

    # 2. Check new_db_name uniqueness against pg_database
    logger.info("Checking db_name uniqueness: %s", new_db_name)
    rows = await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlStore.CHECK_DB_NAME_EXISTS,
        sql_args={"db_name": new_db_name},
    )
    if rows and rows[0].get("exists"):
        raise ValidationException(
            message=AppMessages.CLIENT_DB_NAME_EXISTS,
            extensions={"field": "new_db_name"},
        )

    # 3. CREATE DATABASE (requires autocommit)
    logger.info("Creating database: %s", new_db_name)
    await exec_sql_dml(
        db_name=None,
        schema="public",
        sql=pgsql.SQL("CREATE DATABASE {}").format(pgsql.Identifier(new_db_name)),
    )

    # 4. Set up security schema inside the new database. SqlSecurity.SECURITY_SCHEMA_DDL
    # is generated from service_plus_service.sql and contains only table/constraint DDL
    # (no CREATE SCHEMA statements — those are stripped by the extractor), so the schema
    # itself is created here explicitly, mirroring how the BU flow creates its schema
    # as a separate step before running BU_SCHEMA_DDL.
    logger.info("Setting up security schema in: %s", new_db_name)
    await exec_sql(
        db_name=new_db_name,
        schema="security",
        sql="DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA IF NOT EXISTS security;",
    )
    await exec_sql(
        db_name=new_db_name,
        schema="security",
        sql=SqlSecurity.SECURITY_SCHEMA_DDL,
    )

    # 4a. Seed baseline security data (default roles, etc.) — folds what used to be a
    # separate client-driven wizard step into schema creation itself.
    logger.info("Seeding security schema in: %s", new_db_name)
    await exec_sql(
        db_name=new_db_name,
        schema="security",
        sql=SeedSecurityData.SECURITY_SEED_SQL,
    )

    # 5. Persist new_db_name on the client record
    logger.info("Updating client %s db_name → %s", client_id, new_db_name)
    await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlStore.UPDATE_CLIENT_DB_NAME,
        sql_args={"db_name": new_db_name, "id": client_id},
    )

    logger.info("Client %s successfully initiated with db: %s", client_id, new_db_name)
    await audit_logger.log(
        action=AuditAction.CREATE_SERVICE_DB,
        resource_name=new_db_name,
        resource_type="database",
    )
    return {"db_name": new_db_name, "id": client_id}


async def resolve_feed_bu_seed_data_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Feed seed data into an existing BU schema without recreating the schema or tables.
    All INSERTs in BU_SEED_SQL use ON CONFLICT DO NOTHING — fully idempotent.

    Value payload (URL-encoded JSON): { code }
    """
    # pylint: disable=unused-argument
    payload = _decode_value(value, "feedBuSeedData")

    code: str = (payload.get("code") or "").lower().strip()

    if not code:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "code"},
        )

    if not re.match(r"^[a-z0-9_]{3,9}$", code):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={
                "detail": "Code must be 3–9 alphanumeric/underscore characters",
                "field": "code",
            },
        )

    # Guard: schema must already exist
    rows = await exec_sql(
        db_name=db_name,
        schema="security",
        sql=SqlStore.CHECK_SCHEMA_EXISTS,
        sql_args={"code": code},
    )
    if not (rows and rows[0].get("exists")):
        raise ValidationException(
            message=AppMessages.RESOURCE_NOT_FOUND,
            extensions={"detail": f"Schema '{code}' does not exist", "field": "code"},
        )

    logger.info(
        "Seeding lookup data into existing schema '%s' in db '%s'", code, db_name
    )
    await exec_sql(
        db_name=db_name,
        schema=code,
        sql=SeedBuData.BU_SEED_SQL,
    )

    await audit_logger.log(
        action=AuditAction.FEED_BU_SEED_DATA,
        resource_name=code,
        resource_type="bu_schema",
    )
    logger.info("Seed data fed into schema '%s' successfully", code)
    return {"code": code}


async def resolve_seed_security_data_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Feed seed data into an already-provisioned client's security schema without
    recreating it. All INSERTs use ON CONFLICT DO NOTHING — fully idempotent,
    safe to call even if some/all rows already exist.

    Value payload (URL-encoded JSON): { stage?: "roles" | "access_rights" } —
    lets the two-step re-seed wizard (SeedRolesDialog) seed just the roles
    table or just access_right/role_access_right independently. A missing or
    unrecognized stage runs the full combined seed, preserving the original
    behavior for any other caller.
    """
    # pylint: disable=unused-argument
    payload = _decode_value(value, "seedSecurityData")
    stage = payload.get("stage")

    if stage == "roles":
        sql = SeedSecurityData.ROLE_SEED_SQL
    elif stage == "access_rights":
        sql = SeedSecurityData.ACCESS_RIGHT_SEED_SQL
    else:
        sql = SeedSecurityData.SECURITY_SEED_SQL

    logger.info("Seeding security schema data (stage=%s) in db '%s'", stage or "all", db_name)
    await exec_sql(
        db_name=db_name,
        schema="security",
        sql=sql,
    )

    await audit_logger.log(
        action=AuditAction.SEED_SECURITY_DATA,
        resource_name=db_name,
        resource_type="security_schema",
    )
    logger.info("Security seed data fed into db '%s' successfully", db_name)
    return {"db_name": db_name}


async def resolve_delete_bu_schema_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Drop a BU schema from the database and optionally delete the security.bu row.

    Value payload (URL-encoded JSON): { code, delete_bu_row: bool }
    - code: schema name (lowercase, 3–9 chars, alphanumeric + underscore)
    - delete_bu_row: if true, also DELETE FROM security.bu WHERE LOWER(code) = code
    """
    # pylint: disable=unused-argument
    payload = _decode_value(value, "deleteBuSchema")

    code: str = (payload.get("code") or "").lower().strip()
    delete_bu_row: bool = bool(payload.get("delete_bu_row", False))

    if not code:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "code"},
        )

    if not re.match(r"^[a-z0-9_]{3,9}$", code):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={
                "detail": "Code must be 3–9 alphanumeric/underscore characters",
                "field": "code",
            },
        )

    # Drop schema CASCADE (autocommit DDL)
    logger.info("Dropping schema '%s' in db '%s'", code, db_name)
    await exec_sql_dml(
        db_name=db_name,
        schema="security",
        sql=pgsql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(
            pgsql.Identifier(code)
        ),
    )

    # Optionally delete the bu row
    if delete_bu_row:
        logger.info("Deleting security.bu row for code='%s'", code)
        await exec_sql(
            db_name=db_name,
            schema="security",
            sql=SqlStore.DELETE_BU_BY_CODE,
            sql_args={"code": code},
        )

    await audit_logger.log(
        action=AuditAction.DROP_DATABASE,
        resource_name=code,
        resource_type="bu_schema",
    )
    logger.info("Schema '%s' dropped successfully", code)
    return {"code": code, "delete_bu_row": delete_bu_row}


async def resolve_delete_client_helper(db_name: str, schema: str, value: str) -> dict:
    """
    Decode value payload, guard that client is inactive, drop its database,
    then delete the client row.

    Value payload (URL-encoded JSON): { client_id }
    """
    # pylint: disable=unused-argument
    payload = _decode_value(value, "deleteClient")

    client_id = payload.get("client_id")
    if not client_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "client_id"},
        )

    # 1. Fetch client row for server-side guard
    client_rows = await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlStore.GET_CLIENT_BY_ID,
        sql_args={"id": client_id},
    )
    if not client_rows:
        raise ValidationException(message=AppMessages.NOT_FOUND)

    client = client_rows[0]
    if client.get("is_active"):
        raise ValidationException(
            message=AppMessages.CLIENT_MUST_BE_DISABLED,
            extensions={"field": "is_active"},
        )

    # 2. Drop the associated database if present
    db_name_val = client.get("db_name")
    if db_name_val:
        logger.info("Dropping client database: %s", db_name_val)
        await exec_sql_dml(
            db_name=None,
            schema="public",
            sql=pgsql.SQL("DROP DATABASE IF EXISTS {}").format(
                pgsql.Identifier(db_name_val)
            ),
        )

    # 3. Delete the client row
    await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlStore.DELETE_CLIENT,
        sql_args={"id": client_id},
    )

    logger.info("Client id=%s deleted", client_id)
    await audit_logger.log(
        action=AuditAction.DELETE_CLIENT,
        resource_id=str(client_id),
        resource_name=client.get("name", ""),
        resource_type="client",
    )
    return {"id": client_id}


async def resolve_drop_database_helper(db_name: str, schema: str, value: str) -> dict:
    """
    Decode value payload and physically drop an orphan PostgreSQL database.

    Value payload (URL-encoded JSON): { db_name }
    """
    # pylint: disable=unused-argument
    payload = _decode_value(value, "dropDatabase")

    target_db = payload.get("db_name", "")
    if not target_db:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "db_name"},
        )

    # 1. Validate format
    if not re.match(r"^service_plus_[a-z0-9_]+$", target_db):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={
                "detail": "Database name must match ^service_plus_[a-z0-9_]+$",
                "field": "db_name",
            },
        )

    # 2. Safety check — refuse to drop if still linked to a client
    in_use_rows = await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlStore.CHECK_CLIENT_DB_NAME_IN_USE,
        sql_args={"db_name": target_db},
    )
    if in_use_rows and in_use_rows[0].get("exists"):
        raise ValidationException(
            message=AppMessages.DB_DROP_FORBIDDEN,
            extensions={"field": "db_name"},
        )

    # 3. Verify database exists
    exists_rows = await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlStore.CHECK_DB_NAME_EXISTS,
        sql_args={"db_name": target_db},
    )
    if not (exists_rows and exists_rows[0].get("exists")):
        raise ValidationException(
            message=AppMessages.RESOURCE_NOT_FOUND,
            extensions={"field": "db_name"},
        )

    # 4. DROP DATABASE (requires autocommit)
    logger.info("Dropping orphan database: %s", target_db)
    await exec_sql_dml(
        db_name=None,
        schema="public",
        sql=pgsql.SQL("DROP DATABASE {}").format(pgsql.Identifier(target_db)),
    )

    logger.info("Orphan database dropped: %s", target_db)
    await audit_logger.log(
        action=AuditAction.DROP_DATABASE,
        resource_name=target_db,
        resource_type="database",
    )
    return {"db_name": target_db}


async def resolve_mail_business_user_credentials_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Decode value payload, generate a new temporary password for the business user,
    update the hash in the database, and email the new credentials.

    Value payload (URL-encoded JSON): { id }
    """
    payload = _decode_value(value, "mailBusinessUserCredentials")

    id_ = payload.get("id")
    if not id_:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "id"},
        )

    schema_name = schema or "security"

    # 1. Fetch business user (is_admin=false guard)
    rows = await exec_sql(
        db_name=db_name,
        schema=schema_name,
        sql=SqlStore.GET_BUSINESS_USER_BY_ID,
        sql_args={"id": id_},
    )
    if not rows:
        raise ValidationException(
            message=AppMessages.NOT_FOUND,
            extensions={"field": "id"},
        )
    user = rows[0]

    logger.info("Generating reset link for business user id=%s in %s", id_, db_name)

    # 2. Generate reset token — no password change in DB at this stage
    token = create_reset_token({"sub": str(id_), "db_name": db_name})
    reset_link = f"{settings.frontend_url}/reset-password?token={token}"

    # 3. Email reset link
    email_sent = False
    email_error: str | None = None
    try:
        await send_email(
            to=user["email"],
            subject=AppMessages.EMAIL_BU_RESET_LINK_SUBJECT,
            body=AppMessages.EMAIL_BU_RESET_LINK_BODY.format(
                full_name=user["full_name"],
                reset_link=reset_link,
            ),
        )
        email_sent = True
    except Exception as mail_err:  # pylint: disable=broad-except
        email_error = str(mail_err)
        logger.warning(
            "Failed to send reset link email to %s: %s", user["email"], mail_err
        )

    await audit_logger.log(
        action=AuditAction.MAIL_ADMIN_CREDENTIALS,
        detail=f"email_sent={email_sent}"
        + (f", error={email_error}" if email_error else ""),
        resource_id=str(id_),
        resource_name=user.get("username", ""),
        resource_type="business_user",
    )
    return {"email_error": email_error, "email_sent": email_sent, "id": id_}


async def resolve_generic_update_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> int | None:
    """
    Decode, validate and execute a generic update SQL object.
    """
    if not value:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "value"},
        )

    db_name_arg: str = db_name or ""
    logger.debug("Updating database entry in: %s", db_name_arg or "client_db")

    value_string = unquote(value)
    try:
        sql_object: dict = json.loads(value_string)
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in value parameter: %s", e)
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_VALUE},
        ) from e
    if not isinstance(sql_object, dict):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_OBJECT},
        )

    record_id = await exec_sql_object(db_name_arg, schema or "public", sql_object)

    logger.debug("Database entry updated in: %s", db_name_arg or "client_db")
    return record_id


async def resolve_create_sales_invoice_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """
    Create a sales invoice and atomically generate the invoice number in a single transaction.

    The client sends the sql_object for the sales_invoice insert (with nested xDetails for
    lines and stock_transactions), plus top-level `branch_id` and `division_id` used to claim
    the next SALES_INVOICE sequence number server-side. The claim (UPDATE ... RETURNING) and
    the insert share one transaction, so a failed insert rolls back the claimed number and
    concurrent creates never collide.
    """
    payload = _decode_value(value, "createSalesInvoice")
    x_data = payload.get("xData", {})

    branch_id = payload.pop("branch_id", None)
    division_id = payload.pop("division_id", None)

    if not branch_id or not division_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/division_id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Claim next invoice number atomically
            await cur.execute(
                SqlStore.CLAIM_NEXT_SALES_INVOICE_NUMBER,
                {"branch_id": branch_id, "division_id": division_id},
            )
            seq = await cur.fetchone()
            if not seq:
                raise ValidationException(
                    message=AppMessages.RESOURCE_NOT_FOUND,
                    extensions={
                        "detail": "SALES_INVOICE sequence not configured for this division"
                    },
                )

            # 2. Format invoice number
            invoice_no = (
                f"{seq['prefix'] or ''}"
                f"{seq['separator'] or ''}"
                f"{str(seq['assigned_number']).zfill(seq['padding'] or 0)}"
            )
            x_data["invoice_no"] = invoice_no

            # 3. Insert sales_invoice + lines + stock_transactions in the same transaction
            record_id = await process_data(x_data, cur, "sales_invoice", None, None)
            logger.info("Sales invoice created id=%s invoice_no=%s", record_id, invoice_no)

    return record_id


async def resolve_create_job_invoice_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """
    Create a job invoice and atomically generate the invoice number in a single transaction.
    The client sends all invoice data (including lines) plus branch_id and division_id.
    The server claims the next SERVICE_INVOICE sequence number and inserts everything atomically.
    """
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "createJobInvoice")
    x_data = payload.get("xData", {})

    branch_id = x_data.pop("branch_id", None)
    division_id = x_data.pop("division_id", None)

    if not branch_id or not division_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/division_id"},
        )

    x_details = x_data.get("xDetails")
    has_lines = bool(x_details) and any(
        item.get("tableName") == "job_invoice_line" and item.get("xData")
        for item in (x_details if isinstance(x_details, list) else [x_details])
    )
    if not has_lines:
        raise ValidationException(
            message="Invoice must have at least one line item",
            extensions={"field": "xDetails"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Idempotency check — return existing invoice if already created
            await cur.execute(
                SqlStore.GET_JOB_INVOICE_ID_BY_JOB_FOR_UPDATE,
                {"job_id": x_data.get("job_id")},
            )
            existing = await cur.fetchone()
            if existing:
                return existing["id"]

            # 1b. Enforce that the job must be delivered before an invoice can be created
            await cur.execute(SqlStore.GET_JOB_IS_CLOSED, {"job_id": x_data.get("job_id")})
            job_row = await cur.fetchone()
            if not job_row or not job_row["is_closed"]:
                raise ValidationException(
                    message="Invoice can only be created for a delivered job",
                    extensions={"field": "job_id"},
                )

            # 2. Claim next invoice number atomically
            await cur.execute(
                SqlStore.CLAIM_NEXT_INVOICE_NUMBER,
                {"branch_id": branch_id, "division_id": division_id},
            )
            seq = await cur.fetchone()
            if not seq:
                raise ValidationException(
                    message=AppMessages.RESOURCE_NOT_FOUND,
                    extensions={
                        "detail": "SERVICE_INVOICE sequence not configured for this division"
                    },
                )

            # 3. Format invoice number
            invoice_no = (
                f"{seq['prefix'] or ''}"
                f"{seq['separator'] or ''}"
                f"{str(seq['assigned_number']).zfill(seq['padding'] or 0)}"
            )
            x_data["invoice_no"] = invoice_no

            # 4. Insert job_invoice + lines in the same transaction
            invoice_id = await process_data(x_data, cur, "job_invoice", None, None)
            logger.info("Job invoice created id=%s invoice_no=%s", invoice_id, invoice_no)

    return invoice_id


async def resolve_create_job_payment_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Record a payment against a job and update its status."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "createJobPayment")
    x_data = payload.get("xData", {})
    branch_id = x_data.pop("branch_id", None)
    job_id = x_data.get("job_id")

    if not branch_id or not job_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/job_id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            await cur.execute(
                SqlStore.CLAIM_NEXT_RECEIPT_NUMBER,
                {"branch_id": branch_id, "job_id": job_id},
            )
            seq = await cur.fetchone()
            if not seq:
                raise ValidationException(
                    message=AppMessages.RESOURCE_NOT_FOUND,
                    extensions={
                        "detail": "MONEY_RECEIPT sequence not configured for this division"
                    },
                )
            receipt_no = (
                f"{seq['prefix'] or ''}"
                f"{seq['separator'] or ''}"
                f"{str(seq['assigned_number']).zfill(seq['padding'] or 0)}"
            )
            x_data["receipt_no"] = receipt_no
            payment_id = await process_data(x_data, cur, "job_payment", None, None)
            logger.info("Job payment created id=%s receipt_no=%s", payment_id, receipt_no)

    return payment_id


async def resolve_regenerate_job_invoice_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """
    Regenerate a job invoice atomically: delete existing lines, update header amounts
    (preserving invoice_no and id), then insert new lines — all in one transaction.
    """
    # pylint: disable=too-many-locals
    payload     = _decode_value(value, "regenerateJobInvoice")
    x_data      = payload.get("xData", {})
    invoice_id  = x_data["invoice_id"]
    aggregate   = x_data["aggregate"]
    cgst_amount = x_data["cgst_amount"]
    sgst_amount = x_data["sgst_amount"]
    igst_amount = x_data["igst_amount"]
    amount      = x_data["amount"]
    lines       = x_data.get("lines", [])

    if not lines:
        raise ValidationException(
            message="Invoice must have at least one line item to regenerate",
            extensions={"field": "lines"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            await cur.execute(
                SqlStore.DELETE_JOB_INVOICE_LINES_BY_INVOICE, {"invoice_id": invoice_id}
            )
            await cur.execute(
                SqlStore.UPDATE_JOB_INVOICE_AMOUNTS,
                {"invoice_id": invoice_id, "aggregate": aggregate,
                 "cgst_amount": cgst_amount, "sgst_amount": sgst_amount,
                 "igst_amount": igst_amount, "amount": amount},
            )
            for line in lines:
                line_data = {**line, "job_invoice_id": invoice_id}
                await process_data(line_data, cur, "job_invoice_line", None, None)

    logger.info("Job invoice id=%s regenerated with %s lines", invoice_id, len(lines))
    return invoice_id


async def resolve_create_single_job_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """
    Create a single job and atomically increment the document sequence.
    """
    if not value:
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_OBJECT},
        )
    value_string = unquote(value)
    try:
        payload: dict = json.loads(value_string)
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in createSingleJob value: %s", e)
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_OBJECT},
        ) from e

    x_data = payload.get("xData", {})
    performed_by_user_id = x_data.pop("performed_by_user_id", None)
    branch_id = x_data.get("branch_id")

    if not branch_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Claim next sequence number atomically
            await cur.execute(
                SqlStore.CLAIM_NEXT_JOB_NUMBER, {"branch_id": branch_id}
            )
            seq = await cur.fetchone()
            if not seq:
                raise ValidationException(
                    message=AppMessages.RESOURCE_NOT_FOUND,
                    extensions={
                        "detail": "Job sequence not configured for this branch"
                    },
                )

            # 2. Format job number
            job_no = (
                f"{seq['prefix'] or ''}{seq['separator'] or ''}"
                f"{str(seq['assigned_number']).zfill(seq['padding'])}"
            )
            x_data["job_no"] = job_no

            # 3. Insert the job
            job_id = await process_data(x_data, cur, "job", None, None)
            logger.info("Single job created with id=%s, job_no=%s", job_id, job_no)

            # 4. Opening Jobs: record the user-selected initial status as a real
            # job_transaction row. Unlike Single Job (always created as RECEIVED),
            # an opening job's starting status is user-chosen, so the transaction
            # history needs a real row to reflect it accurately.
            if x_data.get("is_opening_job"):
                txn_data: dict = {
                    "job_id": job_id,
                    "status_id": x_data.get("job_status_id"),
                    "performed_by_user_id": performed_by_user_id,
                }
                technician_id = x_data.get("technician_id")
                if technician_id is not None:
                    txn_data["technician_id"] = technician_id
                job_date = x_data.get("job_date")
                if job_date:
                    txn_data["transaction_date"] = job_date

                new_txn_id = await process_data(txn_data, cur, "job_transaction", None, None)
                if new_txn_id:
                    await process_data(
                        {"id": job_id, "last_transaction_id": new_txn_id},
                        cur, "job", None, None,
                    )
                logger.info(
                    "Opening job %s: recorded initial transaction id=%s, status_id=%s",
                    job_id, new_txn_id, txn_data["status_id"],
                )

    return job_id


async def resolve_update_opening_job_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """
    Update an Opening Job.

    Opening Jobs let the user set/change Status directly on the edit form
    (unlike the normal Job Control pipeline, which changes status only via a
    dedicated Status Transition step). A plain field update on `job` alone
    would silently disconnect job.job_status_id from job_transaction, so
    Transaction History would stop reflecting the job's real status history.
    We read the pre-update status, and if the edit changes it, record a real
    job_transaction row (mirroring the initial-status insert done on create),
    the same way resolve_update_job_helper does for Job Control transitions —
    but without that helper's Job-Control-specific side effects (estimate
    amount defaulting, is_closed recompute, division-change-on-final guard),
    which don't apply to Opening Jobs' free-form edit.
    """
    payload = _decode_value(value, "updateOpeningJob")
    x_data = payload.get("xData", {})
    performed_by_user_id = x_data.pop("performed_by_user_id", None)
    job_id = x_data.get("id")
    if not job_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            await cur.execute("SELECT job_status_id FROM job WHERE id = %s", (job_id,))
            current = await cur.fetchone()
            previous_status_id = current["job_status_id"] if current else None

            await process_data(x_data, cur, "job", None, None)
            logger.info("Opening job %s updated", job_id)

            new_status_id = x_data.get("job_status_id")
            if new_status_id is not None and new_status_id != previous_status_id:
                txn_data: dict = {
                    "job_id": job_id,
                    "status_id": new_status_id,
                    "performed_by_user_id": performed_by_user_id,
                }
                technician_id = x_data.get("technician_id")
                if technician_id is not None:
                    txn_data["technician_id"] = technician_id
                job_date = x_data.get("job_date")
                if job_date:
                    txn_data["transaction_date"] = job_date

                new_txn_id = await process_data(txn_data, cur, "job_transaction", None, None)
                if new_txn_id:
                    await process_data(
                        {"id": job_id, "last_transaction_id": new_txn_id},
                        cur, "job", None, None,
                    )
                logger.info(
                    "Opening job %s: status changed %s -> %s, recorded transaction id=%s",
                    job_id, previous_status_id, new_status_id, new_txn_id,
                )

    return job_id


async def resolve_update_job_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Update fields on an existing job record."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "updateJob")

    job_id = payload.pop("job_id")
    last_transaction_id = payload.pop("last_transaction_id", None)
    performed_by = payload.pop("performed_by_user_id", None)
    remarks = payload.pop("remarks", "")
    transaction_date = payload.pop("transaction_date", None)
    x_data = payload.get("xData", {})

    # Prevent NULL from being written into the NOT NULL estimate_amount column.
    # Null arrives when: (a) user skips the estimate field, or (b) the job row
    # already has NULL due to legacy data and the transition doesn't update estimate.
    if x_data.get("estimate_amount") is None:
        x_data["estimate_amount"] = 0

    job_status_id = x_data.get("job_status_id")
    technician_id = x_data.get("technician_id")
    amount = x_data.get("amount")

    # Enforce is_closed from the canonical _STATUS_FLAGS so the DB stays
    # consistent regardless of what the client sends.  is_final is intentionally
    # left to the client because it is set in a separate "Final the Job" step.
    if job_status_id is not None and job_status_id in _STATUS_FLAGS:
        x_data["is_closed"] = _STATUS_FLAGS[job_status_id]["is_closed"]

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    txn_data: dict = {
        "job_id": job_id,
        "status_id": job_status_id,
        "performed_by_user_id": performed_by,
    }
    if technician_id is not None:
        txn_data["technician_id"] = technician_id
    if amount is not None:
        txn_data["amount"] = amount
    if remarks:
        txn_data["remarks"] = remarks
    if transaction_date:
        txn_data["transaction_date"] = transaction_date
    if last_transaction_id is not None:
        txn_data["previous_transaction_id"] = last_transaction_id

    new_txn_id: int | None = None

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Guard: block division change on a finalised job
            if "division_id" in x_data:
                await cur.execute(SqlStore.GET_JOB_IS_FINAL, {"id": job_id})
                job_row = await cur.fetchone()
                if job_row and job_row["is_final"]:
                    raise ValidationException(
                        message="Cannot change division after job is finalized.",
                        extensions={"field": "division_id"},
                    )

            # 2. Update the job row
            await process_data(x_data, cur, "job", None, None)
            logger.info("Job %s updated", job_id)

            # 3. Insert job_transaction
            new_txn_id = await process_data(txn_data, cur, "job_transaction", None, None)
            logger.debug("Job transaction inserted, id=%s", new_txn_id)

            # 3. Update job.last_transaction_id
            if new_txn_id:
                await process_data(
                    {"id": job_id, "last_transaction_id": new_txn_id},
                    cur, "job", None, None,
                )
                logger.debug("job.last_transaction_id updated to %s", new_txn_id)

    return new_txn_id


# Mirrors STATUS_FLAGS in status-transitions.ts
_STATUS_FLAGS: dict[int, dict[str, bool]] = {
    1:  {"is_final": False, "is_closed": False},  # RECEIVED
    2:  {"is_final": False, "is_closed": False},  # ASSIGNED
    3:  {"is_final": False, "is_closed": False},  # ESTIMATED
    4:  {"is_final": False, "is_closed": False},  # ESTIMATE_APPROVED
    5:  {"is_final": False, "is_closed": False},  # ESTIMATE_REJECTED
    6:  {"is_final": False, "is_closed": False},  # IN_PROGRESS
    7:  {"is_final": False, "is_closed": False},  # PARTS_PENDING
    8:  {"is_final": False, "is_closed": False},  # ON_HOLD
    9:  {"is_final": False, "is_closed": False},  # OUTSOURCED
    10: {"is_final": False, "is_closed": False},  # SENT_TO_COMPANY
    11: {"is_final": True,  "is_closed": False},  # COMPLETED_OK
    12: {"is_final": True,  "is_closed": False},  # RETURN
    13: {"is_final": False, "is_closed": True },  # DELIVERED_OK
    14: {"is_final": False, "is_closed": True },  # DELIVERED_NOT_OK
    15: {"is_final": True,  "is_closed": False},  # CANCELLED
    16: {"is_final": True,  "is_closed": True },  # DISPOSED
    17: {"is_final": False, "is_closed": False},  # RECEIVED_BACK_FROM_COMPANY
}


async def resolve_undo_job_transaction_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Undo the last transaction on a job and restore its previous state."""
    # pylint: disable=too-many-locals
    payload     = _decode_value(value, "undoJobTransaction")
    job_id      = payload["job_id"]
    last_txn_id = payload["last_transaction_id"]

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Stale guard — confirm this txn is still job.last_transaction_id
            await cur.execute(
                SqlStore.GET_JOB_TRANSACTION_FOR_UNDO,
                {"job_id": job_id, "last_txn_id": last_txn_id},
            )
            rows = await cur.fetchall()
            if not rows:
                raise ValidationException("Transaction no longer current — page may be stale.")
            prev_txn_id = rows[0]["previous_transaction_id"]

            # 2. Fallback if previous_transaction_id link was never populated
            if prev_txn_id is None:
                await cur.execute(
                    SqlStore.GET_PREV_JOB_TRANSACTION_FALLBACK,
                    {"job_id": job_id, "last_txn_id": last_txn_id},
                )
                fallback = await cur.fetchall()
                if fallback:
                    prev_txn_id = fallback[0]["id"]

            # 3. Fetch previous state (skipped when undoing the very first real transaction)
            if prev_txn_id is not None:
                await cur.execute(
                    SqlStore.GET_JOB_TRANSACTION_STATE,
                    {"prev_txn_id": prev_txn_id},
                )
                prev_rows = await cur.fetchall()
                if not prev_rows:
                    raise ValidationException("Previous transaction not found.")
                prev  = prev_rows[0]
                flags = _STATUS_FLAGS.get(
                    prev["status_id"], {"is_final": False, "is_closed": False}
                )
            else:
                # No earlier real transaction — restore to the job's implicit initial Received state
                prev  = {"status_id": 1, "technician_id": None, "amount": 0, "estimate_amount": 0}
                flags = _STATUS_FLAGS.get(1, {"is_final": False, "is_closed": False})

            # 4 + 5 are atomic: if 5 fails, 4 is rolled back automatically
            await cur.execute(
                SqlStore.DELETE_JOB_TRANSACTION,
                {"last_txn_id": last_txn_id},
            )
            logger.info("Undid job transaction %s for job %s", last_txn_id, job_id)

            await cur.execute(
                SqlStore.RESTORE_JOB_FROM_TRANSACTION,
                {
                    "job_id":              job_id,
                    "job_status_id":       prev["status_id"],
                    "technician_id":       prev["technician_id"],
                    "amount":              prev["amount"],
                    # None → COALESCE keeps existing
                    "estimate_amount":     prev.get("estimate_amount"),
                    "is_final":            flags["is_final"],
                    "is_closed":           flags["is_closed"],
                    "last_transaction_id": prev_txn_id,
                },
            )
            logger.info("Job %s restored to transaction %s", job_id, prev_txn_id)

    return {"job_id": job_id, "restored_transaction_id": prev_txn_id}


async def resolve_undeliver_job_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Undeliver a job: restore the status it had before delivery and reopen it.

    Reverts the job to its most recent non-delivered transaction (skipping any
    delivery transactions, so stacked re-deliveries are handled), deletes the
    delivery transaction(s), clears the delivery date and the is_closed flag.
    """
    payload = _decode_value(value, "undeliverJob")
    job_id  = payload["job_id"]

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Find the state the job was in just before it was delivered
            await cur.execute(
                SqlStore.GET_LAST_NON_DELIVERED_TRANSACTION, {"job_id": job_id}
            )
            rows = await cur.fetchall()
            if rows:
                prev          = rows[0]
                target_txn_id = prev["id"]
                status_id     = prev["status_id"]
                technician_id = prev["technician_id"]
            else:
                # No earlier non-delivered transaction — fall back to Received
                target_txn_id = None
                status_id     = 1
                technician_id = None
            flags = _STATUS_FLAGS.get(status_id, {"is_final": False, "is_closed": False})

            # 2. Remove the delivery transaction(s), delete the invoice, then restore the job (atomic)
            await cur.execute(SqlStore.DELETE_DELIVERY_TRANSACTIONS, {"job_id": job_id})
            await cur.execute(SqlStore.DELETE_JOB_INVOICE_BY_JOB, {"job_id": job_id})
            await cur.execute(
                SqlStore.UNDELIVER_JOB,
                {
                    "job_id":              job_id,
                    "job_status_id":       status_id,
                    "technician_id":       technician_id,
                    "is_final":            flags["is_final"],
                    "last_transaction_id": target_txn_id,
                },
            )
            logger.info("Job %s undelivered, invoice deleted, restored to status %s", job_id, status_id)

    return {"job_id": job_id, "restored_status_id": status_id}


async def resolve_deliver_job_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Mark a job as delivered and record the delivery transaction."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "deliverJob")

    job_id = payload.pop("job_id")
    last_transaction_id = payload.pop("last_transaction_id", None)
    performed_by = payload.pop("performed_by_user_id", None)
    delivered_status_id = payload.pop("delivered_status_id")
    delivery_date = payload.pop("delivery_date")
    delivery_manner_name = payload.pop("delivery_manner_name", "")
    remarks = payload.pop("remarks", "")
    payment = payload.pop("payment", {})

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    payment_amount = payment.get("amount", 0) or 0
    payment_data = {
        "job_id": job_id,
        "payment_date": payment.get("payment_date"),
        "payment_mode": payment.get("payment_mode", ""),
        "amount": payment_amount,
        "reference_no": payment.get("reference_no", ""),
        "remarks": payment.get("remarks", ""),
    }

    notes_parts = [p for p in [delivery_manner_name, remarks] if p]
    full_notes = ". ".join(notes_parts)

    txn_data: dict = {
        "job_id": job_id,
        "status_id": delivered_status_id,
        "performed_by_user_id": performed_by,
    }
    if full_notes:
        txn_data["remarks"] = full_notes
    if last_transaction_id is not None:
        txn_data["previous_transaction_id"] = last_transaction_id

    new_txn_id: int | None = None

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Insert job_payment if amount > 0
            if payment_amount > 0:
                await process_details({"tableName": "job_payment", "xData": payment_data}, cur)
                logger.info("Payment inserted for job %s, amount=%s", job_id, payment_amount)

            # 2. Update job: close it and record delivery
            await process_details(
                {
                    "tableName": "job",
                    "xData": {
                        "id": job_id,
                        "is_closed": True,
                        "delivery_date": delivery_date,
                        "job_status_id": delivered_status_id,
                    },
                },
                cur,
            )
            logger.info("Job %s closed, delivery_date=%s", job_id, delivery_date)

            # 3. Insert job_transaction
            new_txn_id = await process_details(
                {"tableName": "job_transaction", "xData": txn_data}, cur
            )
            logger.debug("Delivery transaction inserted, id=%s", new_txn_id)

            # 4. Update job.last_transaction_id
            if new_txn_id:
                await process_details(
                    {"tableName": "job", "xData": {"id": job_id, "last_transaction_id": new_txn_id}},
                    cur,
                )
                logger.debug("job.last_transaction_id updated to %s", new_txn_id)

    return new_txn_id


async def resolve_create_job_batch_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Create a batch of jobs from shared data and per-job overrides."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "createJobBatch")
    shared = payload.get("sharedData", {})
    jobs = payload.get("jobs", [])

    branch_id = shared.get("branch_id")
    division_id = shared.get("division_id")
    batch_date = shared.get("batch_date")
    customer_contact_id = shared.get("customer_contact_id")
    job_receive_manner_id = shared.get("job_receive_manner_id")
    job_status_id = shared.get("job_status_id")
    performed_by = shared.get("performed_by_user_id")

    if not branch_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            await cur.execute(SqlStore.CLAIM_NEXT_BATCH_NUMBER)
            batch_no = (await cur.fetchone())["batch_no"]
            logger.info("Assigned batch_no=%s", batch_no)

            job_ids = []
            job_nos = []
            for job in jobs:
                await cur.execute(SqlStore.CLAIM_NEXT_JOB_NUMBER, {"branch_id": branch_id})
                seq = await cur.fetchone()
                if not seq:
                    raise ValidationException(
                        message=AppMessages.RESOURCE_NOT_FOUND,
                        extensions={"detail": "Job sequence not configured for this branch"},
                    )
                job_no = (
                    f"{seq['prefix'] or ''}{seq['separator'] or ''}"
                    f"{str(seq['assigned_number']).zfill(seq['padding'])}"
                )

                job_data = {
                    "branch_id": branch_id,
                    "division_id": division_id,
                    "batch_no": batch_no,
                    "job_no": job_no,
                    "job_date": batch_date,
                    "customer_contact_id": customer_contact_id,
                    "job_type_id": job.get("job_type_id"),
                    "job_receive_manner_id": job_receive_manner_id,
                    "job_status_id": job_status_id,
                    "product_brand_model_id": job.get("product_brand_model_id"),
                    "serial_no": job.get("serial_no"),
                    "problem_reported": job.get("problem_reported"),
                    "warranty_card_no": job.get("warranty_card_no"),
                    "job_receive_condition_id": job.get("job_receive_condition_id"),
                    "remarks": job.get("remarks"),
                    "qty": job.get("qty", 1),
                    "alternate_job_no": job.get("alternate_job_no") or None,
                    "purchase_date": job.get("purchase_date") or None,
                }
                job_id = await process_data(job_data, cur, "job", None, None)
                logger.info("Batch job created with id=%s, job_no=%s", job_id, job_no)
                job_ids.append(job_id)
                job_nos.append(job_no)

                if performed_by is not None:
                    txn_data = {
                        "job_id": job_id,
                        "status_id": job_status_id,
                        "performed_by_user_id": performed_by,
                    }
                    await process_data(txn_data, cur, "job_transaction", None, None)
                    logger.debug("Initial job_transaction inserted for job_id=%s", job_id)

    logger.info("Job batch created: batch_no=%s, jobs=%s, job_nos=%s", batch_no, job_ids, job_nos)
    return {"batch_no": batch_no, "job_ids": job_ids, "job_nos": job_nos}


async def resolve_update_job_batch_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Update header and line items for an existing job batch."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "updateJobBatch")
    batch_no = payload.get("batch_no")
    shared = payload.get("sharedData", {})
    added_jobs = payload.get("addedJobs", [])
    updated_jobs = payload.get("updatedJobs", [])
    deleted_ids = payload.get("deletedJobIds", [])
    performed_by = shared.get("performed_by_user_id")

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            await cur.execute(
                "UPDATE job SET job_date=%s, customer_contact_id=%s,"
                " job_receive_manner_id=%s WHERE batch_no=%s",
                (
                    shared.get("batch_date"),
                    shared.get("customer_contact_id"),
                    shared.get("job_receive_manner_id"),
                    batch_no,
                ),
            )

            for job_id in deleted_ids:
                await cur.execute(
                    "SELECT COUNT(*) AS cnt FROM job_transaction WHERE job_id = %s",
                    (job_id,),
                )
                row = await cur.fetchone()
                if row and row["cnt"] > 1:
                    raise ValidationException(
                        message="Cannot delete job with activity",
                        extensions={"job_id": job_id},
                    )
                await cur.execute(
                    "DELETE FROM job_transaction WHERE job_id = %s", (job_id,)
                )
                await cur.execute("DELETE FROM job WHERE id = %s", (job_id,))

            for job in updated_jobs:
                job_id = job.get("id")
                await cur.execute(
                    "UPDATE job SET job_type_id=%s, product_brand_model_id=%s, serial_no=%s,"
                    " problem_reported=%s, warranty_card_no=%s,"
                    " job_receive_condition_id=%s, remarks=%s, qty=%s,"
                    " alternate_job_no=%s, purchase_date=%s WHERE id=%s",
                    (
                        job.get("job_type_id"),
                        job.get("product_brand_model_id"),
                        job.get("serial_no"),
                        job.get("problem_reported"),
                        job.get("warranty_card_no"),
                        job.get("job_receive_condition_id"),
                        job.get("remarks"),
                        job.get("qty", 1),
                        job.get("alternate_job_no") or None,
                        job.get("purchase_date") or None,
                        job_id,
                    ),
                )

            if added_jobs:
                await cur.execute(
                    "SELECT job_status_id FROM job WHERE batch_no=%s LIMIT 1",
                    (batch_no,),
                )
                status_row = await cur.fetchone()
                job_status_id = status_row["job_status_id"] if status_row else None
                branch_id = shared.get("branch_id")
                division_id = shared.get("division_id")

                for job in added_jobs:
                    # Atomically claim the next job number
                    await cur.execute(SqlStore.CLAIM_NEXT_JOB_NUMBER, {"branch_id": branch_id})
                    seq = await cur.fetchone()
                    if not seq:
                        raise ValidationException(
                            message="Job sequence not configured for this branch",
                            extensions={"detail": "No document_sequence row found for JOB_SHEET"},
                        )
                    job_no = (
                        f"{seq['prefix'] or ''}{seq['separator'] or ''}"
                        f"{str(seq['assigned_number']).zfill(seq['padding'])}"
                    )

                    await cur.execute(
                        "INSERT INTO job"
                        " (branch_id, division_id, batch_no, job_no, job_date, customer_contact_id,"
                        "  job_type_id, job_receive_manner_id, job_status_id,"
                        "  product_brand_model_id, serial_no, problem_reported,"
                        "  warranty_card_no, job_receive_condition_id, remarks, qty, purchase_date)"
                        " VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                        (
                            branch_id,
                            division_id,
                            batch_no,
                            job_no,
                            shared.get("batch_date"),
                            shared.get("customer_contact_id"),
                            job.get("job_type_id"),
                            shared.get("job_receive_manner_id"),
                            job_status_id,
                            job.get("product_brand_model_id"),
                            job.get("serial_no"),
                            job.get("problem_reported"),
                            job.get("warranty_card_no"),
                            job.get("job_receive_condition_id"),
                            job.get("remarks"),
                            job.get("qty", 1),
                            job.get("purchase_date") or None,
                        ),
                    )
                    new_job_id = (await cur.fetchone())["id"]
                    if performed_by is not None:
                        await cur.execute(
                            "INSERT INTO job_transaction (job_id, status_id, performed_by_user_id)"
                            " VALUES (%s, %s, %s)",
                            (new_job_id, job_status_id, performed_by),
                        )

    return {"batch_no": batch_no}


async def resolve_delete_job_batch_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Delete a job batch and its associated job records."""
    payload = _decode_value(value, "deleteJobBatch")
    batch_no = payload.get("batch_no")

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            await cur.execute("SELECT id FROM job WHERE batch_no = %s", (batch_no,))
            job_ids = [r["id"] for r in await cur.fetchall()]

            for job_id in job_ids:
                await cur.execute(
                    "SELECT COUNT(*) AS cnt FROM job_transaction WHERE job_id = %s",
                    (job_id,),
                )
                row = await cur.fetchone()
                if row and row["cnt"] > 1:
                    raise ValidationException(
                        message="Batch has jobs with activity and cannot be deleted",
                        extensions={"job_id": job_id},
                    )

            if job_ids:
                await cur.execute(
                    "DELETE FROM job_transaction WHERE job_id = ANY(%s)", (job_ids,)
                )
            await cur.execute("DELETE FROM job WHERE batch_no = %s", (batch_no,))

    return {"success": True}


async def resolve_generic_update_script_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """
    Execute a pre-defined SQL script from SqlStore with optional named parameters.

    Args:
        db_name: Target service database name. Empty string routes to the client DB.
        schema:  Database schema to execute against (default: "public").
        value:   URL-encoded JSON string with keys:
                   sql_id  (str, required) — attribute name on SqlStore
                   sql_args (dict, optional) — named parameters for the SQL

    Returns:
        List of rows if the SQL has a RETURNING clause, otherwise row count (int).

    Raises:
        ValidationException: If value is missing, not valid JSON, sql_id is absent,
                             or sql_id does not exist in SqlStore.
    """
    payload = _decode_value(value, "genericUpdateScript")

    sql_id = payload.get("sql_id")
    if not sql_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "sql_id"},
        )

    sql = getattr(SqlStore, sql_id, None)
    if sql is None:
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": f"sql_id '{sql_id}' not found in SqlStore"},
        )

    sql_args = payload.get("sql_args") or {}
    db_name_arg: str = db_name or ""

    logger.debug("Executing script '%s' on: %s", sql_id, db_name_arg or "client_db")
    result = await exec_sql(db_name_arg, schema or "public", sql, sql_args)
    logger.debug("Script '%s' executed successfully", sql_id)
    return result


async def resolve_delete_unused_parts_by_brand_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Delete all spare parts for a brand that are not referenced in any
    dependent table (job_part_used, purchase_invoice_line, sales_invoice_line,
    stock_adjustment_line, stock_transaction).

    Value payload (URL-encoded JSON): { brand_id: int }
    Returns: { deleted_count: int }
    """
    payload = _decode_value(value, "deleteUnusedPartsByBrand")

    brand_id = payload.get("brand_id")
    if not brand_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "brand_id"},
        )

    schema_ = schema or "public"
    logger.info("Deleting unused parts for brand_id=%s in db=%s", brand_id, db_name)

    rows = await exec_sql(
        db_name=db_name,
        schema=schema_,
        sql=SqlStore.DELETE_UNUSED_PARTS_BY_BRAND,
        sql_args={"brand_id": brand_id},
    )

    deleted_count = len(rows) if rows else 0
    logger.info("Deleted %d unused parts for brand_id=%s", deleted_count, brand_id)
    return {"deleted_count": deleted_count}


async def resolve_import_spare_parts_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> dict:
    """
    Fast bulk import of spare parts using a single multi-row INSERT.

    Args:
        db_name: Target service database name.
        schema:  Database schema (default: "public").
        value:   URL-encoded JSON array of part record dicts.

    Returns:
        {"success_count": int}
    """
    payload = _decode_value(value, "importSpareParts")

    if not isinstance(payload, list):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": "Expected a list of part records"},
        )

    db_name_arg: str = db_name or ""
    logger.info(
        "Bulk importing %d spare parts into: %s",
        len(payload),
        db_name_arg or "client_db",
    )

    count = await bulk_insert_records(
        db_name=db_name_arg,
        schema=schema or "public",
        table_name="spare_part_master",
        records=payload,
    )

    logger.info("Bulk import complete: %d rows inserted", count)
    return {"success_count": count}


async def resolve_mail_admin_credentials_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Decode value payload, generate a password-reset JWT, and email the reset link
    to the admin user. No password is changed at this stage.

    Value payload (URL-encoded JSON): { id, client_id }
    """
    payload = _decode_value(value, "mailAdminCredentials")

    id_ = payload.get("id")
    client_id = payload.get("client_id")
    if not id_:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "id"},
        )

    # 1. Fetch admin user
    rows = await exec_sql(
        db_name=db_name,
        schema=schema or "security",
        sql=SqlStore.GET_ADMIN_USER_BY_ID,
        sql_args={"id": id_},
    )
    if not rows:
        raise ValidationException(
            message=AppMessages.ADMIN_USER_NOT_FOUND,
            extensions={"field": "id"},
        )
    user = rows[0]

    # 2. Generate reset token (48-hour expiry)
    token = create_reset_token(
        {
            "sub": str(id_),
            "db_name": db_name,
            "client_id": client_id,
        }
    )
    reset_link = f"{settings.frontend_url}/reset-password?token={token}"
    logger.info(
        "Password reset link generated for admin user id=%s in %s", id_, db_name
    )

    # 3. Email reset link
    email_sent = False
    email_error: str | None = None
    try:
        await send_email(
            to=user["email"],
            subject=AppMessages.EMAIL_RESET_LINK_SUBJECT,
            body=AppMessages.EMAIL_RESET_LINK_BODY.format(
                full_name=user["full_name"],
                reset_link=reset_link,
            ),
        )
        email_sent = True
    except Exception as mail_err:  # pylint: disable=broad-except
        email_error = str(mail_err)
        logger.warning(
            "Failed to send reset link email to %s: %s", user["email"], mail_err
        )

    await audit_logger.log(
        action=AuditAction.MAIL_ADMIN_CREDENTIALS,
        detail=f"email_sent={email_sent}"
        + (f", error={email_error}" if email_error else ""),
        resource_id=str(id_),
        resource_name=user.get("username", ""),
        resource_type="admin_user",
    )
    return {"email_error": email_error, "email_sent": email_sent, "id": id_}


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


def _build_money_receipt_tran_h(
    row: dict, debit_account_id: Any, credit_account_id: Any, branch_id: Any
) -> dict:
    """Build a single money-receipt TranH voucher from a serialized job_payment row."""
    detail_entry_c: dict = {"accId": int(debit_account_id),  "dc": "D", "amount": row["amount"]}
    detail_entry_d: dict = {"accId": int(credit_account_id), "dc": "C", "amount": row["amount"]}
    for entry in (detail_entry_c, detail_entry_d):
        if row.get("remarks"):
            entry["remarks"]   = row["remarks"]
        entry["lineRefNo"] = "Service+ Posting"
        if row.get("reference_no"):
            entry["instrNo"]   = row["reference_no"]

    fin_year = int(str(row.get("payment_date", str(date.today())))[:4])

    x_data: dict = {
        "tranDate":   row["payment_date"],
        "tranTypeId": 3,
        "finYearId":  fin_year,
        "branchId":   branch_id,
        "posId":      1,
        "xDetails": [{
            "tableName": "TranD",
            "fkeyName":  "tranHeaderId",
            "xData":     [detail_entry_c, detail_entry_d],
        }],
    }
    if row.get("receipt_no"):
        x_data["userRefNo"] = row["receipt_no"]
    remarks_parts = [p for p in [
        f"JOB:{row['job_no']}" if row.get("job_no") else None,
        row.get("customer_name"),
        f"Mobile:{row['customer_mobile']}" if row.get("customer_mobile") else None,
        f"GSTIN:{row['customer_gstin']}" if row.get("customer_gstin") else None,
        f"Address:{row['customer_address']}" if row.get("customer_address") else None,
        f"PIN:{row['customer_pin']}" if row.get("customer_pin") else None,
    ] if p]
    if remarks_parts:
        x_data["remarks"] = ", ".join(remarks_parts)
    return x_data


def _build_purchase_invoice_tran_h(
    pi_row: dict,
    pi_debit_acc_id: Any,
    pi_credit_acc_id: Any,
    pi_product_id: Any,
    pi_default_hsn: Any,
    pi_default_gst: Any,
    branch_id: Any,
) -> dict:
    """Build a single purchase-invoice TranH voucher from a serialized purchase_invoice row."""
    pi_lines = pi_row.get("lines") or []

    sale_purchase_lines = []
    for line in pi_lines:
        spd: dict = {
            "productId": int(pi_product_id),
            "qty":       float(line["qty"]),
            "price":     float(line["unit_price"]),
            "priceGst":  (float(line["total_amount"]) / float(line["qty"])
                          if line.get("qty") else 0),
            "amount":    float(line["total_amount"]),
            "hsn":       (line.get("hsn_code")
                          or (str(pi_default_hsn) if pi_default_hsn else "")),
            "gstRate":   (float(line["gst_rate"]) if line.get("gst_rate")
                          else (float(pi_default_gst) if pi_default_gst else 0)),
        }
        if line.get("part_code"):
            spd["jData"] = json.dumps({"remarks": f"Part Code: {line['part_code']}"})
        for out_key, db_key in [
            ("cgst", "cgst_amount"),
            ("sgst", "sgst_amount"),
            ("igst", "igst_amount"),
        ]:
            if line.get(db_key) is not None:
                spd[out_key] = float(line[db_key])
        sale_purchase_lines.append(spd)

    ext_gst: dict = {"isInput": True}
    if pi_row.get("supplier_gstin"):
        ext_gst["gstin"] = pi_row["supplier_gstin"]
    for out_key, db_key in [
        ("cgst", "cgst_amount"),
        ("sgst", "sgst_amount"),
        ("igst", "igst_amount"),
    ]:
        if pi_row.get(db_key) is not None:
            ext_gst[out_key] = float(pi_row[db_key])

    debit_pi: dict = {
        "accId":  int(pi_debit_acc_id),
        "dc":     "D",
        "amount": float(pi_row["total_amount"]),
        "xDetails": [
            {"tableName": "ExtGstTranD",
             "fkeyName":  "tranDetailsId",
             "xData":     ext_gst},
            {"tableName": "SalePurchaseDetails",
             "fkeyName":  "tranDetailsId",
             "xData":     sale_purchase_lines},
        ],
    }
    credit_pi: dict = {
        "accId":  int(pi_credit_acc_id),
        "dc":     "C",
        "amount": float(pi_row["total_amount"]),
    }

    pi_fin_year = int(str(pi_row.get("invoice_date", str(date.today())))[:4])
    pi_x_data: dict = {
        "tranDate":   pi_row["invoice_date"],
        "tranTypeId": 5,
        "finYearId":  pi_fin_year,
        "branchId":   branch_id,
        "posId":      1,
        "xDetails": [{
            "tableName": "TranD",
            "fkeyName":  "tranHeaderId",
            "xData":     [debit_pi, credit_pi],
        }],
    }
    if pi_row.get("invoice_no"):
        pi_x_data["userRefNo"] = pi_row["invoice_no"]
    vendor_address_parts = [p for p in [
        pi_row.get("supplier_address_line1"),
        pi_row.get("supplier_address_line2"),
        pi_row.get("supplier_city"),
        pi_row.get("supplier_state"),
        f"PIN:{pi_row['supplier_pincode']}" if pi_row.get("supplier_pincode") else None,
    ] if p]
    if vendor_address_parts:
        pi_x_data["remarks"] = ", ".join(vendor_address_parts)
    return pi_x_data


def _build_job_invoice_tran_h(
    ji_row: dict,
    ji_debit_acc_id: Any,
    ji_credit_acc_id: Any,
    ji_product_id: Any,
    ji_default_hsn: Any,
    ji_default_gst: Any,
    branch_id: Any,
    contacts_id: Any = None,
) -> dict:
    """Build a single job-invoice TranH voucher (tranTypeId=4, output GST)."""
    ji_lines = ji_row.get("lines") or []

    sale_lines = []
    for line in ji_lines:
        spd: dict = {
            "productId": int(ji_product_id),
            "qty":       float(line["qty"]),
            "price":     float(line["price"]),
            "priceGst":  (float(line["amount"]) / float(line["qty"])
                          if line.get("qty") else 0),
            "amount":    float(line["amount"]),
            "hsn":       (line.get("hsn_code")
                          or (str(ji_default_hsn) if ji_default_hsn else "")),
            "gstRate":   (float(line["gst_rate"]) if line.get("gst_rate")
                          else (float(ji_default_gst) if ji_default_gst else 0)),
        }
        if line.get("part_code"):
            spd["jData"] = json.dumps({"remarks": f"Part Code: {line['part_code']}, {line.get('description', '')}"})
        elif line.get("description"):
            spd["jData"] = json.dumps({"remarks": line["description"]})
        for out_key, db_key in [
            ("cgst", "cgst_amount"),
            ("sgst", "sgst_amount"),
            ("igst", "igst_amount"),
        ]:
            if line.get(db_key) is not None:
                spd[out_key] = float(line[db_key])
        sale_lines.append(spd)

    ext_gst: dict = {"isInput": False}
    if ji_row.get("customer_gstin"):
        ext_gst["gstin"] = ji_row["customer_gstin"]
    for out_key, db_key in [
        ("cgst", "cgst_amount"),
        ("sgst", "sgst_amount"),
        ("igst", "igst_amount"),
    ]:
        if ji_row.get(db_key) is not None:
            ext_gst[out_key] = float(ji_row[db_key])

    debit_ji: dict = {
        "accId":  int(ji_debit_acc_id),
        "dc":     "D",
        "amount": float(ji_row["amount"]),
        "xDetails": [
            {"tableName": "ExtGstTranD",
             "fkeyName":  "tranDetailsId",
             "xData":     ext_gst},
            {"tableName": "SalePurchaseDetails",
             "fkeyName":  "tranDetailsId",
             "xData":     sale_lines},
        ],
    }
    credit_ji: dict = {
        "accId":  int(ji_credit_acc_id),
        "dc":     "C",
        "amount": float(ji_row["amount"]),
    }

    ji_fin_year = int(str(ji_row.get("invoice_date", str(date.today())))[:4])
    ji_x_data: dict = {
        "tranDate":   ji_row["invoice_date"],
        "tranTypeId": 4,
        "finYearId":  ji_fin_year,
        "branchId":   branch_id,
        "posId":      1,
        "xDetails": [{
            "tableName": "TranD",
            "fkeyName":  "tranHeaderId",
            "xData":     [debit_ji, credit_ji],
        }],
    }
    if ji_row.get("invoice_no"):
        ji_x_data["userRefNo"] = ji_row["invoice_no"]
    if contacts_id:
        ji_x_data["contactsId"] = int(contacts_id)
    remarks_parts = [p for p in [
        f"JOB:{ji_row['job_no']}" if ji_row.get("job_no") else None,
        ji_row.get("customer_name"),
        f"Mobile:{ji_row['mobile']}" if ji_row.get("mobile") else None,
        ji_row.get("customer_address") or None,
        f"PIN:{ji_row['customer_pin']}" if ji_row.get("customer_pin") else None,
    ] if p]
    if remarks_parts:
        ji_x_data["remarks"] = ", ".join(remarks_parts)
    return ji_x_data


def _build_sales_invoice_tran_h(
    si_row: dict,
    si_debit_acc_id: Any,
    si_credit_acc_id: Any,
    si_product_id: Any,
    si_default_hsn: Any,
    si_default_gst: Any,
    branch_id: Any,
    contacts_id: Any = None,
) -> dict:
    """Build a single sales-invoice TranH voucher (tranTypeId=4/9, output GST)."""
    si_lines = si_row.get("lines") or []

    sale_lines = []
    for line in si_lines:
        spd: dict = {
            "productId": int(si_product_id),
            "qty":       float(line["qty"]),
            "price":     float(line["unit_price"]),
            "priceGst":  (float(line["total_amount"]) / float(line["qty"])
                          if line.get("qty") else 0),
            "amount":    float(line["total_amount"]),
            "hsn":       (line.get("hsn_code")
                          or (str(si_default_hsn) if si_default_hsn else "")),
            "gstRate":   (float(line["gst_rate"]) if line.get("gst_rate")
                          else (float(si_default_gst) if si_default_gst else 0)),
        }
        if line.get("part_code"):
            spd["jData"] = json.dumps({"remarks": f"Part Code: {line['part_code']}, {line.get('part_name', '')}"})
        elif line.get("item_description"):
            spd["jData"] = json.dumps({"remarks": line["item_description"]})
        for out_key, db_key in [
            ("cgst", "cgst_amount"),
            ("sgst", "sgst_amount"),
            ("igst", "igst_amount"),
        ]:
            if line.get(db_key) is not None:
                spd[out_key] = float(line[db_key])
        sale_lines.append(spd)

    ext_gst: dict = {"isInput": False}
    if si_row.get("customer_gstin"):
        ext_gst["gstin"] = si_row["customer_gstin"]
    for out_key, db_key in [
        ("cgst", "cgst_amount"),
        ("sgst", "sgst_amount"),
        ("igst", "igst_amount"),
    ]:
        if si_row.get(db_key) is not None:
            ext_gst[out_key] = float(si_row[db_key])

    debit_si: dict = {
        "accId":  int(si_debit_acc_id),
        "dc":     "D",
        "amount": float(si_row["total_amount"]),
        "xDetails": [
            {"tableName": "ExtGstTranD",
             "fkeyName":  "tranDetailsId",
             "xData":     ext_gst},
            {"tableName": "SalePurchaseDetails",
             "fkeyName":  "tranDetailsId",
             "xData":     sale_lines},
        ],
    }
    credit_si: dict = {
        "accId":  int(si_credit_acc_id),
        "dc":     "C",
        "amount": float(si_row["total_amount"]),
    }

    tran_type_id = 9 if si_row.get("is_return") else 4
    si_fin_year = int(str(si_row.get("invoice_date", str(date.today())))[:4])
    si_x_data: dict = {
        "tranDate":   si_row["invoice_date"],
        "tranTypeId": tran_type_id,
        "finYearId":  si_fin_year,
        "branchId":   branch_id,
        "posId":      1,
        "xDetails": [{
            "tableName": "TranD",
            "fkeyName":  "tranHeaderId",
            "xData":     [debit_si, credit_si],
        }],
    }
    if si_row.get("invoice_no"):
        si_x_data["userRefNo"] = si_row["invoice_no"]
    if contacts_id:
        si_x_data["contactsId"] = int(contacts_id)
    remarks_parts = [p for p in [
        "Sale Return" if si_row.get("is_return") else "Sale Invoice",
        si_row.get("customer_name"),
        f"Mobile:{si_row['mobile']}" if si_row.get("mobile") else None,
        si_row.get("customer_address") or None,
        f"PIN:{si_row['customer_pin']}" if si_row.get("customer_pin") else None,
        f"GSTIN:{si_row['customer_gstin']}" if si_row.get("customer_gstin") else None,
    ] if p]
    if remarks_parts:
        si_x_data["remarks"] = ", ".join(remarks_parts)
    return si_x_data


async def _post_tran_h_to_trace_plus(
    http_client: httpx.AsyncClient,
    client_code: str,
    bu_code: str,
    tran_h: dict,
) -> dict:
    """Post a single TranH voucher to trace-plus internal endpoint and return its result."""
    tran_h_payload = {
        "tableName": "TranH",
        "dbParams":  {"conn": ""},
        "xData":     [tran_h],
        "buCode":    bu_code,
    }
    trace_value = quote(json.dumps({
        "clientCode": client_code,
        "buCode":     bu_code,
        "data":       tran_h_payload,
    }))
    resp = await http_client.post(
        f"{settings.trace_plus_url}/api/internal/accounts-posting",
        json={"value": trace_value},
        headers={"X-Service-Key": settings.trace_plus_service_key},
        timeout=30.0,
    )
    resp.raise_for_status()
    return resp.json()


async def resolve_accounts_posting_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> dict:
    """Post unposted money receipts, purchase invoices, job invoices, and sales invoices for every division in a branch.

    The server determines the divisions to post from the branch: each division with a
    valid account_setting and unposted data is posted separately, using its own account
    settings. Each record is posted in its own trace-plus call and marked
    ``is_posted = true`` only when its own post succeeds. A failing record is recorded and
    skipped so the remaining records still post (partial success, continue on error).
    """
    # pylint: disable=too-many-locals,too-many-branches,too-many-statements
    payload = _decode_value(value, "accountsPosting")
    branch_id_arg = payload.get("branchId")

    if not branch_id_arg:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branchId"},
        )

    # 1. Get all divisions in the branch (includes account_setting)
    divisions = await exec_sql(
        db_name=db_name, schema=schema,
        sql=SqlStore.GET_DIVISIONS_BY_BRANCH,
        sql_args={"branch_id": branch_id_arg},
    )

    # 2. Build the work list: divisions with valid account settings AND unposted data.
    #    Divisions with incomplete settings or no unposted data are skipped silently.
    work: list[dict] = []
    total = 0
    for div in divisions:
        if not div.get("is_active"):
            continue
        account_setting   = div.get("account_setting") or {}
        client_code       = account_setting.get("clientCode", "")
        bu_code           = account_setting.get("buCode", "")
        branch_id         = account_setting.get("branchId")
        debit_account_id  = account_setting.get("receipt", {}).get("debitAccountId")
        credit_account_id = account_setting.get("receipt", {}).get("creditAccountId")
        if not (client_code and bu_code and branch_id
                and debit_account_id and credit_account_id):
            continue

        division_code = (div.get("code") or "").strip()
        receipts = await exec_sql(
            db_name=db_name, schema=schema,
            sql=SqlStore.GET_UNPOSTED_MONEY_RECEIPTS,
            sql_args={"division_code": division_code},
        )
        pi_rows = await exec_sql(
            db_name=db_name, schema=schema,
            sql=SqlStore.GET_UNPOSTED_PURCHASE_INVOICES,
            sql_args={"division_code": division_code},
        )
        ji_rows = await exec_sql(
            db_name=db_name, schema=schema,
            sql=SqlStore.GET_UNPOSTED_JOB_INVOICES,
            sql_args={"division_code": division_code},
        )
        si_rows = await exec_sql(
            db_name=db_name, schema=schema,
            sql=SqlStore.GET_UNPOSTED_SALES_INVOICES,
            sql_args={"division_code": division_code},
        )
        if not receipts and not pi_rows and not ji_rows and not si_rows:
            continue

        pi_settings = account_setting.get("purchaseInvoice", {})
        ji_settings = account_setting.get("jobInvoice", {})
        si_settings = account_setting.get("salesInvoice", {})
        work.append({
            "division_code":     division_code,
            "division_name":     div.get("name") or division_code,
            "client_code":       client_code,
            "bu_code":           bu_code,
            "branch_id":         branch_id,
            "debit_account_id":  debit_account_id,
            "credit_account_id": credit_account_id,
            "pi_debit_acc_id":   pi_settings.get("debitAccountId"),
            "pi_credit_acc_id":  pi_settings.get("creditAccountId"),
            "pi_product_id":     pi_settings.get("productId"),
            "pi_default_hsn":    pi_settings.get("defaultProductHsn"),
            "pi_default_gst":    pi_settings.get("defaultGstRate"),
            "ji_debit_acc_id":   ji_settings.get("debitAccountId"),
            "ji_credit_acc_id":  ji_settings.get("creditAccountId"),
            "ji_product_id":     ji_settings.get("productId"),
            "ji_default_hsn":    ji_settings.get("defaultProductHsn"),
            "ji_default_gst":    ji_settings.get("defaultGstRate"),
            "ji_contacts_id":    ji_settings.get("contactsId"),
            "si_debit_acc_id":   si_settings.get("debitAccountId"),
            "si_credit_acc_id":  si_settings.get("creditAccountId"),
            "si_product_id":     si_settings.get("productId"),
            "si_default_hsn":    si_settings.get("defaultProductHsn"),
            "si_default_gst":    si_settings.get("defaultGstRate"),
            "si_contacts_id":    si_settings.get("contactsId"),
            "receipts":          receipts,
            "pi_rows":           pi_rows,
            "ji_rows":           ji_rows,
            "si_rows":           si_rows,
        })
        total += len(receipts) + len(pi_rows) + len(ji_rows) + len(si_rows)

    if not work:
        return {"message": "No unposted records found."}

    posted_money_receipts = 0
    posted_purchase_invoices = 0
    posted_job_invoices = 0
    posted_sales_invoices = 0
    failed: list[dict] = []

    async def publish_progress(
        current_ref: Any = None, current_division: str = "",
        done: bool = False, message: str = "",
    ) -> None:
        """Emit a progress event for live UI updates (best-effort, never fatal)."""
        try:
            await pubsub.publish("accounts_posting_progress", {
                "branchId":        str(branch_id_arg),
                "total":           total,
                "posted":          posted_money_receipts + posted_purchase_invoices + posted_job_invoices + posted_sales_invoices,
                "failed":          len(failed),
                "currentRef":      current_ref,
                "currentDivision": current_division,
                "done":            done,
                "message":         message,
            })
        except Exception as e:  # pylint: disable=broad-except
            logger.error("Failed to publish accounts posting progress: %s", e)

    # 3. Reuse a single HTTP client for the whole run
    async with httpx.AsyncClient() as http_client:
        for w in work:
            division_name = w["division_name"]
            # 4. Post each money receipt for this division, marking it on success
            for raw in w["receipts"]:
                row = _serialize_row(raw)
                try:
                    tran_h = _build_money_receipt_tran_h(
                        row, w["debit_account_id"], w["credit_account_id"], w["branch_id"]
                    )
                    await _post_tran_h_to_trace_plus(
                        http_client, w["client_code"], w["bu_code"], tran_h
                    )
                    await exec_sql(
                        db_name=db_name, schema=schema,
                        sql=SqlStore.MARK_MONEY_RECEIPT_POSTED,
                        sql_args={"id": row["id"]},
                    )
                    posted_money_receipts += 1
                except Exception as e:  # pylint: disable=broad-except
                    logger.error("Failed to post money receipt %s: %s", row.get("id"), e)
                    failed.append({
                        "type":  "moneyReceipt",
                        "id":    row.get("id"),
                        "ref":   row.get("receipt_no"),
                        "error": str(e),
                    })
                await publish_progress(
                    current_ref=row.get("receipt_no"), current_division=division_name
                )

            # 5. Post each purchase invoice (only if PI account settings are present)
            pi_settings_ok = bool(
                w["pi_debit_acc_id"] and w["pi_credit_acc_id"] and w["pi_product_id"]
            )
            for raw in w["pi_rows"]:
                pi_row = _serialize_row(raw)
                if not pi_settings_ok:
                    failed.append({
                        "type":  "purchaseInvoice",
                        "id":    pi_row.get("id"),
                        "ref":   pi_row.get("invoice_no"),
                        "error": "Skipped: purchaseInvoice account settings missing",
                    })
                    await publish_progress(
                        current_ref=pi_row.get("invoice_no"), current_division=division_name
                    )
                    continue
                try:
                    pi_tran_h = _build_purchase_invoice_tran_h(
                        pi_row, w["pi_debit_acc_id"], w["pi_credit_acc_id"], w["pi_product_id"],
                        w["pi_default_hsn"], w["pi_default_gst"], w["branch_id"],
                    )
                    await _post_tran_h_to_trace_plus(
                        http_client, w["client_code"], w["bu_code"], pi_tran_h
                    )
                    await exec_sql(
                        db_name=db_name, schema=schema,
                        sql=SqlStore.MARK_PURCHASE_INVOICE_POSTED,
                        sql_args={"id": pi_row["id"]},
                    )
                    posted_purchase_invoices += 1
                except Exception as e:  # pylint: disable=broad-except
                    logger.error("Failed to post purchase invoice %s: %s", pi_row.get("id"), e)
                    failed.append({
                        "type":  "purchaseInvoice",
                        "id":    pi_row.get("id"),
                        "ref":   pi_row.get("invoice_no"),
                        "error": str(e),
                    })
                await publish_progress(
                    current_ref=pi_row.get("invoice_no"), current_division=division_name
                )

            # 6. Post each job invoice (only if jobInvoice account settings are present)
            ji_settings_ok = bool(
                w["ji_debit_acc_id"] and w["ji_credit_acc_id"] and w["ji_product_id"]
            )
            for raw in w["ji_rows"]:
                ji_row = _serialize_row(raw)
                if not ji_settings_ok:
                    failed.append({
                        "type":  "jobInvoice",
                        "id":    ji_row.get("id"),
                        "ref":   ji_row.get("invoice_no"),
                        "error": "Skipped: jobInvoice account settings missing",
                    })
                    await publish_progress(
                        current_ref=ji_row.get("invoice_no"), current_division=division_name
                    )
                    continue
                try:
                    ji_tran_h = _build_job_invoice_tran_h(
                        ji_row, w["ji_debit_acc_id"], w["ji_credit_acc_id"], w["ji_product_id"],
                        w["ji_default_hsn"], w["ji_default_gst"], w["branch_id"],
                        contacts_id=w["ji_contacts_id"],
                    )
                    await _post_tran_h_to_trace_plus(
                        http_client, w["client_code"], w["bu_code"], ji_tran_h
                    )
                    await exec_sql(
                        db_name=db_name, schema=schema,
                        sql=SqlStore.MARK_JOB_INVOICE_POSTED,
                        sql_args={"id": ji_row["id"]},
                    )
                    posted_job_invoices += 1
                except Exception as e:  # pylint: disable=broad-except
                    logger.error("Failed to post job invoice %s: %s", ji_row.get("id"), e)
                    failed.append({
                        "type":  "jobInvoice",
                        "id":    ji_row.get("id"),
                        "ref":   ji_row.get("invoice_no"),
                        "error": str(e),
                    })
                await publish_progress(
                    current_ref=ji_row.get("invoice_no"), current_division=division_name
                )

            # 7. Post each sales invoice (only if salesInvoice account settings are present)
            si_settings_ok = bool(
                w["si_debit_acc_id"] and w["si_credit_acc_id"] and w["si_product_id"]
            )
            for raw in w["si_rows"]:
                si_row = _serialize_row(raw)
                if not si_settings_ok:
                    failed.append({
                        "type":  "salesInvoice",
                        "id":    si_row.get("id"),
                        "ref":   si_row.get("invoice_no"),
                        "error": "Skipped: salesInvoice account settings missing",
                    })
                    await publish_progress(
                        current_ref=si_row.get("invoice_no"), current_division=division_name
                    )
                    continue
                try:
                    si_tran_h = _build_sales_invoice_tran_h(
                        si_row, w["si_debit_acc_id"], w["si_credit_acc_id"], w["si_product_id"],
                        w["si_default_hsn"], w["si_default_gst"], w["branch_id"],
                        contacts_id=w["si_contacts_id"],
                    )
                    await _post_tran_h_to_trace_plus(
                        http_client, w["client_code"], w["bu_code"], si_tran_h
                    )
                    await exec_sql(
                        db_name=db_name, schema=schema,
                        sql=SqlStore.MARK_SALES_INVOICE_POSTED,
                        sql_args={"id": si_row["id"]},
                    )
                    posted_sales_invoices += 1
                except Exception as e:  # pylint: disable=broad-except
                    logger.error("Failed to post sales invoice %s: %s", si_row.get("id"), e)
                    failed.append({
                        "type":  "salesInvoice",
                        "id":    si_row.get("id"),
                        "ref":   si_row.get("invoice_no"),
                        "error": str(e),
                    })
                await publish_progress(
                    current_ref=si_row.get("invoice_no"), current_division=division_name
                )

    message = (
        f"Posted {posted_money_receipts} money receipt(s), "
        f"{posted_purchase_invoices} purchase invoice(s), "
        f"{posted_job_invoices} job invoice(s), and "
        f"{posted_sales_invoices} sales invoice(s) "
        f"across {len(work)} division(s)."
    )
    if failed:
        message += f" {len(failed)} record(s) failed."
    await publish_progress(done=True, message=message)
    return {
        "postedMoneyReceipts":    posted_money_receipts,
        "postedPurchaseInvoices": posted_purchase_invoices,
        "postedJobInvoices":      posted_job_invoices,
        "postedSalesInvoices":    posted_sales_invoices,
        "divisionsPosted":        len(work),
        "failed":                 failed,
        "message":                message,
    }
