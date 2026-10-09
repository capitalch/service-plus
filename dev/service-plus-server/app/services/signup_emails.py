"""Sign-up emails (plans/plan.md Step 7).

The wording lives in AppMessages as plain-text templates. Each email is sent as that
text plus an HTML version built from it here: same words, paragraphs kept, links made
clickable, in the table-based inline-styled layout the other public emails use.

Every send is best-effort: the request is already saved, so a failed email is logged
and never fails the caller (save first, email after).
"""

import html
import re

from app.config import settings
from app.core.email import send_email
from app.core.exceptions import AppMessages
from app.core.plan_prices import PAISE_PER_RUPEE
from app.logger import logger

PLAN_NAMES = {"lite": "Lite", "basic": "Basic", "standard": "Standard", "enterprise": "Enterprise"}

_URL_RE = re.compile(r"(https?://[^\s<]+)")


def signup_status_url() -> str:
    """The portal's sign-up status page (the portal is built with trailingSlash: true)."""
    return f"{settings.portal_url}/signup-status/"


def enquiries_url() -> str:
    """The Admin → Enquiries page of the Service+ client (built in Step 9)."""
    return f"{settings.frontend_url.rstrip('/')}/admin/enquiries"


def rupees(paise: int) -> str:
    """Whole rupees with Indian digit grouping, e.g. 200000 paise -> '2,000'."""
    value = str(paise // PAISE_PER_RUPEE)
    if len(value) <= 3:
        return value
    head, tail = value[:-3], value[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ",".join(groups) + "," + tail


# "Label: value" lines become a details table; a single "Label: https://…" line becomes a button.
_BUTTON_RE = re.compile(r"^(.{1,60}?):\s+(https?://\S+)$")
_DETAIL_RE = re.compile(r"^([A-Za-z][A-Za-z '&/+-]{0,28}):\s+(\S.*)$")

_FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"


def _paragraph_html(block: str) -> str:
    escaped = html.escape(block)
    linked = _URL_RE.sub(r'<a href="\1" style="color:#2563eb;">\1</a>', escaped)
    return (
        '<p style="margin:0 0 16px 0;color:#0f172a;font-size:15px;line-height:1.65;">'
        f"{linked.replace(chr(10), '<br>')}</p>"
    )


def _details_html(rows: list[tuple[str, str]]) -> str:
    cells = "".join(
        '<tr>'
        f'<td style="padding:8px 14px;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top;">{html.escape(label)}</td>'
        f'<td style="padding:8px 14px;color:#0f172a;font-size:14px;font-weight:600;">{html.escape(value)}</td>'
        "</tr>"
        for label, value in rows
    )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="margin:0 0 20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">'
        f"{cells}</table>"
    )


def _button_html(label: str, url: str) -> str:
    href = html.escape(url, quote=True)
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px 0;"><tr>'
        '<td style="background:#2563eb;border-radius:8px;">'
        f'<a href="{href}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:15px;'
        f'font-weight:600;text-decoration:none;">{html.escape(label)}</a></td></tr></table>'
        f'<p style="margin:0 0 16px 0;color:#64748b;font-size:12px;line-height:1.5;">'
        f'If the button does not work, copy this link into your browser:<br>'
        f'<a href="{href}" style="color:#2563eb;word-break:break-all;">{html.escape(url)}</a></p>'
    )


