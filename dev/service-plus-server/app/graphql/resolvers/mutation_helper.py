import json
import re
import secrets
from datetime import datetime
from urllib.parse import unquote

from psycopg import sql as pgsql

from app.core.audit_log import AuditAction, audit_logger
from app.core.email import send_email
from app.core.security import hash_password
from app.db.psycopg_driver import exec_sql, exec_sql_dml, exec_sql_object
from app.db.sql_auth import SqlAuth
from app.exceptions import AppMessages, ValidationException
from app.logger import logger


def _serialize_row(row: dict) -> dict:
    return {k: v.isoformat() if isinstance(v, datetime) else v for k, v in row.items()}


async def resolve_delete_client_helper(client_id: int) -> dict:
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


async def resolve_drop_database_helper(db_name: str) -> dict:
    """
    Physically drop an orphan PostgreSQL database.

    Validates that the database name follows the service_plus_* pattern,
    is not currently linked to any client, and exists before dropping.

    Args:
        db_name: Name of the database to drop.

    Returns:
        Dict with the dropped db_name.

    Raises:
        ValidationException: If name is invalid, still in use, or not found.
    """
    # 1. Validate format
    if not re.match(r"^service_plus_[a-z0-9_]+$", db_name):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": "Database name must match ^service_plus_[a-z0-9_]+$", "field": "db_name"},
        )

    # 2. Safety check — refuse to drop if still linked to a client
    in_use_rows = await exec_sql(
        db_name=None, schema="public",
        sql=SqlAuth.CHECK_CLIENT_DB_NAME_IN_USE,
        sql_args={"db_name": db_name},
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
        sql_args={"db_name": db_name},
    )
    if not (exists_rows and exists_rows[0].get("exists")):
        raise ValidationException(
            message=AppMessages.RESOURCE_NOT_FOUND,
            extensions={"field": "db_name"},
        )

    # 4. DROP DATABASE (requires autocommit)
    logger.info(f"Dropping orphan database: {db_name}")
    await exec_sql_dml(
        db_name=None, schema="public",
        sql=pgsql.SQL("DROP DATABASE {}").format(pgsql.Identifier(db_name)),
    )

    logger.info(f"Orphan database dropped: {db_name}")
    await audit_logger.log(
        action=AuditAction.DROP_DATABASE,
        resource_name=db_name,
        resource_type="database",
    )
    return {"db_name": db_name}


async def resolve_create_admin_user_helper(
    db_name: str,
    email: str,
    full_name: str,
    mobile: str | None,
    username: str,
) -> dict:
    """
    Hash the password, insert a new admin user into security.user of the
    specified client database, and email the credentials.

    Args:
        db_name:   Service database name.
        email:     User email (unique). Credentials are sent here.
        full_name: User full name.
        mobile:    User mobile number (optional).
        username:  Username supplied by the SA (unique within the client DB).

    Returns:
        Dict with the newly created user id.

    Raises:
        ValidationException: If required fields are missing.
        DatabaseException:   On any database error.
    """
    # Generate temporary password and hash it
    temp_password = secrets.token_urlsafe(9)
    password_hash = hash_password(temp_password)

    logger.info(f"Creating admin user '{username}' in database '{db_name}'")

    sql_object = {
        "tableName": "user",
        "xData": {
            "email": email,
            "full_name": full_name,
            "is_active": True,
            "is_admin": True,
            "mobile": mobile or None,
            "password_hash": password_hash,
            "username": username,
        },
    }
    record_id = await exec_sql_object(db_name, "security", sql_object)

    logger.info(f"Admin user created successfully with id: {record_id}")

    # Email credentials (errors are logged, not re-raised)
    email_sent = False
    try:
        await send_email(
            to=email,
            subject=AppMessages.EMAIL_ADMIN_CREDENTIALS_SUBJECT,
            body=AppMessages.EMAIL_ADMIN_CREDENTIALS_BODY.format(
                full_name=full_name,
                username=username,
                password=temp_password,
            ),
        )
        email_sent = True
    except Exception as mail_err:
        logger.warning(f"Failed to send credentials email to {email}: {mail_err}")

    await audit_logger.log(
        action=AuditAction.CREATE_ADMIN_USER,
        resource_id=str(record_id),
        resource_name=username,
        resource_type="admin_user",
    )
    return {"id": record_id, "email_sent": email_sent}


async def resolve_create_service_db_helper(client_id: int, db_name: str) -> dict:
    """
    Create a new PostgreSQL service database with the security schema
    for a client, then record the db_name on the client row.

    Args:
        client_id: ID of the client in the client database.
        db_name:   Name of the new database to create.

    Returns:
        Dict with client id and db_name on success.

    Raises:
        ValidationException: If db_name format is invalid or already taken.
        DatabaseException:   On any database error.
    """
    # 1. Validate db_name format
    if not re.match(r"^service_plus_[a-z0-9_]+$", db_name):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": "Database name must match ^service_plus_[a-z0-9_]+$", "field": "db_name"},
        )

    # 2. Check db_name uniqueness against pg_database
    logger.info(f"Checking db_name uniqueness: {db_name}")
    rows = await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlAuth.CHECK_DB_NAME_EXISTS,
        sql_args={"db_name": db_name},
    )
    if rows and rows[0].get("exists"):
        raise ValidationException(
            message=AppMessages.CLIENT_DB_NAME_EXISTS,
            extensions={"field": "db_name"},
        )

    # 3. CREATE DATABASE (requires autocommit – cannot run inside a transaction)
    logger.info(f"Creating database: {db_name}")
    await exec_sql_dml(
        db_name=None,
        schema="public",
        sql=pgsql.SQL("CREATE DATABASE {}").format(pgsql.Identifier(db_name)),
    )

    # 4. Set up security schema inside the new database.
    #    No sql_args → psycopg3 uses simple query protocol → multi-statement DDL works.
    logger.info(f"Setting up security schema in: {db_name}")
    await exec_sql(
        db_name=db_name,
        schema="security",
        sql=SqlAuth.SECURITY_SCHEMA_DDL,
    )

    # 5. Persist db_name on the client record
    logger.info(f"Updating client {client_id} db_name → {db_name}")
    await exec_sql(
        db_name=None,
        schema="public",
        sql=SqlAuth.UPDATE_CLIENT_DB_NAME,
        sql_args={"db_name": db_name, "id": client_id},
    )

    logger.info(f"Client {client_id} successfully initiated with db: {db_name}")
    await audit_logger.log(
        action=AuditAction.CREATE_SERVICE_DB,
        resource_name=db_name,
        resource_type="database",
    )
    return {"db_name": db_name, "id": client_id}


