"""
Meta WhatsApp Cloud API webhook — subscription verification (GET) and inbound
status callbacks (POST).

Tenant resolution decodes `biz_opaque_callback_data` directly (confirmed 2026-08-23
against a real DELIVERED callback for a template message — no routing-table lookup
needed). The status ladder is enforced inside SqlStore.SET_JOB_WHATSAPP_OUTCOME's
WHERE clause, not here — this file just decodes the callback and calls it per job.
"""
import asyncio
import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.config import settings
from app.core.rate_limit import rate_limit
from app.db.connection.psycopg_driver import exec_sql
from app.db.sql.sql_base import SqlStore
from app.graphql.pubsub import pubsub
from app.logger import logger

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Mirrors the ladder in job.whatsapp_notifications: PENDING(0) < ACCEPTED(1) < SENT(2)
# < DELIVERED(3) < READ(4), FAILED(9) terminal. Only statuses Meta's status webhook
# actually reports appear here — PENDING/ACCEPTED are our own send-time states.
_STATUS_RANK = {
    "SENT": 2,
    "DELIVERED": 3,
    "READ": 4,
    "FAILED": 9,
}


@router.get(
    "/whatsapp",
    dependencies=[Depends(rate_limit("whatsapp-webhook-verify", limit=10, window_seconds=60))],
)
async def verify_whatsapp_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_challenge: str = Query(alias="hub.challenge"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
) -> Response:
    """Meta's one-time (or re-verify) subscription handshake. Must echo the raw
    challenge as plain text — wrapping it in JSON fails verification."""
    if hub_mode == "subscribe" and hmac.compare_digest(hub_verify_token, settings.whatsapp_webhook_verify_token):
        return Response(content=hub_challenge, media_type="text/plain")

    logger.warning("WhatsApp webhook verification failed: mode=%s", hub_mode)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification failed")


@router.post(
    "/whatsapp",
    dependencies=[Depends(rate_limit("whatsapp-webhook", limit=300, window_seconds=60))],
)
async def receive_whatsapp_webhook(request: Request) -> dict:
    """Always returns 200 once the signature checks out — Meta retries on anything
    else, and a retry storm is worse than silently dropping one malformed payload."""
    raw_body = await request.body()
    signature = request.headers.get("x-hub-signature-256", "")
    expected = "sha256=" + hmac.new(
        settings.whatsapp_app_secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        logger.warning("WhatsApp webhook signature mismatch — rejecting")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")

    try:
        payload = json.loads(raw_body)
        await _process_webhook_payload(payload)
    except Exception:  # pylint: disable=broad-except
        logger.exception("WhatsApp webhook payload failed to parse — raw body: %s", raw_body[:2000])

    return {"status": "ok"}


async def _process_webhook_payload(payload: dict) -> None:
    tasks = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") != "messages":
                continue
            value = change.get("value", {})

            for msg in value.get("messages", []):
                logger.info("WhatsApp inbound message received (dropped): from=%s", msg.get("from"))

            for msg_status in value.get("statuses", []):
                tasks.append(_apply_status_callback(msg_status))

    if tasks:
        await asyncio.gather(*tasks)


def _decode_callback_data(callback_data: str) -> tuple[str, str, list[int]] | None:
    """`db_name|schema|job_id,job_id,…` — locked format."""
    try:
        db_name, schema, job_ids_raw = callback_data.split("|", 2)
        job_ids = [int(j) for j in job_ids_raw.split(",") if j]
        if not db_name or not schema or not job_ids:
            return None
        return db_name, schema, job_ids
    except ValueError:
        return None


async def _apply_status_callback(msg_status: dict) -> None:
    wamid = msg_status.get("id")
    raw_status = (msg_status.get("status") or "").upper()
    callback_data = msg_status.get("biz_opaque_callback_data")

    new_rank = _STATUS_RANK.get(raw_status)
    if new_rank is None:
        logger.info("WhatsApp status callback: unrecognized status=%r wamid=%s — ignored", raw_status, wamid)
        return

    decoded = _decode_callback_data(callback_data) if callback_data else None
    if decoded is None:
        logger.warning(
            "WhatsApp status callback wamid=%s cannot resolve tenant — biz_opaque_callback_data=%r",
            wamid,
            callback_data,
        )
        return
    db_name, schema, job_ids = decoded

    error_message = None
    if raw_status == "FAILED":
        errors = msg_status.get("errors") or []
        if errors:
            error_message = errors[0].get("title") or errors[0].get("message")

    for job_id in job_ids:
        try:
            rows = await exec_sql(
                db_name=db_name,
                schema=schema,
                sql=SqlStore.SET_JOB_WHATSAPP_OUTCOME,
                sql_args={
                    "job_id": job_id,
                    "wamid": wamid,
                    "status": raw_status,
                    "error": error_message,
                    "new_rank": new_rank,
                },
            )
            if rows:
                logger.info("WhatsApp outcome applied: job_id=%s status=%s wamid=%s", job_id, raw_status, wamid)
                # Real-time push to Customer Connect — the subscription resolver
                # filters by db_name; the client filters further by whether job_id is
                # one it's currently tracking.
                await pubsub.publish(
                    "whatsapp_delivery_status",
                    {"db_name": db_name, "job_id": job_id, "status": raw_status, "error": error_message},
                )
            else:
                logger.info(
                    "WhatsApp outcome ignored (status ladder, duplicate/out-of-order): "
                    "job_id=%s status=%s wamid=%s",
                    job_id,
                    raw_status,
                    wamid,
                )
        except Exception:  # pylint: disable=broad-except
            # One bad job_id/tenant must not stop the rest of the batch, and the
            # handler still returns 200 either way — Meta must never see a 500 here.
            logger.exception("Failed to apply WhatsApp outcome for job_id=%s wamid=%s", job_id, wamid)
