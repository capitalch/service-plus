"""Inventory mutation resolvers: spare parts cleanup and bulk import. Split
from mutation_helper.py — see plans/plan.md Step 4."""

from app.db.connection.psycopg_driver import bulk_insert_records, exec_sql
from app.db.sql.sql_base import SqlStore
from app.core.exceptions import AppMessages, ValidationException
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger

# genericUpdate access rights for tables owned by the Masters and Inventory
# menus. Merged into mutation.py's GENERIC_UPDATE_TABLE_RIGHTS — see
# plans/plan.md Step 4.6 / item 13.
INVENTORY_GENERIC_UPDATE_TABLE_RIGHTS: dict[str, str] = {
    # Masters
    "brand": "MASTERS_MENU",
    "customer_type": "MASTERS_MENU",
    "document_type": "MASTERS_MENU",
    "job_type": "MASTERS_MENU",
    "job_receive_manner": "MASTERS_MENU",
    "job_delivery_manner": "MASTERS_MENU",
    "job_status": "MASTERS_MENU",
    "job_receive_condition": "MASTERS_MENU",
    "product_brand_model": "MASTERS_MENU",
    "spare_part_master": "MASTERS_MENU",
    "customer_contact": "MASTERS_MENU",
    "supplier": "MASTERS_MENU",
    "technician": "MASTERS_MENU",
    "branch": "MASTERS_MENU",
    "state": "MASTERS_MENU",
    "financial_year": "MASTERS_MENU",
    "additional_charge": "MASTERS_MENU",
    # Inventory
    "purchase_invoice": "INVENTORY_PURCHASE_ENTRY",
    "sales_invoice": "INVENTORY_SALES_ENTRY",
    "stock_adjustment": "INVENTORY_STOCK_ADJUSTMENT",
    "stock_branch_transfer": "INVENTORY_BRANCH_TRANSFER",
    "stock_opening_balance": "INVENTORY_OPENING_STOCK",
}

# genericUpdateScript access rights, keyed by sql_id rather than tableName.
INVENTORY_GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS: dict[str, str] = {
    "SET_PART_LOCATIONS": "INVENTORY_SET_PART_LOCATION",
}


async def resolve_delete_unused_parts_by_brand_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Delete all spare parts for a brand that are not referenced in any
    dependent table (job_part_used, purchase_invoice_line, sales_invoice_line,
    stock_adjustment_line, stock_transaction).

    Value payload (URL-encoded JSON): { brand_id: int }
    Returns: { deleted_count: int }
    """
    payload = _decode_value(value, "deleteUnusedPartsByBrand")

    brand_id = payload.get("brand_id")
    if not brand_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "brand_id"},
        )

    schema_ = schema or "public"
    logger.info("Deleting unused parts for brand_id=%s in db=%s", brand_id, db_name)

    rows = await exec_sql(
        db_name=db_name,
        schema=schema_,
        sql=SqlStore.DELETE_UNUSED_PARTS_BY_BRAND,
        sql_args={"brand_id": brand_id},
    )

    deleted_count = len(rows) if rows else 0
    logger.info("Deleted %d unused parts for brand_id=%s", deleted_count, brand_id)
    return {"deleted_count": deleted_count}

async def resolve_import_spare_parts_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> dict:
    """
    Fast bulk import of spare parts using a single multi-row INSERT.

    Args:
        db_name: Target service database name.
        schema:  Database schema (default: "public").
        value:   URL-encoded JSON array of part record dicts.

    Returns:
        {"success_count": int}
    """
    payload = _decode_value(value, "importSpareParts")

    if not isinstance(payload, list):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": "Expected a list of part records"},
        )

    db_name_arg: str = db_name or ""
    logger.info(
        "Bulk importing %d spare parts into: %s",
        len(payload),
        db_name_arg or "client_db",
    )

    count = await bulk_insert_records(
        db_name=db_name_arg,
        schema=schema or "public",
        table_name="spare_part_master",
        records=payload,
    )

    logger.info("Bulk import complete: %d rows inserted", count)
    return {"success_count": count}
