"""sendWhatsappCompletion — the text-only completion-message send, grouped one
message per customer (never one per job), for every eligible job in the request.
Rewritten from app/graphql/resolvers/jobs/whatsapp.py.
"""

import asyncio
import re
from datetime import datetime, timezone
from typing import Any

from app.core.exceptions import AppMessages, ValidationException
from app.db.connection.psycopg_driver import exec_sql, exec_sql_query
from app.db.sql.sql_base import SqlStore
from app.graphql.pubsub import pubsub
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger
from app.whatsapp.client import send_template
from app.whatsapp.mobile import is_valid_mobile, normalize_mobile
from app.whatsapp.templates import TEMPLATES
from app.whatsapp.token import sign as sign_status_link

# Cap on concurrent Cloud API calls fanned out per request.
_SEND_CONCURRENCY = 5

# Locked 2026-08-24: pipe-delimited, not JSON — every character spent on JSON syntax
# subtracts from how many job ids fit under the 512-char biz_opaque_callback_data
# ceiling. ~55-60 ids fit with room to spare even with generous db_name/schema length
# estimates; 35 leaves real margin, not a squeeze.
MAX_JOBS_PER_WHATSAPP_MESSAGE = 35

_WHITESPACE_RUN = re.compile(r" {4,}")
_NEWLINE_OR_TAB = re.compile(r"[\n\t]")


def _sanitize(value: str) -> str:
    """Meta rejects the send if a parameter value has newlines/tabs or 4+ consecutive
    spaces — strip/collapse before anything reaches the Cloud API."""
    value = _NEWLINE_OR_TAB.sub(" ", value)
    return _WHITESPACE_RUN.sub("   ", value).strip()


def _truncate_business_unit(name: str) -> str:
    """Header is 60 chars total; 'Service Update from ' eats 20, leaving ~40 for the
    BU name. Cut at a word boundary, not mid-word."""
    max_len = 40
    if len(name) <= max_len:
        return name
    truncated = name[:max_len]
    last_space = truncated.rfind(" ")
    return (truncated[:last_space] if last_space > 0 else truncated).rstrip()


def _format_job_no(job_nos: list[str]) -> str:
    """Join up to 3, then '…and N more'. Single line."""
    if len(job_nos) <= 3:
        return ", ".join(job_nos)
    return f"{', '.join(job_nos[:3])}…and {len(job_nos) - 3} more"


def _format_device(devices: list[str | None]) -> str:
    """One job → device string; more than one → 'N items'."""
    if len(devices) == 1:
        return devices[0] or "-"
    return f"{len(devices)} items"


def _format_amount(total: float) -> str:
    """SUM == 0 → the literal 'No charge'; otherwise '₹2,450.00' — symbol in the
    value, not the template text, so a zero-amount job never renders '₹No charge'."""
    if total == 0:
        return "No charge"
    return f"₹{total:,.2f}"


def _format_item_summary(count: int) -> str:
    """'1 item' or '{n} items' — JOB_CREATION's item_summary param."""
    return "1 item" if count == 1 else f"{count} items"


def _build_reference_line(batch_no: int | None, job_nos: list[str]) -> str:
    """Computed server-side, not a template conditional (Meta templates can't
    branch): single job → 'Job No: JOB-1024'; batch → 'Batch No: 88 — {job_nos}',
    reusing _format_job_no's own 3-then-elide truncation as-is."""
    if batch_no is None:
        return f"Job No: {job_nos[0]}"
    return f"Batch No: {batch_no} — {_format_job_no(job_nos)}"


