"""
Database connection management using psycopg (psycopg3).
"""
import psycopg
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

from psycopg import sql as pgsql
from psycopg.rows import dict_row

from app.config import settings
from app.exceptions import AppMessages, DatabaseException
from app.logger import logger


def _get_client_db_conninfo() -> str:
    """Build the psycopg connection info string from settings."""
    return (
        f"host={settings.client_db_host} "
        f"port={settings.client_db_port} "
        f"dbname={settings.client_db_name} "
        f"user={settings.client_db_user} "
        f"password={settings.client_db_password}"
    )


@asynccontextmanager
async def get_client_db_connection() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """
    Async context manager that yields a database connection.

    Commits automatically on clean exit; rolls back on exception.
    The connection is always closed in the finally block.

    Usage:
        async with get_client_db_connection() as conn:
            result = await conn.execute(...)
    """
    conn: psycopg.AsyncConnection | None = None
    try:
        conn = await psycopg.AsyncConnection.connect(
            host=settings.client_db_host,
            port=settings.client_db_port,
            user=settings.client_db_user,
            password=settings.client_db_password,
            dbname=settings.client_db_name)
        logger.debug("Database connection opened")
        yield conn
        await conn.commit()
        logger.debug("Database transaction committed")
    except psycopg.OperationalError as e:
        logger.error(f"{AppMessages.DATABASE_CONNECTION_FAILED}: {e}")
        raise DatabaseException(AppMessages.DATABASE_CONNECTION_FAILED)
    except DatabaseException:
        if conn and not conn.closed:
            await conn.rollback()
        raise
    except Exception as e:
        if conn and not conn.closed:
            await conn.rollback()
        logger.error(f"Unexpected database error: {e}")
        raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED)
    finally:
        if conn and not conn.closed:
            await conn.close()
            logger.debug("Database connection closed")


@asynccontextmanager
async def get_service_db_connection(db_name: str) -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """
    Async context manager for service database connection.

    Similar to get_client_db_connection but connects to the service database.
    """
    conn: psycopg.AsyncConnection | None = None
    try:
        conn = await psycopg.AsyncConnection.connect(
            host=settings.service_db_host,
            port=settings.service_db_port,
            user=settings.service_db_user,
            password=settings.service_db_password,
            dbname=db_name
        )
        logger.debug("Service database connection opened")
        yield conn
        await conn.commit()
        logger.debug("Service database transaction committed")
    except psycopg.OperationalError as e:
        logger.error(f"{AppMessages.DATABASE_CONNECTION_FAILED}: {e}")
        raise DatabaseException(AppMessages.DATABASE_CONNECTION_FAILED)
    except DatabaseException:
        if conn and not conn.closed:
            await conn.rollback()
        raise
    except Exception as e:
        if conn and not conn.closed:
            await conn.rollback()
        logger.error(f"Unexpected service database error: {e}")
        raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED)
    finally:
        if conn and not conn.closed:
            await conn.close()
            logger.debug("Service database connection closed")


async def exec_sql(
    db_name: str | None,
    schema: str = "public",
    sql: str | None = None,
    sql_args: dict | None = None,
) -> list[Any]:
    """
    Execute a raw SQL query against the specified database and schema.

    Args:
        db_name:  Service database name; pass None to use the client DB.
        schema:   PostgreSQL schema to set for the session (default: "public").
        sql:      The parameterised SQL query to execute.
        sql_args: Parameters to pass to the SQL query.

    Returns:
        List of dict rows for SELECT queries; integer row-count for DML.
    """
    if not sql:
        raise ValueError(AppMessages.DATABASE_QUERY_FAILED)

    sql_args = sql_args or {}
    schema_to_set = schema or "public"
    records: list[Any] = []

    connection = get_service_db_connection(db_name) if db_name else get_client_db_connection()

    async with connection as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_to_set))
            )
            await cur.execute(sql, sql_args)
            if cur.description:
                records = await cur.fetchall()
            else:
                records = cur.rowcount

    return records