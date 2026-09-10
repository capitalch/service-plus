"""Extended Warranty — the customer-facing landing page behind the reminder's button.

Same shape as app/routers/public/job_intake_router.py: the signed token
(app/whatsapp/token.py's sign_ew/verify_ew) is the only credential, HTML is returned
directly, and a bad token never raises — the customer sees a plain "invalid or expired"
card, not a 500.

No CSRF token. There is no ambient authority to abuse (the link *is* the credential, so
a forged cross-site POST would need the token anyway) and both writes are idempotent by
construction — SET_EW_INTEREST no-ops once interest exists, SET_EW_OPT_OUT once opted
out. That is the same reasoning job_intake_router.py already relies on.

Mounted with no /api prefix so the messaged URL reads as a page, not an API call.
"""

import html
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Form, status
from fastapi.responses import HTMLResponse

from app.core.email import send_email
from app.core.rate_limit import rate_limit
from app.db.connection.psycopg_driver import exec_sql, exec_sql_query
from app.db.sql.sql_base import SqlStore
from app.logger import logger
from app.whatsapp.sender import get_ew_settings, send_ew_lead_alert
from app.whatsapp.token import verify_ew

router = APIRouter(prefix="/extended-warranty", tags=["extended-warranty"])

# Exactly the wording the customer was promised in the WhatsApp message.
INTEREST_BUTTON_LABEL = "I am interested in extended warranty. Please contact me"