def _chunk(items: list[dict], size: int) -> list[list[dict]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


# Abbreviated to 2 letters on the wire — every extra character here subtracts from
# the 512-char biz_opaque_callback_data budget. The full key (`JOB_COMPLETION`,
# `JOB_CREATION`, ...) is this codebase's own vocabulary everywhere else (SQL args,
# whatsapp_notifications jsonb keys); only this callback payload ever sees the
# abbreviation, and only for as long as it's in flight to/from Meta.
_EVENT_CODE_BY_KEY = {"JOB_COMPLETION": "CC", "JOB_CREATION": "JC", "JOB_DELIVERY": "JD"}


async def _is_event_enabled(db_name: str, schema: str, event_key: str) -> bool:
    """App Settings > whatsapp_notifications — per-BU on/off switch for outbound
    WhatsApp sends, keyed the same way job.whatsapp_notifications is
    (JOB_CREATION/JOB_COMPLETION/JOB_DELIVERY). Missing row, non-dict value, or
    missing key all fail CLOSED — an admin must opt in, never opt in by omission."""
    rows = await exec_sql_query(
        db_name=db_name, schema=schema, sql=SqlStore.GET_APP_SETTING_BY_KEY,
        sql_args={"setting_key": "whatsapp_notifications"},
    )
    if not rows:
        return False
    value = rows[0]["setting_value"]
    return isinstance(value, dict) and value.get(event_key) is True


def _build_biz_opaque_callback_data(db_name: str, schema: str, event_key: str, job_ids: list[int]) -> str:
    """Locked format: `db_name|schema|event_code|job_id,job_id,…`. Every end of this
    payload is our own code, so there's nothing to gain from a self-describing
    format — and every JSON brace/quote/key would subtract from the 512-char budget."""
    return f"{db_name}|{schema}|{_EVENT_CODE_BY_KEY[event_key]}|{','.join(str(j) for j in job_ids)}"


def _build_params(bu_name: str, jobs: list[dict]) -> tuple[list[str], list[str]]:
    """header_values, body_values for one chunk (all jobs belonging to one customer,
    one message) — order matches TemplateSpec.header_params / .body_params."""
    job_nos = [j["job_no"] for j in jobs]
    devices = [j["device_details"] for j in jobs]
    total_amount = sum(j["amount"] or 0 for j in jobs)

    header_values = [_truncate_business_unit(bu_name)]
    body_values = [
        jobs[0]["customer_name"],
        _format_job_no(job_nos),
        _format_device(devices),
        jobs[0]["branch_name"],
        _format_amount(total_amount),
        jobs[0]["branch_phone"] or "-",
        # _v2's closing line also uses {{business_unit}} in the body — untruncated,
        # unlike the header's copy, since the body has 1024 chars of room vs the
        # header's 60.
        bu_name,
    ]
    return (
        [_sanitize(v) for v in header_values],
        [_sanitize(v) for v in body_values],
    )


def _build_creation_params(bu_name: str, jobs: list[dict]) -> tuple[list[str], list[str]]:
    """header_values, body_values for one JOB_CREATION chunk (all jobs belonging to
    one customer, one message) — order matches TEMPLATES["JOB_CREATION"]'s
    header_params / body_params. Batches are per-customer by construction (one
    drop-off event), so jobs[0]["batch_no"] is representative of the whole chunk,
    same as jobs[0]["branch_name"]/["customer_name"] already are below."""
    job_nos = [j["job_no"] for j in jobs]
    batch_no = jobs[0]["batch_no"]

    header_values = [_truncate_business_unit(bu_name)]
    body_values = [
        jobs[0]["customer_name"],
        _format_item_summary(len(jobs)),
        _build_reference_line(batch_no, job_nos),
        jobs[0]["branch_name"],
        jobs[0]["branch_phone"] or "-",
        bu_name,
    ]
    return (
        [_sanitize(v) for v in header_values],
        [_sanitize(v) for v in body_values],
    )


async def _persist_attempt(
    db_name: str,
    schema: str,
    job_id: int,
    event_key: str,
    wamid: str | None,
    status: str,
    error: str | None,
) -> None:
    await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.SET_JOB_WHATSAPP_ATTEMPT,
        sql_args={
            "job_id": job_id,
            "event_key": event_key,
            "wamid": wamid,
            "status": status,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "error": error,
        },
    )


async def _send_chunk(
    db_name: str,
    schema: str,
    bu_name: str,
    jobs: list[dict],
    semaphore: asyncio.Semaphore,
) -> dict[str, Any]:
    """Send one JOB_COMPLETION message for one chunk (≤35 jobs, one customer)."""
    customer_name = jobs[0]["customer_name"]
    mobile = jobs[0]["mobile"]
    job_ids = [j["job_id"] for j in jobs]

    template = TEMPLATES["JOB_COMPLETION"]
    header_values, body_values = _build_params(bu_name, jobs)
    callback_data = _build_biz_opaque_callback_data(db_name, schema, "JOB_COMPLETION", job_ids)

    async with semaphore:
        result = await send_template(
            normalize_mobile(mobile), template, header_values, body_values, callback_data
        )

    status = "ACCEPTED" if result.ok else "FAILED"
    await asyncio.gather(
        *(
            _persist_attempt(
                db_name, schema, j["job_id"], "JOB_COMPLETION", result.provider_message_id, status, result.error_message
            )
            for j in jobs
        )
    )

    return {
        "customer_name": customer_name,
        "job_ids": job_ids,
        "status": "SENT" if result.ok else "FAILED",
        "error": result.error_message,
    }


