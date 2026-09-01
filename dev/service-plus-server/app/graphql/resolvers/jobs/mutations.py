"""Job lifecycle mutation resolvers: create/update/deliver/undeliver/undo,
single and batch jobs, payments. Split from mutation_helper.py — see
plans/plan.md Step 4."""

import json
from typing import Any
from urllib.parse import unquote

import psycopg.sql as pgsql
from psycopg.rows import dict_row

from app.db.connection.psycopg_driver import (
    get_service_db_connection,
    process_data,
    process_details,
)
from app.db.sql.sql_base import SqlStore
from app.core.exceptions import AppMessages, ValidationException
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger

# genericUpdate access rights for tables owned by the jobs domain. Merged
# into mutation.py's GENERIC_UPDATE_TABLE_RIGHTS — see plans/plan.md
# Step 4.6 / item 13.
JOBS_GENERIC_UPDATE_TABLE_RIGHTS: dict[str, str] = {
    "job_invoice": "JOBS_DELIVER_JOB",
}


async def resolve_create_job_payment_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Record a payment against a job and update its status."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "createJobPayment")
    x_data = payload.get("xData", {})
    branch_id = x_data.pop("branch_id", None)
    job_id = x_data.get("job_id")

    if not branch_id or not job_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/job_id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            await cur.execute(
                SqlStore.CLAIM_NEXT_RECEIPT_NUMBER,
                {"branch_id": branch_id, "job_id": job_id},
            )
            seq = await cur.fetchone()
            if not seq:
                raise ValidationException(
                    message=AppMessages.RESOURCE_NOT_FOUND,
                    extensions={
                        "detail": "MONEY_RECEIPT sequence not configured for this division"
                    },
                )
            receipt_no = (
                f"{seq['prefix'] or ''}"
                f"{seq['separator'] or ''}"
                f"{str(seq['assigned_number']).zfill(seq['padding'] or 0)}"
            )
            x_data["receipt_no"] = receipt_no
            payment_id = await process_data(x_data, cur, "job_payment", None, None)
            logger.info("Job payment created id=%s receipt_no=%s", payment_id, receipt_no)

    return payment_id

async def resolve_create_single_job_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """
    Create a single job and atomically increment the document sequence.
    """
    if not value:
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_OBJECT},
        )
    value_string = unquote(value)
    try:
        payload: dict = json.loads(value_string)
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in createSingleJob value: %s", e)
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": AppMessages.INVALID_JSON_OBJECT},
        ) from e

    x_data = payload.get("xData", {})
    performed_by_user_id = x_data.pop("performed_by_user_id", None)
    branch_id = x_data.get("branch_id")

    if not branch_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Claim next sequence number atomically
            await cur.execute(
                SqlStore.CLAIM_NEXT_JOB_NUMBER, {"branch_id": branch_id}
            )
            seq = await cur.fetchone()
            if not seq:
                raise ValidationException(
                    message=AppMessages.RESOURCE_NOT_FOUND,
                    extensions={
                        "detail": "Job sequence not configured for this branch"
                    },
                )

            # 2. Format job number
            job_no = (
                f"{seq['prefix'] or ''}{seq['separator'] or ''}"
                f"{str(seq['assigned_number']).zfill(seq['padding'])}"
            )
            x_data["job_no"] = job_no

            # 3. Insert the job
            job_id = await process_data(x_data, cur, "job", None, None)
            logger.info("Single job created with id=%s, job_no=%s", job_id, job_no)

            # 4. Record the initial status as a real job_transaction row. This
            # applies to every single job, opening or not — Event Tracking reads
            # "Received" (and every other status count) off job_transaction, so
            # skipping this for the common non-opening case made those jobs
            # invisible to that report even though job.job_status_id was set
            # correctly. A status value being fixed (RECEIVED, for a normal job)
            # doesn't make the event not worth logging.
            txn_data: dict = {
                "job_id": job_id,
                "status_id": x_data.get("job_status_id"),
                "performed_by_user_id": performed_by_user_id,
            }
            technician_id = x_data.get("technician_id")
            if technician_id is not None:
                txn_data["technician_id"] = technician_id
            job_date = x_data.get("job_date")
            if job_date:
                txn_data["transaction_date"] = job_date

            new_txn_id = await process_data(txn_data, cur, "job_transaction", None, None)
            if new_txn_id:
                await process_data(
                    {"id": job_id, "last_transaction_id": new_txn_id},
                    cur, "job", None, None,
                )
            logger.info(
                "Job %s: recorded initial transaction id=%s, status_id=%s",
                job_id, new_txn_id, txn_data["status_id"],
            )

    return {"job_id": job_id, "job_no": job_no}

