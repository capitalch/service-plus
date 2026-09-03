"""Job Intake Notice — public status page + on-demand job-slip PDF.

Unlike app/routers/public/website_router.py (gated by X-Website-Key, JSON via
Pydantic response_models), this router's only credential is the signed token
itself (app/whatsapp/token.py) and it returns HTML/PDF bytes directly — no
frontend consuming a JSON response. Mounted with no /api prefix so the
printed/messaged URL reads as a page, not an API call. See plans/plan-whatsapp.md
("Step 4") for the full design.
"""

import html
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import HTMLResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.rate_limit import rate_limit
from app.db.connection.psycopg_driver import exec_sql_query
from app.db.sql.sql_public import PublicSql
from app.whatsapp.token import verify

router = APIRouter(prefix="/job-intake", tags=["job-intake"])


@dataclass(frozen=True)
class _JobIntakeItem:
    """Everything below `status` is legal-slip-only content — the HTML status page
    doesn't render any of it, only _build_pdf does. Per-item, not per-batch, since
    a batch's jobs can each have their own problem/condition/warranty, exactly the
    per-row shape the manual (paper) batch job sheet already uses."""

    job_no: str
    device: str | None
    status: str
    alternate_job_no: str | None
    problem_reported: str | None
    remarks: str | None
    qty: int
    job_type_name: str
    receive_manner_name: str
    receive_condition_name: str | None
    warranty_card_no: str | None
    purchase_date: str | None
    # Job-sheet-only fields (device above stays as the combined string the HTML
    # status page's per-item card already renders) — the grid job sheet needs
    # Product/Brand/Model/Serial No as their own cells, matching the manual
    # paper job sheet (job-sheet-pdf.ts's buildSingleJobSheetDoc/
    # buildBatchJobSheetDoc, this route's server-side counterpart).
    product_name: str | None
    brand_name: str | None
    model_name: str | None
    serial_no: str | None


@dataclass(frozen=True)
class _JobIntakeData:
    """Not an API contract — nothing external consumes this as JSON, it's only fed
    into the HTML/PDF builders below. `batch_no` is present only when the token
    covers more than one job; `job_no` is present only when there's exactly one.
    `received_date` is shared across every item — a batch's jobs are all created
    in the same drop-off transaction, so there's one intake date for the whole
    document, same as bu_name/branch_name/branch_address/customer_name below.
    `bu_name` comes from `security.bu`, not the tenant schema itself — same
    per-request lookup app/whatsapp/sender.py does before a template send.
    `amount_payable` is the sum of `amount` across only the items that are both
    finalized and billed OK (`is_final` AND `status_code == 'COMPLETED_OK'`, the
    same eligibility GET_JOBS_FOR_WHATSAPP_COMPLETION uses) — a job still in
    progress has no settled price to show yet. 0 means "don't show," same as the
    "price > 0" condition it was built from; a batch mixing finalized and
    in-progress items still gets one combined figure, same as the completion
    WhatsApp message's own amount total.
    `customer_mobile`/`customer_address`/`branch_phone`/`branch_email`/
    `branch_gstin`/`terms_and_conditions` exist only for the job slip PDF (a legal
    document expected to carry the same information the manual printed job slip
    does) — the HTML status page never reads them. `terms_and_conditions` comes
    from the `job_terms_and_conditions` app_setting, the exact text already printed
    on the manual slip today.
    `branch_code` and `division_*` are job-sheet-only too — the printed/
    downloaded Job Sheet is branded per DIVISION (name/address/phone/email/
    gstin), exactly like the client's own job-sheet-pdf.ts, not per branch;
    `branch_code` (e.g. "HO") is what that document's "Branch:" row shows,
    never the full branch_name the HTML status page uses instead."""

    batch_no: int | None
    job_no: str | None
    bu_name: str
    branch_code: str
    branch_name: str
    branch_address: str
    branch_phone: str | None
    branch_email: str | None
    branch_gstin: str | None
    division_name: str | None
    division_address: str | None
    division_phone: str | None
    division_email: str | None
    division_gstin: str | None
    customer_name: str
    customer_mobile: str
    customer_address: str | None
    received_date: str
    amount_payable: float
    terms_and_conditions: str | None
    items: list[_JobIntakeItem]
    # Job-sheet-only, mirroring job-sheet-pdf.ts's SingleJobSheetPrintMeta:
    # `client_name` is this server's own tenant identifier (db_name) — the
    # closest server-side equivalent of the client's own auth-derived
    # `clientName`, used only in the low-stakes "tenant -- BU" identification
    # segment of the track line, not customer-facing branding.
    # `track_job_url` is the `track_job_url` app_setting verbatim (a bare
    # configured URL, not a per-job deep link) — same pass-through the client
    # does, no "https://" prefix added here either.
    client_name: str
    track_job_url: str | None


