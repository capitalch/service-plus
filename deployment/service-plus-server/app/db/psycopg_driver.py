"""
Database connection management using psycopg (psycopg3).
"""

import os
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator
import psycopg
from psycopg import sql as pgsql
from psycopg.rows import dict_row
from psycopg.types.datetime import DateLoader, TimestampLoader, TimestamptzLoader
from psycopg.types.numeric import FloatLoader
from app.config import settings
from app.exceptions import AppMessages, DatabaseException
from app.logger import logger

_APP_ENV: str = os.environ.get("APP_ENV", "development")
_MAX_BULK_PLACEHOLDERS: int = 2000


class _IsoDateLoader(DateLoader):  # pylint: disable=too-few-public-methods
    """Returns date values as ISO-formatted strings instead of date objects."""

    def load(self, data: bytes) -> str:
        return super().load(data).isoformat()


class _IsoTimestampLoader(TimestampLoader):  # pylint: disable=too-few-public-methods
    """Returns timestamp values as ISO-formatted strings instead of datetime objects."""

    def load(self, data: bytes) -> str:
        return super().load(data).isoformat()


class _IsoTimestamptzLoader(TimestamptzLoader):  # pylint: disable=too-few-public-methods
    """Returns timestamptz values as ISO-formatted strings instead of datetime objects."""

    def load(self, data: bytes) -> str:
        return super().load(data).isoformat()


class _FloatNumericLoader(FloatLoader):  # pylint: disable=too-few-public-methods
    """Returns numeric/decimal values as float instead of Decimal (JSON-serializable)."""


@asynccontextmanager
async def _open_db_connection(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    host: str,
    port: int,
    user: str,
    password: str,
    dbname: str,
    label: str,
    autocommit: bool = False,
) -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """
    Private async context manager that opens a psycopg connection.

    Commits automatically on clean exit; rolls back on exception.
    The connection is always closed in the finally block.

    Args:
        host:        Database host.
        port:        Database port.
        user:        Database user.
        password:    Database password.
        dbname:      Database name.
        label:       Short label used in log messages (e.g. "client", "service").
        autocommit:  When True, each statement is committed immediately (required
                     for DDL statements that cannot run inside a transaction block).
    """
    conn: psycopg.AsyncConnection | None = None
    try:
        conn = await psycopg.AsyncConnection.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=dbname,
            autocommit=autocommit,
        )
        logger.debug("%s database connection opened (autocommit=%s)", label, autocommit)
        yield conn
        if not autocommit:
            await conn.commit()
            logger.debug("%s database transaction committed", label)
    except psycopg.OperationalError as e:
        logger.error("%s: %s", AppMessages.DATABASE_CONNECTION_FAILED, e)
        raise DatabaseException(AppMessages.DATABASE_CONNECTION_FAILED) from e
    except DatabaseException:
        if not autocommit and conn and not conn.closed:
            await conn.rollback()
        raise
    except Exception as e:
        if not autocommit and conn and not conn.closed:
            await conn.rollback()
        logger.error("Unexpected %s database error: %s", label, e)
        raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED) from e
    finally:
        if conn and not conn.closed:
            await conn.close()
            logger.debug("%s database connection closed", label)


async def exec_sql(
    db_name: str | None,
    schema: str = "public",
    sql: str | None = None,
    sql_args: dict | None = None,
    text_dates: bool = False,
) -> list[Any]:
    """
    Execute a raw SQL query against the specified database and schema.

    Args:
        db_name:    Service database name; pass None to use the client DB.
        schema:     PostgreSQL schema to set for the session (default: "public").
        sql:        The parameterised SQL query to execute.
        sql_args:   Parameters to pass to the SQL query.
        text_dates: When True, date/timestamp columns are returned as ISO strings
                    instead of Python datetime objects (zero Python-level iteration).

    Returns:
        List of dict rows for SELECT queries; integer row-count for DML.
    """
    if not sql:
        raise ValueError(AppMessages.DATABASE_QUERY_FAILED)

    sql_args = sql_args or {}
    schema_to_set = schema or "public"
    records: list[Any] = []

    connection = (
        get_service_db_connection(db_name) if db_name else get_client_db_connection()
    )

    async with connection as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            cur.adapters.register_loader("numeric", _FloatNumericLoader)
            if text_dates:
                cur.adapters.register_loader("date", _IsoDateLoader)
                cur.adapters.register_loader("timestamp", _IsoTimestampLoader)
                cur.adapters.register_loader("timestamptz", _IsoTimestamptzLoader)
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(
                    pgsql.Identifier(schema_to_set)
                )
            )
            await cur.execute(sql, sql_args)
            if cur.description:
                records = await cur.fetchall()
            else:
                records = cur.rowcount

    return records