async def resolve_update_opening_job_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """
    Update an Opening Job.

    Opening Jobs let the user set/change Status directly on the edit form
    (unlike the normal Job Control pipeline, which changes status only via a
    dedicated Status Transition step). A plain field update on `job` alone
    would silently disconnect job.job_status_id from job_transaction, so
    Transaction History would stop reflecting the job's real status history.
    We read the pre-update status, and if the edit changes it, record a real
    job_transaction row (mirroring the initial-status insert done on create),
    the same way resolve_update_job_helper does for Job Control transitions —
    but without that helper's Job-Control-specific side effects (estimate
    amount defaulting, is_closed recompute, division-change-on-final guard),
    which don't apply to Opening Jobs' free-form edit.
    """
    payload = _decode_value(value, "updateOpeningJob")
    x_data = payload.get("xData", {})
    performed_by_user_id = x_data.pop("performed_by_user_id", None)
    job_id = x_data.get("id")
    if not job_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            await cur.execute("SELECT job_status_id FROM job WHERE id = %s", (job_id,))
            current = await cur.fetchone()
            previous_status_id = current["job_status_id"] if current else None

            await process_data(x_data, cur, "job", None, None)
            logger.info("Opening job %s updated", job_id)

            new_status_id = x_data.get("job_status_id")
            if new_status_id is not None and new_status_id != previous_status_id:
                txn_data: dict = {
                    "job_id": job_id,
                    "status_id": new_status_id,
                    "performed_by_user_id": performed_by_user_id,
                }
                technician_id = x_data.get("technician_id")
                if technician_id is not None:
                    txn_data["technician_id"] = technician_id
                job_date = x_data.get("job_date")
                if job_date:
                    txn_data["transaction_date"] = job_date

                new_txn_id = await process_data(txn_data, cur, "job_transaction", None, None)
                if new_txn_id:
                    await process_data(
                        {"id": job_id, "last_transaction_id": new_txn_id},
                        cur, "job", None, None,
                    )
                logger.info(
                    "Opening job %s: status changed %s -> %s, recorded transaction id=%s",
                    job_id, previous_status_id, new_status_id, new_txn_id,
                )

    return job_id

async def resolve_update_job_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Update fields on an existing job record."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "updateJob")

    job_id = payload.pop("job_id")
    last_transaction_id = payload.pop("last_transaction_id", None)
    performed_by = payload.pop("performed_by_user_id", None)
    remarks = payload.pop("remarks", "")
    transaction_date = payload.pop("transaction_date", None)
    x_data = payload.get("xData", {})

    # Prevent NULL from being written into the NOT NULL estimate_amount column.
    # Null arrives when: (a) user skips the estimate field, or (b) the job row
    # already has NULL due to legacy data and the transition doesn't update estimate.
    if x_data.get("estimate_amount") is None:
        x_data["estimate_amount"] = 0

    job_status_id = x_data.get("job_status_id")
    technician_id = x_data.get("technician_id")
    amount = x_data.get("amount")

    # Enforce is_closed from the canonical _STATUS_FLAGS so the DB stays
    # consistent regardless of what the client sends.  is_final is intentionally
    # left to the client because it is set in a separate "Final the Job" step.
    if job_status_id is not None and job_status_id in _STATUS_FLAGS:
        x_data["is_closed"] = _STATUS_FLAGS[job_status_id]["is_closed"]

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    txn_data: dict = {
        "job_id": job_id,
        "status_id": job_status_id,
        "performed_by_user_id": performed_by,
    }
    if technician_id is not None:
        txn_data["technician_id"] = technician_id
    if amount is not None:
        txn_data["amount"] = amount
    if remarks:
        txn_data["remarks"] = remarks
    if transaction_date:
        txn_data["transaction_date"] = transaction_date
    if last_transaction_id is not None:
        txn_data["previous_transaction_id"] = last_transaction_id

    new_txn_id: int | None = None

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Guard: block division change on a finalised job
            if "division_id" in x_data:
                await cur.execute(SqlStore.GET_JOB_IS_FINAL, {"id": job_id})
                job_row = await cur.fetchone()
                if job_row and job_row["is_final"]:
                    raise ValidationException(
                        message="Cannot change division after job is finalized.",
                        extensions={"field": "division_id"},
                    )

            # 2. Update the job row
            await process_data(x_data, cur, "job", None, None)
            logger.info("Job %s updated", job_id)

            # 3. Insert job_transaction
            new_txn_id = await process_data(txn_data, cur, "job_transaction", None, None)
            logger.debug("Job transaction inserted, id=%s", new_txn_id)

            # 3. Update job.last_transaction_id
            if new_txn_id:
                await process_data(
                    {"id": job_id, "last_transaction_id": new_txn_id},
                    cur, "job", None, None,
                )
                logger.debug("job.last_transaction_id updated to %s", new_txn_id)

    return new_txn_id