async def _load_job_intake(token: str) -> _JobIntakeData | None:
    """Shared by both routes below. Returns None on any failure — a tampered or
    expired token, or a token whose job ids no longer resolve to any row — so
    callers render a plain "invalid or expired" response, never a 500 or a
    partial-data leak."""
    decoded = verify(token)
    if decoded is None:
        return None
    db_name, schema, job_ids = decoded

    rows = await exec_sql_query(
        db_name=db_name,
        schema=schema,
        sql=PublicSql.GET_JOB_INTAKE_STATUS,
        sql_args={"job_ids": job_ids},
    )
    if not rows:
        return None

    bu_rows = await exec_sql_query(
        db_name=db_name,
        schema="security",
        sql=PublicSql.GET_BU_NAME_BY_CODE,
        sql_args={"schema": schema},
    )
    bu_name = bu_rows[0]["name"] if bu_rows else schema

    terms_rows = await exec_sql_query(
        db_name=db_name,
        schema=schema,
        sql=PublicSql.GET_APP_SETTING_BY_KEY,
        sql_args={"setting_key": "job_terms_and_conditions"},
    )
    terms_and_conditions = (terms_rows[0]["setting_value"] or None) if terms_rows else None

    track_url_rows = await exec_sql_query(
        db_name=db_name,
        schema=schema,
        sql=PublicSql.GET_APP_SETTING_BY_KEY,
        sql_args={"setting_key": "track_job_url"},
    )
    track_job_url = (track_url_rows[0]["setting_value"] or None) if track_url_rows else None

    items = [
        _JobIntakeItem(
            job_no=r["job_no"],
            device=r["device"],
            status=r["status"],
            alternate_job_no=r["alternate_job_no"],
            problem_reported=r["problem_reported"],
            remarks=r["remarks"],
            qty=r["qty"],
            job_type_name=r["job_type_name"],
            receive_manner_name=r["receive_manner_name"],
            receive_condition_name=r["receive_condition_name"],
            warranty_card_no=r["warranty_card_no"],
            purchase_date=r["purchase_date"].strftime("%d %b %Y") if r["purchase_date"] else None,
            product_name=r["product_name"],
            brand_name=r["brand_name"],
            model_name=r["model_name"],
            serial_no=r["serial_no"],
        )
        for r in rows
    ]
    is_batch = len(items) > 1
    job_date = rows[0]["job_date"]
    amount_payable = sum(
        float(r["amount"]) for r in rows if r["is_final"] and r["status_code"] == "COMPLETED_OK"
    )
    return _JobIntakeData(
        batch_no=rows[0]["batch_no"] if is_batch else None,
        job_no=None if is_batch else items[0].job_no,
        bu_name=bu_name,
        branch_code=rows[0]["branch_code"],
        branch_name=rows[0]["branch_name"],
        branch_address=rows[0]["branch_address"] or "",
        branch_phone=rows[0]["branch_phone"],
        branch_email=rows[0]["branch_email"],
        branch_gstin=rows[0]["branch_gstin"],
        division_name=rows[0]["division_name"],
        division_address=rows[0]["division_address"] or None,
        division_phone=rows[0]["division_phone"],
        division_email=rows[0]["division_email"],
        division_gstin=rows[0]["division_gstin"],
        customer_name=rows[0]["customer_name"],
        customer_mobile=rows[0]["customer_mobile"],
        customer_address=rows[0]["address_snapshot"],
        received_date=job_date.strftime("%d %b %Y") if job_date else "—",
        amount_payable=amount_payable,
        terms_and_conditions=terms_and_conditions,
        client_name=db_name,
        track_job_url=track_job_url,
        items=items,
    )


