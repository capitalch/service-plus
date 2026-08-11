"""WhatsApp notification mutation resolvers for the jobs domain.

sendWhatsappCompletion is the text-only completion-message send (plan-whatsapp.md
§4d) — the same mutation and grouping logic serves both the single-job "Whatsapp"
button on the finalize form and the bulk Customer Connect screen. The three
PDF-carrying sends (creation/delivery/receipt) go through a REST endpoint instead
(app/routers/notifications/whatsapp_router.py, §4e), not this mutation, because a
binary payload doesn't fit a JSON mutation envelope well.
"""

import asyncio
from typing import Any

from app.core.exceptions import AppMessages, ValidationException
from app.db.connection.psycopg_driver import exec_sql
from app.db.sql.sql_base import SqlStore
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger
from app.notifications.whatsapp_client import send_template
from app.notifications.whatsapp_helpers import build_notification_update_args, is_valid_mobile, normalize_mobile
from app.notifications.whatsapp_templates import TEMPLATES

# Cap on concurrent BSP calls fanned out per request — a plain constant, no
# per-BSP rate-limit config table needed for a single BSP (plan §4d step 3).
_SEND_CONCURRENCY = 5


async def _send_completion_for_customer(
    jobs: list[dict], semaphore: asyncio.Semaphore
) -> dict[str, Any]:
    """Send one JOB_COMPLETION message for every job belonging to one customer."""
    customer_name = jobs[0]["customer_name"]
    mobile = jobs[0]["mobile"]
    job_ids = [j["job_id"] for j in jobs]

    if not is_valid_mobile(mobile):
        logger.info(
            "Skipping WhatsApp completion send for customer=%s — invalid/missing mobile",
            customer_name,
        )
        return {
            "customer_name": customer_name,
            "job_ids": job_ids,
            "status": "FAILED",
            "error": "Invalid or missing mobile number",
            "ok": False,
            "jobs": jobs,
        }

    template = TEMPLATES["JOB_COMPLETION"]
    job_nos = ", ".join(j["job_no"] for j in jobs)
    amount = sum(j["amount"] or 0 for j in jobs)
    params = [customer_name, job_nos, f"{amount:.2f}"]

    async with semaphore:
        result = await send_template(normalize_mobile(mobile), template, params, None)

    return {
        "customer_name": customer_name,
        "job_ids": job_ids,
        "status": "SENT" if result.ok else "FAILED",
        "error": result.error_message,
        "ok": result.ok,
        "jobs": jobs,
    }


async def resolve_send_whatsapp_completion_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> dict[str, Any]:
    """Send the JOB_COMPLETION text-only WhatsApp message, grouped one message per
    customer (never one per job), for every eligible job in the request."""
    payload = _decode_value(value, "sendWhatsappCompletion")
    branch_id = payload.get("branch_id")
    job_ids = payload.get("job_ids") or []

    if not branch_id or not job_ids:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/job_ids"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    # Server never trusts the client's selection as-is — re-filter to is_final=true.
    rows = await exec_sql(
        db_name=db_name_arg,
        schema=schema_name,
        sql=SqlStore.GET_JOBS_FOR_WHATSAPP_COMPLETION,
        sql_args={"job_ids": job_ids, "branch_id": branch_id},
    )
    if not rows:
        return {"results": []}

    # Group by customer_contact_id — one WhatsApp message per customer, never
    # one per job.
    groups: dict[int, list[dict]] = {}
    for row in rows:
        groups.setdefault(row["customer_contact_id"], []).append(row)

    semaphore = asyncio.Semaphore(_SEND_CONCURRENCY)
    send_results = await asyncio.gather(
        *(_send_completion_for_customer(jobs, semaphore) for jobs in groups.values())
    )

    for group_result in send_results:
        for job in group_result["jobs"]:
            update_args = build_notification_update_args(
                job_id=job["job_id"],
                event_type="JOB_COMPLETION",
                current_notifications=job.get("whatsapp_notifications"),
                sent=group_result["ok"],
                error_message=group_result["error"],
            )
            await exec_sql(
                db_name=db_name_arg,
                schema=schema_name,
                sql=SqlStore.SET_JOB_WHATSAPP_NOTIFICATION,
                sql_args=update_args,
            )

    logger.info(
        "sendWhatsappCompletion: %d customer(s), %d job(s) processed",
        len(send_results),
        len(rows),
    )

    return {
        "results": [
            {
                "customer_name": r["customer_name"],
                "job_ids": r["job_ids"],
                "status": r["status"],
                "error": r["error"],
            }
            for r in send_results
        ]
    }
