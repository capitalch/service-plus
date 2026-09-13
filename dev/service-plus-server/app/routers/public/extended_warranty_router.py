"""Extended Warranty — the customer-facing page behind the reminder's button
(plans/plan-ew-final.md §C5.5).

The prefix `/extended-warranty/` is fixed by the Meta-approved template (Part B1) and
proxied by nginx — no /api prefix, so the messaged URL reads as a page. The signed token
(app/whatsapp/token.py sign_ew / verify_ew) is the only credential; it binds a lead AND
the reminder that carried it. HTML is returned directly, and a bad token never raises —
the customer sees an "invalid or expired" card, not a 500.

No CSRF token: there is no ambient authority to abuse (the link is the credential), and
both writes are idempotent — RECORD_EW_INTEREST matches only the first tap,
SET_EW_OPT_OUT only the first opt-out. No JavaScript: the customer may be on anything.
"""

import html
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Form, status
from fastapi.responses import HTMLResponse

from app.core.email import send_email
from app.core.rate_limit import rate_limit
from app.db.connection.psycopg_driver import exec_sql, exec_sql_query
from app.db.sql.sql_extended_warranty import ExtendedWarrantyServerSql
from app.graphql.pubsub import publish_ew_lead_changed
from app.logger import logger
from app.whatsapp.ew_sender import get_ew_settings, send_ew_lead_alert
from app.whatsapp.token import verify_ew

router = APIRouter(prefix="/extended-warranty", tags=["extended-warranty"])

# Exactly the wording the customer was promised (plan §C5.5).
INTEREST_BUTTON_LABEL = "I am interested in extended warranty. Please contact me"
_REMARKS_MAX = 500


def _fact(key: str, value: Any) -> str:
    if value in (None, ""):
        return ""
    return (
        f'<div class="fact"><span class="k">{html.escape(key)}</span>'
        f'<span class="v">{html.escape(str(value))}</span></div>'
    )


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
    """verify_ew, then the lead — and only if the token's message is a reminder that
    belongs to that lead (GET_EW_LEAD_FOR_PUBLIC)."""
    decoded = verify_ew(token)
    if decoded is None:
        return None
    db_name, schema, ew_lead_id, ew_message_id = decoded
    rows = await exec_sql_query(
        db_name=db_name,
        schema=schema,
        sql=ExtendedWarrantyServerSql.GET_EW_LEAD_FOR_PUBLIC,
        sql_args={"ew_lead_id": ew_lead_id, "ew_message_id": ew_message_id},
    )
    return (db_name, schema, ew_lead_id, ew_message_id, rows[0]) if rows else None


def _message_page(title: str, heading: str, text: str) -> HTMLResponse:
    return HTMLResponse(content=_page(title, heading, f'<div class="body">{html.escape(text)}</div>'))


