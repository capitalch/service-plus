"""sendWhatsappCompletion — the text-only completion-message send, grouped one
message per customer (never one per job), for every eligible job in the request.
Rewritten from app/graphql/resolvers/jobs/whatsapp.py.
"""

import asyncio
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.exceptions import AppMessages, ValidationException
from app.db.connection.psycopg_driver import exec_sql, exec_sql_batch, exec_sql_query
from app.db.sql.sql_base import SqlStore
from app.graphql.pubsub import pubsub
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger
from app.whatsapp import otp
from app.whatsapp.client import send_template
from app.whatsapp.mobile import is_valid_mobile, normalize_mobile
from app.whatsapp.templates import TEMPLATES
from app.whatsapp.token import sign as sign_status_link
from app.whatsapp.token import sign_ew, sign_receipt

# OTP window (plans/plan.md): 15-minute expiry, 5-attempt lockout — the lockout,
# not the 4-digit keyspace, carries the real security weight (see otp.py).
OTP_TTL_MINUTES = 15
OTP_MAX_ATTEMPTS = 5

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


def _build_delivery_reference_line(job_nos: list[str]) -> str:
    """Delivery grouping is independent of intake grouping (plans/plan.md) — a
    single delivery message can span jobs from several different intake
    batches, or individually-created jobs, so this never frames a shared
    "Batch No" the way _build_reference_line does for JOB_CREATION/JOB_COMPLETION.
    Single job → 'Job No: JOB-1024'; multiple → 'Job Nos: {job_nos}', reusing
    _format_job_no's own 3-then-elide truncation as-is."""
    if len(job_nos) == 1:
        return f"Job No: {job_nos[0]}"
    return f"Job Nos: {_format_job_no(job_nos)}"


def _build_amount_line(jobs: list[dict]) -> str:
    """'No charge' when the total is zero (e.g. an unrepaired RETURN job),
    'Paid in full' when the balance is fully settled, else 'Balance due:
    ₹X' — computed server-side across every job in the chunk, not a template
    conditional (Meta templates can't branch)."""
    total_amount = sum(j["amount"] or 0 for j in jobs)
    if total_amount == 0:
        return "No charge"
    balance = total_amount - sum(j["paid_amount"] or 0 for j in jobs)
    if balance <= 0:
        return "Paid in full"
    return f"Balance due: ₹{balance:,.2f}"


