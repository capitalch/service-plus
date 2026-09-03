"""Signed status-link token behind `/job-intake/{token}` — a digital stand-in for a
paper job slip, not a login session. Plain HMAC-SHA256 over a pipe-delimited payload,
same shape discipline as `biz_opaque_callback_data` (app/whatsapp/sender.py): no JSON,
no table, no DB round-trip to validate.

The same token identifies a single job (one-element `job_ids`) or a batch (every
job_id in it) — no separate "kind" field; callers derive job_no vs batch_no from
what they find when they load these rows.
"""

import base64
import hashlib
import hmac
import time

from app.config import settings


def _b64url(data: bytes) -> str:
    """Standard base64 is the wrong alphabet for a URL path segment: `+`/`=` need
    percent-encoding to survive untouched, and `/` breaks path-segment matching
    outright. `.rstrip("=")` drops the padding — `_b64url_decode` re-derives it from
    length, since base64 padding is fully determined by input length."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _signature(secret: bytes, payload_b64: str) -> bytes:
    return hmac.new(secret, payload_b64.encode("ascii"), hashlib.sha256).digest()


def sign(db_name: str, schema: str, job_ids: list[int], ttl_days: int = 730) -> str:
    """`ttl_days=730` (~2 years): this is a digital stand-in for a paper slip a
    customer may need a year later, not a login session — a short TTL would defeat
    that, and the data behind it is no more sensitive than what's already printed
    on the paper job sheet."""
    exp = int(time.time()) + ttl_days * 86400
    payload = f"{db_name}|{schema}|{','.join(str(j) for j in job_ids)}|{exp}"
    payload_b64 = _b64url(payload.encode("utf-8"))
    signature_b64 = _b64url(_signature(settings.whatsapp_link_token_secret.encode("utf-8"), payload_b64))
    # `.` is an unreserved URL character (RFC 3986: ALPHA / DIGIT / "-" / "." / "_" /
    # "~") so it needs no encoding either — mirrors the JWT convention of
    # `payload.signature` closely enough to reuse that mental model without adopting
    # JWT itself (no header segment, no alg negotiation, still the plain HMAC scheme
    # above).
    return f"{payload_b64}.{signature_b64}"


def verify(token: str) -> tuple[str, str, list[int]] | None:
    """Decode and verify a status-link token. Returns `(db_name, schema, job_ids)`,
    or `None` on any failure — tampered, malformed, or expired — never raises, so
    callers can render a plain "invalid or expired" response instead of a 500."""
    try:
        payload_b64, signature_b64 = token.split(".", 1)
        given_signature = _b64url_decode(signature_b64)
    except ValueError:
        # Covers both an unpack failure (no "." in token) and a malformed-base64
        # decode failure (binascii.Error is a ValueError subclass) — either way it's
        # just an invalid token, not a real error.
        return None

    expected_signature = _signature(settings.whatsapp_link_token_secret.encode("utf-8"), payload_b64)
    if not hmac.compare_digest(expected_signature, given_signature):
        return None

    try:
        payload = _b64url_decode(payload_b64).decode("utf-8")
        db_name, schema, job_ids_raw, exp_raw = payload.split("|", 3)
        job_ids = [int(j) for j in job_ids_raw.split(",") if j]
        exp = int(exp_raw)
    except (ValueError, UnicodeDecodeError):
        return None

    if not db_name or not schema or not job_ids:
        return None
    if time.time() > exp:
        return None

    return db_name, schema, job_ids


def sign_receipt(db_name: str, schema: str, job_id: int, payment_id: int, ttl_days: int = 730) -> str:
    """Same shape as `sign`, for a single `job_payment` row instead of a list of
    job ids — a Money Receipt WhatsApp download link needs to identify one
    specific payment, not just its job (a job can have several receipts). Same
    `ttl_days=730` reasoning as `sign`: a receipt is as durable a record as a job
    slip, not a login session."""
    exp = int(time.time()) + ttl_days * 86400
    payload = f"{db_name}|{schema}|{job_id}|{payment_id}|{exp}"
    payload_b64 = _b64url(payload.encode("utf-8"))
    signature_b64 = _b64url(_signature(settings.whatsapp_link_token_secret.encode("utf-8"), payload_b64))
    return f"{payload_b64}.{signature_b64}"


def verify_receipt(token: str) -> tuple[str, str, int, int] | None:
    """Decode and verify a receipt-link token. Returns `(db_name, schema, job_id,
    payment_id)`, or `None` on any failure — tampered, malformed, or expired —
    never raises, same discipline as `verify`."""
    try:
        payload_b64, signature_b64 = token.split(".", 1)
        given_signature = _b64url_decode(signature_b64)
    except ValueError:
        return None

    expected_signature = _signature(settings.whatsapp_link_token_secret.encode("utf-8"), payload_b64)
    if not hmac.compare_digest(expected_signature, given_signature):
        return None

    try:
        payload = _b64url_decode(payload_b64).decode("utf-8")
        db_name, schema, job_id_raw, payment_id_raw, exp_raw = payload.split("|", 4)
        job_id = int(job_id_raw)
        payment_id = int(payment_id_raw)
        exp = int(exp_raw)
    except (ValueError, UnicodeDecodeError):
        return None

    if not db_name or not schema:
        return None
    if time.time() > exp:
        return None

    return db_name, schema, job_id, payment_id