# Mirrors STATUS_FLAGS in status-transitions.ts
_STATUS_FLAGS: dict[int, dict[str, bool]] = {
    1:  {"is_final": False, "is_closed": False},  # RECEIVED
    2:  {"is_final": False, "is_closed": False},  # ASSIGNED
    3:  {"is_final": False, "is_closed": False},  # ESTIMATED
    4:  {"is_final": False, "is_closed": False},  # ESTIMATE_APPROVED
    5:  {"is_final": False, "is_closed": False},  # ESTIMATE_REJECTED
    6:  {"is_final": False, "is_closed": False},  # IN_PROGRESS
    7:  {"is_final": False, "is_closed": False},  # PARTS_PENDING
    8:  {"is_final": False, "is_closed": False},  # ON_HOLD
    9:  {"is_final": False, "is_closed": False},  # OUTSOURCED
    10: {"is_final": False, "is_closed": False},  # SENT_TO_COMPANY
    11: {"is_final": True,  "is_closed": False},  # COMPLETED_OK
    12: {"is_final": True,  "is_closed": False},  # RETURN
    13: {"is_final": False, "is_closed": True },  # DELIVERED_OK
    14: {"is_final": False, "is_closed": True },  # DELIVERED_NOT_OK
    15: {"is_final": True,  "is_closed": False},  # CANCELLED
    16: {"is_final": True,  "is_closed": True },  # DISPOSED
    17: {"is_final": False, "is_closed": False},  # RECEIVED_BACK_FROM_COMPANY
}