async def _send_creation_chunk(
    db_name: str,
    schema: str,
    bu_name: str,
    jobs: list[dict],
    semaphore: asyncio.Semaphore,
) -> dict[str, Any]:
    """Send one JOB_CREATION message for one chunk (≤35 jobs, one customer)."""
    customer_name = jobs[0]["customer_name"]
    mobile = jobs[0]["mobile"]
    job_ids = [j["job_id"] for j in jobs]

    template = TEMPLATES["JOB_CREATION"]
    header_values, body_values = _build_creation_params(bu_name, jobs)
    callback_data = _build_biz_opaque_callback_data(db_name, schema, "JOB_CREATION", job_ids)

    # Both buttons' base URL is already baked into the template at Meta
    # approval time — the API payload only ever carries the *suffix* value
    # substituted for {{token}}, never the full reconstructed URL, or Meta
    # would append this onto its own stored base and produce a malformed
    # double-URL (confirmed against Meta's documented button-parameter
    # behavior, not assumed).
    status_token = sign_status_link(db_name, schema, job_ids)
    button_values = [status_token, status_token]

    async with semaphore:
        result = await send_template(
            normalize_mobile(mobile), template, header_values, body_values, callback_data, button_values
        )

    status = "ACCEPTED" if result.ok else "FAILED"
    await asyncio.gather(
        *(
            _persist_attempt(
                db_name, schema, j["job_id"], "JOB_CREATION", result.provider_message_id, status, result.error_message
            )
            for j in jobs
        )
    )

    return {
        "customer_name": customer_name,
        "job_ids": job_ids,
        "status": "SENT" if result.ok else "FAILED",
        "error": result.error_message,
    }


async def resolve_send_whatsapp_completion_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> dict[str, Any]:
    """Send the JOB_COMPLETION text-only WhatsApp message, grouped one message per
    customer (split further if a customer's job count exceeds the 35-job cap), for
    every eligible job in the request. Returns per-message *dispatch* results — not
    delivery; delivery is settled later by the webhook (app/routers/webhooks)."""
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

    if not await _is_event_enabled(db_name_arg, schema_name, "JOB_COMPLETION"):
        return {"results": [], "disabled": True}

    # Server never trusts the client's selection as-is — GET_JOBS_FOR_WHATSAPP_COMPLETION
    # itself re-filters to is_final=true, js.code='COMPLETED_OK', and this branch_id.
    rows = await exec_sql(
        db_name=db_name_arg,
        schema=schema_name,
        sql=SqlStore.GET_JOBS_FOR_WHATSAPP_COMPLETION,
        sql_args={"job_ids": job_ids, "branch_id": branch_id},
    )
    if not rows:
        return {"results": []}

    bu_rows = await exec_sql_query(
        db_name=db_name_arg, schema="security", sql=SqlStore.GET_BU_NAME_BY_CODE, sql_args={"schema": schema_name}
    )
    bu_name = bu_rows[0]["name"] if bu_rows else schema_name

    # Group by customer_contact_id — one WhatsApp message per customer, never one per
    # job — then split any group over the cap into multiple independently-tracked chunks.
    groups: dict[int, list[dict]] = {}
    for row in rows:
        groups.setdefault(row["customer_contact_id"], []).append(row)

    semaphore = asyncio.Semaphore(_SEND_CONCURRENCY)
    send_tasks = []
    skipped_results = []

    for jobs in groups.values():
        if not is_valid_mobile(jobs[0]["mobile"]):
            logger.info(
                "Skipping WhatsApp completion send for customer=%s — invalid/missing mobile",
                jobs[0]["customer_name"],
            )
            skipped_results.append(
                {
                    "customer_name": jobs[0]["customer_name"],
                    "job_ids": [j["job_id"] for j in jobs],
                    "status": "FAILED",
                    "error": "Invalid or missing mobile number",
                }
            )
            continue
        for chunk in _chunk(jobs, MAX_JOBS_PER_WHATSAPP_MESSAGE):
            send_tasks.append(_send_chunk(db_name_arg, schema_name, bu_name, chunk, semaphore))

    send_results = await asyncio.gather(*send_tasks) if send_tasks else []
    all_results = [*send_results, *skipped_results]

    logger.info(
        "sendWhatsappCompletion: %d customer(s), %d message(s), %d job(s) processed",
        len(groups),
        len(all_results),
        len(rows),
    )

    return {"results": all_results}


