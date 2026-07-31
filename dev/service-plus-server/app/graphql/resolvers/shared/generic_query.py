"""Generic query envelope resolvers — the escape hatch every domain uses to run
an arbitrary SqlStore query/batch by sqlId. Split from query_helper.py / part of
mutation_helper.py — see plans/plan.md Step 4."""

import json
from datetime import date, datetime
from urllib.parse import unquote

from app.db.connection.psycopg_driver import SqlBatchItem, exec_sql_query, exec_sql_batch_query
from app.db.sql.sql_base import SqlStore
from app.core.exceptions import AppMessages, ValidationException
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


async def resolve_generic_query_helper(db_name: str, schema: str = "public", value: str = ""):
    """Execute a generic SQL query from SqlStore with provided arguments."""
    logger.debug("Generic query requested")

    if not value:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "value"},
        )

    try:
        params: dict = json.loads(unquote(value))
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Invalid JSON in genericQuery value: %s", e)
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_VALUE},
        )

    sql_id:   str  = params.get("sqlId", "")
    logger.debug(sql_id)
    sql_args: dict = params.get("sqlArgs", {}) or {}

    sql = getattr(SqlStore, sql_id, None)
    if not sql:
        logger.error("Unknown sqlId in genericQuery: %r", sql_id)
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": f"Unknown sqlId: {sql_id}"},
        )

    db_name_arg = db_name if db_name else None
    rows = await exec_sql_query(db_name_arg, schema or "public", sql, sql_args, text_dates=True)

    logger.debug("Generic query completed: sqlId=%r", sql_id)
    return rows


async def resolve_generic_batch_query_helper(db_name: str, items: list[str]) -> list:
    """Execute multiple SQL queries in one DB connection, returning results in order."""
    logger.debug("Generic batch query requested: %d items", len(items))

    batch: list[SqlBatchItem] = []
    for raw in items:
        try:
            params: dict = json.loads(unquote(raw))
        except (json.JSONDecodeError, ValueError) as e:
            raise ValidationException(
                message=AppMessages.INVALID_INPUT,
                extensions={"detail": AppMessages.INVALID_JSON_VALUE},
            ) from e
        sql_id: str = params.get("sqlId", "")
        if not getattr(SqlStore, sql_id, None):
            logger.error("Unknown sqlId in genericBatchQuery: %r", sql_id)
            raise ValidationException(
                message=AppMessages.INVALID_INPUT,
                extensions={"detail": f"Unknown sqlId: {sql_id}"},
            )
        batch.append(SqlBatchItem(
            sql_id=sql_id,
            sql_args=params.get("sqlArgs") or {},
            schema=params.get("schema") or "public",
            text_dates=params.get("textDates", True),
        ))

    db_name_arg = db_name if db_name else None
    results = await exec_sql_batch_query(db_name_arg, batch)
    logger.debug("Generic batch query completed: %d items", len(items))
    return results
