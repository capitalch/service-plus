import json
from psycopg.rows import dict_row
import re
import secrets
from datetime import datetime
from typing import Any
from urllib.parse import unquote

from psycopg import sql as pgsql

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
)
from app.db.sql_store import SqlStore
from app.db.sql_bu import SqlBu
from app.exceptions import AppMessages, ValidationException
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
        )


def _serialize_row(row: dict) -> dict:
    return {k: v.isoformat() if isinstance(v, datetime) else v for k, v in row.items()}


async def resolve_create_admin_user_helper(db_name: str, schema: str, value: str) -> dict:
    """
    Decode value payload, create an admin user (is_admin=True) with a random unusable
    password, then email a 48-hour reset link so the admin sets their own password.

    Value payload (URL-encoded JSON): { client_id, email, full_name, mobile, username }
    """
    payload = _decode_value(value, "createAdminUser")

    client_id = payload.get("client_id")
    email     = payload.get("email", "")
    full_name = payload.get("full_name", "")
    mobile    = payload.get("mobile") or None
    username  = payload.get("username", "")

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
            "email":         email,
            "full_name":     full_name,
            "is_active":     True,
            "is_admin":      True,
            "mobile":        mobile,
            "password_hash": password_hash,
            "username":      username,
        },
    }
    record_id = await exec_sql_object(db_name, schema or "security", sql_object)
    logger.info("Admin user '%s' created with id=%s", username, record_id)

    # Generate reset link so admin can set their own password
    token = create_reset_token({
        "sub":       str(record_id),
        "db_name":   db_name,
        "client_id": client_id,
    })
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
    except Exception as mail_err:
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
    create all 35 tables (from BU_SCHEMA_DDL), and seed 9 lookup tables (BU_SEED_SQL).

    Value payload (URL-encoded JSON): { code, name }
    """
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
            extensions={"detail": "Code must be 3–9 alphanumeric/underscore characters", "field": "code"},
        )

    # 3. Validate name format: alphanumeric + spaces, min 3 chars
    if not re.match(r"^[a-zA-Z0-9 ]{3,}$", name):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": "Name must be at least 3 alphanumeric characters", "field": "name"},
        )

    # 4. If id supplied, BU row already exists — skip uniqueness checks and INSERT
    raw_id = payload.get("id")
    if raw_id:
        bu_id = int(raw_id)
        logger.info("Schema-repair path: using existing BU id=%d for code='%s'", bu_id, code)
    else:
        # 4a. Check code uniqueness
        rows = await exec_sql(
            db_name=db_name, schema="security",
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
            db_name=db_name, schema="security",
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
            db_name=db_name, schema="security",
            sql=SqlStore.INSERT_BU,
            sql_args={"code": code, "name": name},
        )
        bu_id = rows[0]["id"] if rows else None

    # 7. Create schema <code>
    logger.info("Creating schema '%s' in db '%s'", code, db_name)
    await exec_sql(
        db_name=db_name, schema="security",
        sql=pgsql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(pgsql.Identifier(code)),
    )

    # 8. Create all BU tables in the new schema
    logger.info("Running BU_SCHEMA_DDL in schema '%s'", code)
    await exec_sql(
        db_name=db_name, schema=code,
        sql=SqlBu.BU_SCHEMA_DDL,
    )

    # 9. Seed lookup data
    logger.info("Seeding lookup data in schema '%s'", code)
    await exec_sql(
        db_name=db_name, schema=code,
        sql=SqlBu.BU_SEED_SQL,
    )

    # 10. Audit log
    await audit_logger.log(
        action=AuditAction.CREATE_BU_SCHEMA,
        resource_name=code,
        resource_type="bu_schema",
    )

    logger.info("BU '%s' created successfully with schema and seed data", code)
    return {"code": code, "id": bu_id, "name": name}


async def resolve_create_business_user_helper(db_name: str, schema: str, value: str) -> dict:
    """
    Decode value payload, hash a temp password, create a business user (is_admin=False)
    in the specified client database, and email credentials.

    Value payload (URL-encoded JSON): { email, full_name, mobile, username }
    """
    payload = _decode_value(value, "createBusinessUser")

    email     = payload.get("email", "")
    full_name = payload.get("full_name", "")
    mobile    = payload.get("mobile") or None
    username  = payload.get("username", "")

    if not email or not full_name or not username:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"fields": ["email", "full_name", "username"]},
        )

    schema_name = schema or "security"

    # Check username uniqueness
    uname_rows = await exec_sql(
        db_name=db_name, schema=schema_name,
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
        db_name=db_name, schema=schema_name,
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
            "email":         email,
            "full_name":     full_name,
            "is_active":     True,
            "is_admin":      False,
            "mobile":        mobile,
            "password_hash": password_hash,
            "username":      username,
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
    except Exception as mail_err:
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
    payload = _decode_value(value, "createClient")

    code      = payload.get("code", "")
    name      = payload.get("name", "")
    email     = payload.get("email") or None

    if not code or not name:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"fields": ["code", "name"]},
        )

    xData: dict = {"code": code, "name": name, "is_active": payload.get("is_active", True)}
    for field in ("address_line1", "address_line2", "city", "country_code",
                  "email", "gstin", "pan", "phone", "pincode", "state"):
        val = payload.get(field)
        if val:
            xData[field] = val

    sql_object = {"tableName": "client", "xData": xData}
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
        except Exception as mail_err:
            logger.warning("Failed to send welcome email to %s: %s", email, mail_err)

    await audit_logger.log(
        action=AuditAction.CREATE_CLIENT,
        resource_id=str(record_id),
        resource_name=name,
        resource_type="client",
    )
    return {"email_sent": email_sent, "id": record_id}


async def resolve_create_service_db_helper(db_name: str, schema: str, value: str) -> dict:
    """
    Decode value payload, create a new PostgreSQL service database with the security
    schema for a client, then record the db_name on the client row.

    Value payload (URL-encoded JSON): { client_id, new_db_name }
    """
    payload = _decode_value(value, "createServiceDb")

    client_id   = payload.get("client_id")
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
            extensions={"detail": "Database name must match ^service_plus_[a-z0-9_]+$", "field": "new_db_name"},
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

    # 4. Set up security schema inside the new database
    logger.info("Setting up security schema in: %s", new_db_name)
    await exec_sql(
        db_name=new_db_name,
        schema="security",
        sql=SqlStore.SECURITY_SCHEMA_DDL,
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


async def resolve_feed_bu_seed_data_helper(db_name: str, schema: str, value: str) -> dict:
    """
    Feed seed data into an existing BU schema without recreating the schema or tables.
    All INSERTs in BU_SEED_SQL use ON CONFLICT DO NOTHING — fully idempotent.

    Value payload (URL-encoded JSON): { code }
    """
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
            extensions={"detail": "Code must be 3–9 alphanumeric/underscore characters", "field": "code"},
        )

    # Guard: schema must already exist
    rows = await exec_sql(
        db_name=db_name, schema="security",
        sql=SqlStore.CHECK_SCHEMA_EXISTS,
        sql_args={"code": code},
    )
    if not (rows and rows[0].get("exists")):
        raise ValidationException(
            message=AppMessages.RESOURCE_NOT_FOUND,
            extensions={"detail": f"Schema '{code}' does not exist", "field": "code"},
        )

    logger.info("Seeding lookup data into existing schema '%s' in db '%s'", code, db_name)
    await exec_sql(
        db_name=db_name, schema=code,
        sql=SqlBu.BU_SEED_SQL,
    )

    await audit_logger.log(
        action=AuditAction.FEED_BU_SEED_DATA,
        resource_name=code,
        resource_type="bu_schema",
    )
    logger.info("Seed data fed into schema '%s' successfully", code)
    return {"code": code}


async def resolve_delete_bu_schema_helper(db_name: str, schema: str, value: str) -> dict:
    """
    Drop a BU schema from the database and optionally delete the security.bu row.

    Value payload (URL-encoded JSON): { code, delete_bu_row: bool }
    - code: schema name (lowercase, 3–9 chars, alphanumeric + underscore)
    - delete_bu_row: if true, also DELETE FROM security.bu WHERE LOWER(code) = code
    """
    payload = _decode_value(value, "deleteBuSchema")

    code: str          = (payload.get("code") or "").lower().strip()
    delete_bu_row: bool = bool(payload.get("delete_bu_row", False))

    if not code:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "code"},
        )

    if not re.match(r"^[a-z0-9_]{3,9}$", code):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": "Code must be 3–9 alphanumeric/underscore characters", "field": "code"},
        )

    # Drop schema CASCADE (autocommit DDL)
    logger.info("Dropping schema '%s' in db '%s'", code, db_name)
    await exec_sql_dml(
        db_name=db_name, schema="security",
        sql=pgsql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(pgsql.Identifier(code)),
    )

    # Optionally delete the bu row
    if delete_bu_row:
        logger.info("Deleting security.bu row for code='%s'", code)
        await exec_sql(
            db_name=db_name, schema="security",
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
    payload = _decode_value(value, "deleteClient")

    client_id = payload.get("client_id")
    if not client_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "client_id"},
        )

    # 1. Fetch client row for server-side guard
    client_rows = await exec_sql(
        db_name=None, schema="public",
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
            db_name=None, schema="public",
            sql=pgsql.SQL("DROP DATABASE IF EXISTS {}").format(pgsql.Identifier(db_name_val)),
        )

    # 3. Delete the client row
    await exec_sql(
        db_name=None, schema="public",
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
            extensions={"detail": "Database name must match ^service_plus_[a-z0-9_]+$", "field": "db_name"},
        )

    # 2. Safety check — refuse to drop if still linked to a client
    in_use_rows = await exec_sql(
        db_name=None, schema="public",
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
        db_name=None, schema="public",
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
        db_name=None, schema="public",
        sql=pgsql.SQL("DROP DATABASE {}").format(pgsql.Identifier(target_db)),
    )

    logger.info("Orphan database dropped: %s", target_db)
    await audit_logger.log(
        action=AuditAction.DROP_DATABASE,
        resource_name=target_db,
        resource_type="database",
    )
    return {"db_name": target_db}


async def resolve_mail_business_user_credentials_helper(db_name: str, schema: str, value: str) -> dict:
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
        db_name=db_name, schema=schema_name,
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
    except Exception as mail_err:
        email_error = str(mail_err)
        logger.warning("Failed to send reset link email to %s: %s", user['email'], mail_err)

    await audit_logger.log(
        action=AuditAction.MAIL_ADMIN_CREDENTIALS,
        detail=f"email_sent={email_sent}" + (f", error={email_error}" if email_error else ""),
        resource_id=str(id_),
        resource_name=user.get("username", ""),
        resource_type="business_user",
    )
    return {"email_error": email_error, "email_sent": email_sent, "id": id_}


async def resolve_generic_update_helper(db_name: str, schema: str = "public", value: str = "") -> int | None:
    """
    Decode, validate and execute a generic update SQL object.
    """
    if not value:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "value"},
        )

    db_name_arg = db_name if db_name else None
    logger.debug("Updating database entry in: %s", db_name_arg or 'client_db')

    value_string = unquote(value)
    try:
        sql_object: dict = json.loads(value_string)
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in value parameter: %s", e)
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_VALUE},
        )
    if not isinstance(sql_object, dict):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_OBJECT},
        )

    record_id = await exec_sql_object(db_name_arg, schema or "public", sql_object)

    logger.debug("Database entry updated in: %s", db_name_arg or 'client_db')
    return record_id


async def resolve_create_sales_invoice_helper(db_name: str, schema: str = "public", value: str = "") -> Any:
    """
    Create a sales invoice and atomically increment the document sequence.

    The `value` JSON must contain:
      - The sql_object for the sales_invoice insert (with nested xDetails for lines and
        stock_transactions), PLUS:
      - doc_sequence_id   (int): ID of the document_sequence row to increment.
      - doc_sequence_next (int): The new next_number value (current + 1).

    Both doc_sequence_* keys are stripped before passing the sql_object to exec_sql_object.
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
        logger.error("Invalid JSON in createSalesInvoice value: %s", e)
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_OBJECT},
        )

    doc_sequence_id   = payload.pop("doc_sequence_id", None)
    doc_sequence_next = payload.pop("doc_sequence_next", None)

    db_name_arg = db_name if db_name else None
    schema_name = schema or "public"

    record_id = await exec_sql_object(db_name_arg, schema_name, payload)
    logger.info("Sales invoice created with id=%s", record_id)

    if doc_sequence_id is not None and doc_sequence_next is not None:
        seq_object = {
            "tableName": "document_sequence",
            "xData": {"id": doc_sequence_id, "next_number": doc_sequence_next},
        }
        await exec_sql_object(db_name_arg, schema_name, seq_object)
        logger.debug("Document sequence %s incremented to %s", doc_sequence_id, doc_sequence_next)

    return record_id