async def resolve_set_admin_user_active_helper(db_name: str, id: int, is_active: bool) -> dict:
    rows = await exec_sql(
        db_name=db_name, schema="security",
        sql=SqlAuth.SET_ADMIN_USER_ACTIVE,
        sql_args={"id": id, "is_active": is_active},
    )
    if not rows:
        raise ValidationException(
            message=AppMessages.ADMIN_USER_NOT_FOUND,
            extensions={"field": "id"},
        )
    logger.info(f"Admin user id={id} is_active set to {is_active} in {db_name}")
    await audit_logger.log(
        action=AuditAction.ACTIVATE_ADMIN_USER if is_active else AuditAction.DEACTIVATE_ADMIN_USER,
        resource_id=str(id),
        resource_type="admin_user",
    )
    return _serialize_row(rows[0])


async def resolve_update_admin_user_helper(
    db_name: str, id: int, full_name: str, email: str, mobile: str | None
) -> dict:
    dup_rows = await exec_sql(
        db_name=db_name, schema="security",
        sql=SqlAuth.CHECK_ADMIN_EMAIL_EXISTS_EXCLUDE_ID,
        sql_args={"email": email, "id": id},
    )
    if dup_rows and dup_rows[0].get("exists"):
        raise ValidationException(
            message=AppMessages.ADMIN_EMAIL_EXISTS,
            extensions={"field": "email"},
        )

    rows = await exec_sql(
        db_name=db_name, schema="security",
        sql=SqlAuth.UPDATE_ADMIN_USER,
        sql_args={"email": email, "full_name": full_name, "id": id, "mobile": mobile or ""},
    )
    if not rows:
        raise ValidationException(
            message=AppMessages.ADMIN_USER_NOT_FOUND,
            extensions={"field": "id"},
        )
    logger.info(f"Admin user id={id} updated in {db_name}")
    await audit_logger.log(
        action=AuditAction.UPDATE_ADMIN_USER,
        resource_id=str(id),
        resource_name=full_name,
        resource_type="admin_user",
    )
    return _serialize_row(rows[0])


async def resolve_mail_admin_credentials_helper(db_name: str, id: int) -> dict:
    """
    Generate a new temporary password for an admin user, update the hash in the
    database, and email the new credentials.

    Args:
        db_name: Service database name.
        id:      ID of the admin user in security."user".

    Returns:
        Dict with id and email_sent flag.

    Raises:
        ValidationException: If the admin user is not found.
    """
    # 1. Fetch admin user
    rows = await exec_sql(
        db_name=db_name, schema="security",
        sql=SqlAuth.GET_ADMIN_USER_BY_ID,
        sql_args={"id": id},
    )
    if not rows:
        raise ValidationException(
            message=AppMessages.ADMIN_USER_NOT_FOUND,
            extensions={"field": "id"},
        )
    user = rows[0]

    # 2. Generate new temporary password and hash it
    temp_password = secrets.token_urlsafe(9)
    password_hash = hash_password(temp_password)

    # 3. Update password_hash in the database
    updated = await exec_sql(
        db_name=db_name, schema="security",
        sql=SqlAuth.RESET_ADMIN_PASSWORD,
        sql_args={"id": id, "password_hash": password_hash},
    )
    if not updated:
        raise ValidationException(
            message=AppMessages.ADMIN_USER_NOT_FOUND,
            extensions={"field": "id"},
        )

    logger.info(f"Admin user id={id} password reset in {db_name}")

    # 4. Email credentials
    email_sent = False
    email_error: str | None = None
    try:
        await send_email(
            to=user["email"],
            subject=AppMessages.EMAIL_RESET_CREDENTIALS_SUBJECT,
            body=AppMessages.EMAIL_RESET_CREDENTIALS_BODY.format(
                full_name=user["full_name"],
                username=user["username"],
                password=temp_password,
            ),
        )
        email_sent = True
    except Exception as mail_err:
        email_error = str(mail_err)
        logger.warning(f"Failed to send reset credentials email to {user['email']}: {mail_err}")

    await audit_logger.log(
        action=AuditAction.MAIL_ADMIN_CREDENTIALS,
        detail=f"email_sent={email_sent}" + (f", error={email_error}" if email_error else ""),
        resource_id=str(id),
        resource_name=user.get("username", ""),
        resource_type="admin_user",
    )
    return {"id": id, "email_sent": email_sent, "email_error": email_error}


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