async def resolve_undo_job_transaction_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Undo the last transaction on a job and restore its previous state."""
    # pylint: disable=too-many-locals
    payload     = _decode_value(value, "undoJobTransaction")
    job_id      = payload["job_id"]
    last_txn_id = payload["last_transaction_id"]

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Stale guard — confirm this txn is still job.last_transaction_id
            await cur.execute(
                SqlStore.GET_JOB_TRANSACTION_FOR_UNDO,
                {"job_id": job_id, "last_txn_id": last_txn_id},
            )
            rows = await cur.fetchall()
            if not rows:
                raise ValidationException("Transaction no longer current — page may be stale.")
            prev_txn_id = rows[0]["previous_transaction_id"]

            # 2. Fallback if previous_transaction_id link was never populated
            if prev_txn_id is None:
                await cur.execute(
                    SqlStore.GET_PREV_JOB_TRANSACTION_FALLBACK,
                    {"job_id": job_id, "last_txn_id": last_txn_id},
                )
                fallback = await cur.fetchall()
                if fallback:
                    prev_txn_id = fallback[0]["id"]

            # 3. Fetch previous state (skipped when undoing the very first real transaction)
            if prev_txn_id is not None:
                await cur.execute(
                    SqlStore.GET_JOB_TRANSACTION_STATE,
                    {"prev_txn_id": prev_txn_id},
                )
                prev_rows = await cur.fetchall()
                if not prev_rows:
                    raise ValidationException("Previous transaction not found.")
                prev  = prev_rows[0]
                flags = _STATUS_FLAGS.get(
                    prev["status_id"], {"is_final": False, "is_closed": False}
                )
            else:
                # No earlier real transaction — restore to the job's implicit initial Received state
                prev  = {"status_id": 1, "technician_id": None, "amount": 0, "estimate_amount": 0}
                flags = _STATUS_FLAGS.get(1, {"is_final": False, "is_closed": False})

            # 4 + 5 are atomic: if 5 fails, 4 is rolled back automatically
            await cur.execute(
                SqlStore.DELETE_JOB_TRANSACTION,
                {"last_txn_id": last_txn_id},
            )
            logger.info("Undid job transaction %s for job %s", last_txn_id, job_id)

            await cur.execute(
                SqlStore.RESTORE_JOB_FROM_TRANSACTION,
                {
                    "job_id":              job_id,
                    "job_status_id":       prev["status_id"],
                    "technician_id":       prev["technician_id"],
                    "amount":              prev["amount"],
                    # None → COALESCE keeps existing
                    "estimate_amount":     prev.get("estimate_amount"),
                    "is_final":            flags["is_final"],
                    "is_closed":           flags["is_closed"],
                    "last_transaction_id": prev_txn_id,
                },
            )
            logger.info("Job %s restored to transaction %s", job_id, prev_txn_id)

    return {"job_id": job_id, "restored_transaction_id": prev_txn_id}

async def resolve_undeliver_job_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Undeliver a job: restore the status it had before delivery and reopen it.

    Reverts the job to its most recent non-delivered transaction (skipping any
    delivery transactions, so stacked re-deliveries are handled), deletes the
    delivery transaction(s), clears the delivery date and the is_closed flag.
    """
    payload = _decode_value(value, "undeliverJob")
    job_id  = payload["job_id"]

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Find the state the job was in just before it was delivered
            await cur.execute(
                SqlStore.GET_LAST_NON_DELIVERED_TRANSACTION, {"job_id": job_id}
            )
            rows = await cur.fetchall()
            if rows:
                prev          = rows[0]
                target_txn_id = prev["id"]
                status_id     = prev["status_id"]
                technician_id = prev["technician_id"]
            else:
                # No earlier non-delivered transaction — fall back to Received
                target_txn_id = None
                status_id     = 1
                technician_id = None
            flags = _STATUS_FLAGS.get(status_id, {"is_final": False, "is_closed": False})

            # 2. Remove the delivery transaction(s), delete the invoice, then restore the job (atomic)
            await cur.execute(SqlStore.DELETE_DELIVERY_TRANSACTIONS, {"job_id": job_id})
            await cur.execute(SqlStore.DELETE_JOB_INVOICE_BY_JOB, {"job_id": job_id})
            await cur.execute(
                SqlStore.UNDELIVER_JOB,
                {
                    "job_id":              job_id,
                    "job_status_id":       status_id,
                    "technician_id":       technician_id,
                    "is_final":            flags["is_final"],
                    "last_transaction_id": target_txn_id,
                },
            )
            logger.info("Job %s undelivered, invoice deleted, restored to status %s", job_id, status_id)

    return {"job_id": job_id, "restored_status_id": status_id}

async def resolve_deliver_job_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Mark a job as delivered and record the delivery transaction."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "deliverJob")

    job_id = payload.pop("job_id")
    last_transaction_id = payload.pop("last_transaction_id", None)
    performed_by = payload.pop("performed_by_user_id", None)
    delivered_status_id = payload.pop("delivered_status_id")
    delivery_date = payload.pop("delivery_date")
    delivery_manner_name = payload.pop("delivery_manner_name", "")
    remarks = payload.pop("remarks", "")
    payment = payload.pop("payment", {})

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    payment_amount = payment.get("amount", 0) or 0
    payment_data = {
        "job_id": job_id,
        "payment_date": payment.get("payment_date"),
        "payment_mode": payment.get("payment_mode", ""),
        "amount": payment_amount,
        "reference_no": payment.get("reference_no", ""),
        "remarks": payment.get("remarks", ""),
    }

    notes_parts = [p for p in [delivery_manner_name, remarks] if p]
    full_notes = ". ".join(notes_parts)

    txn_data: dict = {
        "job_id": job_id,
        "status_id": delivered_status_id,
        "performed_by_user_id": performed_by,
    }
    if full_notes:
        txn_data["remarks"] = full_notes
    if last_transaction_id is not None:
        txn_data["previous_transaction_id"] = last_transaction_id

    new_txn_id: int | None = None

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Insert job_payment if amount > 0
            if payment_amount > 0:
                await process_details({"tableName": "job_payment", "xData": payment_data}, cur)
                logger.info("Payment inserted for job %s, amount=%s", job_id, payment_amount)

            # 2. Update job: close it and record delivery
            await process_details(
                {
                    "tableName": "job",
                    "xData": {
                        "id": job_id,
                        "is_closed": True,
                        "delivery_date": delivery_date,
                        "job_status_id": delivered_status_id,
                    },
                },
                cur,
            )
            logger.info("Job %s closed, delivery_date=%s", job_id, delivery_date)

            # 3. Insert job_transaction
            new_txn_id = await process_details(
                {"tableName": "job_transaction", "xData": txn_data}, cur
            )
            logger.debug("Delivery transaction inserted, id=%s", new_txn_id)

            # 4. Update job.last_transaction_id
            if new_txn_id:
                await process_details(
                    {"tableName": "job", "xData": {"id": job_id, "last_transaction_id": new_txn_id}},
                    cur,
                )
                logger.debug("job.last_transaction_id updated to %s", new_txn_id)

    return new_txn_id