def _invalid_token_html() -> str:
    return """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link invalid or expired</title>
<style>
  body {
    margin: 0; padding: 20px 16px; background: #f1f5f9; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    box-sizing: border-box;
  }
  .card {
    max-width: 400px; width: 100%; background: #ffffff; border-radius: 16px;
    padding: 28px 24px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08); text-align: center;
  }
  .title { color: #0f172a; font-size: 17px; font-weight: 700; margin-bottom: 8px; }
  .body { color: #64748b; font-size: 14px; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <div class="title">This link is invalid or has expired</div>
    <div class="body">Please contact the shop for your job status.</div>
  </div>
</body>
</html>"""


# Best-effort keyword coloring for the HTML status badges — same keyword list
# and priority order as _status_color's PDF equivalent below, just as
# (background-tint, text) hex pairs instead of a single reportlab Color, so the
# two renderings of the same status always agree.
_STATUS_BADGE_COLORS: list[tuple[str, str, str]] = [
    ("deliver", "#ccfbf1", "#0f766e"),
    ("ready", "#d1fae5", "#047857"),
    ("complet", "#d1fae5", "#047857"),
    ("progress", "#fef3c7", "#b45309"),
    ("diagnos", "#fef3c7", "#b45309"),
    ("hold", "#f1f5f9", "#475569"),
    ("cancel", "#fee2e2", "#b91c1c"),
    ("fail", "#fee2e2", "#b91c1c"),
    ("receiv", "#dbeafe", "#1d4ed8"),
]


def _status_badge_colors(status_text: str) -> tuple[str, str]:
    lowered = status_text.lower()
    for keyword, bg, fg in _STATUS_BADGE_COLORS:
        if keyword in lowered:
            return bg, fg
    return "#f1f5f9", "#475569"


