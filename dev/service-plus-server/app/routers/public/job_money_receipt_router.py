"""Money Receipt — public, token-gated PDF download (plans/plan.md).

WhatsApp-triggered "Download Money Receipt" button, one specific `job_payment`
row per link — never a job's full payment history (a job can have several
receipts; this route serves exactly one). PDF-only, same credential model as
job_intake_router.py/job_delivery_router.py — a signed `sign_receipt` token
alone, no login — same rate-limiting pattern, no template engine, inline
reportlab construction. Layout mirrors the client's own `buildReceiptPdf`
(deliver-job-pdf.ts), confirmed against a real manual receipt sample
(plans/plan.md), reimplemented fresh from whitelisted public fields rather
than shared/ported, same "don't share code across languages/apps" reasoning
job_intake_router.py's docstring already gives for job-sheet-pdf.ts.
"""

import html
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from typing import NoReturn

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.rate_limit import rate_limit
from app.db.connection.psycopg_driver import exec_sql_query
from app.db.sql.sql_public import PublicSql
from app.whatsapp.token import verify_receipt

router = APIRouter(prefix="/job-money-receipt", tags=["job-money-receipt"])


def _raise_invalid_token() -> NoReturn:
    """No styled HTML page here (see module docstring) — a plain, non-leaky 404
    is enough for a download link that failed to resolve. FastAPI renders this
    as {"detail": "..."}."""
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This link is invalid or has expired.")


_SLATE_500 = colors.HexColor("#64748b")
_SLATE_100 = colors.HexColor("#f1f5f9")
_BORDER = colors.HexColor("#dbe3ee")
_INK = colors.HexColor("#141414")

_RECEIPT_DISCLAIMER = (
    "Received the amounts stated above on the specified dates against their respective "
    "reference numbers. Cheque receipts are subject to realization."
)


def _format_amount(value: float) -> str:
    """`"Rs. "`, not `"₹"`: reportlab's core Helvetica font has no glyph for
    U+20B9 (Indian Rupee Sign), so it silently renders as a solid black box
    instead of failing loudly — same fix already applied in
    job_delivery_router.py's own `_format_amount`."""
    return f"Rs. {value:,.2f}"


def _or_dash(value: str | None) -> str:
    return value if value else "—"


@dataclass(frozen=True)
class _ReceiptData:
    receipt_no: str | None
    payment_date: str
    payment_mode: str
    amount: float
    reference_no: str | None
    remarks: str | None
    job_no: str
    alternate_job_no: str | None
    job_date: str
    branch_name: str
    division_name: str | None
    division_phone: str | None
    division_email: str | None
    division_gstin: str | None
    division_address: str | None
    customer_name: str
    customer_mobile: str | None
    customer_address: str | None


async def _load_receipt_data(token: str) -> _ReceiptData | None:
    decoded = verify_receipt(token)
    if decoded is None:
        return None
    db_name, schema, job_id, payment_id = decoded

    rows = await exec_sql_query(
        db_name=db_name, schema=schema, sql=PublicSql.GET_JOB_PAYMENT_FOR_WHATSAPP_RECEIPT,
        sql_args={"job_id": job_id, "payment_id": payment_id},
    )
    if not rows:
        return None
    r = rows[0]

    return _ReceiptData(
        receipt_no=r["receipt_no"],
        payment_date=r["payment_date"].strftime("%Y-%m-%d") if hasattr(r["payment_date"], "strftime") else str(r["payment_date"]),
        payment_mode=r["payment_mode"],
        amount=float(r["amount"]),
        reference_no=r["reference_no"],
        remarks=r["remarks"],
        job_no=r["job_no"],
        alternate_job_no=r["alternate_job_no"],
        job_date=r["job_date"].strftime("%Y-%m-%d") if hasattr(r["job_date"], "strftime") else str(r["job_date"]),
        branch_name=r["branch_name"],
        division_name=r["division_name"],
        division_phone=r["division_phone"],
        division_email=r["division_email"],
        division_gstin=r["division_gstin"],
        division_address=r["division_address"] or None,
        customer_name=r["customer_name"],
        customer_mobile=r["customer_mobile"],
        customer_address=r["customer_address"] or None,
    )


