"""Email codes that prove a portal applicant owns their email (plans/plan.md Step 3).

Every Lite / Basic / Standard applicant gets a code, new or returning, so asking for one
never shows whether an email already has a login. The checked form waits in
security.signup_otp of the default customer database until the code is entered; only the
code's HMAC hash is stored, bound to the email, under its own secret (signup_otp_secret),
never the WhatsApp delivery one (app/whatsapp/otp.py).

Limits: 6 digits, valid for 10 minutes, 5 wrong tries, a resend after 60 seconds, at most
5 codes per email per hour. A correct code deletes its row, so it cannot be used twice.
"""

import hashlib
import hmac
import json
import secrets

from app.config import settings
from app.core.exceptions import AppMessages
from app.db.connection.psycopg_driver import exec_sql
from app.db.sql.sql_signups import SignupServerSql
from app.services.default_customer import get_default_customer_client
from app.services.signup_emails import otp_email, send_text_email
from app.services.signups import SignupException

CODE_DIGITS = 6
MAX_ATTEMPTS = 5
MAX_SENDS_PER_HOUR = 5
RESEND_SECONDS = 60
TTL_MINUTES = 10


def generate() -> str:
    """6 random digits from `secrets`, never `random`: a code someone could try to guess."""
    return f"{secrets.randbelow(10**CODE_DIGITS):0{CODE_DIGITS}d}"


def hash_code(email: str, code: str) -> str:
    """HMAC-SHA256 of email and code, so a code is only good for the email it was sent to."""
    message = f"{email}:{code}".encode("utf-8")
    return hmac.new(settings.signup_otp_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def _refuse(message: str, code: str, **extensions) -> SignupException:
    return SignupException(message=message, code=code, extensions=extensions or None)


async def _db_name() -> str:
    return (await get_default_customer_client())["db_name"]


async def send_code(email: str, payload: dict) -> None:
    """Store a new code and the checked form for `email` (lower-case), then email the code.
    Refuses a resend within RESEND_SECONDS and more than MAX_SENDS_PER_HOUR codes an hour."""
    db_name = await _db_name()
    await exec_sql(db_name, "security", SignupServerSql.PURGE_SIGNUP_OTP)
    code = generate()
    rows = await exec_sql(
        db_name,
        "security",
        SignupServerSql.UPSERT_SIGNUP_OTP,
        {
            "code_hash": hash_code(email, code),
            "email": email,
            "max_sends": MAX_SENDS_PER_HOUR,
            "payload": json.dumps(payload),
            "resend_seconds": RESEND_SECONDS,
            "ttl_minutes": TTL_MINUTES,
        },
    )
    if not rows:
        current = await exec_sql(
            db_name, "security", SignupServerSql.GET_SIGNUP_OTP, {"email": email, "resend_seconds": RESEND_SECONDS}
        )
        if current and current[0]["too_soon"]:
            raise _refuse(AppMessages.OTP_RESEND_WAIT, "OTP_TOO_MANY")
        raise _refuse(AppMessages.OTP_TOO_MANY_SENDS, "OTP_TOO_MANY")
    subject, text = otp_email(code, TTL_MINUTES)
    if not await send_text_email(email, subject, text):
        raise _refuse(AppMessages.OTP_EMAIL_FAILED, "OTP_EMAIL_FAILED")


async def verify_code(email: str, code: str) -> dict:
    """The stored form for `email` (lower-case) when `code` is right; the row is deleted so
    the code cannot be used again. A wrong code uses up one of MAX_ATTEMPTS tries."""
    db_name = await _db_name()
    rows = await exec_sql(
        db_name, "security", SignupServerSql.GET_SIGNUP_OTP, {"email": email, "resend_seconds": RESEND_SECONDS}
    )
    if not rows or rows[0]["expired"]:
        raise _refuse(AppMessages.OTP_EXPIRED, "OTP_EXPIRED")
    row = rows[0]
    if row["attempts"] >= MAX_ATTEMPTS:
        raise _refuse(AppMessages.OTP_TOO_MANY_TRIES, "OTP_TOO_MANY")

    code_hash = hash_code(email, (code or "").strip())
    if hmac.compare_digest(code_hash, row["code_hash"]):
        used = await exec_sql(
            db_name, "security", SignupServerSql.DELETE_SIGNUP_OTP, {"code_hash": code_hash, "email": email}
        )
        if used:
            return used[0]["payload"]
        # Used or expired a moment ago by another request.
        raise _refuse(AppMessages.OTP_EXPIRED, "OTP_EXPIRED")

    bumped = await exec_sql(
        db_name, "security", SignupServerSql.BUMP_SIGNUP_OTP_ATTEMPTS, {"email": email, "max_attempts": MAX_ATTEMPTS}
    )
    tries_left = MAX_ATTEMPTS - bumped[0]["attempts"] if bumped else 0
    if tries_left <= 0:
        raise _refuse(AppMessages.OTP_TOO_MANY_TRIES, "OTP_TOO_MANY")
    raise _refuse(AppMessages.OTP_INVALID.format(tries_left=tries_left), "OTP_INVALID", tries_left=tries_left)