async def exec_sql_dml(
    db_name: str | None,
    schema: str = "public",
    sql: str | None = None,
    sql_args: dict | None = None,
) -> int:
    """
    Execute a DDL or autocommit-required SQL statement against the specified database.

    Uses autocommit mode so statements that cannot run inside a transaction block
    (e.g. CREATE SCHEMA, CREATE TABLE, DROP TABLE) are handled correctly.

    Args:
        db_name:  Service database name; pass None to use the client DB.
        schema:   PostgreSQL schema to set for the session (default: "public").
        sql:      The SQL statement to execute.
        sql_args: Parameters to pass to the SQL statement.

    Returns:
        Row count affected by the statement.
    """
    if not sql:
        raise ValueError(AppMessages.DATABASE_QUERY_FAILED)

    sql_args = sql_args or {}
    schema_to_set = schema or "public"
    row_count: int = 0

    connection = (
        get_service_db_connection(db_name, autocommit=True)
        if db_name
        else get_client_db_connection(autocommit=True)
    )

    async with connection as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(
                    pgsql.Identifier(schema_to_set)
                )
            )
            await cur.execute(sql, sql_args)
            row_count = cur.rowcount if cur.rowcount >= 0 else 0

    return row_count


async def exec_sql_object(
    db_name: str | None,
    schema: str = "public",
    sql_object: Any = None,
) -> int | None:
    """
    Execute a structured SQL object against the specified database and schema.

    Args:
        db_name:    Service database name; pass None to use the client DB.
        schema:     PostgreSQL schema to set for the session (default: "public").
        sql_object: The SQL object to execute.

    Returns:
        The id of the last inserted/updated record, or None.
    """
    if not sql_object:
        raise ValueError(AppMessages.DATABASE_QUERY_FAILED)

    schema_to_set = schema or "public"
    record_id: int | None = None

    connection = (
        get_service_db_connection(db_name) if db_name else get_client_db_connection()
    )

    async with connection as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(
                    pgsql.Identifier(schema_to_set)
                )
            )
            record_id = await process_details(sql_object, cur)
            # closing connection and cursor is handled by the context manager automatically

    return record_id


@asynccontextmanager
async def get_client_db_connection(
    autocommit: bool = False,
) -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """
    Async context manager that yields a client database connection.

    Usage:
        async with get_client_db_connection() as conn:
            result = await conn.execute(...)
    """
    host = settings.client_db_ip_address if _APP_ENV == "production" else settings.client_db_host
    port = settings.client_db_internal_port if _APP_ENV == "production" else settings.client_db_port
    async with _open_db_connection(
        host=host,
        port=port,
        user=settings.client_db_user,
        password=settings.client_db_password,
        dbname=settings.client_db_name,
        label="client",
        autocommit=autocommit,
    ) as conn:
        yield conn