def build_html(text: str, title: str | None = None) -> str:
    """The HTML version of a plain-text email: escaped, paragraphs kept, URLs as links.
    Blocks of 'Label: value' lines become a details table, a lone 'Label: URL' line becomes
    a button, and `title` (the subject) is shown as the heading."""
    parts = []
    for block in text.split("\n\n"):
        lines = block.split("\n")
        button = _BUTTON_RE.match(block) if len(lines) == 1 else None
        details = [_DETAIL_RE.match(line) for line in lines]
        if button:
            parts.append(_button_html(button.group(1), button.group(2)))
        elif all(details) and not any(d.group(2).startswith("http") for d in details):
            parts.append(_details_html([(d.group(1), d.group(2)) for d in details]))
        else:
            parts.append(_paragraph_html(block))
    body = "".join(parts)
    heading = (
        f'<h1 style="margin:0 0 18px 0;color:#0f172a;font-size:20px;line-height:1.3;">{html.escape(title)}</h1>'
        if title
        else ""
    )
    return f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:{_FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#2563eb;padding:22px 32px;">
                <div style="color:#ffffff;font-size:20px;font-weight:700;">Service+</div>
                <div style="color:#dbeafe;font-size:12px;margin-top:2px;">Repair workshop management</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 10px 32px;">{heading}{body}</td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.6;">
                This is an automated message from Service+. Just reply to this email if you need help.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


async def send_text_email(to: str, subject: str, text: str, reply_to: str | None = None) -> bool:
    """Send one plain-text + HTML email; log and return False on failure, never raise."""
    try:
        await send_email(to=to, subject=subject, body=text, html_body=build_html(text, subject), reply_to=reply_to)
        return True
    except Exception as e:  # pylint: disable=broad-except
        logger.warning("Failed to send sign-up email '%s' to %s: %s", subject, to, e)
        return False


def thank_you_email(enquiry: dict) -> tuple[str, str]:
    """(subject, text) of the applicant's thank-you for any plan. `enquiry` holds
    plan_code, name, business_name, reference, setup_fee_paise and monthly_fee_paise."""
    plan_code = enquiry["plan_code"]
    fields = {
        "business_name": enquiry["business_name"],
        "name": enquiry["name"],
        "plan_name": PLAN_NAMES[plan_code],
        "reference": enquiry["reference"],
    }
    if plan_code == "lite":
        return (
            AppMessages.SIGNUP_EMAIL_LITE_SUBJECT.format(**fields),
            AppMessages.SIGNUP_EMAIL_LITE_TEXT.format(**fields, status_url=signup_status_url()),
        )
    if plan_code == "enterprise":
        return (
            AppMessages.SIGNUP_EMAIL_ENTERPRISE_SUBJECT.format(**fields),
            AppMessages.SIGNUP_EMAIL_ENTERPRISE_TEXT.format(**fields),
        )
    return (
        AppMessages.SIGNUP_EMAIL_PAID_SUBJECT.format(**fields),
        AppMessages.SIGNUP_EMAIL_PAID_TEXT.format(
            **fields,
            monthly_fee=rupees(enquiry["monthly_fee_paise"]),
            setup_fee=rupees(enquiry["setup_fee_paise"]),
        ),
    )


def rejection_email(enquiry: dict, reason: str) -> tuple[str, str]:
    """(subject, text) of the applicant's rejection email (sent by Step 9)."""
    return (
        AppMessages.SIGNUP_EMAIL_REJECTED_SUBJECT.format(reference=enquiry["reference"]),
        AppMessages.SIGNUP_EMAIL_REJECTED_TEXT.format(
            business_name=enquiry["business_name"],
            name=enquiry["name"],
            reason=reason,
            reference=enquiry["reference"],
            status_url=signup_status_url(),
        ),
    )


def approver_email(enquiry: dict) -> tuple[str, str]:
    """(subject, text) of the email to the default database's approvers."""
    setup_status = (
        "not required"
        if enquiry["payment_status"] == "not_required"
        else f"₹{rupees(enquiry['setup_fee_paise'])} pending"
    )
    plan_name = PLAN_NAMES[enquiry["plan_code"]]
    return (
        AppMessages.SIGNUP_EMAIL_APPROVER_SUBJECT.format(
            business_name=enquiry["business_name"], plan_name=plan_name, reference=enquiry["reference"]
        ),
        AppMessages.SIGNUP_EMAIL_APPROVER_TEXT.format(
            business_name=enquiry["business_name"],
            city=enquiry["city"],
            email=enquiry["email"],
            enquiries_url=enquiries_url(),
            mobile=enquiry["mobile"],
            name=enquiry["name"],
            plan_name=plan_name,
            reference=enquiry["reference"],
            setup_status=setup_status,
        ),
    )
