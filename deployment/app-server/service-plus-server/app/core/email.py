"""Email utility: async wrapper around smtplib for sending plain-text (or
plain-text + HTML) emails."""

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings
from app.logger import logger


async def send_email(
    to: str,
    subject: str,
    body: str,
    html_body: str | None = None,
    reply_to: str | None = None,
) -> None:
    """Send an email asynchronously — plain-text only, or plain-text + HTML.

    Runs the blocking smtplib call in a thread pool so the event loop is not blocked.
    Silently skips (with a warning) when SMTP is not configured.

    Args:
        to:        Recipient email address.
        subject:   Email subject line.
        body:      Plain-text body (always sent — the fallback for clients that
                   don't render HTML, and the whole message when html_body is omitted).
        html_body: Optional HTML body. When given, the email is sent as
                   multipart/alternative (HTML preferred, plain-text fallback);
                   existing callers that don't pass this keep getting a plain
                   MIMEText message exactly as before.
        reply_to:  Optional Reply-To address (e.g. so replying to a contact-form
                   notification goes straight to the submitter, not smtp_from).
    """
    if not settings.smtp_host:
        raise RuntimeError(f"SMTP not configured — cannot send email to {to} (subject: {subject})")

    await asyncio.to_thread(_send_email_sync, to, subject, body, html_body, reply_to)


def _send_email_sync(
    to: str,
    subject: str,
    body: str,
    html_body: str | None,
    reply_to: str | None,
) -> None:
    """Blocking SMTP send — called via asyncio.to_thread."""
    if html_body:
        msg: MIMEMultipart | MIMEText = MIMEMultipart("alternative")
        msg.attach(MIMEText(body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))
    else:
        msg = MIMEText(body, "plain", "utf-8")

    msg["From"] = settings.smtp_from
    msg["Subject"] = subject
    msg["To"] = to
    if reply_to:
        msg["Reply-To"] = reply_to

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.ehlo()
        if settings.smtp_port == 587:
            server.starttls()
            server.ehlo()
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, [to], msg.as_string())
    logger.info("Email sent to %s (subject: %s)", to, subject)
