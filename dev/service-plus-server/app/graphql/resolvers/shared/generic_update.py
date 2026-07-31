"""Generic update envelope resolvers — the escape hatch every domain uses to run
an arbitrary insert/update or pre-defined SqlStore script. Split from
mutation_helper.py — see plans/plan.md Step 4."""

import json
from typing import Any
from urllib.parse import unquote

from app.db.connection.psycopg_driver import exec_sql, exec_sql_object
from app.db.sql.sql_base import SqlStore
from app.core.exceptions import AppMessages, ValidationException
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger


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
