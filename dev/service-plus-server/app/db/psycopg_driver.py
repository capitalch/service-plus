"""
Database connection management using psycopg (psycopg3).
"""

import psycopg
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator
from psycopg import sql as pgsql
from psycopg.rows import dict_row
from psycopg.types.datetime import DateLoader, TimestampLoader, TimestamptzLoader
from psycopg.types.numeric import FloatLoader
from app.config import settings
from app.exceptions import AppMessages, DatabaseException
from app.logger import logger


class _IsoDateLoader(DateLoader):
    """Returns date values as ISO-formatted strings instead of date objects."""

    def load(self, data: bytes) -> str:
        return super().load(data).isoformat()


class _IsoTimestampLoader(TimestampLoader):
    """Returns timestamp values as ISO-formatted strings instead of datetime objects."""

    def load(self, data: bytes) -> str:
        return super().load(data).isoformat()


class _IsoTimestamptzLoader(TimestamptzLoader):
    """Returns timestamptz values as ISO-formatted strings instead of datetime objects."""

    def load(self, data: bytes) -> str:
        return super().load(data).isoformat()


class _FloatNumericLoader(FloatLoader):
    """Returns numeric/decimal values as float instead of Decimal (JSON-serializable)."""


@asynccontextmanager
async def _open_db_connection(
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
        logger.debug(f"{label} database connection opened (autocommit={autocommit})")
        yield conn
        if not autocommit:
            await conn.commit()
            logger.debug(f"{label} database transaction committed")
    except psycopg.OperationalError as e:
        logger.error(f"{AppMessages.DATABASE_CONNECTION_FAILED}: {e}")
        raise DatabaseException(AppMessages.DATABASE_CONNECTION_FAILED)
    except DatabaseException:
        if not autocommit and conn and not conn.closed:
            await conn.rollback()
        raise
    except Exception as e:
        if not autocommit and conn and not conn.closed:
            await conn.rollback()
        logger.error(f"Unexpected {label} database error: {e}")
        raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED)
    finally:
        if conn and not conn.closed:
            await conn.close()
            logger.debug(f"{label} database connection closed")


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

    conn_settings = (
        dict(
            host=settings.service_db_host,
            port=settings.service_db_port,
            user=settings.service_db_user,
            password=settings.service_db_password,
            dbname=db_name,
            label="service",
        )
        if db_name
        else dict(
            host=settings.client_db_host,
            port=settings.client_db_port,
            user=settings.client_db_user,
            password=settings.client_db_password,
            dbname=settings.client_db_name,
            label="client",
        )
    )

    async with _open_db_connection(**conn_settings, autocommit=True) as conn:
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
async def get_client_db_connection() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """
    Async context manager that yields a client database connection.

    Usage:
        async with get_client_db_connection() as conn:
            result = await conn.execute(...)
    """
    async with _open_db_connection(
        host=settings.client_db_host,
        port=settings.client_db_port,
        user=settings.client_db_user,
        password=settings.client_db_password,
        dbname=settings.client_db_name,
        label="client",
    ) as conn:
        yield conn


def get_insert_sql(
    x_data: dict,
    table_name: str,
    fkey_name: str | None,
    fkey_value: Any,
) -> tuple[pgsql.Composed, tuple]:
    field_names = list(x_data.keys())
    if fkey_name and fkey_value:
        field_names.append(fkey_name)

    values_list = list(x_data.values())
    if fkey_name and fkey_value:
        values_list.append(fkey_value)

    logger.debug(f"Building INSERT SQL for table '{table_name}'")
    sql = pgsql.SQL("INSERT INTO {} ({}) VALUES ({}) RETURNING id").format(
        pgsql.Identifier(table_name),
        pgsql.SQL(", ").join(pgsql.Identifier(f) for f in field_names),
        pgsql.SQL(", ").join(pgsql.Placeholder() for _ in field_names),
    )
    return (sql, tuple(values_list))


@asynccontextmanager
async def get_service_db_connection(
    db_name: str,
) -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """
    Async context manager that yields a service database connection.

    Args:
        db_name: Name of the service (tenant) database to connect to.
    """
    async with _open_db_connection(
        host=settings.service_db_host,
        port=settings.service_db_port,
        user=settings.service_db_user,
        password=settings.service_db_password,
        dbname=db_name,
        label="service",
    ) as conn:
        yield conn


def get_sql(
    x_data: dict,
    table_name: str,
    fkey_name: str | None,
    fkey_value: Any,
) -> tuple[pgsql.Composed | None, tuple | None]:
    sql = None
    values_tuple = None
    if x_data.get("id", None) and (not x_data.get("isIdInsert", None)):  # update
        sql, values_tuple = get_update_sql(x_data, table_name)
    else:  # insert
        x_data.pop("isIdInsert", None)
        sql, values_tuple = get_insert_sql(x_data, table_name, fkey_name, fkey_value)
    return (sql, values_tuple)


def get_update_sql(x_data: dict, table_name: str) -> tuple[pgsql.Composed, tuple]:
    data_copy = x_data.copy()
    record_id = data_copy.pop("id")

    logger.debug(f"Building UPDATE SQL for table '{table_name}'")
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

    num_fields = len(field_names)

    # psycopg allows at most 2000 placeholders per statement
    MAX_PLACEHOLDERS = 2000
    batch_size = max(1, MAX_PLACEHOLDERS // num_fields)

    col_sql = pgsql.SQL(", ").join(pgsql.Identifier(f) for f in field_names)
    row_ph = pgsql.SQL("({})").format(
        pgsql.SQL(", ").join(pgsql.Placeholder() for _ in field_names)
    )

    connection = (
        get_service_db_connection(db_name) if db_name else get_client_db_connection()
    )
    async with connection as conn:
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
    deleted_id_list = sql_object.get("deletedIds")
    if not deleted_id_list:
        return
    table_name = sql_object.get("tableName")
    logger.debug(f"Deleting ids {deleted_id_list} from table '{table_name}'")
    sql = pgsql.SQL("DELETE FROM {} WHERE id = ANY(%s)").format(
        pgsql.Identifier(table_name)
    )
    await cur.execute(sql, (list(deleted_id_list),))


async def process_details(
    sql_object: dict,
    cur: psycopg.AsyncCursor,
    fkey_value: Any = None,
) -> int | None:
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