def get_insert_sql(
    x_data: dict,
    table_name: str,
    fkey_name: str | None,
    fkey_value: Any,
) -> tuple[pgsql.Composed, tuple]:
    """
    Build a parameterised INSERT … RETURNING id SQL object for a table.

    Args:
        x_data:     Row data as a dict of column → value.
        table_name: Target table name.
        fkey_name:  Optional foreign-key column name to append.
        fkey_value: Value for the foreign-key column.

    Returns:
        Tuple of (composed SQL, values tuple).
    """
    field_names = list(x_data.keys())
    if fkey_name and fkey_value:
        field_names.append(fkey_name)

    values_list = list(x_data.values())
    if fkey_name and fkey_value:
        values_list.append(fkey_value)

    logger.debug("Building INSERT SQL for table '%s'", table_name)
    sql = pgsql.SQL("INSERT INTO {} ({}) VALUES ({}) RETURNING id").format(
        pgsql.Identifier(table_name),
        pgsql.SQL(", ").join(pgsql.Identifier(f) for f in field_names),
        pgsql.SQL(", ").join(pgsql.Placeholder() for _ in field_names),
    )
    return (sql, tuple(values_list))


@asynccontextmanager
async def get_service_db_connection(
    db_name: str,
    autocommit: bool = False,
) -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """
    Async context manager that yields a service database connection.

    Args:
        db_name:    Name of the service (tenant) database to connect to.
        autocommit: When True, each statement is committed immediately.
    """
    host = settings.service_db_ip_address if _APP_ENV == "production" else settings.service_db_host
    port = settings.service_db_internal_port if _APP_ENV == "production" else settings.service_db_port
    async with _open_db_connection(
        host=host,
        port=port,
        user=settings.service_db_user,
        password=settings.service_db_password,
        dbname=db_name,
        label="service",
        autocommit=autocommit,
    ) as conn:
        yield conn


def get_sql(
    x_data: dict,
    table_name: str,
    fkey_name: str | None,
    fkey_value: Any,
) -> tuple[pgsql.Composed | None, tuple | None]:
    """
    Dispatch to get_update_sql or get_insert_sql based on whether x_data contains an id.

    Args:
        x_data:     Row data as a dict of column → value.
        table_name: Target table name.
        fkey_name:  Optional foreign-key column name.
        fkey_value: Value for the foreign-key column.

    Returns:
        Tuple of (composed SQL, values tuple), or (None, None) if no SQL could be built.
    """
    sql = None
    values_tuple = None
    if x_data.get("id", None) and (not x_data.get("isIdInsert", None)):  # update
        sql, values_tuple = get_update_sql(x_data, table_name)
    else:  # insert
        x_data.pop("isIdInsert", None)
        sql, values_tuple = get_insert_sql(x_data, table_name, fkey_name, fkey_value)
    return (sql, values_tuple)


def get_update_sql(x_data: dict, table_name: str) -> tuple[pgsql.Composed, tuple]:
    """
    Build a parameterised UPDATE … RETURNING id SQL object for a table.

    Args:
        x_data:     Row data as a dict of column → value; must contain an "id" key.
        table_name: Target table name.

    Returns:
        Tuple of (composed SQL, values tuple).
    """
    data_copy = x_data.copy()
    record_id = data_copy.pop("id")

    logger.debug("Building UPDATE SQL for table '%s'", table_name)
    assignments = pgsql.SQL(", ").join(
        pgsql.SQL("{} = %s").format(pgsql.Identifier(col)) for col in data_copy
    )
    sql = pgsql.SQL("UPDATE {} SET {} WHERE id = %s RETURNING id").format(
        pgsql.Identifier(table_name),
        assignments,
    )
    return (sql, tuple(data_copy.values()) + (record_id,))


async def process_data(
    x_data: dict,
    cur: psycopg.AsyncCursor,
    table_name: str,
    fkey_name: str | None,
    fkey_value: Any,
) -> int | None:
    """
    Execute an INSERT or UPDATE for one row dict, recursing into nested xDetails.

    Args:
        x_data:     Row data; may contain an "xDetails" key with nested sql_object(s).
        cur:        Active psycopg async cursor.
        table_name: Target table name.
        fkey_name:  Optional foreign-key column name.
        fkey_value: Value for the foreign-key column.

    Returns:
        The id of the inserted/updated record, or None.
    """
    x_details = None
    record_id = None
    records = None
    if "xDetails" in x_data:
        x_details = x_data.pop("xDetails")
    sql, tup = get_sql(x_data, table_name, fkey_name, fkey_value)
    if sql:
        await cur.execute(sql, tup)
        if cur.rowcount > 0:
            records = await cur.fetchone()
            record_id = records.get("id")
    if x_details:
        if isinstance(x_details, list):
            for item in x_details:
                await process_details(item, cur, record_id)
        else:
            await process_details(x_details, cur, record_id)
    return record_id