async def _notify_by_email(db_name: str, schema: str, row: dict, remarks: str = "") -> None:
    """Optional e-mail copy of a new interest. Best-effort and never raises into the
    customer's request — the lead is already saved.

    `remarks` is passed in rather than read off `row`: `row` was loaded before the interest
    was written, so it cannot carry what the customer just typed."""
    try:
        notify_email = str((await get_ew_settings(db_name, schema)).get("notify_email") or "").strip()
        if not notify_email:
            return
        expiry = row.get("warranty_end_date")
        await send_email(
            to=notify_email,
            subject=f"Extended warranty interest — {row.get('full_name') or 'customer'}",
            body=(
                f"{row.get('full_name') or 'A customer'} has asked to be contacted about "
                f"extending their warranty.\n\n"
                f"Brand:         {row.get('brand_name') or '-'}\n"
                f"Product:       {row.get('product_label') or '-'}\n"
                f"Warranty ends: {expiry.strftime('%d %b %Y') if expiry else '-'}\n"
                f"Their comment: {remarks.strip() or '-'}\n\n"
                f"Open Service+ -> Custom -> Extended Warranty to follow it up."
            ),
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception("Extended warranty interest e-mail failed — the lead is already saved")


def _page(title: str, heading: str, body_html: str) -> str:
    """One card, one message — styled like job_intake_router.py's pages, since a customer
    may see both and they should look like one shop."""
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


def _unsubscribed_page() -> HTMLResponse:
    return _message_page(
        "Unsubscribed", "You have unsubscribed", "You will not receive further warranty reminders from us."
    )


@router.get(
    "/{token}",
    dependencies=[Depends(rate_limit("extended-warranty", limit=60, window_seconds=60))],
)
async def get_extended_warranty_page(token: str) -> HTMLResponse:
    loaded = await _load(token)
    if loaded is None:
        return _invalid_page()
    row = loaded[4]

    if row["is_opted_out"]:
        return _unsubscribed_page()
    if row["has_interest"]:
        return _message_page(
            "Thank you",
            "Thank you — we have your request",
            "Our team will contact you shortly about extending your warranty.",
        )
    if row["state"] == "WON":
        return _message_page(
            "Thank you",
            "Thank you — your extension is being handled",
            "Our team is already taking care of your warranty extension.",
        )

    expiry = row["warranty_end_date"]
    ends = "ended" if expiry and expiry < date.today() else "ends"
    facts = "".join([
        _fact("Brand", row["brand_name"]),
        _fact("Product", row["product_label"]),
        _fact(f"Warranty {ends}", expiry.strftime("%d %b %Y") if expiry else None),
    ])
    safe_token = html.escape(token)
    body_html = f"""
    <div class="body">Hello {html.escape(row["full_name"] or "there")}, you can extend your
    warranty for a further 1 or 2 years and stay covered for parts and labour.</div>
    <div class="facts">{facts}</div>
    <form method="post" action="/extended-warranty/{safe_token}/interest">
      <label for="remarks">Anything you would like to tell us? (optional)</label>
      <textarea id="remarks" name="customer_remarks" maxlength="{_REMARKS_MAX}"></textarea>
      <button type="submit">{html.escape(INTEREST_BUTTON_LABEL)}</button>
    </form>
    <div class="opt-out">
      <form method="post" action="/extended-warranty/{safe_token}/opt-out">
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
    customer_remarks: str = Form(default=""),
) -> HTMLResponse:
    """The customer's "I am interested". The interest is COMMITTED first (exec_sql commits
    on return); only then are staff notified, so a tap is never lost to a Meta outage, a
    missing staff number or an SMTP failure. Notifications fire only when this tap actually
    recorded the interest, so a double click or a later revisit sends no second alert."""
    loaded = await _load(token)
    if loaded is None:
        return _invalid_page()
    db_name, schema, ew_lead_id, ew_message_id, row = loaded
    if row["is_opted_out"]:
        return _unsubscribed_page()

    # The customer is no longer asked how to be reached — the shop calls. preferred_contact
    # stays NULL rather than an assumed 'CALL': a preference nobody expressed is not a fact,
    # and the column keeps meaning "what the customer chose" for the leads that did choose.
    # A stale page still posting preferred_contact is ignored, not honoured.
    remarks = (customer_remarks or "")[:_REMARKS_MAX]
    created = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=ExtendedWarrantyServerSql.RECORD_EW_INTEREST,
        sql_args={
            "customer_remarks": remarks,
            "ew_lead_id": ew_lead_id,
            "ew_message_id": ew_message_id,
            "preferred_contact": None,
        },
    )
    if created:
        logger.info(
            "Extended Warranty interest: schema=%s lead=%s %s -> %s",
            schema, ew_lead_id, created[0]["from_state"], created[0]["to_state"],
        )
        await send_ew_lead_alert(db_name, schema, ew_lead_id)
        await _notify_by_email(db_name, schema, row, remarks)
        # The lead has moved to Interested and its alert row exists — push it to every
        # open screen, not just the bell count the next poll would have found.
        await publish_ew_lead_changed(db_name, schema, "INTEREST", ew_lead_id)

    return _message_page(
        "Thank you", "Thank you — we will contact you", "Our team will get in touch shortly about extending your warranty."
    )


@router.post(
    "/{token}/opt-out",
    dependencies=[Depends(rate_limit("extended-warranty-opt-out", limit=20, window_seconds=60))],
)
async def post_extended_warranty_opt_out(token: str) -> HTMLResponse:
    loaded = await _load(token)
    if loaded is None:
        return _invalid_page()
    db_name, schema, ew_lead_id, ew_message_id, _row = loaded

    rows = await exec_sql(
        db_name=db_name,
        schema=schema,
        sql=ExtendedWarrantyServerSql.SET_EW_OPT_OUT,
        sql_args={"ew_lead_id": ew_lead_id, "ew_message_id": ew_message_id},
    )
    if rows:
        logger.info("Extended Warranty opt-out: schema=%s lead=%s", schema, ew_lead_id)
        # can_send just went false: the row's send tick disappears on every open grid.
        await publish_ew_lead_changed(db_name, schema, "OPT_OUT", ew_lead_id)
    return _unsubscribed_page()
