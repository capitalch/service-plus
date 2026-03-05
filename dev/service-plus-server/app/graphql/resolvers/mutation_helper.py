import json
from urllib.parse import unquote

from app.db.psycopg_driver import exec_sql_object
from app.exceptions import AppMessages, ValidationException
from app.logger import logger


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