def _chunk(items: list[dict], size: int) -> list[list[dict]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


# Abbreviated to 2 letters on the wire — every extra character here subtracts from
# the 512-char biz_opaque_callback_data budget. The full key (`JOB_COMPLETION`,
# `JOB_CREATION`, ...) is this codebase's own vocabulary everywhere else (SQL args,
# whatsapp_notifications jsonb keys); only this callback payload ever sees the
# abbreviation, and only for as long as it's in flight to/from Meta.
# `EW`/`EL` are the first codes whose trailing id list is NOT job ids — it is
# `customer_id,stage`. Anything reading that segment must check the event code first.
_EVENT_CODE_BY_KEY = {
    "JOB_COMPLETION": "CC", "JOB_CREATION": "JC", "JOB_DELIVERY": "JD",
    "JOB_MONEY_RECEIPT": "MR", "JOB_INVOICE": "JI",
    "EXTENDED_WARRANTY": "EW", "EXTENDED_WARRANTY_LEAD": "EL",
}


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


def _build_delivery_params(bu_name: str, jobs: list[dict]) -> tuple[list[str], list[str]]:
    """header_values, body_values for one JOB_DELIVERY chunk (all jobs belonging
    to one customer, one message) — order matches TEMPLATES["JOB_DELIVERY"]'s
    header_params/body_params. `reference_line` never assumes a shared
    batch_no (_build_delivery_reference_line) since delivery grouping is
    independent of intake grouping."""
    job_nos = [j["job_no"] for j in jobs]

    header_values = [_truncate_business_unit(bu_name)]
    body_values = [
        jobs[0]["customer_name"],
        _build_delivery_reference_line(job_nos),
        _build_amount_line(jobs),
        jobs[0]["branch_name"],
        jobs[0]["branch_phone"] or "-",
    ]
    return (
        [_sanitize(v) for v in header_values],
        [_sanitize(v) for v in body_values],
    )


def _build_money_receipt_params(bu_name: str, row: dict) -> tuple[list[str], list[str]]:
    """header_values, body_values for one Money Receipt send — order matches
    TEMPLATES["JOB_MONEY_RECEIPT"]'s header_params/body_params. Never grouped
    (one payment row is always one message), so this takes a single row, not
    a list of jobs the way the other three `_build_*_params` helpers do.
    `reference_line` reuses `_build_delivery_reference_line` with a
    one-element list — a payment always belongs to exactly one job, never a
    batch framing."""
    header_values = [_truncate_business_unit(bu_name)]
    payment_date = row["payment_date"]
    body_values = [
        row["customer_name"],
        f"₹{float(row['amount']):,.2f}",
        row["payment_mode"],
        payment_date.strftime("%d %b %Y") if hasattr(payment_date, "strftime") else str(payment_date),
        _build_delivery_reference_line([row["job_no"]]),
        row["receipt_no"] or str(row["payment_id"]),
        row["branch_name"],
        row["branch_phone"] or "-",
    ]
    return (
        [_sanitize(v) for v in header_values],
        [_sanitize(v) for v in body_values],
    )


def _build_invoice_params(bu_name: str, row: dict) -> tuple[list[str], list[str]]:
    """header_values, body_values for one Invoice send — order matches
    TEMPLATES["JOB_INVOICE"]'s header_params/body_params. Never grouped
    (one job is always one message), same precedent as
    _build_money_receipt_params. `amount_line` reuses `_build_amount_line`
    unchanged by wrapping this single row in a one-element list — that
    helper already sums `amount`/`paid_amount` across whatever list it's
    given, and a one-element list is exactly "this job's own balance,"
    nothing to build fresh here."""
    header_values = [_truncate_business_unit(bu_name)]
    body_values = [
        row["customer_name"],
        row["invoice_no"],
        _build_delivery_reference_line([row["job_no"]]),
        _build_amount_line([row]),
        row["branch_name"],
        row["branch_phone"] or "-",
    ]
    return (
        [_sanitize(v) for v in header_values],
        [_sanitize(v) for v in body_values],
    )


async def _persist_receipt_attempt(
    db_name: str,
    schema: str,
    job_id: int,
    payment_id: int,
    wamid: str | None,
    status: str,
    error: str | None,
) -> None:
    """Same shape as `_persist_attempt`, but writes into `JOB_MONEY_RECEIPT`'s
    array (find-or-append by payment_id) instead of a flat per-event object —
    see SET_JOB_MONEY_RECEIPT_WHATSAPP_ATTEMPT's own docstring for why this
    can't reuse SET_JOB_WHATSAPP_ATTEMPT directly."""
    await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.SET_JOB_MONEY_RECEIPT_WHATSAPP_ATTEMPT,
        sql_args={
            "job_id": job_id,
            "payment_id": payment_id,
            "wamid": wamid,
            "status": status,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "error": error,
        },
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


async def _send_delivery_chunk(
    db_name: str,
    schema: str,
    bu_name: str,
    jobs: list[dict],
    semaphore: asyncio.Semaphore,
) -> dict[str, Any]:
    """Send one JOB_DELIVERY chunk (≤35 jobs, one customer): the Utility summary
    message (Delivery Note/Invoice buttons) first, then the Authentication OTP
    message — in that order, since the OTP send is the one actually tracked in
    whatsapp_notifications (event_key="JOB_DELIVERY"); a summary-send failure
    is logged but never written there, so it can't be mistaken for a missed
    OTP (plans/plan.md, Step 3). The OTP write itself (SET_JOB_DELIVERY_OTP
    across every job_id in this chunk) runs as one transaction via
    exec_sql_batch — a partial failure must never leave some jobs with the new
    hash and others with a stale one."""
    customer_name = jobs[0]["customer_name"]
    mobile = jobs[0]["mobile"]
    job_ids = [j["job_id"] for j in jobs]

    delivery_template = TEMPLATES["JOB_DELIVERY"]
    header_values, body_values = _build_delivery_params(bu_name, jobs)
    delivery_callback = _build_biz_opaque_callback_data(db_name, schema, "JOB_DELIVERY", job_ids)

    # Both buttons' base URL is baked into the template at Meta approval time —
    # same "one token, no new parameter" trick JOB_CREATION's two buttons use.
    status_token = sign_status_link(db_name, schema, job_ids)
    button_values = [status_token, status_token]

    async with semaphore:
        summary_result = await send_template(
            normalize_mobile(mobile), delivery_template, header_values, body_values,
            delivery_callback, button_values,
        )
    if not summary_result.ok:
        logger.error(
            "Whatsapp JOB_DELIVERY summary send failed for job_ids=%s: %s",
            job_ids, summary_result.error_message,
        )

    code = otp.generate()
    otp_hash = otp.hash_code(code)
    otp_expires_at = (datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)).isoformat()

    await exec_sql_batch(
        db_name or None,
        [
            {
                "sql_id": "SET_JOB_DELIVERY_OTP",
                "sql_args": {"job_id": job_id, "otp_hash": otp_hash, "otp_expires_at": otp_expires_at},
                "schema": schema,
            }
            for job_id in job_ids
        ],
    )

    otp_template = TEMPLATES["JOB_DELIVERY_OTP"]
    # Positional body only, no header, no button_values — see client.py's
    # AUTHENTICATION branch. Plaintext `code` lives only in this stack frame
    # until this call returns.
    otp_callback = _build_biz_opaque_callback_data(db_name, schema, "JOB_DELIVERY", job_ids)
    async with semaphore:
        otp_result = await send_template(
            normalize_mobile(mobile), otp_template, [], [code], otp_callback,
        )

    if not otp_result.ok:
        logger.error(
            "Whatsapp JOB_DELIVERY OTP send failed for job_ids=%s: %s — the customer "
            "got the summary but no code, so this delivery can only be confirmed by "
            "manual override",
            job_ids, otp_result.error_message,
        )

    status = "ACCEPTED" if otp_result.ok else "FAILED"
    await asyncio.gather(
        *(
            _persist_attempt(
                db_name, schema, j["job_id"], "JOB_DELIVERY", otp_result.provider_message_id, status, otp_result.error_message
            )
            for j in jobs
        )
    )

    return {
        "customer_name": customer_name,
        "job_ids": job_ids,
        "status": "SENT" if otp_result.ok else "FAILED",
        "error": otp_result.error_message,
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


async def send_job_delivery_notice(db_name: str, schema: str = "public", value: str = "") -> dict[str, Any]:
    """Send the paperless job-delivery WhatsApp messages (plans/plan.md, Step 3):
    a Utility summary (Delivery Note/Invoice buttons) followed by an
    Authentication OTP message, one pair per customer per chunk (split further
    if a customer's job count exceeds the 35-job cap). Grouped by customer
    *only*, never by batch_no — a single delivery can span jobs from several
    intake batches, or individually-created jobs, unlike JOB_CREATION's
    per-batch grouping (plans/plan.md's "Never assume a delivery shares one
    batch_no" watch-out). Returns per-chunk dispatch results, each carrying the
    exact job_ids its OTP covers — the caller must use this set, not its
    original selection, when calling verifyJobDeliveryOtp."""
    payload = _decode_value(value, "sendWhatsappJobDelivery")
    branch_id = payload.get("branch_id")
    job_ids = payload.get("job_ids") or []

    if not branch_id or not job_ids:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/job_ids"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    if not await _is_event_enabled(db_name_arg, schema_name, "JOB_DELIVERY"):
        return {"results": [], "disabled": True}

    # Server never trusts the client's selection as-is — GET_JOBS_FOR_WHATSAPP_DELIVERY
    # re-filters to DELIVERED_OK/DELIVERED_NOT_OK and this branch_id; a job that
    # isn't actually delivered yet, or belongs to another branch, is silently
    # dropped here rather than sent to.
    rows = await exec_sql(
        db_name=db_name_arg,
        schema=schema_name,
        sql=SqlStore.GET_JOBS_FOR_WHATSAPP_DELIVERY,
        sql_args={"job_ids": job_ids, "branch_id": branch_id},
    )
    if not rows:
        return {"results": []}

    bu_rows = await exec_sql_query(
        db_name=db_name_arg, schema="security", sql=SqlStore.GET_BU_NAME_BY_CODE, sql_args={"schema": schema_name}
    )
    bu_name = bu_rows[0]["name"] if bu_rows else schema_name

    # Group by customer_contact_id — one WhatsApp message pair per customer,
    # never per intake batch — then split any group over the cap into multiple
    # independently-tracked chunks.
    groups: dict[int, list[dict]] = {}
    for row in rows:
        groups.setdefault(row["customer_contact_id"], []).append(row)

    semaphore = asyncio.Semaphore(_SEND_CONCURRENCY)
    send_tasks = []
    skipped_results = []

    for jobs in groups.values():
        if not is_valid_mobile(jobs[0]["mobile"]):
            logger.info(
                "Skipping WhatsApp delivery send for customer=%s — invalid/missing "
                "mobile; manual-override is the only way to record this delivery",
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
            send_tasks.append(_send_delivery_chunk(db_name_arg, schema_name, bu_name, chunk, semaphore))

    send_results = await asyncio.gather(*send_tasks) if send_tasks else []
    all_results = [*send_results, *skipped_results]

    logger.info(
        "sendWhatsappJobDelivery: %d customer(s), %d message(s), %d job(s) processed",
        len(groups),
        len(all_results),
        len(rows),
    )

    return {"results": all_results}


async def send_whatsapp_money_receipt(db_name: str, schema: str = "public", value: str = "") -> dict[str, Any]:
    """Send the "Download Money Receipt" WhatsApp message for exactly one
    `job_payment` row (plans/plan.md, Step 3) — never grouped or chunked
    like the other three events, since a receipt always belongs to exactly
    one job/customer. Plain Utility, no companion Authentication send: a
    receipt copy isn't proof of anything happening (unlike JOB_DELIVERY's
    OTP), just a convenience copy of a payment already recorded, so there's
    no confirmation loop to wire up here."""
    payload = _decode_value(value, "sendWhatsappMoneyReceipt")
    branch_id = payload.get("branch_id")
    payment_id = payload.get("payment_id")

    if not branch_id or not payment_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/payment_id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    if not await _is_event_enabled(db_name_arg, schema_name, "JOB_MONEY_RECEIPT"):
        return {"results": [], "disabled": True}

    # Server never trusts the client's payment_id as-is — GET_JOB_PAYMENT_FOR_WHATSAPP_SEND
    # re-filters to this branch_id, same discipline as the other three events'
    # own GET_JOBS_FOR_WHATSAPP_* queries.
    rows = await exec_sql_query(
        db_name=db_name_arg, schema=schema_name, sql=SqlStore.GET_JOB_PAYMENT_FOR_WHATSAPP_SEND,
        sql_args={"payment_id": payment_id, "branch_id": branch_id},
    )
    if not rows:
        return {"results": []}
    row = rows[0]

    if not is_valid_mobile(row["mobile"]):
        logger.info(
            "Skipping WhatsApp money-receipt send for customer=%s — invalid/missing mobile",
            row["customer_name"],
        )
        return {
            "results": [
                {
                    "customer_name": row["customer_name"],
                    "payment_id": payment_id,
                    "status": "FAILED",
                    "error": "Invalid or missing mobile number",
                }
            ]
        }

    bu_rows = await exec_sql_query(
        db_name=db_name_arg, schema="security", sql=SqlStore.GET_BU_NAME_BY_CODE, sql_args={"schema": schema_name}
    )
    bu_name = bu_rows[0]["name"] if bu_rows else schema_name

    template = TEMPLATES["JOB_MONEY_RECEIPT"]
    header_values, body_values = _build_money_receipt_params(bu_name, row)
    callback_data = _build_biz_opaque_callback_data(db_name_arg, schema_name, "JOB_MONEY_RECEIPT", [row["job_id"]])

    # Token identifies (job_id, payment_id), not just job_ids — a job can have
    # several receipts, so the download link must be scoped to this one
    # (app/whatsapp/token.py's sign_receipt, distinct from sign/verify).
    receipt_token = sign_receipt(db_name_arg, schema_name, row["job_id"], payment_id)
    button_values = [receipt_token]

    result = await send_template(
        normalize_mobile(row["mobile"]), template, header_values, body_values, callback_data, button_values
    )

    status = "ACCEPTED" if result.ok else "FAILED"
    await _persist_receipt_attempt(
        db_name_arg, schema_name, row["job_id"], payment_id, result.provider_message_id, status, result.error_message
    )

    logger.info(
        "sendWhatsappMoneyReceipt: payment_id=%s job_id=%s status=%s", payment_id, row["job_id"], status
    )

    return {
        "results": [
            {
                "customer_name": row["customer_name"],
                "payment_id": payment_id,
                "status": "SENT" if result.ok else "FAILED",
                "error": result.error_message,
            }
        ]
    }


async def send_whatsapp_job_invoice(db_name: str, schema: str = "public", value: str = "") -> dict[str, Any]:
    """Send the "Download Invoice" WhatsApp message for exactly one job
    (plans/plan.md) — a resend path from the Delivered Jobs grid for jobs
    that already left the live paperless-delivery session (`JOB_DELIVERY`'s
    own Invoice button, in `_send_delivery_chunk`, only exists for the
    duration of that one send/session). Never grouped or chunked, like
    `send_whatsapp_money_receipt` — an invoice always belongs to exactly one
    job/customer. Plain Utility, no companion Authentication send, no OTP:
    this is a convenience resend of a document already issued, not a new
    delivery-confirmation event needing staff verification. Reuses the
    existing `GET /job-delivery/invoice/{token}` route completely
    unchanged — `token.py`'s `sign()` is a generic link token, not
    OTP-gated or status-checked, so minting a fresh one here needs no new
    PDF route, no new token scheme."""
    payload = _decode_value(value, "sendWhatsappJobInvoice")
    branch_id = payload.get("branch_id")
    job_id = payload.get("job_id")

    if not branch_id or not job_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/job_id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    if not await _is_event_enabled(db_name_arg, schema_name, "JOB_INVOICE"):
        return {"results": [], "disabled": True}

    # Server never trusts the client's job_id as-is —
    # GET_JOB_INVOICE_FOR_WHATSAPP_SEND re-filters to this branch_id and
    # requires a job_invoice row to exist, same discipline as the other
    # events' own GET_JOBS_FOR_WHATSAPP_*/GET_JOB_PAYMENT_FOR_WHATSAPP_SEND
    # queries.
    rows = await exec_sql_query(
        db_name=db_name_arg, schema=schema_name, sql=SqlStore.GET_JOB_INVOICE_FOR_WHATSAPP_SEND,
        sql_args={"job_id": job_id, "branch_id": branch_id},
    )
    if not rows:
        return {"results": []}
    row = rows[0]

    if not is_valid_mobile(row["mobile"]):
        logger.info(
            "Skipping WhatsApp invoice send for customer=%s — invalid/missing mobile",
            row["customer_name"],
        )
        return {
            "results": [
                {
                    "customer_name": row["customer_name"],
                    "job_id": job_id,
                    "status": "FAILED",
                    "error": "Invalid or missing mobile number",
                }
            ]
        }

    bu_rows = await exec_sql_query(
        db_name=db_name_arg, schema="security", sql=SqlStore.GET_BU_NAME_BY_CODE, sql_args={"schema": schema_name}
    )
    bu_name = bu_rows[0]["name"] if bu_rows else schema_name

    template = TEMPLATES["JOB_INVOICE"]
    header_values, body_values = _build_invoice_params(bu_name, row)
    callback_data = _build_biz_opaque_callback_data(db_name_arg, schema_name, "JOB_INVOICE", [job_id])

    # Reuses the same generic status-link token JOB_DELIVERY's own Invoice
    # button already points at (GET /job-delivery/invoice/{token}) — not
    # OTP-gated, not status-checked, so a fresh one here works for a job in
    # any status, closed or not.
    invoice_token = sign_status_link(db_name_arg, schema_name, [job_id])
    button_values = [invoice_token]

    result = await send_template(
        normalize_mobile(row["mobile"]), template, header_values, body_values, callback_data, button_values
    )

    status = "ACCEPTED" if result.ok else "FAILED"
    await _persist_attempt(
        db_name_arg, schema_name, job_id, "JOB_INVOICE", result.provider_message_id, status, result.error_message
    )

    logger.info("sendWhatsappJobInvoice: job_id=%s status=%s", job_id, status)

    return {
        "results": [
            {
                "customer_name": row["customer_name"],
                "job_id": job_id,
                "status": "SENT" if result.ok else "FAILED",
                "error": result.error_message,
            }
        ]
    }


async def _increment_otp_attempt(db_name: str, schema: str, job_id: int) -> None:
    await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=SqlStore.INCREMENT_JOB_DELIVERY_OTP_ATTEMPT,
        sql_args={"job_id": job_id},
    )


async def verify_job_delivery_otp(
    db_name: str, schema: str = "public", value: str = "", staff_id: str | None = None
) -> dict[str, Any]:
    """verifyJobDeliveryOtp (plans/plan.md, Step 3) — staff-facing, authenticated
    confirmation that the customer read the OTP aloud. Requires every job_id in
    the set to share one matching, unexpired hash under the attempt lockout; a
    mismatch or missing hash on any single job fails the whole call rather than
    partially confirming, since a chunk's OTP is one shared code by
    construction (`_send_delivery_chunk` writes it identically to every
    job_id). `staff_id` comes from the caller's own GraphQL context, never a
    client-supplied field — same separation `set_job_delivery_manual_confirmation`
    already has."""
    payload = _decode_value(value, "verifyJobDeliveryOtp")
    job_ids = payload.get("job_ids") or []
    code = payload.get("code") or ""

    if not job_ids or not code:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "job_ids/code"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    rows = await exec_sql_query(
        db_name=db_name_arg, schema=schema_name, sql=SqlStore.GET_JOB_DELIVERY_OTP,
        sql_args={"job_ids": job_ids},
    )
    rows_by_id = {r["id"]: r for r in rows}

    if len(rows_by_id) != len(set(job_ids)) or any(r["otp_hash"] is None for r in rows):
        return {"status": "NO_PENDING_OTP", "job_ids": job_ids}

    hashes = {r["otp_hash"] for r in rows}
    if len(hashes) != 1:
        # Not all of these job_ids belong to the same OTP send — the caller must
        # be using a stale/hand-edited job_ids list, not the exact set a
        # sendWhatsappJobDelivery chunk result returned.
        return {"status": "JOB_SET_MISMATCH", "job_ids": job_ids}

    now = datetime.now(timezone.utc)
    if any(datetime.fromisoformat(r["otp_expires_at"]) <= now for r in rows):
        return {"status": "EXPIRED", "job_ids": job_ids}

    if any(r["otp_attempt_count"] >= OTP_MAX_ATTEMPTS for r in rows):
        return {"status": "TOO_MANY_ATTEMPTS", "job_ids": job_ids}

    otp_hash = next(iter(hashes))
    if not otp.verify(code, otp_hash):
        await asyncio.gather(
            *(_increment_otp_attempt(db_name_arg, schema_name, job_id) for job_id in job_ids)
        )
        return {"status": "INCORRECT_CODE", "job_ids": job_ids}

    confirmed_at = now.isoformat()
    for job_id in job_ids:
        await exec_sql(
            db_name=db_name_arg,
            schema=schema_name,
            sql=SqlStore.SET_JOB_DELIVERY_CONFIRMATION,
            sql_args={
                "job_id": job_id,
                "confirmed_at": confirmed_at,
                "confirmation_method": "otp_verified",
                "staff_id": staff_id,
            },
        )
        await pubsub.publish(
            "whatsapp_delivery_status",
            {"db_name": db_name_arg, "job_id": job_id, "status": "CONFIRMED", "error": None},
        )

    logger.info("verifyJobDeliveryOtp: %d job(s) confirmed by staff_id=%s", len(job_ids), staff_id)

    return {"status": "CONFIRMED", "job_ids": job_ids}


async def get_job_delivery_otp_pending(db_name: str, schema: str = "public", value: str = "") -> dict[str, Any]:
    """getJobDeliveryOtpPending (plans/plan.md, Step 3) — feeds Step 4's "Verify
    Code" affordance: whether a still-valid, unconfirmed OTP is already waiting
    for this exact job set, without exposing the hash or expiry themselves, so
    the client can offer re-entry instead of forcing a fresh (and
    first-code-invalidating) resend."""
    payload = _decode_value(value, "getJobDeliveryOtpPending")
    job_ids = payload.get("job_ids") or []

    if not job_ids:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "job_ids"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    rows = await exec_sql_query(
        db_name=db_name_arg, schema=schema_name, sql=SqlStore.GET_JOB_DELIVERY_OTP_PENDING,
        sql_args={"job_ids": job_ids},
    )
    pending_by_id = {r["id"]: r["otp_pending"] for r in rows}
    otp_pending = len(pending_by_id) == len(set(job_ids)) and all(pending_by_id.values())

    return {"job_ids": job_ids, "otp_pending": otp_pending}


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


# ── Extended Warranty (plans/plan.md) ─────────────────────────────────────────
# The first event not anchored to a `job` row: state lives on `ew_customer.stages`,
# keyed by the days-before bucket, and there is no reminder table. Exactly-once per
# stage therefore comes from CLAIM_EW_REMINDER_STAGE's WHERE clause instead of a
# unique index — see that statement's own comment.

# How far past expiry a record stays eligible. Negative: a warranty that lapsed a
# week ago is still worth a stage-0 nudge, one that lapsed six months ago is not.
_EW_GRACE_DAYS = -7

_EW_DEFAULT_SETTINGS: dict[str, Any] = {
    "auto_send_enabled": False,
    "contact_phone": "",
    "daily_send_cap": 250,
    # The feature flag. Default False so an unmigrated schema, a missing row or a partial
    # object all resolve to "off" — never enabled by omission.
    "enabled": False,
    "notify_email": "",
    "reminder_days_before": [30, 7, 0],
    "staff_whatsapp_number": "",
    "whatsapp_number": "",
}


def _is_ew_feature_enabled(settings_row: dict[str, Any]) -> bool:
    """The feature flag, separate from the per-event send switch.

    `extended_warranty.enabled` makes the module *visible*;
    `whatsapp_notifications.EXTENDED_WARRANTY` makes sends *allowed*. Both must be true
    to send. They are separate because an owner will want to enter and review leads
    before any message goes out.

    Takes the already-fetched settings row rather than querying: `enabled` lives on the
    same row `get_ew_settings` returns, so re-reading it would be a second round trip for
    a key we already hold. It was its own app_setting row until the settings
    consolidation — see scripts/ew_enabled_merge.sql.

    Fails closed like `_is_event_enabled`: strict `is True`, so a missing key, a non-bool
    value, or the string "true" left behind by the old free-text editor all read as off.
    """
    return settings_row.get("enabled") is True


async def get_ew_settings(db_name: str, schema: str) -> dict[str, Any]:
    """The `extended_warranty` app_setting row, merged over defaults so a missing key
    never raises — the row is admin-editable JSON and can legitimately be partial."""
    rows = await exec_sql_query(
        db_name=db_name, schema=schema, sql=SqlStore.GET_APP_SETTING_BY_KEY,
        sql_args={"setting_key": "extended_warranty"},
    )
    settings_row = rows[0]["setting_value"] if rows else None
    merged = dict(_EW_DEFAULT_SETTINGS)
    if isinstance(settings_row, dict):
        merged.update({k: v for k, v in settings_row.items() if v is not None})
    stages = merged.get("reminder_days_before")
    if not isinstance(stages, list) or not stages:
        merged["reminder_days_before"] = list(_EW_DEFAULT_SETTINGS["reminder_days_before"])
    return merged


def _format_expiry_date(value: Any) -> str:
    """'12 Oct 2026' — spelled month, so there is no dd/mm vs mm/dd ambiguity in a
    message a customer reads on their phone."""
    if value is None:
        return "-"
    if isinstance(value, str):
        return value
    return value.strftime("%d %b %Y")


def _build_ew_params(bu_name: str, row: dict, settings_row: dict) -> tuple[list[str], list[str]]:
    """header_values, body_values for one customer's reminder."""
    header_values = [_sanitize(_truncate_business_unit(bu_name))]
    body_values = [
        _sanitize(row.get("full_name") or "Customer"),
        _sanitize(row.get("brand_name") or "-"),
        _sanitize(row.get("product_label") or "-"),
        _sanitize(_format_expiry_date(row.get("warranty_end_date"))),
        _sanitize(str(settings_row.get("contact_phone") or "-")),
        _sanitize(str(settings_row.get("whatsapp_number") or "-")),
    ]
    return header_values, body_values


def _join_parts(*parts: Any) -> str:
    """' · '-joined, blanks dropped. Every staff-alert body parameter is ONE line —
    `_sanitize` strips newlines and tabs because Meta rejects the send otherwise, so a
    line break inside a parameter is not available. The template's own body text
    supplies the breaks between parameters; this supplies the separator within one."""
    kept = [str(p).strip() for p in parts if p not in (None, "") and str(p).strip()]
    return " · ".join(kept) if kept else "-"


def _build_ew_lead_params(bu_name: str, row: dict, stage: int) -> tuple[list[str], list[str]]:
    """The staff alert's five composed lines — "full details of the customer" without
    fifteen template variables. Meta templates cannot branch, so every "omit when
    blank" decision happens here, the same way _build_reference_line already works."""
    preferred = (row.get("preferred_contact") or "").upper()
    preferred_label = {
        "CALL": "Prefers a call",
        "WHATSAPP": "Prefers WhatsApp",
    }.get(preferred, "No contact preference")

    header_values = [_sanitize(_truncate_business_unit(bu_name))]
    body_values = [
        _sanitize(_join_parts(row.get("full_name"), row.get("mobile"))),
        _sanitize(_join_parts(row.get("brand_name"), row.get("product_label"), row.get("serial_no"))),
        _sanitize(
            _join_parts(
                f"Warranty ends {_format_expiry_date(row.get('warranty_end_date'))}",
                f"Bought {_format_expiry_date(row['purchase_date'])}" if row.get("purchase_date") else None,
                f"{stage}-day reminder",
            )
        ),
        _sanitize(_join_parts(row.get("address"), row.get("city"), preferred_label)),
        _sanitize(row.get("customer_remarks") or "No remarks"),
    ]
    return header_values, body_values


async def _persist_ew_sent(
    db_name: str, schema: str, ew_customer_id: int, stage: str,
    wamid: str | None, status: str, error: str | None,
) -> None:
    await exec_sql(
        db_name=db_name, schema=schema, sql=SqlStore.SET_EW_REMINDER_SENT,
        sql_args={
            "ew_customer_id": ew_customer_id,
            "stage": stage,
            "wamid": wamid,
            "status": status,
            "settled_at": datetime.now(timezone.utc).isoformat(),
            "error": error,
        },
    )


async def _send_one_ew_reminder(
    db_name: str, schema: str, row: dict, stage: int, bu_name: str,
    settings_row: dict, sent_by: int | None,
) -> dict[str, Any]:
    """One customer, one stage. Claims the stage BEFORE calling Meta, so two staff
    clicking Send — or staff racing the scheduler — produce exactly one message."""
    ew_customer_id = row["ew_customer_id"]
    stage_key = str(stage)
    result_base = {"customer_name": row.get("full_name"), "ew_customer_id": ew_customer_id, "stage": stage}

    if not is_valid_mobile(row.get("mobile")):
        logger.info("Skipping EW reminder for customer_id=%s — invalid/missing mobile", ew_customer_id)
        return {**result_base, "status": "SKIPPED", "error": "Invalid or missing mobile number"}

    claimed = await exec_sql(
        db_name=db_name, schema=schema, sql=SqlStore.CLAIM_EW_REMINDER_STAGE,
        sql_args={
            "ew_customer_id": ew_customer_id,
            "stage": stage_key,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "sent_by": sent_by,
        },
    )
    if not claimed:
        # Already sent for this stage, or the customer opted out / went inactive
        # between selection and send. Not an error — the guard did its job.
        return {**result_base, "status": "SKIPPED", "error": "Already sent for this stage"}

    template = TEMPLATES["EXTENDED_WARRANTY"]
    header_values, body_values = _build_ew_params(bu_name, row, settings_row)
    callback_data = _build_biz_opaque_callback_data(
        db_name, schema, "EXTENDED_WARRANTY", [ew_customer_id, stage]
    )
    token = sign_ew(db_name, schema, ew_customer_id, stage)

    result = await send_template(
        normalize_mobile(row["mobile"]), template, header_values, body_values, callback_data, [token]
    )
    status = "ACCEPTED" if result.ok else "FAILED"
    await _persist_ew_sent(
        db_name, schema, ew_customer_id, stage_key, result.provider_message_id, status, result.error_message
    )
    return {**result_base, "status": "SENT" if result.ok else "FAILED", "error": result.error_message}


async def send_ew_reminders(
    db_name: str, schema: str = "public", value: str = "", sent_by: int | None = None
) -> dict[str, Any]:
    """Send Extended Warranty reminders for the selected customers at one stage.

    Payload: `{branch_id, ew_customer_ids: [...], stage}`. `branch_id` is required and
    cross-checked server-side by GET_EW_CUSTOMERS_FOR_SEND — a list of ids alone is
    never proof the caller is authorised for those customers' branch, the same
    discipline GET_JOBS_FOR_WHATSAPP_COMPLETION already applies.

    `sent_by` comes from the authenticated session, never the payload — the Message Log
    attributes every send to a real user, or to NULL for the scheduler."""
    payload = _decode_value(value, "sendEwReminders")
    branch_id = payload.get("branch_id")
    ew_customer_ids = payload.get("ew_customer_ids") or []
    stage = payload.get("stage")

    if not branch_id or not ew_customer_ids or stage is None:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/ew_customer_ids/stage"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    # Both switches, in order: the feature flag, then the per-event send switch. Either
    # one off means no message leaves the building. The flag lives on the settings row, so
    # fetch that first and read it from there rather than querying app_setting twice.
    settings_row = await get_ew_settings(db_name_arg, schema_name)
    if not _is_ew_feature_enabled(settings_row):
        return {"results": [], "disabled": True}
    if not await _is_event_enabled(db_name_arg, schema_name, "EXTENDED_WARRANTY"):
        return {"results": [], "disabled": True}

    rows = await exec_sql_query(
        db_name=db_name_arg, schema=schema_name, sql=SqlStore.GET_EW_CUSTOMERS_FOR_SEND,
        sql_args={"ew_customer_ids": list(ew_customer_ids), "branch_id": branch_id},
    )
    if not rows:
        return {"results": []}

    # Daily cap is per BU schema per run, not per client database — a multi-BU tenant
    # can send up to cap × BUs in a day. Checked once up front rather than per message
    # so a large selection degrades predictably instead of half-sending.
    cap = int(settings_row.get("daily_send_cap") or 0)
    if cap > 0:
        sent_rows = await exec_sql_query(
            db_name=db_name_arg, schema=schema_name, sql=SqlStore.GET_EW_SENT_TODAY_COUNT, sql_args={}
        )
        already_sent = int(sent_rows[0]["sent_today"]) if sent_rows else 0
        remaining = max(0, cap - already_sent)
    else:
        remaining = len(rows)

    allowed, capped = rows[:remaining], rows[remaining:]

    bu_rows = await exec_sql_query(
        db_name=db_name_arg, schema="security", sql=SqlStore.GET_BU_NAME_BY_CODE,
        sql_args={"schema": schema_name},
    )
    bu_name = bu_rows[0]["name"] if bu_rows else schema_name

    semaphore = asyncio.Semaphore(_SEND_CONCURRENCY)

    async def _guarded(row: dict) -> dict[str, Any]:
        async with semaphore:
            return await _send_one_ew_reminder(
                db_name_arg, schema_name, row, int(stage), bu_name, settings_row, sent_by
            )

    results = list(await asyncio.gather(*(_guarded(row) for row in allowed)))
    results.extend(
        {
            "customer_name": row.get("full_name"),
            "ew_customer_id": row["ew_customer_id"],
            "stage": int(stage),
            "status": "CAPPED",
            "error": "Daily send cap reached",
        }
        for row in capped
    )

    logger.info(
        "sendEwReminders: schema=%s stage=%s selected=%s sent=%s capped=%s",
        schema_name, stage, len(rows), len(allowed), len(capped),
    )
    return {"results": results}


async def send_ew_lead_alert(db_name: str, schema: str, ew_customer_id: int, stage: int) -> None:
    """Channel 1 of the two follow-up channels: the moment a customer taps "I am
    interested", the whole lead goes to the company's own WhatsApp number.

    Called AFTER SET_EW_INTEREST has committed, and deliberately swallowing every
    failure — an unset number, an invalid one, a Meta 4xx/5xx, a timeout. None of that
    may propagate into the customer's request: the customer sees a thank-you page and
    the lead is already saved either way. A failure is recorded at
    stages[n].interest.alert so the Interest grid can show it and offer a re-send;
    swallowing it silently would mean staff never learn a customer raised a hand."""
    stage_key = str(stage)
    try:
        settings_row = await get_ew_settings(db_name, schema)
        staff_number = str(settings_row.get("staff_whatsapp_number") or "").strip()
        if not staff_number:
            return
        if not is_valid_mobile(staff_number):
            await exec_sql(
                db_name=db_name, schema=schema, sql=SqlStore.SET_EW_ALERT_OUTCOME,
                sql_args={
                    "ew_customer_id": ew_customer_id, "stage": stage_key, "status": "FAILED",
                    "wamid": None, "sent_at": datetime.now(timezone.utc).isoformat(),
                    "error": "staff_whatsapp_number is not a valid mobile number",
                },
            )
            return

        rows = await exec_sql_query(
            db_name=db_name, schema=schema, sql=SqlStore.GET_EW_LEAD_DETAIL,
            sql_args={"ew_customer_id": ew_customer_id, "stage": stage_key},
        )
        if not rows:
            return
        row = rows[0]

        bu_rows = await exec_sql_query(
            db_name=db_name, schema="security", sql=SqlStore.GET_BU_NAME_BY_CODE,
            sql_args={"schema": schema},
        )
        bu_name = bu_rows[0]["name"] if bu_rows else schema

        template = TEMPLATES["EXTENDED_WARRANTY_LEAD"]
        header_values, body_values = _build_ew_lead_params(bu_name, row, stage)
        callback_data = _build_biz_opaque_callback_data(
            db_name, schema, "EXTENDED_WARRANTY_LEAD", [ew_customer_id, stage]
        )
        # The button's dynamic segment is a deep link into the authenticated app, not a
        # signed token — ProtectedRoute is the credential there.
        deep_link_ref = f"{ew_customer_id}-{stage}"

        result = await send_template(
            normalize_mobile(staff_number), template, header_values, body_values, callback_data, [deep_link_ref]
        )
        await exec_sql(
            db_name=db_name, schema=schema, sql=SqlStore.SET_EW_ALERT_OUTCOME,
            sql_args={
                "ew_customer_id": ew_customer_id,
                "stage": stage_key,
                "status": "ACCEPTED" if result.ok else "FAILED",
                "wamid": result.provider_message_id,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "error": result.error_message,
            },
        )
        logger.info(
            "send_ew_lead_alert: customer_id=%s stage=%s ok=%s", ew_customer_id, stage, result.ok
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "send_ew_lead_alert failed for customer_id=%s stage=%s — lead is already saved",
            ew_customer_id, stage,
        )
