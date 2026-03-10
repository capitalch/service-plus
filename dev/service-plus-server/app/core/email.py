"""Email utility: async wrapper around smtplib for sending plain-text emails."""

import asyncio
import smtplib
from email.mime.text import MIMEText

from app.config import settings
from app.logger import logger


async def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email asynchronously.

    Runs the blocking smtplib call in a thread pool so the event loop is not blocked.
    Silently skips (with a warning) when SMTP is not configured.

    Args:
        to:      Recipient email address.
        subject: Email subject line.
        body:    Plain-text email body.
    """
    if not settings.smtp_host:
        logger.warning(f"SMTP not configured — skipping email to {to} (subject: {subject})")
        return

    await asyncio.to_thread(_send_email_sync, to, subject, body)


def _send_email_sync(to: str, subject: str, body: str) -> None:
    """Blocking SMTP send — called via asyncio.to_thread."""
    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = settings.smtp_from
    msg["Subject"] = subject
    msg["To"] = to

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.ehlo()
        if settings.smtp_port == 587:
            server.starttls()
            server.ehlo()
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, [to], msg.as_string())
    logger.info(f"Email sent to {to} (subject: {subject})")