def _build_receipt_pdf(data: _ReceiptData) -> bytes:
    """Single copy, not the client's two-up (top/bottom half) print layout —
    a WhatsApp download is one document, not something torn in half at a
    counter. Layout mirrors `buildReceiptPdf`'s confirmed field order:
    division header, "PAYMENT RECEIPT" title, Job No/Rcpt No/Job Date left,
    Customer block right, one-row payment table, disclaimer, Authorised
    Signatory."""
    esc = html.escape

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=20 * mm, rightMargin=20 * mm,
        title=f"Money Receipt — {data.receipt_no or data.job_no}",
    )

    bu_style = ParagraphStyle(
        "BU", fontName="Helvetica-Bold", fontSize=14, leading=17, alignment=TA_CENTER, textColor=_INK, spaceAfter=2,
    )
    branch_line_style = ParagraphStyle(
        "BranchLine", fontName="Helvetica", fontSize=9, leading=12, alignment=TA_CENTER, textColor=_SLATE_500,
    )
    gstin_style = ParagraphStyle(
        "Gstin", fontName="Helvetica-Bold", fontSize=9, leading=12, alignment=TA_CENTER, textColor=_SLATE_500,
    )
    title_style = ParagraphStyle(
        "Title", fontName="Helvetica-Bold", fontSize=12, leading=15, alignment=TA_CENTER, spaceBefore=8, spaceAfter=8,
    )
    cell_style = ParagraphStyle("Cell", fontName="Helvetica", fontSize=9.5, leading=13)
    cell_bold_style = ParagraphStyle("CellBold", parent=cell_style, fontName="Helvetica-Bold")
    section_label_style = ParagraphStyle("SectionLabel", fontName="Helvetica-Bold", fontSize=9, leading=12)
    disclaimer_style = ParagraphStyle("Disclaimer", fontName="Helvetica-Oblique", fontSize=7.5, leading=9.5, textColor=_SLATE_500)
    sig_style = ParagraphStyle("Sig", fontName="Helvetica-Bold", fontSize=9.5, leading=12, alignment=TA_RIGHT)
    footer_style = ParagraphStyle("Footer", fontName="Helvetica", fontSize=8, leading=11, alignment=TA_CENTER, textColor=_SLATE_500)

    elements: list = []

    # ── Header: division name/address/GSTIN ──────────────────────────────────
    header_name = data.division_name or data.branch_name
    elements.append(Paragraph(esc(header_name.upper()), bu_style))
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
        elements.append(Paragraph(esc(f"GSTIN: {data.division_gstin}"), gstin_style))

    elements.append(HRFlowable(width="100%", thickness=0.6, color=_INK, spaceBefore=6))
    elements.append(Paragraph("PAYMENT RECEIPT", title_style))
    elements.append(HRFlowable(width="100%", thickness=0.6, color=_INK, spaceAfter=10))

    # ── Job No/Rcpt No/Job Date (left) | Customer (right) ────────────────────
    job_no_html = esc(data.job_no)
    if data.alternate_job_no:
        job_no_html += f" / {esc(data.alternate_job_no)}"

    left_rows = [
        [Paragraph("Job No:", cell_bold_style), Paragraph(job_no_html, cell_style)],
        [Paragraph("Rcpt No:", cell_bold_style), Paragraph(esc(_or_dash(data.receipt_no)), cell_style)],
        [Paragraph("Job Date:", cell_bold_style), Paragraph(esc(data.job_date), cell_style)],
    ]
    left_table = Table(left_rows, colWidths=[26 * mm, None])
    left_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    cust_lines = [Paragraph("Customer:", section_label_style), Paragraph(esc(data.customer_name), cell_bold_style)]
    if data.customer_address:
        cust_lines.append(Paragraph(esc(data.customer_address), cell_style))
    if data.customer_mobile:
        cust_lines.append(Paragraph(f"Ph: {esc(data.customer_mobile)}", cell_style))

    info_table = Table([[left_table, cust_lines]], colWidths=[doc.width / 2, doc.width / 2])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements += [info_table, Spacer(1, 14)]

    # ── One-row payment table ─────────────────────────────────────────────────
    table_data = [
        [
            Paragraph("Rcpt No", cell_bold_style), Paragraph("Date", cell_bold_style),
            Paragraph("Mode", cell_bold_style), Paragraph("Amount", cell_bold_style),
            Paragraph("Ref No", cell_bold_style), Paragraph("Remarks", cell_bold_style),
        ],
        [
            Paragraph(esc(_or_dash(data.receipt_no)), cell_style), Paragraph(esc(data.payment_date), cell_style),
            Paragraph(esc(data.payment_mode), cell_style), Paragraph(_format_amount(data.amount), cell_style),
            Paragraph(esc(_or_dash(data.reference_no)), cell_style), Paragraph(esc(_or_dash(data.remarks)), cell_style),
        ],
    ]
    payment_table = Table(table_data, colWidths=[60, 68, 50, 68, None, None])
    payment_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), _SLATE_100),
        ("GRID", (0, 0), (-1, -1), 0.6, _BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements += [payment_table, Spacer(1, 14)]

    # ── Disclaimer + signature ────────────────────────────────────────────────
    elements += [
        Paragraph(_RECEIPT_DISCLAIMER, disclaimer_style),
        Spacer(1, 18),
        Paragraph("Authorised Signatory", sig_style),
    ]

    generated_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    elements += [
        Spacer(1, 20),
        HRFlowable(width="100%", thickness=0.6, color=_BORDER, spaceAfter=8),
        Paragraph("Please retain this receipt for your reference.", footer_style),
        Paragraph(f"This is a system-generated document — generated {generated_at}.", footer_style),
    ]

    doc.build(elements)
    return buffer.getvalue()


@router.get(
    "/pdf/{token}",
    dependencies=[Depends(rate_limit("job-money-receipt-pdf", limit=30, window_seconds=60))],
)
async def get_job_money_receipt_pdf(token: str) -> Response:
    data = await _load_receipt_data(token)
    if data is None:
        _raise_invalid_token()

    ref = data.receipt_no or data.job_no
    return Response(
        content=_build_receipt_pdf(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="money-receipt-{ref}.pdf"'},
    )
