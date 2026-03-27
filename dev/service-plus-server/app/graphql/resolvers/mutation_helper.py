import json
import re
import secrets
from datetime import datetime
from urllib.parse import unquote

from psycopg import sql as pgsql

from app.core.audit_log import AuditAction, audit_logger
from app.core.email import send_email
from app.core.security import create_reset_token, hash_password
from app.config import settings
from app.db.psycopg_driver import exec_sql, exec_sql_dml, exec_sql_object, get_service_db_connection
from app.db.sql_auth import SqlAuth
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
        logger.error(f"Invalid JSON in {context} value: {e}")
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

    logger.info(f"Creating admin user '{username}' in database '{db_name}'")

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
    logger.info(f"Admin user created successfully with id: {record_id}")

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
        logger.warning(f"Failed to send welcome email to {email}: {mail_err}")

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
        logger.info(f"Schema-repair path: using existing BU id={bu_id} for code='{code}'")
    else:
        # 4a. Check code uniqueness
        rows = await exec_sql(
            db_name=db_name, schema="security",
            sql=SqlAuth.CHECK_BU_CODE_EXISTS,
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
            sql=SqlAuth.CHECK_BU_NAME_EXISTS,
            sql_args={"name": name},
        )
        if rows and rows[0].get("exists"):
            raise ValidationException(
                message=AppMessages.BU_NAME_EXISTS,
                extensions={"field": "name"},
            )

        # 4c. Insert BU row into security.bu
        logger.info(f"Creating BU '{code}' / '{name}' in db '{db_name}'")
        rows = await exec_sql(
            db_name=db_name, schema="security",
            sql=SqlAuth.INSERT_BU,
            sql_args={"code": code, "name": name},
        )
        bu_id = rows[0]["id"] if rows else None

    # 7. Create schema <code>
    logger.info(f"Creating schema '{code}' in db '{db_name}'")
    await exec_sql(
        db_name=db_name, schema="security",
        sql=pgsql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(pgsql.Identifier(code)),
    )

    # 8. Create all BU tables in the new schema
    logger.info(f"Running BU_SCHEMA_DDL in schema '{code}'")
    await exec_sql(
        db_name=db_name, schema=code,
        sql=SqlBu.BU_SCHEMA_DDL,
    )

    # 9. Seed lookup data
    logger.info(f"Seeding lookup data in schema '{code}'")
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

    logger.info(f"BU '{code}' created successfully with schema and seed data")
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
        sql=SqlAuth.CHECK_BUSINESS_USER_USERNAME_EXISTS,
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
        sql=SqlAuth.CHECK_BUSINESS_USER_EMAIL_EXISTS,
        sql_args={"email": email},
    )
    if email_rows and email_rows[0].get("exists"):
        raise ValidationException(
            message=AppMessages.BUSINESS_USER_EMAIL_EXISTS,
            extensions={"field": "email"},
        )

    # Store a random unusable hash — user cannot log in until they set a password via reset link
    password_hash = hash_password(secrets.token_urlsafe(32))

    logger.info(f"Creating business user '{username}' in database '{db_name}'")

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
    logger.info(f"Business user created with id: {record_id}")

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
        logger.warning(f"Failed to send setup link email to {email}: {mail_err}")

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
    logger.info(f"Client '{name}' created with id={record_id}")

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
            logger.warning(f"Failed to send welcome email to {email}: {mail_err}")

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
    logger.info(f"Checking db_name uniqueness: {new_db_name}")
    rows = await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlAuth.CHECK_DB_NAME_EXISTS,
        sql_args={"db_name": new_db_name},
    )
    if rows and rows[0].get("exists"):
        raise ValidationException(
            message=AppMessages.CLIENT_DB_NAME_EXISTS,
            extensions={"field": "new_db_name"},
        )

    # 3. CREATE DATABASE (requires autocommit)
    logger.info(f"Creating database: {new_db_name}")
    await exec_sql_dml(
        db_name=None,
        schema="public",
        sql=pgsql.SQL("CREATE DATABASE {}").format(pgsql.Identifier(new_db_name)),
    )

    # 4. Set up security schema inside the new database
    logger.info(f"Setting up security schema in: {new_db_name}")
    await exec_sql(
        db_name=new_db_name,
        schema="security",
        sql=SqlAuth.SECURITY_SCHEMA_DDL,
    )

    # 5. Persist new_db_name on the client record
    logger.info(f"Updating client {client_id} db_name → {new_db_name}")
    await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlAuth.UPDATE_CLIENT_DB_NAME,
        sql_args={"db_name": new_db_name, "id": client_id},
    )

    logger.info(f"Client {client_id} successfully initiated with db: {new_db_name}")
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
        sql="""
            with "dummy" as (values(1::int))
            SELECT EXISTS (
                SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = %(code)s
            ) AS exists
        """,
        sql_args={"code": code},
    )
    if not (rows and rows[0].get("exists")):
        raise ValidationException(
            message=AppMessages.RESOURCE_NOT_FOUND,
            extensions={"detail": f"Schema '{code}' does not exist", "field": "code"},
        )

    logger.info(f"Seeding lookup data into existing schema '{code}' in db '{db_name}'")
    await exec_sql(
        db_name=db_name, schema=code,
        sql=SqlBu.BU_SEED_SQL,
    )

    await audit_logger.log(
        action=AuditAction.FEED_BU_SEED_DATA,
        resource_name=code,
        resource_type="bu_schema",
    )
    logger.info(f"Seed data fed into schema '{code}' successfully")
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
    logger.info(f"Dropping schema '{code}' in db '{db_name}'")
    await exec_sql_dml(
        db_name=db_name, schema="security",
        sql=pgsql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(pgsql.Identifier(code)),
    )

    # Optionally delete the bu row
    if delete_bu_row:
        logger.info(f"Deleting security.bu row for code='{code}'")
        await exec_sql(
            db_name=db_name, schema="security",
            sql="""
                with "p_code" as (values(%(code)s::text))
                DELETE FROM security.bu
                WHERE LOWER(code) = LOWER((table "p_code"))
                RETURNING id
            """,
            sql_args={"code": code},
        )

    await audit_logger.log(
        action=AuditAction.DROP_DATABASE,
        resource_name=code,
        resource_type="bu_schema",
    )
    logger.info(f"Schema '{code}' dropped successfully")
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
        sql=SqlAuth.GET_CLIENT_BY_ID,
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
        logger.info(f"Dropping client database: {db_name_val}")
        await exec_sql_dml(
            db_name=None, schema="public",
            sql=pgsql.SQL("DROP DATABASE IF EXISTS {}").format(pgsql.Identifier(db_name_val)),
        )

    # 3. Delete the client row
    await exec_sql(
        db_name=None, schema="public",
        sql=SqlAuth.DELETE_CLIENT,
        sql_args={"id": client_id},
    )

    logger.info(f"Client id={client_id} deleted")
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
        sql=SqlAuth.CHECK_CLIENT_DB_NAME_IN_USE,
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
        sql=SqlAuth.CHECK_DB_NAME_EXISTS,
        sql_args={"db_name": target_db},
    )
    if not (exists_rows and exists_rows[0].get("exists")):
        raise ValidationException(
            message=AppMessages.RESOURCE_NOT_FOUND,
            extensions={"field": "db_name"},
        )

    # 4. DROP DATABASE (requires autocommit)
    logger.info(f"Dropping orphan database: {target_db}")
    await exec_sql_dml(
        db_name=None, schema="public",
        sql=pgsql.SQL("DROP DATABASE {}").format(pgsql.Identifier(target_db)),
    )

    logger.info(f"Orphan database dropped: {target_db}")
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
        sql=SqlAuth.GET_BUSINESS_USER_BY_ID,
        sql_args={"id": id_},
    )
    if not rows:
        raise ValidationException(
            message=AppMessages.NOT_FOUND,
            extensions={"field": "id"},
        )
    user = rows[0]

    logger.info(f"Generating reset link for business user id={id_} in {db_name}")

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
        logger.warning(f"Failed to send reset link email to {user['email']}: {mail_err}")

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

    Args:
        db_name: Target service database name. Empty string routes to the client DB.
        schema:  Database schema to execute against (default: "public").
        value:   URL-encoded JSON string representing the SQL object to execute.

    Returns:
        The id of the last inserted/updated record, or None.

    Raises:
        ValidationException: If value is missing or not valid JSON.
    """
    if not value:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "value"},
        )

    db_name_arg = db_name if db_name else None
    logger.info(f"Updating database entry in: {db_name_arg or 'client_db'}")

    value_string = unquote(value)
    try:
        sql_object: dict = json.loads(value_string)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in value parameter: {e}")
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

    logger.info(f"Database entry updated successfully in: {db_name_arg or 'client_db'}")
    return record_id


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
        sql=SqlAuth.GET_ADMIN_USER_BY_ID,
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
    logger.info(f"Password reset link generated for admin user id={id_} in {db_name}")

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
        logger.warning(f"Failed to send reset link email to {user['email']}: {mail_err}")

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
        sql=SqlAuth.GET_BUSINESS_USER_BY_ID,
        sql_args={"id": user_id},
    )
    if not user_rows:
        raise ValidationException(
            message=AppMessages.NOT_FOUND,
            extensions={"field": "user_id"},
        )

    logger.info(f"Setting BU/role associations for user_id={user_id} in {db_name}")

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
