"""BU/client provisioning mutation resolvers: create/delete BU schema, client,
service DB, drop database, feed seed data. Split from mutation_helper.py —
see plans/plan.md Step 4."""

import re

import psycopg.sql as pgsql

from app.core.audit_log import AuditAction, audit_logger
from app.core.email import send_email
from app.db.connection.psycopg_driver import exec_sql, exec_sql_dml, exec_sql_object
from app.db.seeds.seed_bu_data import SeedBuData
from app.db.seeds.seed_security_data import SeedSecurityData
from app.db.sql.sql_base import SqlStore
from app.core.exceptions import AppMessages, ValidationException
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger

# genericUpdate access rights for tables owned by the bu-admin/Configurations
# menu. Merged into mutation.py's GENERIC_UPDATE_TABLE_RIGHTS — see
# plans/plan.md Step 4.6 / item 13.
BU_ADMIN_GENERIC_UPDATE_TABLE_RIGHTS: dict[str, str] = {
    "division": "CONFIG_MENU",
    "app_setting": "CONFIG_MENU",
    "document_sequence": "CONFIG_MENU",
}


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

    # 2. Validate code format: alphanumeric + underscore, 3–30 chars
    if not re.match(r"^[a-z0-9_]{3,30}$", code):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={
                "detail": "Code must be 3–30 alphanumeric/underscore characters",
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
        sql=SqlStore.BU_SCHEMA_DDL,
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

    # 4. Set up security schema inside the new database. SqlStore.SECURITY_SCHEMA_DDL
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
        sql=SqlStore.SECURITY_SCHEMA_DDL,
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

    if not re.match(r"^[a-z0-9_]{3,30}$", code):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={
                "detail": "Code must be 3–30 alphanumeric/underscore characters",
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
    - code: schema name (lowercase, 3–30 chars, alphanumeric + underscore)
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

    if not re.match(r"^[a-z0-9_]{3,30}$", code):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={
                "detail": "Code must be 3–30 alphanumeric/underscore characters",
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