async def resolve_create_single_job_helper(db_name: str, schema: str = "public", value: str = "") -> Any:
    """
    Create a single job and atomically insert an initial job_transaction + increment document sequence.
    
    The `value` JSON must contain:
      - tableName: "job"
      - performed_by_user_id (int): User ID for the initial job_transaction.
      - xData: job fields.
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
        )

    # Ignore client-provided sequence info
    payload.pop("doc_sequence_id", None)
    payload.pop("doc_sequence_next", None)
    
    x_data = payload.get("xData", {})
    performed_by = x_data.pop("performed_by_user_id", None)
    initial_status_id = x_data.get("job_status_id")
    branch_id = x_data.get("branch_id")
    
    if not branch_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id"},
        )

    db_name_arg = db_name if db_name else None
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Claim next sequence number atomically
            seq_rows = await cur.execute(
                SqlStore.CLAIM_NEXT_JOB_NUMBER,
                {"branch_id": branch_id}
            )
            seq = await cur.fetchone()
            if not seq:
                raise ValidationException(
                    message=AppMessages.RESOURCE_NOT_FOUND,
                    extensions={"detail": "Job sequence not configured for this branch"},
                )

            # 2. Format job number
            job_no = f"{seq['prefix']}{seq['separator']}{str(seq['assigned_number']).zfill(seq['padding'])}"
            x_data["job_no"] = job_no

            # 3. Insert the job
            job_id = await process_data(x_data, cur, "job", None, None)
            logger.info("Single job created with id=%s, job_no=%s", job_id, job_no)

            # 4. Insert initial job_transaction
            if performed_by is not None:
                txn_data = {
                    "job_id":               job_id,
                    "status_id":            initial_status_id,
                    "performed_by_user_id": performed_by,
                }
                await process_data(txn_data, cur, "job_transaction", None, None)
                logger.debug("Initial job_transaction inserted for job_id=%s", job_id)

    return job_id


async def resolve_update_job_helper(db_name: str, schema: str = "public", value: str = "") -> Any:
    payload = _decode_value(value, "updateJob")

    job_id               = payload.pop("job_id")
    last_transaction_id  = payload.pop("last_transaction_id", None)
    performed_by         = payload.pop("performed_by_user_id", None)
    transaction_notes    = payload.pop("transaction_notes", "")
    x_data               = payload.get("xData", {})

    job_status_id = x_data.get("job_status_id")
    technician_id = x_data.get("technician_id")
    amount        = x_data.get("amount")

    db_name_arg = db_name if db_name else None
    schema_name = schema or "public"

    # 1. Update the job row
    job_object = {"tableName": "job", "xData": x_data}
    await exec_sql_object(db_name_arg, schema_name, job_object)
    logger.info("Job %s updated", job_id)

    # 2. Insert job_transaction
    txn_data: dict = {
        "job_id":               job_id,
        "status_id":            job_status_id,
        "performed_by_user_id": performed_by,
    }
    if technician_id is not None:
        txn_data["technician_id"] = technician_id
    if amount is not None:
        txn_data["amount"] = amount
    if transaction_notes:
        txn_data["notes"] = transaction_notes
    if last_transaction_id is not None:
        txn_data["previous_transaction_id"] = last_transaction_id

    txn_object = {"tableName": "job_transaction", "xData": txn_data}
    new_txn_id = await exec_sql_object(db_name_arg, schema_name, txn_object)
    logger.debug("Job transaction inserted, id=%s", new_txn_id)

    # 3. Update job.last_transaction_id with the new transaction id
    if new_txn_id:
        upd_object = {
            "tableName": "job",
            "xData": {"id": job_id, "last_transaction_id": new_txn_id},
        }
        await exec_sql_object(db_name_arg, schema_name, upd_object)
        logger.debug("job.last_transaction_id updated to %s", new_txn_id)

    return new_txn_id


async def resolve_deliver_job_helper(db_name: str, schema: str = "public", value: str = "") -> Any:
    payload = _decode_value(value, "deliverJob")

    job_id               = payload.pop("job_id")
    last_transaction_id  = payload.pop("last_transaction_id", None)
    performed_by         = payload.pop("performed_by_user_id", None)
    delivered_status_id  = payload.pop("delivered_status_id")
    delivery_date        = payload.pop("delivery_date")
    delivery_manner_name = payload.pop("delivery_manner_name", "")
    transaction_notes    = payload.pop("transaction_notes", "")
    payment              = payload.pop("payment", {})

    db_name_arg = db_name if db_name else None
    schema_name = schema or "public"

    # 1. Insert job_payment if amount > 0
    payment_amount = payment.get("amount", 0) or 0
    if payment_amount > 0:
        payment_data = {
            "job_id":       job_id,
            "payment_date": payment.get("payment_date"),
            "payment_mode": payment.get("payment_mode", ""),
            "amount":       payment_amount,
            "reference_no": payment.get("reference_no", ""),
            "remarks":      payment.get("remarks", ""),
        }
        await exec_sql_object(db_name_arg, schema_name, {"tableName": "job_payment", "xData": payment_data})
        logger.info("Payment inserted for job %s, amount=%s", job_id, payment_amount)

    # 2. Update job: close it and record delivery
    job_object = {
        "tableName": "job",
        "xData": {
            "id":            job_id,
            "is_closed":     True,
            "delivery_date": delivery_date,
            "job_status_id": delivered_status_id,
        },
    }
    await exec_sql_object(db_name_arg, schema_name, job_object)
    logger.info("Job %s closed, delivery_date=%s", job_id, delivery_date)

    # 3. Insert job_transaction
    notes_parts = [p for p in [delivery_manner_name, transaction_notes] if p]
    full_notes  = ". ".join(notes_parts)

    txn_data: dict = {
        "job_id":               job_id,
        "status_id":            delivered_status_id,
        "performed_by_user_id": performed_by,
    }
    if full_notes:
        txn_data["notes"] = full_notes
    if last_transaction_id is not None:
        txn_data["previous_transaction_id"] = last_transaction_id

    new_txn_id = await exec_sql_object(db_name_arg, schema_name, {"tableName": "job_transaction", "xData": txn_data})
    logger.debug("Delivery transaction inserted, id=%s", new_txn_id)

    # 4. Update job.last_transaction_id
    if new_txn_id:
        await exec_sql_object(db_name_arg, schema_name, {
            "tableName": "job",
            "xData": {"id": job_id, "last_transaction_id": new_txn_id},
        })
        logger.debug("job.last_transaction_id updated to %s", new_txn_id)

    return new_txn_id


async def resolve_create_job_batch_helper(db_name: str, schema: str = "public", value: str = "") -> Any:
    payload = _decode_value(value, "createJobBatch")
    shared = payload.get("sharedData", {})
    jobs   = payload.get("jobs", [])

    branch_id             = shared.get("branch_id")
    batch_date            = shared.get("batch_date")
    customer_contact_id   = shared.get("customer_contact_id")
    job_type_id           = shared.get("job_type_id")
    job_receive_manner_id = shared.get("job_receive_manner_id")
    job_status_id         = shared.get("job_status_id")
    performed_by          = shared.get("performed_by_user_id")
    doc_sequence_id       = shared.get("job_doc_sequence_id")
    doc_sequence_next     = shared.get("job_doc_sequence_next")

    db_name_arg = db_name if db_name else None
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            await cur.execute("SELECT nextval('job_batch_no_seq') AS batch_no")
            batch_no = (await cur.fetchone())["batch_no"]
            logger.info("Assigned batch_no=%s", batch_no)

            job_ids = []
            for job in jobs:
                await cur.execute(
                    "INSERT INTO job"
                    " (branch_id, batch_no, job_no, job_date, customer_contact_id,"
                    "  job_type_id, job_receive_manner_id, job_status_id,"
                    "  product_brand_model_id, serial_no, problem_reported,"
                    "  warranty_card_no, job_receive_condition_id, remarks, quantity)"
                    " VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                    (
                        branch_id, batch_no, job.get("job_no"), batch_date,
                        customer_contact_id, job_type_id, job_receive_manner_id, job_status_id,
                        job.get("product_brand_model_id"), job.get("serial_no"),
                        job.get("problem_reported"), job.get("warranty_card_no"),
                        job.get("job_receive_condition_id"), job.get("remarks"),
                        job.get("quantity", 1),
                    ),
                )
                job_id = (await cur.fetchone())["id"]
                job_ids.append(job_id)

                if performed_by is not None:
                    await cur.execute(
                        "INSERT INTO job_transaction (job_id, status_id, performed_by_user_id)"
                        " VALUES (%s, %s, %s)",
                        (job_id, job_status_id, performed_by),
                    )

            if doc_sequence_id is not None and doc_sequence_next is not None:
                await cur.execute(
                    "UPDATE document_sequence SET next_number = %s WHERE id = %s",
                    (doc_sequence_next, doc_sequence_id),
                )

    logger.info("Job batch created: batch_no=%s, jobs=%s", batch_no, job_ids)
    return {"batch_no": batch_no, "job_ids": job_ids}


async def resolve_update_job_batch_helper(db_name: str, schema: str = "public", value: str = "") -> Any:
    payload      = _decode_value(value, "updateJobBatch")
    batch_no     = payload.get("batch_no")
    shared       = payload.get("sharedData", {})
    added_jobs   = payload.get("addedJobs", [])
    updated_jobs = payload.get("updatedJobs", [])
    deleted_ids  = payload.get("deletedJobIds", [])
    doc_seq_id   = payload.get("job_doc_sequence_id")
    doc_seq_next = payload.get("job_doc_sequence_next")
    performed_by = shared.get("performed_by_user_id")

    db_name_arg = db_name if db_name else None
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            await cur.execute(
                "UPDATE job SET job_date=%s, customer_contact_id=%s, job_type_id=%s,"
                " job_receive_manner_id=%s WHERE batch_no=%s",
                (
                    shared.get("batch_date"), shared.get("customer_contact_id"),
                    shared.get("job_type_id"), shared.get("job_receive_manner_id"),
                    batch_no,
                ),
            )

            for job_id in deleted_ids:
                await cur.execute(
                    "SELECT COUNT(*) AS cnt FROM job_transaction WHERE job_id = %s", (job_id,)
                )
                row = await cur.fetchone()
                if row and row["cnt"] > 1:
                    raise ValidationException(
                        message="Cannot delete job with activity",
                        extensions={"job_id": job_id},
                    )
                await cur.execute("DELETE FROM job_transaction WHERE job_id = %s", (job_id,))
                await cur.execute("DELETE FROM job WHERE id = %s", (job_id,))

            for job in updated_jobs:
                job_id = job.get("id")
                await cur.execute(
                    "UPDATE job SET product_brand_model_id=%s, serial_no=%s,"
                    " problem_reported=%s, warranty_card_no=%s,"
                    " job_receive_condition_id=%s, remarks=%s, quantity=%s WHERE id=%s",
                    (
                        job.get("product_brand_model_id"), job.get("serial_no"),
                        job.get("problem_reported"), job.get("warranty_card_no"),
                        job.get("job_receive_condition_id"), job.get("remarks"),
                        job.get("quantity", 1),
                        job_id,
                    ),
                )

            if added_jobs:
                await cur.execute(
                    "SELECT job_status_id FROM job WHERE batch_no=%s LIMIT 1", (batch_no,)
                )
                status_row    = await cur.fetchone()
                job_status_id = status_row["job_status_id"] if status_row else None

                for job in added_jobs:
                    await cur.execute(
                        "INSERT INTO job"
                        " (branch_id, batch_no, job_no, job_date, customer_contact_id,"
                        "  job_type_id, job_receive_manner_id, job_status_id,"
                        "  product_brand_model_id, serial_no, problem_reported,"
                        "  warranty_card_no, job_receive_condition_id, remarks, quantity)"
                        " VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                        (
                            shared.get("branch_id"), batch_no, job.get("job_no"),
                            shared.get("batch_date"), shared.get("customer_contact_id"),
                            shared.get("job_type_id"), shared.get("job_receive_manner_id"),
                            job_status_id,
                            job.get("product_brand_model_id"), job.get("serial_no"),
                            job.get("problem_reported"), job.get("warranty_card_no"),
                            job.get("job_receive_condition_id"), job.get("remarks"),
                            job.get("quantity", 1),
                        ),
                    )
                    new_job_id = (await cur.fetchone())["id"]
                    if performed_by is not None:
                        await cur.execute(
                            "INSERT INTO job_transaction (job_id, status_id, performed_by_user_id)"
                            " VALUES (%s, %s, %s)",
                            (new_job_id, job_status_id, performed_by),
                        )

                if doc_seq_id is not None and doc_seq_next is not None:
                    await cur.execute(
                        "UPDATE document_sequence SET next_number = %s WHERE id = %s",
                        (doc_seq_next, doc_seq_id),
                    )

    return {"batch_no": batch_no}


async def resolve_delete_job_batch_helper(db_name: str, schema: str = "public", value: str = "") -> Any:
    payload  = _decode_value(value, "deleteJobBatch")
    batch_no = payload.get("batch_no")

    db_name_arg = db_name if db_name else None
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
                    "SELECT COUNT(*) AS cnt FROM job_transaction WHERE job_id = %s", (job_id,)
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


async def resolve_generic_update_script_helper(db_name: str, schema: str = "public", value: str = "") -> Any:
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
    db_name_arg = db_name if db_name else None

    logger.debug("Executing script '%s' on: %s", sql_id, db_name_arg or 'client_db')
    result = await exec_sql(db_name_arg, schema or "public", sql, sql_args)
    logger.debug("Script '%s' executed successfully", sql_id)
    return result


async def resolve_delete_unused_parts_by_brand_helper(db_name: str, schema: str, value: str) -> dict:
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


async def resolve_import_spare_parts_helper(db_name: str, schema: str = "public", value: str = "") -> dict:
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

    db_name_arg = db_name if db_name else None
    logger.info("Bulk importing %d spare parts into: %s", len(payload), db_name_arg or 'client_db')

    count = await bulk_insert_records(
        db_name=db_name_arg,
        schema=schema or "public",
        table_name="spare_part_master",
        records=payload,
    )

    logger.info("Bulk import complete: %d rows inserted", count)
    return {"success_count": count}


async def resolve_mail_admin_credentials_helper(db_name: str, schema: str, value: str) -> dict:
    """
    Decode value payload, generate a password-reset JWT, and email the reset link
    to the admin user. No password is changed at this stage.

    Value payload (URL-encoded JSON): { id, client_id }
    """
    payload = _decode_value(value, "mailAdminCredentials")

    id_       = payload.get("id")
    client_id = payload.get("client_id")
    if not id_:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "id"},
        )

    # 1. Fetch admin user
    rows = await exec_sql(
        db_name=db_name, schema=schema or "security",
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
    token = create_reset_token({
        "sub":       str(id_),
        "db_name":   db_name,
        "client_id": client_id,
    })
    reset_link = f"{settings.frontend_url}/reset-password?token={token}"
    logger.info("Password reset link generated for admin user id=%s in %s", id_, db_name)

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
    except Exception as mail_err:
        email_error = str(mail_err)
        logger.warning("Failed to send reset link email to %s: %s", user['email'], mail_err)

    await audit_logger.log(
        action=AuditAction.MAIL_ADMIN_CREDENTIALS,
        detail=f"email_sent={email_sent}" + (f", error={email_error}" if email_error else ""),
        resource_id=str(id_),
        resource_name=user.get("username", ""),
        resource_type="admin_user",
    )
    return {"email_error": email_error, "email_sent": email_sent, "id": id_}


async def resolve_set_user_bu_role_helper(db_name: str, schema: str, value: str) -> dict:
    """
    Decode value payload and replace all BU/role associations for a business user.
    Transaction: DELETE all user_bu_role rows for user_id, then INSERT one per bu_id.

    Value payload (URL-encoded JSON): { user_id, bu_ids, role_id }
    """
    payload = _decode_value(value, "setUserBuRole")

    user_id = payload.get("user_id")
    bu_ids  = payload.get("bu_ids", [])
    role_id = payload.get("role_id")

    if not user_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "user_id"},
        )

    schema_name = schema or "security"

    # Verify user exists and is a business user
    user_rows = await exec_sql(
        db_name=db_name, schema=schema_name,
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
