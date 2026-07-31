"""BU-admin credential mailer resolvers: mail admin/business-user password
reset links. Split from mutation_helper.py — see plans/plan.md Step 4."""

from typing import Any

from app.config import settings
from app.core.audit_log import AuditAction, audit_logger
from app.core.email import send_email
from app.core.security import create_reset_token
from app.db.connection.psycopg_driver import exec_sql
from app.db.sql.sql_base import SqlStore
from app.core.exceptions import AppMessages, ValidationException
from app.graphql.resolvers.shared.generic_query import _decode_value
from app.logger import logger


def _build_reset_link(request: Any, token: str) -> str:
    """Build the password-reset link from the incoming request's host/proto so it
    matches whatever domain the caller used (localhost in dev, the real domain in
    production). nginx forwards `Host` and `X-Forwarded-Proto`. Falls back to
    settings.frontend_url when no request is available."""
    base = None
    if request is not None:
        host = request.headers.get("host")
        if host:
            proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "http"
            base = f"{proto}://{host}"
    if not base:
        base = settings.frontend_url  # dev / no-request fallback (localhost:3000)
    return f"{base}/reset-password?token={token}"

async def resolve_mail_business_user_credentials_helper(
    db_name: str, schema: str, value: str, request: Any = None
) -> dict:
    """
    Decode value payload, generate a new temporary password for the business user,
    update the hash in the database, and email the new credentials.

    Value payload (URL-encoded JSON): { id }
    """
    payload = _decode_value(value, "mailBusinessUserCredentials")

    id_ = payload.get("id")
    if not id_:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "id"},
        )

    schema_name = schema or "security"

    # 1. Fetch business user (is_admin=false guard)
    rows = await exec_sql(
        db_name=db_name,
        schema=schema_name,
        sql=SqlStore.GET_BUSINESS_USER_BY_ID,
        sql_args={"id": id_},
    )
    if not rows:
        raise ValidationException(
            message=AppMessages.NOT_FOUND,
            extensions={"field": "id"},
        )
    user = rows[0]

    logger.info("Generating reset link for business user id=%s in %s", id_, db_name)

    # 2. Generate reset token — no password change in DB at this stage
    token = create_reset_token({"sub": str(id_), "db_name": db_name})
    reset_link = _build_reset_link(request, token)

    # 3. Email reset link
    email_sent = False
    email_error: str | None = None
    try:
        await send_email(
            to=user["email"],
            subject=AppMessages.EMAIL_BU_RESET_LINK_SUBJECT,
            body=AppMessages.EMAIL_BU_RESET_LINK_BODY.format(
                full_name=user["full_name"],
                reset_link=reset_link,
            ),
        )
        email_sent = True
    except Exception as mail_err:  # pylint: disable=broad-except
        email_error = str(mail_err)
        logger.warning(
            "Failed to send reset link email to %s: %s", user["email"], mail_err
        )

    await audit_logger.log(
        action=AuditAction.MAIL_ADMIN_CREDENTIALS,
        detail=f"email_sent={email_sent}"
        + (f", error={email_error}" if email_error else ""),
        resource_id=str(id_),
        resource_name=user.get("username", ""),
        resource_type="business_user",
    )
    return {"email_error": email_error, "email_sent": email_sent, "id": id_}

async def resolve_mail_admin_credentials_helper(
    db_name: str, schema: str, value: str, request: Any = None
) -> dict:
    """
    Decode value payload, generate a password-reset JWT, and email the reset link
    to the admin user. No password is changed at this stage.

    Value payload (URL-encoded JSON): { id, client_id }
    """
    payload = _decode_value(value, "mailAdminCredentials")

    id_ = payload.get("id")
    client_id = payload.get("client_id")
    if not id_:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "id"},
        )

    # 1. Fetch admin user
    rows = await exec_sql(
        db_name=db_name,
        schema=schema or "security",
        sql=SqlStore.GET_ADMIN_USER_BY_ID,
        sql_args={"id": id_},
    )
    if not rows:
        raise ValidationException(
            message=AppMessages.ADMIN_USER_NOT_FOUND,
            extensions={"field": "id"},
        )
    user = rows[0]

    # 2. Generate reset token (48-hour expiry)
    token = create_reset_token(
        {
            "sub": str(id_),
            "db_name": db_name,
            "client_id": client_id,
        }
    )
    reset_link = _build_reset_link(request, token)
    logger.info(
        "Password reset link generated for admin user id=%s in %s", id_, db_name
    )

    # 3. Email reset link
    email_sent = False
    email_error: str | None = None
    try:
        await send_email(
            to=user["email"],
            subject=AppMessages.EMAIL_RESET_LINK_SUBJECT,
            body=AppMessages.EMAIL_RESET_LINK_BODY.format(
                full_name=user["full_name"],
                reset_link=reset_link,
            ),
        )
        email_sent = True
    except Exception as mail_err:  # pylint: disable=broad-except
        email_error = str(mail_err)
        logger.warning(
            "Failed to send reset link email to %s: %s", user["email"], mail_err
        )

    await audit_logger.log(
        action=AuditAction.MAIL_ADMIN_CREDENTIALS,
        detail=f"email_sent={email_sent}"
        + (f", error={email_error}" if email_error else ""),
        resource_id=str(id_),
        resource_name=user.get("username", ""),
        resource_type="admin_user",
    )
    return {"email_error": email_error, "email_sent": email_sent, "id": id_}
