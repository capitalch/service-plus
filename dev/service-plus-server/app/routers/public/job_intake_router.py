"""Job Intake Notice — public status page + on-demand job-slip PDF.

Unlike app/routers/public/website_router.py (gated by X-Website-Key, JSON via
Pydantic response_models), this router's only credential is the signed token
itself (app/whatsapp/token.py) and it returns HTML/PDF bytes directly — no
frontend consuming a JSON response. Mounted with no /api prefix so the
printed/messaged URL reads as a page, not an API call. See plans/plan-whatsapp.md
("Step 4") for the full design.
"""

import html
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
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

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
    on the manual slip today."""

    batch_no: int | None
    job_no: str | None
    bu_name: str
    branch_name: str
    branch_address: str
    branch_phone: str | None
    branch_email: str | None
    branch_gstin: str | None
    customer_name: str
    customer_mobile: str
    customer_address: str | None
    received_date: str
    amount_payable: float
    terms_and_conditions: str | None
    items: list[_JobIntakeItem]


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
        branch_name=rows[0]["branch_name"],
        branch_address=rows[0]["branch_address"] or "",
        branch_phone=rows[0]["branch_phone"],
        branch_email=rows[0]["branch_email"],
        branch_gstin=rows[0]["branch_gstin"],
        customer_name=rows[0]["customer_name"],
        customer_mobile=rows[0]["customer_mobile"],
        customer_address=rows[0]["address_snapshot"],
        received_date=job_date.strftime("%d %b %Y") if job_date else "—",
        amount_payable=amount_payable,
        terms_and_conditions=terms_and_conditions,
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


_BRAND_BLUE = colors.HexColor("#2563eb")
_BRAND_BLUE_DARK = colors.HexColor("#1e3a8a")
_SLATE_500 = colors.HexColor("#64748b")
_SLATE_100 = colors.HexColor("#f1f5f9")
_BORDER = colors.HexColor("#dbe3ee")


def _build_pdf(data: _JobIntakeData) -> bytes:
    """Server-side, pure-Python — reportlab, no native dependencies. This is a
    legal document, not just a convenience download — it's expected to carry the
    same information the manual, staff-printed job slip does (same standard staff
    hands a customer at drop-off), not a trimmed-down summary. Per-item detail
    (problem reported, remarks, job type, condition, warranty, purchase date) is
    rendered as a card per item rather than dense table columns, since several of
    those fields are free text that a narrow table column can't hold — reportlab's
    KeepTogether keeps one item's whole block from splitting across a page break.
    Still fed only by the whitelisted public fields in _JobIntakeData/
    _JobIntakeItem, never the internal JobDetailType/JobInfoReport the client-side
    builders take — no cost price, technician, diagnosis, or payment history, none
    of which belongs on an intake-time document anyway."""
    esc = html.escape
    ref_label, ref_value = ("Batch No", str(data.batch_no)) if data.batch_no is not None else ("Job No", data.job_no or "")

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=20 * mm, rightMargin=20 * mm,
        title=f"Job Intake Slip — {ref_label} {ref_value} — {data.bu_name}",
    )

    # reportlab's ParagraphStyle defaults `leading` to a flat 12pt regardless of
    # `fontSize` when built from scratch (not inherited from a stylesheet base) —
    # left alone, an 18pt title's own line height is shorter than the glyphs are
    # tall, so it visually collides with whatever paragraph comes right after it.
    # Every custom style below sets `leading` explicitly for this reason.
    bu_style = ParagraphStyle(
        "BU", fontName="Helvetica-Bold", fontSize=18, leading=22, alignment=TA_CENTER,
        textColor=_BRAND_BLUE_DARK, spaceAfter=2,
    )
    branch_line_style = ParagraphStyle(
        "BranchLine", fontName="Helvetica", fontSize=9.5, leading=13, alignment=TA_CENTER, textColor=_SLATE_500,
    )
    contact_line_style = ParagraphStyle(
        "ContactLine", fontName="Helvetica", fontSize=8.5, leading=11, alignment=TA_CENTER, textColor=_SLATE_500,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", fontName="Helvetica", fontSize=10, leading=13, alignment=TA_CENTER, textColor=_SLATE_500,
        spaceBefore=6,
    )
    intro_style = ParagraphStyle(
        "Intro", fontName="Helvetica", fontSize=10, leading=15, textColor=colors.HexColor("#1e293b"),
    )
    section_style = ParagraphStyle("Section", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=_SLATE_500, spaceAfter=6)
    cell_style = ParagraphStyle("Cell", fontName="Helvetica", fontSize=9.5, leading=13)
    cell_bold_style = ParagraphStyle("CellBold", parent=cell_style, fontName="Helvetica-Bold")
    footer_style = ParagraphStyle("Footer", fontName="Helvetica", fontSize=8, leading=11, alignment=TA_CENTER, textColor=_SLATE_500)
    item_title_style = ParagraphStyle("ItemTitle", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=_BRAND_BLUE_DARK)
    item_line_style = ParagraphStyle("ItemLine", fontName="Helvetica", fontSize=9, leading=13, textColor=colors.HexColor("#334155"))
    item_note_style = ParagraphStyle("ItemNote", fontName="Helvetica", fontSize=9, leading=13, textColor=colors.HexColor("#1e293b"))
    terms_style = ParagraphStyle("Terms", fontName="Helvetica", fontSize=7.5, leading=11, textColor=_SLATE_500)
    sig_label_style = ParagraphStyle("SigLabel", fontName="Helvetica", fontSize=8.5, leading=11, alignment=TA_CENTER, textColor=_SLATE_500)

    item_word = "item" if len(data.items) == 1 else "items"
    branch_line = f"{data.branch_name} · {data.branch_address}" if data.branch_address else data.branch_name
    contact_parts = [
        p for p in [data.branch_phone, data.branch_email, f"GSTIN: {data.branch_gstin}" if data.branch_gstin else None] if p
    ]

    elements: list = [
        Paragraph(esc(data.bu_name), bu_style),
        Paragraph(esc(branch_line), branch_line_style),
    ]
    if contact_parts:
        elements.append(Paragraph(esc(" · ".join(contact_parts)), contact_line_style))
    elements += [
        Paragraph("JOB INTAKE SLIP", subtitle_style),
        Spacer(1, 16),
        Paragraph(
            f"This confirms that {len(data.items)} {item_word} listed below "
            f"{'has' if len(data.items) == 1 else 'have'} been received by "
            f"<b>{esc(data.branch_name)}</b> for service.",
            intro_style,
        ),
        Spacer(1, 14),
    ]

    info_rows = [
        [Paragraph(ref_label, cell_bold_style), Paragraph(esc(ref_value), cell_style)],
        [Paragraph("Date Received", cell_bold_style), Paragraph(esc(data.received_date), cell_style)],
        [Paragraph("Customer", cell_bold_style), Paragraph(esc(data.customer_name), cell_style)],
        [Paragraph("Mobile", cell_bold_style), Paragraph(esc(data.customer_mobile), cell_style)],
    ]
    if data.customer_address:
        info_rows.append([Paragraph("Address", cell_bold_style), Paragraph(esc(data.customer_address), cell_style)])

    info_table = Table(info_rows, colWidths=[100, None])
    info_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), _SLATE_100),
                ("GRID", (0, 0), (-1, -1), 0.6, _BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    elements += [info_table, Spacer(1, 20), Paragraph("ITEMS RECEIVED", section_style)]

    for idx, item in enumerate(data.items, start=1):
        title = f"{idx}. {esc(item.job_no)}"
        if item.alternate_job_no:
            title += f"  (Alt: {esc(item.alternate_job_no)})"
        block: list = [Paragraph(title, item_title_style)]
        if item.device:
            block.append(Paragraph(esc(item.device), item_line_style))

        meta_parts = [f"Job Type: {item.job_type_name}", f"Qty: {item.qty}", f"Received Via: {item.receive_manner_name}"]
        if item.receive_condition_name:
            meta_parts.append(f"Condition: {item.receive_condition_name}")
        if item.warranty_card_no:
            meta_parts.append(f"Warranty Card: {item.warranty_card_no}")
        block.append(Paragraph(esc(" · ".join(meta_parts)), item_line_style))

        if item.purchase_date:
            block.append(Paragraph(esc(f"Purchase Date: {item.purchase_date}"), item_line_style))
        if item.problem_reported:
            block.append(Paragraph(f"<b>Problem Reported:</b> {esc(item.problem_reported)}", item_note_style))
        if item.remarks:
            block.append(Paragraph(f"<b>Remarks:</b> {esc(item.remarks)}", item_note_style))

        block.append(Spacer(1, 8))
        if idx < len(data.items):
            block += [HRFlowable(width="100%", thickness=0.5, color=_BORDER), Spacer(1, 8)]
        elements.append(KeepTogether(block))

    if data.terms_and_conditions:
        elements += [
            Spacer(1, 18),
            Paragraph("TERMS &amp; CONDITIONS", section_style),
            Paragraph(esc(data.terms_and_conditions), terms_style),
        ]

    signature_table = Table(
        [
            ["", ""],
            [Paragraph("Customer Signature", sig_label_style), Paragraph("Authorized Signatory", sig_label_style)],
        ],
        colWidths=[None, None],
        rowHeights=[34, None],
    )
    signature_table.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, 1), (0, 1), 0.7, _BORDER),
                ("LINEABOVE", (1, 1), (1, 1), 0.7, _BORDER),
                ("TOPPADDING", (0, 1), (-1, 1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 24),
                ("RIGHTPADDING", (0, 0), (-1, -1), 24),
            ]
        )
    )
    elements += [Spacer(1, 28), signature_table]

    generated_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    elements += [
        Spacer(1, 20),
        HRFlowable(width="100%", thickness=0.6, color=_BORDER, spaceAfter=8),
        Paragraph("Please retain this slip for your reference.", footer_style),
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