async def resolve_create_job_batch_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Create a batch of jobs from shared data and per-job overrides."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "createJobBatch")
    shared = payload.get("sharedData", {})
    jobs = payload.get("jobs", [])

    branch_id = shared.get("branch_id")
    division_id = shared.get("division_id")
    batch_date = shared.get("batch_date")
    customer_contact_id = shared.get("customer_contact_id")
    job_receive_manner_id = shared.get("job_receive_manner_id")
    job_status_id = shared.get("job_status_id")
    performed_by = shared.get("performed_by_user_id")

    if not branch_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            await cur.execute(SqlStore.CLAIM_NEXT_BATCH_NUMBER)
            batch_no = (await cur.fetchone())["batch_no"]
            logger.info("Assigned batch_no=%s", batch_no)

            job_ids = []
            job_nos = []
            for job in jobs:
                await cur.execute(SqlStore.CLAIM_NEXT_JOB_NUMBER, {"branch_id": branch_id})
                seq = await cur.fetchone()
                if not seq:
                    raise ValidationException(
                        message=AppMessages.RESOURCE_NOT_FOUND,
                        extensions={"detail": "Job sequence not configured for this branch"},
                    )
                job_no = (
                    f"{seq['prefix'] or ''}{seq['separator'] or ''}"
                    f"{str(seq['assigned_number']).zfill(seq['padding'])}"
                )

                job_data = {
                    "branch_id": branch_id,
                    "division_id": division_id,
                    "batch_no": batch_no,
                    "job_no": job_no,
                    "job_date": batch_date,
                    "customer_contact_id": customer_contact_id,
                    "job_type_id": job.get("job_type_id"),
                    "job_receive_manner_id": job_receive_manner_id,
                    "job_status_id": job_status_id,
                    "product_brand_model_id": job.get("product_brand_model_id"),
                    "serial_no": job.get("serial_no"),
                    "problem_reported": job.get("problem_reported"),
                    "warranty_card_no": job.get("warranty_card_no"),
                    "job_receive_condition_id": job.get("job_receive_condition_id"),
                    "remarks": job.get("remarks"),
                    "qty": job.get("qty", 1),
                    "alternate_job_no": job.get("alternate_job_no") or None,
                    "purchase_date": job.get("purchase_date") or None,
                }
                job_id = await process_data(job_data, cur, "job", None, None)
                logger.info("Batch job created with id=%s, job_no=%s", job_id, job_no)
                job_ids.append(job_id)
                job_nos.append(job_no)

                txn_data = {
                    "job_id": job_id,
                    "status_id": job_status_id,
                    "performed_by_user_id": performed_by,
                }
                await process_data(txn_data, cur, "job_transaction", None, None)
                logger.debug("Initial job_transaction inserted for job_id=%s", job_id)

    logger.info("Job batch created: batch_no=%s, jobs=%s, job_nos=%s", batch_no, job_ids, job_nos)
    return {"batch_no": batch_no, "job_ids": job_ids, "job_nos": job_nos}