async def send_job_creation_notice(db_name: str, schema: str = "public", value: str = "") -> dict[str, Any]:
    """Send the JOB_CREATION text-only WhatsApp message (Job Intake Notice), grouped
    one message per customer (split further if a customer's job count exceeds the
    35-job cap), for every job in the request. Returns per-message *dispatch*
    results — not delivery; delivery is settled later by the webhook
    (app/routers/webhooks). This grouping/chunking is already batch-safe as
    written: a 12-job batch for one customer becomes one message with
    item_summary="12 items" — the same "single job is a batch of one" property
    `resolve_send_whatsapp_completion_helper` already has, nothing batch-specific
    needs adding here."""
    payload = _decode_value(value, "sendWhatsappJobIntake")
    branch_id = payload.get("branch_id")
    job_ids = payload.get("job_ids") or []

    if not branch_id or not job_ids:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/job_ids"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    if not await _is_event_enabled(db_name_arg, schema_name, "JOB_CREATION"):
        return {"results": [], "disabled": True}

    # Server never trusts the client's selection as-is — GET_JOBS_FOR_WHATSAPP_CREATION
    # re-filters to this branch_id (no status filter — an intake notice fires right
    # after creation, before the job is anywhere near final, unlike the completion
    # helper above).
    rows = await exec_sql(
        db_name=db_name_arg,
        schema=schema_name,
        sql=SqlStore.GET_JOBS_FOR_WHATSAPP_CREATION,
        sql_args={"job_ids": job_ids, "branch_id": branch_id},
    )
    if not rows:
        return {"results": []}

    bu_rows = await exec_sql_query(
        db_name=db_name_arg, schema="security", sql=SqlStore.GET_BU_NAME_BY_CODE, sql_args={"schema": schema_name}
    )
    bu_name = bu_rows[0]["name"] if bu_rows else schema_name

    # Group by customer_contact_id — one WhatsApp message per customer, never one per
    # job — then split any group over the cap into multiple independently-tracked chunks.
    groups: dict[int, list[dict]] = {}
    for row in rows:
        groups.setdefault(row["customer_contact_id"], []).append(row)

    semaphore = asyncio.Semaphore(_SEND_CONCURRENCY)
    send_tasks = []
    skipped_results = []

    for jobs in groups.values():
        if not is_valid_mobile(jobs[0]["mobile"]):
            logger.info(
                "Skipping WhatsApp job-intake send for customer=%s — invalid/missing mobile",
                jobs[0]["customer_name"],
            )
            skipped_results.append(
                {
                    "customer_name": jobs[0]["customer_name"],
                    "job_ids": [j["job_id"] for j in jobs],
                    "status": "FAILED",
                    "error": "Invalid or missing mobile number",
                }
            )
            continue
        for chunk in _chunk(jobs, MAX_JOBS_PER_WHATSAPP_MESSAGE):
            send_tasks.append(_send_creation_chunk(db_name_arg, schema_name, bu_name, chunk, semaphore))

    send_results = await asyncio.gather(*send_tasks) if send_tasks else []
    all_results = [*send_results, *skipped_results]

    logger.info(
        "sendWhatsappJobIntake: %d customer(s), %d message(s), %d job(s) processed",
        len(groups),
        len(all_results),
        len(rows),
    )

    return {"results": all_results}


async def set_job_delivery_manual_confirmation(
    db_name: str, schema: str = "public", value: str = "", staff_id: str | None = None
) -> dict[str, Any]:
    """Manual override for job-delivery confirmation (plans/plan.md, Step 1) —
    "customer confirmed in person / no WhatsApp". No token, no code: this can be
    the very first write ever for JOB_DELIVERY on a job that was never sent a
    WhatsApp message at all (no mobile on file), which is exactly why
    SqlStore.SET_JOB_DELIVERY_CONFIRMATION defends against JOB_DELIVERY not
    existing yet rather than assuming a prior OTP send created it. Publishes the
    same "CONFIRMED" pubsub event verifyJobDeliveryOtp will (Step 3), so the
    Deliver Job UI's badge updates live regardless of which path confirmed it.
    `staff_id` comes from the caller's own GraphQL context (info.context["user_id"]),
    never a client-supplied field — this function doesn't know or care how the
    caller obtained it, same separation of concerns _persist_attempt already has
    from the mutation layer above it."""
    payload = _decode_value(value, "setJobDeliveryManualConfirmation")
    job_ids = payload.get("job_ids") or []

    if not job_ids:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "job_ids"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"
    confirmed_at = datetime.now(timezone.utc).isoformat()

    for job_id in job_ids:
        await exec_sql(
            db_name=db_name_arg,
            schema=schema_name,
            sql=SqlStore.SET_JOB_DELIVERY_CONFIRMATION,
            sql_args={
                "job_id": job_id,
                "confirmed_at": confirmed_at,
                "confirmation_method": "manual_override",
                "staff_id": staff_id,
            },
        )
        await pubsub.publish(
            "whatsapp_delivery_status",
            {"db_name": db_name_arg, "job_id": job_id, "status": "CONFIRMED", "error": None},
        )

    logger.info(
        "setJobDeliveryManualConfirmation: %d job(s) confirmed by staff_id=%s",
        len(job_ids),
        staff_id,
    )

    return {"job_ids": job_ids}
