"""Job invoice mutation resolvers: create and regenerate. Split from
mutation_helper.py — see plans/plan.md Step 4."""

from typing import Any

import psycopg.sql as pgsql
from psycopg.rows import dict_row

from app.db.connection.psycopg_driver import get_service_db_connection, process_data
from app.db.sql.sql_base import SqlStore
from app.core.exceptions import AppMessages, ValidationException
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger


async def resolve_create_job_invoice_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """
    Create a job invoice and atomically generate the invoice number in a single transaction.
    The client sends all invoice data (including lines) plus branch_id and division_id.
    The server claims the next SERVICE_INVOICE sequence number and inserts everything atomically.
    """
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "createJobInvoice")
    x_data = payload.get("xData", {})

    branch_id = x_data.pop("branch_id", None)
    division_id = x_data.pop("division_id", None)

    if not branch_id or not division_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/division_id"},
        )

    x_details = x_data.get("xDetails")
    has_lines = bool(x_details) and any(
        item.get("tableName") == "job_invoice_line" and item.get("xData")
        for item in (x_details if isinstance(x_details, list) else [x_details])
    )
    if not has_lines:
        raise ValidationException(
            message="Invoice must have at least one line item",
            extensions={"field": "xDetails"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Idempotency check — return existing invoice if already created
            await cur.execute(
                SqlStore.GET_JOB_INVOICE_ID_BY_JOB_FOR_UPDATE,
                {"job_id": x_data.get("job_id")},
            )
            existing = await cur.fetchone()
            if existing:
                return existing["id"]

            # 1b. Enforce that the job must be delivered before an invoice can be created
            await cur.execute(SqlStore.GET_JOB_IS_CLOSED, {"job_id": x_data.get("job_id")})
            job_row = await cur.fetchone()
            if not job_row or not job_row["is_closed"]:
                raise ValidationException(
                    message="Invoice can only be created for a delivered job",
                    extensions={"field": "job_id"},
                )

            # 2. Claim next invoice number atomically
            await cur.execute(
                SqlStore.CLAIM_NEXT_INVOICE_NUMBER,
                {"branch_id": branch_id, "division_id": division_id},
            )
            seq = await cur.fetchone()
            if not seq:
                raise ValidationException(
                    message=AppMessages.RESOURCE_NOT_FOUND,
                    extensions={
                        "detail": "SERVICE_INVOICE sequence not configured for this division"
                    },
                )

            # 3. Format invoice number
            invoice_no = (
                f"{seq['prefix'] or ''}"
                f"{seq['separator'] or ''}"
                f"{str(seq['assigned_number']).zfill(seq['padding'] or 0)}"
            )
            x_data["invoice_no"] = invoice_no

            # 4. Insert job_invoice + lines in the same transaction
            invoice_id = await process_data(x_data, cur, "job_invoice", None, None)
            logger.info("Job invoice created id=%s invoice_no=%s", invoice_id, invoice_no)

    return invoice_id

async def resolve_regenerate_job_invoice_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """
    Regenerate a job invoice atomically: delete existing lines, update header amounts
    (preserving invoice_no and id), then insert new lines — all in one transaction.
    """
    # pylint: disable=too-many-locals
    payload     = _decode_value(value, "regenerateJobInvoice")
    x_data      = payload.get("xData", {})
    invoice_id  = x_data["invoice_id"]
    aggregate   = x_data["aggregate"]
    cgst_amount = x_data["cgst_amount"]
    sgst_amount = x_data["sgst_amount"]
    igst_amount = x_data["igst_amount"]
    amount      = x_data["amount"]
    lines       = x_data.get("lines", [])

    if not lines:
        raise ValidationException(
            message="Invoice must have at least one line item to regenerate",
            extensions={"field": "lines"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            await cur.execute(
                SqlStore.DELETE_JOB_INVOICE_LINES_BY_INVOICE, {"invoice_id": invoice_id}
            )
            await cur.execute(
                SqlStore.UPDATE_JOB_INVOICE_AMOUNTS,
                {"invoice_id": invoice_id, "aggregate": aggregate,
                 "cgst_amount": cgst_amount, "sgst_amount": sgst_amount,
                 "igst_amount": igst_amount, "amount": amount},
            )
            for line in lines:
                line_data = {**line, "job_invoice_id": invoice_id}
                await process_data(line_data, cur, "job_invoice_line", None, None)

    logger.info("Job invoice id=%s regenerated with %s lines", invoice_id, len(lines))
    return invoice_id