def _page(title: str, heading: str, body_html: str) -> str:
    """One card, one message. Deliberately styled to match job_intake_router.py's
    invalid-token card — a customer may see both, and they should look like one shop."""
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
  body {{
    margin: 0; padding: 20px 16px; background: #f1f5f9; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    box-sizing: border-box;
  }}
  .card {{
    max-width: 440px; width: 100%; background: #ffffff; border-radius: 16px;
    padding: 28px 24px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
  }}
  .title {{ color: #0f172a; font-size: 18px; font-weight: 700; margin-bottom: 12px; }}
  .body {{ color: #475569; font-size: 14px; line-height: 1.6; }}
  .facts {{ margin: 18px 0; border-top: 1px solid #e2e8f0; }}
  .fact {{ display: flex; justify-content: space-between; gap: 12px;
           padding: 9px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }}
  .fact .k {{ color: #64748b; }}
  .fact .v {{ color: #0f172a; font-weight: 600; text-align: right; }}
  label {{ display: block; color: #334155; font-size: 13px;
           font-weight: 600; margin: 16px 0 6px; }}
  .choice {{ display: flex; gap: 16px; font-size: 14px; color: #334155; font-weight: 400; }}
  .choice label {{ margin: 0; font-weight: 400; display: flex; align-items: center; gap: 6px; }}
  textarea {{
    width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 10px;
    padding: 10px; font: inherit; font-size: 14px; resize: vertical; min-height: 64px;
  }}
  button {{
    width: 100%; margin-top: 18px; padding: 14px 16px; border: 0; border-radius: 10px;
    background: #0f766e; color: #ffffff; font-size: 15px; font-weight: 700;
    cursor: pointer; line-height: 1.35;
  }}
  .opt-out {{ margin-top: 18px; text-align: center; }}
  .opt-out button {{
    background: none; color: #94a3b8; font-size: 12px; font-weight: 500;
    text-decoration: underline; padding: 4px; margin: 0; width: auto;
  }}
</style>
</head>
<body>
  <div class="card">
    <div class="title">{html.escape(heading)}</div>
    {body_html}
  </div>
</body>
</html>"""


def _invalid_page() -> HTMLResponse:
    return HTMLResponse(
        content=_page(
            "Link invalid or expired",
            "This link is invalid or has expired",
            '<div class="body">Please contact the shop about your warranty.</div>',
        ),
        status_code=status.HTTP_404_NOT_FOUND,
    )


async def _load(token: str) -> tuple[str, str, int, int, dict[str, Any]] | None:
    decoded = verify_ew(token)
    if decoded is None:
        return None
    db_name, schema, ew_customer_id, stage = decoded
    rows = await exec_sql_query(
        db_name=db_name, schema=schema, sql=SqlStore.GET_EW_CUSTOMER_FOR_PUBLIC,
        sql_args={"ew_customer_id": ew_customer_id, "stage": str(stage)},
    )
    if not rows or not rows[0].get("is_active"):
        return None
    return db_name, schema, ew_customer_id, stage, rows[0]


def _fact(key: str, value: Any) -> str:
    if value in (None, ""):
        return ""
    return f'<div class="fact"><span class="k">{html.escape(key)}</span>' \
           f'<span class="v">{html.escape(str(value))}</span></div>'


@router.get(
    "/{token}",
    dependencies=[Depends(rate_limit("extended-warranty", limit=60, window_seconds=60))],
)
async def get_extended_warranty_page(token: str) -> HTMLResponse:
    loaded = await _load(token)
    if loaded is None:
        return _invalid_page()
    _db, _schema, _cid, _stage, row = loaded

    if row.get("is_opted_out"):
        return HTMLResponse(
            content=_page(
                "Unsubscribed", "You have unsubscribed",
                '<div class="body">You will not receive further warranty reminders from us.</div>',
            )
        )

    if row.get("has_interest"):
        return HTMLResponse(
            content=_page(
                "Thank you", "Thank you — we have your request",
                '<div class="body">Our team will contact you shortly about extending '
                "your warranty.</div>",
            )
        )

    expiry = row.get("warranty_end_date")
    facts = "".join([
        _fact("Brand", row.get("brand_name")),
        _fact("Product", row.get("product_label")),
        _fact("Warranty ends", expiry.strftime("%d %b %Y") if expiry else None),
    ])
    # A plain form POST — no JavaScript. The customer may be on anything.
    body_html = f"""
    <div class="body">Hello {html.escape(row.get("full_name") or "there")}, your warranty
    is ending soon. You may extend it for a further 1 or 2 years.</div>
    <div class="facts">{facts}</div>
    <form method="post" action="/extended-warranty/{html.escape(token)}/interest">
      <label>How should we contact you?</label>
      <div class="choice">
        <label><input type="radio" name="preferred_contact" value="CALL" checked> Call me</label>
        <label><input type="radio" name="preferred_contact" value="WHATSAPP"> WhatsApp me</label>
      </div>
      <label for="remarks">Anything you would like to tell us? (optional)</label>
      <textarea id="remarks" name="customer_remarks" maxlength="500"></textarea>
      <button type="submit">{html.escape(INTEREST_BUTTON_LABEL)}</button>
    </form>
    <div class="opt-out">
      <form method="post" action="/extended-warranty/{html.escape(token)}/opt-out">
        <button type="submit">Don't send me warranty reminders</button>
      </form>
    </div>
    """
    return HTMLResponse(content=_page("Extend your warranty", "Extend your warranty", body_html))


@router.post(
    "/{token}/interest",
    dependencies=[Depends(rate_limit("extended-warranty-interest", limit=20, window_seconds=60))],
)
async def post_extended_warranty_interest(
    token: str,
    preferred_contact: str = Form(default="CALL"),
    customer_remarks: str = Form(default=""),
) -> HTMLResponse:
    """One tap, two channels.

    The lead is committed FIRST and unconditionally; only then are the notification
    channels fanned out. A customer tap can never be lost to a Meta outage, an unset
    staff number or an SMTP failure.

    Every channel is keyed off `SET_EW_INTEREST` actually having created the interest
    (`RETURNING id`), so a double-click, a retried form post, or the customer re-opening
    the link days later produces neither a second lead nor a second staff alert."""
    loaded = await _load(token)
    if loaded is None:
        return _invalid_page()
    db_name, schema, ew_customer_id, stage, row = loaded

    if row.get("is_opted_out"):
        return _invalid_page()

    choice = preferred_contact.strip().upper()
    if choice not in ("CALL", "WHATSAPP"):
        choice = "CALL"

    created = await exec_sql(
        db_name=db_name, schema=schema, sql=SqlStore.SET_EW_INTEREST,
        sql_args={
            "ew_customer_id": ew_customer_id,
            "stage": str(stage),
            "expressed_at": datetime.now(timezone.utc).isoformat(),
            "preferred_contact": choice,
            "customer_remarks": (customer_remarks or "").strip()[:500] or None,
        },
    )

    if created:
        # Channel 1 — staff WhatsApp. Swallows its own failures by design.
        await send_ew_lead_alert(db_name, schema, ew_customer_id, stage)
        # Channel 2's email half. The bell half needs nothing here — it is a count
        # query the client already polls.
        await _notify_by_email(db_name, schema, ew_customer_id, stage, row, choice)

    return HTMLResponse(
        content=_page(
            "Thank you", "Thank you — we will contact you",
            '<div class="body">Our team will get in touch shortly about extending your '
            "warranty.</div>",
        )
    )


async def _notify_by_email(
    db_name: str, schema: str, ew_customer_id: int, stage: int, row: dict, choice: str
) -> None:
    """Best-effort, and deliberately never raises into the customer's request — the same
    contract send_ew_lead_alert honours. The lead is already saved."""
    try:
        settings_row = await get_ew_settings(db_name, schema)
        notify_email = str(settings_row.get("notify_email") or "").strip()
        if not notify_email:
            return
        expiry = row.get("warranty_end_date")
        await send_email(
            to=notify_email,
            subject=f"Extended warranty interest — {row.get('full_name') or 'customer'}",
            body=(
                f"{row.get('full_name') or 'A customer'} has asked to be contacted about "
                f"extending their warranty.\n\n"
                f"Brand:        {row.get('brand_name') or '-'}\n"
                f"Product:      {row.get('product_label') or '-'}\n"
                f"Warranty ends: {expiry.strftime('%d %b %Y') if expiry else '-'}\n"
                f"Reminder stage: {stage} days\n"
                f"Prefers:      {'a call' if choice == 'CALL' else 'WhatsApp'}\n\n"
                f"The lead is in Service+ under Custom -> Extended Warranty -> Interest."
            ),
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "Extended warranty interest email failed for customer_id=%s — lead is already saved",
            ew_customer_id,
        )


@router.post(
    "/{token}/opt-out",
    dependencies=[Depends(rate_limit("extended-warranty-opt-out", limit=20, window_seconds=60))],
)
async def post_extended_warranty_opt_out(token: str) -> HTMLResponse:
    loaded = await _load(token)
    if loaded is None:
        return _invalid_page()
    db_name, schema, ew_customer_id, _stage, _row = loaded

    await exec_sql(
        db_name=db_name, schema=schema, sql=SqlStore.SET_EW_OPT_OUT,
        sql_args={"ew_customer_id": ew_customer_id},
    )
    return HTMLResponse(
        content=_page(
            "Unsubscribed", "You have unsubscribed",
            '<div class="body">You will not receive further warranty reminders from us.</div>',
        )
    )
