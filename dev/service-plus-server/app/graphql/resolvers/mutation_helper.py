import json
import re
import secrets
from urllib.parse import unquote

from psycopg import sql as pgsql

from app.core.email import send_email
from app.core.security import hash_password
from app.db.psycopg_driver import exec_sql, exec_sql_dml, exec_sql_object
from app.db.sql_auth import SqlAuth
from app.exceptions import AppMessages, ValidationException
from app.logger import logger



async def resolve_create_admin_user_helper(
    db_name: str,
    email: str,
    full_name: str,
    mobile: str | None,
) -> dict:
    """
    Auto-generate credentials, hash the password, insert a new admin user into
    security.user of the specified client database, and email the credentials.

    Args:
        db_name:   Service database name.
        email:     User email (unique). Credentials are sent here.
        full_name: User full name.
        mobile:    User mobile number (optional).

    Returns:
        Dict with the newly created user id.

    Raises:
        ValidationException: If required fields are missing.
        DatabaseException:   On any database error.
    """
    # Derive username from email local-part
    local = email.split("@")[0]
    username = re.sub(r"[^a-zA-Z0-9_]", "", local).lower()[:30] or "admin"
    if username and username[0].isdigit():
        username = "adm_" + username

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
    try:
        await send_email(
            to=email,
            subject="Your Admin Account Credentials",
            body=(
                f"Hello {full_name},\n\n"
                f"Your admin account has been created.\n\n"
                f"  Username : {username}\n"
                f"  Password : {temp_password}\n\n"
                f"Please log in and change your password immediately.\n"
            ),
        )
    except Exception as mail_err:
        logger.warning(f"Failed to send credentials email to {email}: {mail_err}")

    return {"id": record_id}


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
    return {"db_name": db_name, "id": client_id}


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