async def resolve_update_job_batch_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Update header and line items for an existing job batch."""
    # pylint: disable=too-many-locals
    payload = _decode_value(value, "updateJobBatch")
    batch_no = payload.get("batch_no")
    shared = payload.get("sharedData", {})
    added_jobs = payload.get("addedJobs", [])
    updated_jobs = payload.get("updatedJobs", [])
    deleted_ids = payload.get("deletedJobIds", [])
    performed_by = shared.get("performed_by_user_id")

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            await cur.execute(
                "UPDATE job SET job_date=%s, customer_contact_id=%s,"
                " job_receive_manner_id=%s WHERE batch_no=%s",
                (
                    shared.get("batch_date"),
                    shared.get("customer_contact_id"),
                    shared.get("job_receive_manner_id"),
                    batch_no,
                ),
            )

            for job_id in deleted_ids:
                await cur.execute(
                    "SELECT COUNT(*) AS cnt FROM job_transaction WHERE job_id = %s",
                    (job_id,),
                )
                row = await cur.fetchone()
                if row and row["cnt"] > 1:
                    raise ValidationException(
                        message="Cannot delete job with activity",
                        extensions={"job_id": job_id},
                    )
                await cur.execute(
                    "DELETE FROM job_transaction WHERE job_id = %s", (job_id,)
                )
                await cur.execute("DELETE FROM job WHERE id = %s", (job_id,))

            for job in updated_jobs:
                job_id = job.get("id")
                await cur.execute(
                    "UPDATE job SET job_type_id=%s, product_brand_model_id=%s, serial_no=%s,"
                    " problem_reported=%s, warranty_card_no=%s,"
                    " job_receive_condition_id=%s, remarks=%s, qty=%s,"
                    " alternate_job_no=%s, purchase_date=%s WHERE id=%s",
                    (
                        job.get("job_type_id"),
                        job.get("product_brand_model_id"),
                        job.get("serial_no"),
                        job.get("problem_reported"),
                        job.get("warranty_card_no"),
                        job.get("job_receive_condition_id"),
                        job.get("remarks"),
                        job.get("qty", 1),
                        job.get("alternate_job_no") or None,
                        job.get("purchase_date") or None,
                        job_id,
                    ),
                )

            if added_jobs:
                await cur.execute(
                    "SELECT job_status_id FROM job WHERE batch_no=%s LIMIT 1",
                    (batch_no,),
                )
                status_row = await cur.fetchone()
                job_status_id = status_row["job_status_id"] if status_row else None
                branch_id = shared.get("branch_id")
                division_id = shared.get("division_id")

                for job in added_jobs:
                    # Atomically claim the next job number
                    await cur.execute(SqlStore.CLAIM_NEXT_JOB_NUMBER, {"branch_id": branch_id})
                    seq = await cur.fetchone()
                    if not seq:
                        raise ValidationException(
                            message="Job sequence not configured for this branch",
                            extensions={"detail": "No document_sequence row found for JOB_SHEET"},
                        )
                    job_no = (
                        f"{seq['prefix'] or ''}{seq['separator'] or ''}"
                        f"{str(seq['assigned_number']).zfill(seq['padding'])}"
                    )

                    await cur.execute(
                        "INSERT INTO job"
                        " (branch_id, division_id, batch_no, job_no, job_date, customer_contact_id,"
                        "  job_type_id, job_receive_manner_id, job_status_id,"
                        "  product_brand_model_id, serial_no, problem_reported,"
                        "  warranty_card_no, job_receive_condition_id, remarks, qty, purchase_date)"
                        " VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                        (
                            branch_id,
                            division_id,
                            batch_no,
                            job_no,
                            shared.get("batch_date"),
                            shared.get("customer_contact_id"),
                            job.get("job_type_id"),
                            shared.get("job_receive_manner_id"),
                            job_status_id,
                            job.get("product_brand_model_id"),
                            job.get("serial_no"),
                            job.get("problem_reported"),
                            job.get("warranty_card_no"),
                            job.get("job_receive_condition_id"),
                            job.get("remarks"),
                            job.get("qty", 1),
                            job.get("purchase_date") or None,
                        ),
                    )
                    new_job_id = (await cur.fetchone())["id"]
                    await cur.execute(
                        "INSERT INTO job_transaction (job_id, status_id, performed_by_user_id)"
                        " VALUES (%s, %s, %s)",
                        (new_job_id, job_status_id, performed_by),
                    )

    return {"batch_no": batch_no}

async def resolve_delete_job_batch_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """Delete a job batch and its associated job records."""
    payload = _decode_value(value, "deleteJobBatch")
    batch_no = payload.get("batch_no")

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )
            await cur.execute("SELECT id FROM job WHERE batch_no = %s", (batch_no,))
            job_ids = [r["id"] for r in await cur.fetchall()]

            for job_id in job_ids:
                await cur.execute(
                    "SELECT COUNT(*) AS cnt FROM job_transaction WHERE job_id = %s",
                    (job_id,),
                )
                row = await cur.fetchone()
                if row and row["cnt"] > 1:
                    raise ValidationException(
                        message="Batch has jobs with activity and cannot be deleted",
                        extensions={"job_id": job_id},
                    )

            if job_ids:
                await cur.execute(
                    "DELETE FROM job_transaction WHERE job_id = ANY(%s)", (job_ids,)
                )
            await cur.execute("DELETE FROM job WHERE batch_no = %s", (batch_no,))

    return {"success": True}
