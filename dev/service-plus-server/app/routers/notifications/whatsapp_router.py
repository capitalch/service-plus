"""REST endpoint for the three PDF-carrying WhatsApp sends: job creation,
delivery, and receipt (plan-whatsapp.md §4e). A binary payload doesn't fit a
JSON GraphQL mutation envelope well, so these go through REST instead — unlike
sendWhatsappCompletion, the text-only completion send (§4d).
"""

from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.dependencies import get_current_user
from app.db.connection.psycopg_driver import exec_sql
from app.db.sql.sql_base import SqlStore
from app.logger import logger
from app.notifications.whatsapp_client import WhatsappApiError, send_template, upload_media
from app.notifications.whatsapp_helpers import (
    build_notification_update_args,
    is_valid_mobile,
    normalize_mobile,
)
from app.notifications.whatsapp_templates import TEMPLATES

router = APIRouter(prefix="/notifications/whatsapp", tags=["whatsapp"])

_DOCUMENT_EVENT_TYPES = {"JOB_CREATION", "JOB_DELIVERY", "JOB_RECEIPT"}


def _render_params(event_type: str, jobs: list[dict]) -> list[str]:
    """Fill each template's ordered placeholder list (see whatsapp_templates.py)
    from the loaded job row(s) — job_no becomes a comma-joined list for a batch."""
    first = jobs[0]
    customer_name = first["customer_name"]
    job_no = ", ".join(j["job_no"] for j in jobs)
    amount = sum(j["amount"] or 0 for j in jobs)

    if event_type == "JOB_CREATION":
        return [customer_name, job_no, first["branch_name"]]
    if event_type == "JOB_DELIVERY":
        return [customer_name, job_no, f"{amount:.2f}"]
    return [customer_name, first["receipt_no"] or "", f"{amount:.2f}", first["payment_mode"] or ""]


@router.post("/send")
async def send_whatsapp_document(
    pdf: UploadFile = File(...),
    job_ids: list[int] = Form(...),
    event_type: str = Form(...),
    db_name: str = Form(...),
    schema: str = Form("public"),
    _current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Upload the PDF, send the templated WhatsApp message, and record the
    result (success/fail count, last status/error) on every job in the request."""
    if event_type not in _DOCUMENT_EVENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"event_type must be one of {sorted(_DOCUMENT_EVENT_TYPES)}",
        )
    if not job_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="job_ids is required"
        )

    schema_name = schema or "public"

    rows = await exec_sql(
        db_name=db_name,
        schema=schema_name,
        sql=SqlStore.GET_JOBS_FOR_WHATSAPP_SEND,
        sql_args={"job_ids": job_ids},
    )
    found_ids = {r["job_id"] for r in rows}
    missing = set(job_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Job(s) not found: {sorted(missing)}"
        )

    # A batch send is still one message to one customer — never one per job.
    customer_ids = {r["customer_contact_id"] for r in rows}
    if len(customer_ids) > 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="All jobs in a batch send must belong to the same customer",
        )

    mobile = rows[0]["mobile"]
    if not is_valid_mobile(mobile):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Customer has no valid mobile number",
        )

    template = TEMPLATES[event_type]
    pdf_bytes = await pdf.read()

    try:
        media_id = await upload_media(pdf_bytes, pdf.filename or f"{event_type.lower()}.pdf")
    except WhatsappApiError as e:
        logger.error("WhatsApp media upload failed for job_ids=%s: %s", job_ids, e)
        return {"status": "FAILED", "error": str(e)}

    params = _render_params(event_type, rows)
    result = await send_template(normalize_mobile(mobile), template, params, media_id)

    for row in rows:
        update_args = build_notification_update_args(
            job_id=row["job_id"],
            event_type=event_type,
            current_notifications=row.get("whatsapp_notifications"),
            sent=result.ok,
            error_message=result.error_message,
        )
        await exec_sql(
            db_name=db_name,
            schema=schema_name,
            sql=SqlStore.SET_JOB_WHATSAPP_NOTIFICATION,
            sql_args=update_args,
        )

    logger.info(
        "WhatsApp %s send for job_ids=%s: %s",
        event_type,
        job_ids,
        "SENT" if result.ok else "FAILED",
    )

    return {"status": "SENT" if result.ok else "FAILED", "error": result.error_message}
