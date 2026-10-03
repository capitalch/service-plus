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


def build_html(text: str) -> str:
    """The HTML version of a plain-text email: escaped, paragraphs and line breaks kept,
    URLs as links."""
    paragraphs = []
    for block in text.split("\n\n"):
        escaped = html.escape(block)
        linked = _URL_RE.sub(r'<a href="\1" style="color:#2563eb;">\1</a>', escaped)
        paragraphs.append(
            f'<p style="margin:0 0 14px 0;color:#0f172a;font-size:14px;line-height:1.6;">'
            f"{linked.replace(chr(10), '<br>')}</p>"
        )
    body = "".join(paragraphs)
    return f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#2563eb;padding:24px 32px;">
                <div style="color:#ffffff;font-size:18px;font-weight:700;">Service+</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 14px 32px;">{body}</td>
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
        await send_email(to=to, subject=subject, body=text, html_body=build_html(text), reply_to=reply_to)
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