async def bulk_insert_records(
    db_name: str | None,
    schema: str,
    table_name: str,
    records: list[dict],
) -> int:
    """
    Fast bulk insert using multi-row INSERT statements.

    Automatically splits records into sub-batches to stay within psycopg's
    2000-placeholder limit per query.

    Args:
        db_name:    Service database name; pass None to use the client DB.
        schema:     PostgreSQL schema to set for the session.
        table_name: Target table name.
        records:    List of dicts, each representing one row. All dicts must have identical keys.

    Returns:
        Number of rows inserted.
    """
    if not records:
        return 0

    schema_to_set = schema or "public"

    # Collect the union of all keys so every row has the same columns.
    # Preserves insertion order; missing fields default to None.
    field_names = list(dict.fromkeys(k for r in records for k in r.keys()))
    normalized = [{f: r.get(f) for f in field_names} for r in records]

    # psycopg allows at most _MAX_BULK_PLACEHOLDERS placeholders per statement
    batch_size = max(1, _MAX_BULK_PLACEHOLDERS // len(field_names))

    col_sql = pgsql.SQL(", ").join(pgsql.Identifier(f) for f in field_names)
    row_ph = pgsql.SQL("({})").format(
        pgsql.SQL(", ").join(pgsql.Placeholder() for _ in field_names)
    )

    async with (
        get_service_db_connection(db_name) if db_name else get_client_db_connection()
    ) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_to_set))
            )
            for i in range(0, len(normalized), batch_size):
                batch = normalized[i : i + batch_size]
                sql = pgsql.SQL("INSERT INTO {} ({}) VALUES {}").format(
                    pgsql.Identifier(table_name),
                    col_sql,
                    pgsql.SQL(", ").join(row_ph for _ in batch),
                )
                values = tuple(v for r in batch for v in r.values())
                await cur.execute(sql, values)

    return len(records)


async def process_deleted_ids(sql_object: dict, cur: psycopg.AsyncCursor) -> None:
    """
    Delete rows by id list from the table named in sql_object.

    Args:
        sql_object: Dict containing "deletedIds" (list of ids) and "tableName".
        cur:        Active psycopg async cursor.
    """
    deleted_id_list = sql_object.get("deletedIds")
    if not deleted_id_list:
        return
    table_name = sql_object.get("tableName")
    logger.debug("Deleting ids %s from table '%s'", deleted_id_list, table_name)
    sql = pgsql.SQL("DELETE FROM {} WHERE id = ANY(%s)").format(
        pgsql.Identifier(table_name)
    )
    await cur.execute(sql, (list(deleted_id_list),))


async def process_details(
    sql_object: dict,
    cur: psycopg.AsyncCursor,
    fkey_value: Any = None,
) -> int | None:
    """
    Dispatch deletions and upserts for one sql_object node.

    Processes any "deletedIds" first, then delegates "xData" rows to process_data.

    Args:
        sql_object: Dict containing "tableName", optional "fkeyName", "deletedIds", and "xData".
        cur:        Active psycopg async cursor.
        fkey_value: Foreign-key value to pass down to child rows.

    Returns:
        The id of the last inserted/updated record, or None.
    """
    ret = None
    if "deletedIds" in sql_object:
        await process_deleted_ids(sql_object, cur)
    x_data = sql_object.get("xData", None)
    table_name = sql_object.get("tableName", None)
    fkey_name = sql_object.get("fkeyName", None)
    if x_data:
        if isinstance(x_data, list):
            for item in x_data:
                ret = await process_data(item, cur, table_name, fkey_name, fkey_value)
        else:
            ret = await process_data(x_data, cur, table_name, fkey_name, fkey_value)
    return ret