def _build_status_page_html(data: _JobIntakeData, pdf_url: str) -> str:
    """A real mobile-browser page, not an email — unlike
    _build_contact_email_html (website_router.py), which deliberately uses
    inline-styled tables because email clients need that, this one is free to use
    a normal <head><style> block, flexbox, and a viewport meta tag. (The previous
    version of this page borrowed the email-safe table pattern anyway, which is
    exactly why it rendered cramped/zoomed-out on a phone — no viewport meta at
    all — and why the 3-column grid felt clumsy on a narrow screen instead of
    stacking naturally.)"""
    esc = html.escape
    is_batch = data.batch_no is not None
    ref_label = "Batch No" if is_batch else "Job No"
    ref_value = str(data.batch_no) if is_batch else (data.job_no or "")
    count_note = f"{len(data.items)} item{'s' if len(data.items) != 1 else ''}" if is_batch else None

    cards = "".join(
        f"""
        <div class="card">
          <div class="card-row">
            <span class="job-no">{f'<span class="idx">{idx}.</span> ' if is_batch else ""}{esc(item.job_no)}</span>
            <span class="badge" style="background:{bg};color:{fg};">{esc(item.status)}</span>
          </div>
          <div class="device">{esc(item.device or 'Device details not recorded')}</div>
        </div>"""
        for idx, (item, (bg, fg)) in enumerate(((i, _status_badge_colors(i.status)) for i in data.items), start=1)
    )

    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{ref_label} {esc(ref_value)} — {esc(data.bu_name)}, {esc(data.branch_name)}</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 0; background: #f1f5f9;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
  }}
  .wrap {{ max-width: 480px; margin: 0 auto; padding: 20px 16px 40px; }}
  .header {{
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: #ffffff; border-radius: 16px; padding: 22px 20px; margin-bottom: 16px;
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
  }}
  .header .bu-name {{ font-size: 15px; font-weight: 700; }}
  .header .branch-line {{ font-size: 12px; color: #dbeafe; margin-top: 3px; margin-bottom: 14px; }}
  .header .label {{ font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #bfdbfe; }}
  .header .ref {{ font-size: 26px; font-weight: 700; margin-top: 2px; }}
  .header .meta {{ font-size: 13px; color: #dbeafe; margin-top: 10px; }}
  .header .count {{
    display: inline-block; margin-top: 10px; background: rgba(255,255,255,0.15);
    padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
  }}
  .header .amount-box {{
    margin-top: 14px; background: rgba(255,255,255,0.15); border-radius: 10px;
    padding: 10px 14px;
  }}
  .header .amount-label {{
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #bfdbfe;
  }}
  .header .amount-value {{ font-size: 20px; font-weight: 800; margin-top: 2px; }}
  .section-label {{
    font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    color: #64748b; margin: 20px 4px 8px;
  }}
  .card {{
    background: #ffffff; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06); border: 1px solid #e5e9f2;
  }}
  .card-row {{ display: flex; align-items: center; justify-content: space-between; gap: 10px; }}
  .job-no {{ font-weight: 700; font-size: 15px; font-family: ui-monospace, Menlo, Consolas, monospace; }}
  .idx {{ color: #94a3b8; font-weight: 600; }}
  .badge {{
    font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px;
    white-space: nowrap;
  }}
  .device {{ font-size: 13.5px; color: #64748b; margin-top: 6px; }}
  .cta {{
    display: block; text-align: center; background: #2563eb; color: #ffffff;
    text-decoration: none; padding: 14px 20px; border-radius: 12px; font-size: 15px;
    font-weight: 700; margin-top: 22px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
  }}
  .footer {{ text-align: center; font-size: 12px; color: #94a3b8; margin-top: 20px; }}
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="bu-name">{esc(data.bu_name)}</div>
      <div class="branch-line">{esc(data.branch_name)}{f" &middot; {esc(data.branch_address)}" if data.branch_address else ""}</div>
      <div class="label">{esc(ref_label)}</div>
      <div class="ref">{esc(ref_value)}</div>
      <div class="meta">{esc(data.customer_name)}</div>
      {f'<div class="count">{esc(count_note)}</div>' if count_note else ""}
      {f'''<div class="amount-box">
        <div class="amount-label">Amount Payable</div>
        <div class="amount-value">&#8377;{data.amount_payable:,.2f}</div>
      </div>''' if data.amount_payable > 0 else ""}
    </div>

    <div class="section-label">Items</div>
    {cards}

    <a class="cta" href="{esc(pdf_url)}">Download Job Slip</a>
    <div class="footer">Reopen this link anytime to see the latest status.</div>
  </div>
</body>
</html>"""


_SLATE_500 = colors.HexColor("#64748b")
_SLATE_100 = colors.HexColor("#f1f5f9")
_BORDER = colors.HexColor("#dbe3ee")


_DASH = "—"


def _or_dash(value: str | None) -> str:
    return value if value else _DASH


def _strip_rupee(text: str) -> str:
    """The printed/downloaded Job Sheet must never show the ₹ glyph — reportlab's
    core Helvetica font has no glyph for U+20B9 and renders a solid black box
    (the exact bug already hit and fixed once this session, in
    job_delivery_router.py's Delivery Note PDF). `job_terms_and_conditions` is
    free text an admin typed into App Settings, so it could contain ₹ despite
    nothing in this flow needing an amount — normalize it away the same way
    the client's own job-sheet-pdf.ts already does for its jsPDF rendering
    (`text.replace(/₹\\s*/g, "Rs ")`), not just hope it's never typed."""
    return re.sub(r"₹\s*", "Rs ", text)


def _build_track_line(data: _JobIntakeData, ref_label: str | None, ref_value: str | None) -> str | None:
    """Mirrors job-sheet-pdf.ts's buildTrackInfoLine exactly (same segments, same
    "label -- label" / " | " joins) — this is a plain text line inside a PDF, not
    a link a browser resolves, so `track_job_url` is shown verbatim (it's a bare
    configured URL, e.g. a general status-lookup page, not a per-job deep link;
    same pass-through the client does, no scheme prefix added here either).
    `ref_label`/`ref_value` are omitted entirely for a batch, same as the
    client's batch job sheet (no single "Job No" applies to every row)."""
    segments: list[str] = []
    if data.track_job_url:
        segments.append(f"Track your Job URL: {data.track_job_url}")
    name_bu = " -- ".join(p for p in [data.client_name, data.bu_name] if p)
    if name_bu:
        segments.append(name_bu)
    if ref_label and ref_value:
        segments.append(f"{ref_label}: {ref_value}")
    segments.append(f"Mobile: {data.customer_mobile}")
    return "   |   ".join(segments) if segments else None


def _build_pdf(data: _JobIntakeData) -> bytes:
    """Server-side, pure-Python — reportlab, no native dependencies. Redesigned
    (plans/plan.md) to match the manual, staff-printed Job Sheet field-for-field
    (job-sheet-pdf.ts's buildSingleJobSheetDoc/buildBatchJobSheetDoc) rather than
    the earlier card-per-item layout — this is the same document a customer would
    otherwise be handed on paper at drop-off, just reachable from the WhatsApp
    Job Intake Notice's "Download Job Slip" button instead. Branded per DIVISION
    (name/address/phone/email/gstin), not per branch — same as the client's own
    version; the "Branch:" row shows the branch's short `code` (e.g. "HO"), not
    its full name. Still fed only by the whitelisted public fields in
    _JobIntakeData/_JobIntakeItem — no cost price, technician, diagnosis, or
    payment history."""
    esc = html.escape
    is_batch = data.batch_no is not None

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=16 * mm, bottomMargin=16 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
        title=f"Job Intake Slip — {'Batch ' + str(data.batch_no) if is_batch else data.job_no} — {data.bu_name}",
    )

    bu_style = ParagraphStyle(
        "BU", fontName="Helvetica-Bold", fontSize=15, leading=18, alignment=TA_CENTER, spaceAfter=2,
    )
    branch_line_style = ParagraphStyle(
        "BranchLine", fontName="Helvetica", fontSize=9, leading=12, alignment=TA_CENTER, textColor=_SLATE_500,
    )
    title_style = ParagraphStyle(
        "Title", fontName="Helvetica-Bold", fontSize=13, leading=16, alignment=TA_CENTER, spaceBefore=6, spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", fontName="Helvetica", fontSize=9, leading=12, alignment=TA_CENTER, spaceAfter=10, textColor=_SLATE_500,
    )
    cell_style = ParagraphStyle("Cell", fontName="Helvetica", fontSize=9, leading=12)
    cell_bold_style = ParagraphStyle("CellBold", parent=cell_style, fontName="Helvetica-Bold")
    track_style = ParagraphStyle("Track", parent=cell_bold_style, alignment=TA_CENTER, fontSize=7.5, leading=10)
    section_label_style = ParagraphStyle("SectionLabel", fontName="Helvetica-Bold", fontSize=9, leading=12)
    body_style = ParagraphStyle("Body", fontName="Helvetica", fontSize=9, leading=13)
    terms_style = ParagraphStyle("Terms", fontName="Helvetica-BoldOblique", fontSize=7, leading=9.5, textColor=_SLATE_500)
    sig_label_style = ParagraphStyle("SigLabel", fontName="Helvetica", fontSize=8.5, leading=11, textColor=_SLATE_500)
    footer_style = ParagraphStyle("Footer", fontName="Helvetica", fontSize=7.5, leading=10, alignment=TA_CENTER, textColor=_SLATE_500)

    # ── Header: DIVISION name/address/contact, then the JOB INTAKE SLIP title ─
    header_name = data.division_name or data.bu_name
    elements: list = [Paragraph(esc(header_name), bu_style)]
    if data.division_address:
        elements.append(Paragraph(esc(data.division_address), branch_line_style))
    contact_parts = [
        p for p in [
            f"Phone: {data.division_phone}" if data.division_phone else None,
            f"Email: {data.division_email}" if data.division_email else None,
        ] if p
    ]
    if contact_parts:
        elements.append(Paragraph(esc(" | ".join(contact_parts)), branch_line_style))
    if data.division_gstin:
        elements.append(Paragraph(esc(f"GSTIN: {data.division_gstin}"), branch_line_style))
    elements.append(Paragraph("BATCH JOB INTAKE SLIP" if is_batch else "JOB INTAKE SLIP", title_style))
    elements.append(Paragraph("Received following articles from customer for repairs", subtitle_style))

    label_w = 30 * mm
    value_w = (doc.width - 2 * label_w) / 2
    col_widths = [label_w, value_w, label_w, value_w]
    grid_style_cmds = [
        ("GRID", (0, 0), (-1, -1), 0.5, _BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]

    if not is_batch:
        # ── Single job: one info grid mirroring buildSingleJobSheetDoc's exactly ──
        item = data.items[0]
        job_no_html = esc(data.job_no or item.job_no)
        if item.alternate_job_no:
            job_no_html += f'  <font size="7" color="#888888">Alt: {esc(item.alternate_job_no)}</font>'

        rows: list = []
        spans: list = []

        def pair(l1: str, v1: str, l2: str, v2: str) -> None:
            rows.append([
                Paragraph(l1, cell_bold_style), Paragraph(esc(v1), cell_style),
                Paragraph(l2, cell_bold_style), Paragraph(esc(v2), cell_style),
            ])

        def full(label: str, value_html: str) -> None:
            r = len(rows)
            rows.append([Paragraph(label, cell_bold_style), Paragraph(value_html, cell_style), "", ""])
            spans.append(("SPAN", (1, r), (3, r)))

        rows.append([Paragraph("Job No", cell_bold_style), Paragraph(job_no_html, cell_style),
                     Paragraph("Date", cell_bold_style), Paragraph(esc(data.received_date), cell_style)])
        pair("Branch", data.branch_code, "Customer", data.customer_name)
        full("Mobile", esc(data.customer_mobile))
        full("Address", esc(_or_dash(data.customer_address)))
        pair("Product", _or_dash(item.product_name), "Brand", _or_dash(item.brand_name))
        pair("Model", _or_dash(item.model_name), "Serial No", _or_dash(item.serial_no))
        full("Qty", esc(str(item.qty)))
        pair("Job Type", item.job_type_name, "Warranty Card", _or_dash(item.warranty_card_no))
        pair("Receive Manner", item.receive_manner_name, "Condition", _or_dash(item.receive_condition_name))

        track_line = _build_track_line(data, "Job No", data.job_no or item.job_no)
        if track_line:
            r = len(rows)
            rows.append([Paragraph(esc(track_line), track_style), "", "", ""])
            spans.append(("SPAN", (0, r), (3, r)))

        info_table = Table(rows, colWidths=col_widths)
        info_table.setStyle(TableStyle(grid_style_cmds + spans))
        elements.append(info_table)

        # ── Problem Reported / Remarks — side by side, matching the manual slip ──
        elements.append(Spacer(1, 8))
        half = (doc.width - 10) / 2
        note_cells = [Paragraph(f"<b>Problem Reported:</b><br/>{esc(_or_dash(item.problem_reported))}", body_style)]
        if item.remarks:
            note_cells.append(Paragraph(f"<b>Remarks:</b><br/>{esc(item.remarks)}", body_style))
        else:
            note_cells.append("")
        notes_table = Table([note_cells], colWidths=[half, half])
        notes_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        elements.append(notes_table)

    else:
        # ── Batch: batch-level info grid + one row per job ────────────────────
        rows = [
            [Paragraph("Batch No", cell_bold_style), Paragraph(f"#{data.batch_no}", cell_style),
             Paragraph("Date", cell_bold_style), Paragraph(esc(data.received_date), cell_style)],
            [Paragraph("Branch", cell_bold_style), Paragraph(esc(data.branch_code), cell_style),
             Paragraph("Customer", cell_bold_style), Paragraph(esc(data.customer_name), cell_style)],
            [Paragraph("Mobile", cell_bold_style), Paragraph(esc(data.customer_mobile), cell_style),
             Paragraph("Receive Manner", cell_bold_style), Paragraph(esc(data.items[0].receive_manner_name), cell_style)],
            [Paragraph("Address", cell_bold_style), Paragraph(esc(_or_dash(data.customer_address)), cell_style),
             Paragraph("Jobs", cell_bold_style), Paragraph(str(len(data.items)), cell_style)],
        ]
        spans = []
        track_line = _build_track_line(data, None, None)
        if track_line:
            r = len(rows)
            rows.append([Paragraph(esc(track_line), track_style), "", "", ""])
            spans.append(("SPAN", (0, r), (3, r)))

        info_table = Table(rows, colWidths=col_widths)
        info_table.setStyle(TableStyle(grid_style_cmds + spans))
        elements += [info_table, Spacer(1, 10)]

        show_purchase_date = any(i.purchase_date for i in data.items)
        head = ["#", "Job No", "Product / Brand / Model", "Job Type", "Qty", "Condition", "Serial No"]
        if show_purchase_date:
            head.insert(2, "Purchase Date")
        col_count = len(head)

        job_rows: list = [head]
        job_span_cmds: list = [
            ("BACKGROUND", (0, 0), (-1, 0), _SLATE_100),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
        for idx, i in enumerate(data.items, start=1):
            job_no_cell = i.job_no + (f" (Alt: {i.alternate_job_no})" if i.alternate_job_no else "")
            row = [
                str(idx), esc(job_no_cell),
                _or_dash(" / ".join(p for p in [i.product_name, i.brand_name, i.model_name] if p)),
                i.job_type_name, str(i.qty), _or_dash(i.receive_condition_name), _or_dash(i.serial_no),
            ]
            if show_purchase_date:
                row.insert(2, _or_dash(i.purchase_date))
            job_rows.append(row)

            note_text = " | ".join(p.strip() for p in [i.problem_reported, i.remarks] if p and p.strip())
            if note_text:
                r = len(job_rows)
                job_rows.append([esc(note_text)] + [""] * (col_count - 1))
                job_span_cmds.append(("SPAN", (0, r), (col_count - 1, r)))
                job_span_cmds.append(("FONTSIZE", (0, r), (-1, r), 7))
                job_span_cmds.append(("TEXTCOLOR", (0, r), (-1, r), _SLATE_500))

        # Explicit, weighted column widths (rather than colWidths=None) so the
        # table always stretches to fill the full page width instead of shrinking
        # to its content's minimum width.
        col_weights = {
            "#": 0.035, "Job No": 0.14, "Purchase Date": 0.11,
            "Product / Brand / Model": 0.24, "Job Type": 0.12, "Qty": 0.05,
            "Condition": 0.16, "Serial No": 0.145,
        }
        weights = [col_weights[h] for h in head]
        col_widths = [doc.width * w / sum(weights) for w in weights]
        jobs_table = Table(job_rows, colWidths=col_widths, repeatRows=1)
        jobs_table.setStyle(TableStyle(job_span_cmds + [
            ("GRID", (0, 0), (-1, -1), 0.4, _BORDER),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(jobs_table)

    # ── Terms & conditions — same exact text the manual slip prints, ₹-free ───
    if data.terms_and_conditions:
        elements += [Spacer(1, 10), Paragraph(_strip_rupee(esc(data.terms_and_conditions)), terms_style)]

    # ── Signatures ─────────────────────────────────────────────────────────
    sig_table = Table(
        [["", ""], [Paragraph("Customer Signature", sig_label_style), Paragraph("Authorized Signatory", sig_label_style)]],
        colWidths=[doc.width / 2, doc.width / 2],
        rowHeights=[26, None],
    )
    sig_table.setStyle(TableStyle([
        ("LINEABOVE", (0, 1), (0, 1), 0.7, _BORDER),
        ("LINEABOVE", (1, 1), (1, 1), 0.7, _BORDER),
        ("TOPPADDING", (0, 1), (-1, 1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (1, 0), (1, -1), 0),
    ]))
    elements += [Spacer(1, 16), sig_table]

    generated_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    elements += [
        Spacer(1, 12),
        Paragraph(f"This is a system-generated document — generated {generated_at}.", footer_style),
    ]

    doc.build(elements)
    return buffer.getvalue()


@router.get(
    "/{token}",
    dependencies=[Depends(rate_limit("job-intake", limit=60, window_seconds=60))],
)
async def get_job_intake_status(token: str) -> HTMLResponse:
    data = await _load_job_intake(token)
    if data is None:
        return HTMLResponse(content=_invalid_token_html(), status_code=status.HTTP_404_NOT_FOUND)
    return HTMLResponse(content=_build_status_page_html(data, pdf_url=f"/job-intake/pdf/{token}"))


@router.get(
    "/pdf/{token}",
    dependencies=[Depends(rate_limit("job-intake-pdf", limit=30, window_seconds=60))],
)
async def get_job_intake_pdf(token: str) -> Response:
    data = await _load_job_intake(token)
    if data is None:
        return HTMLResponse(content=_invalid_token_html(), status_code=status.HTTP_404_NOT_FOUND)

    ref = data.job_no or f"batch-{data.batch_no}"
    return Response(
        content=_build_pdf(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="job-slip-{ref}.pdf"'},
    )
