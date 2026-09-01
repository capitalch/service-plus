"""Job Delivery — public, token-gated PDF downloads (plans/plan.md).

Unlike app/routers/public/job_intake_router.py, this router is deliberately
PDF-only — there is no customer-facing HTML confirmation page here at all.
Proof of delivery is a one-time code read aloud to staff and verified inside
the authenticated app (GraphQL `verifyJobDeliveryOtp`/
`setJobDeliveryManualConfirmation`), not a tap-through web page, so this
router only needs to serve the two documents the WhatsApp message links to:
a Delivery Note (itemized job list, one row per delivered job) and an
Invoice (the formal line-item bill). Same credential model as
job_intake_router.py — the signed token alone, no login — same rate-limiting
pattern, no template engine, inline reportlab construction.
"""

import html
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from typing import NoReturn

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
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

router = APIRouter(prefix="/job-delivery", tags=["job-delivery"])


def _raise_invalid_token() -> NoReturn:
    """No styled HTML page here (see module docstring) — a plain, non-leaky 404
    is enough for a download link that failed to resolve. FastAPI renders this
    as {"detail": "..."}."""
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This link is invalid or has expired.")


# ─── Delivery Note ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class _DeliveryItem:
    job_no: str
    device: str | None
    serial_no: str | None
    batch_no: int | None  # this job's own originating intake batch, if any — never a shared group value


@dataclass(frozen=True)
class _DeliveryData:
    bu_name: str
    branch_name: str
    branch_address: str
    customer_name: str
    total_amount: float
    total_paid: float
    items: list[_DeliveryItem]


async def _load_delivery_data(token: str) -> _DeliveryData | None:
    decoded = verify(token)
    if decoded is None:
        return None
    db_name, schema, job_ids = decoded

    rows = await exec_sql_query(
        db_name=db_name, schema=schema, sql=PublicSql.GET_JOB_DELIVERY_STATUS,
        sql_args={"job_ids": job_ids},
    )
    if not rows:
        return None

    bu_rows = await exec_sql_query(
        db_name=db_name, schema="security", sql=PublicSql.GET_BU_NAME_BY_CODE,
        sql_args={"schema": schema},
    )
    bu_name = bu_rows[0]["name"] if bu_rows else schema

    items = [
        _DeliveryItem(job_no=r["job_no"], device=r["device"], serial_no=r["serial_no"], batch_no=r["batch_no"])
        for r in rows
    ]
    return _DeliveryData(
        bu_name=bu_name,
        branch_name=rows[0]["branch_name"],
        branch_address=rows[0]["branch_address"] or "",
        customer_name=rows[0]["customer_name"],
        total_amount=sum(float(r["amount"]) for r in rows),
        total_paid=sum(float(r["paid_amount"]) for r in rows),
        items=items,
    )


_BRAND_BLUE = colors.HexColor("#2563eb")
_BRAND_BLUE_DARK = colors.HexColor("#1e3a8a")
_SLATE_500 = colors.HexColor("#64748b")
_SLATE_100 = colors.HexColor("#f1f5f9")
_BORDER = colors.HexColor("#dbe3ee")


def _format_amount(value: float) -> str:
    """`"No charge"` for zero, same pattern app/whatsapp/sender.py's
    `_format_amount` already established for the WhatsApp message text — the two
    should never disagree on how a zero-amount job reads. `"Rs. "`, not `"₹"`:
    reportlab's core Helvetica font has no glyph for U+20B9 (Indian Rupee Sign,
    added to Unicode in 2010 — well outside any legacy 8-bit PDF font encoding),
    so it silently renders as a solid black box instead of failing loudly.
    Confirmed by rendering a real PDF, not assumed — the HTML status page
    elsewhere in this feature uses "&#8377;" instead, since a browser's font
    stack has no such gap."""
    if value == 0:
        return "No charge"
    return f"Rs. {value:,.2f}"


def _build_delivery_note_pdf(data: _DeliveryData) -> bytes:
    """One row per delivered job — job no, device, serial no, and which intake
    batch (if any) it came from — regardless of how many distinct intake
    batches or individually-created jobs are mixed into this one delivery.
    Deliberately not a port of the client's jsPDF buildDeliveryNotePdf: this
    version is fed only by whitelisted public fields, and gives serial number
    its own labeled column instead of burying it in a concatenated string —
    see app/routers/public/job_intake_router.py's docstring for the same
    "don't share code across languages/apps" reasoning, and plans/plan.md's
    "What already exists" for the specific gap in the paper original this
    fixes."""
    esc = html.escape
    balance = data.total_amount - data.total_paid

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=20 * mm, rightMargin=20 * mm,
        title=f"Delivery Note — {data.customer_name}",
    )

    bu_style = ParagraphStyle(
        "BU", fontName="Helvetica-Bold", fontSize=18, leading=22, alignment=TA_CENTER,
        textColor=_BRAND_BLUE_DARK, spaceAfter=2,
    )
    branch_line_style = ParagraphStyle(
        "BranchLine", fontName="Helvetica", fontSize=9.5, leading=13, alignment=TA_CENTER, textColor=_SLATE_500,
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

    item_word = "item" if len(data.items) == 1 else "items"
    branch_line = f"{data.branch_name} · {data.branch_address}" if data.branch_address else data.branch_name

    elements: list = [
        Paragraph(esc(data.bu_name), bu_style),
        Paragraph(esc(branch_line), branch_line_style),
        Paragraph("DELIVERY NOTE", subtitle_style),
        Spacer(1, 16),
        Paragraph(
            f"This confirms that {len(data.items)} {item_word} listed below "
            f"{'has' if len(data.items) == 1 else 'have'} been delivered to "
            f"<b>{esc(data.customer_name)}</b>.",
            intro_style,
        ),
        Spacer(1, 14),
    ]

    info_table = Table(
        [
            [Paragraph("Customer", cell_bold_style), Paragraph(esc(data.customer_name), cell_style)],
            [Paragraph("Amount", cell_bold_style), Paragraph(esc(_format_amount(data.total_amount)), cell_style)],
            [Paragraph("Paid", cell_bold_style), Paragraph(esc(_format_amount(data.total_paid)), cell_style)],
            [Paragraph("Balance", cell_bold_style), Paragraph(esc(_format_amount(balance)), cell_style)],
        ],
        colWidths=[100, None],
    )
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
    elements += [info_table, Spacer(1, 20), Paragraph("ITEMS DELIVERED", section_style)]

    table_data = [
        [
            Paragraph("#", cell_bold_style),
            Paragraph("Job No", cell_bold_style),
            Paragraph("Device", cell_bold_style),
            Paragraph("Serial No", cell_bold_style),
            Paragraph("Batch", cell_bold_style),
        ]
    ]
    for idx, item in enumerate(data.items, start=1):
        table_data.append(
            [
                Paragraph(str(idx), cell_style),
                Paragraph(esc(item.job_no), cell_style),
                Paragraph(esc(item.device or "—"), cell_style),
                Paragraph(esc(item.serial_no or "—"), cell_style),
                Paragraph(str(item.batch_no) if item.batch_no is not None else "—", cell_style),
            ]
        )
    items_table = Table(table_data, colWidths=[22, 62, None, 92, 48], repeatRows=1)
    items_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), _BRAND_BLUE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.6, _BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _SLATE_100]),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                # Narrower padding + centered text on "#" (idx 0), "Serial No"
                # (idx 3), and "Batch" (idx 4) — each column's own header/value is
                # short/dense enough (e.g. "RZ8N40ABCDE", "Batch") that the
                # default 8pt padding each side left too little room and wrapped.
                ("LEFTPADDING", (0, 0), (0, -1), 4),
                ("RIGHTPADDING", (0, 0), (0, -1), 4),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("LEFTPADDING", (4, 0), (4, -1), 4),
                ("RIGHTPADDING", (4, 0), (4, -1), 4),
                ("ALIGN", (4, 0), (4, -1), "CENTER"),
                ("LEFTPADDING", (3, 0), (3, -1), 4),
                ("RIGHTPADDING", (3, 0), (3, -1), 4),
            ]
        )
    )
    elements.append(items_table)

    generated_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    elements += [
        Spacer(1, 24),
        HRFlowable(width="100%", thickness=0.6, color=_BORDER, spaceAfter=8),
        Paragraph("Please retain this note for your reference.", footer_style),
        Paragraph(f"This is a system-generated document — generated {generated_at}.", footer_style),
    ]

    doc.build(elements)
    return buffer.getvalue()


# ─── Invoice ────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class _InvoiceLine:
    description: str | None
    hsn_code: str | None
    qty: float | None
    price: float | None
    gst_rate: float | None
    line_amount: float | None


@dataclass(frozen=True)
class _InvoiceJob:
    job_no: str
    invoice_no: str | None
    invoice_date: str | None
    invoice_cgst: float
    invoice_sgst: float
    invoice_igst: float
    invoice_total: float | None
    paid_amount: float
    lines: list[_InvoiceLine]


@dataclass(frozen=True)
class _InvoiceData:
    bu_name: str
    jobs: list[_InvoiceJob]


async def _load_invoice_data(token: str) -> _InvoiceData | None:
    decoded = verify(token)
    if decoded is None:
        return None
    db_name, schema, job_ids = decoded

    rows = await exec_sql_query(
        db_name=db_name, schema=schema, sql=PublicSql.GET_JOB_DELIVERY_INVOICE_DETAIL,
        sql_args={"job_ids": job_ids},
    )
    if not rows:
        return None

    bu_rows = await exec_sql_query(
        db_name=db_name, schema="security", sql=PublicSql.GET_BU_NAME_BY_CODE,
        sql_args={"schema": schema},
    )
    bu_name = bu_rows[0]["name"] if bu_rows else schema

    order: list[int] = []
    headers: dict[int, dict] = {}
    lines_by_job: dict[int, list[_InvoiceLine]] = {}
    for r in rows:
        job_id = r["job_id"]
        if job_id not in headers:
            order.append(job_id)
            headers[job_id] = r
            lines_by_job[job_id] = []
        if r["description"]:
            lines_by_job[job_id].append(
                _InvoiceLine(
                    description=r["description"],
                    hsn_code=r["hsn_code"],
                    qty=float(r["qty"]) if r["qty"] is not None else None,
                    price=float(r["price"]) if r["price"] is not None else None,
                    gst_rate=float(r["gst_rate"]) if r["gst_rate"] is not None else None,
                    line_amount=float(r["line_amount"]) if r["line_amount"] is not None else None,
                )
            )

    jobs = [
        _InvoiceJob(
            job_no=headers[jid]["job_no"],
            invoice_no=headers[jid]["invoice_no"],
            invoice_date=headers[jid]["invoice_date"].strftime("%d %b %Y") if headers[jid]["invoice_date"] else None,
            invoice_cgst=float(headers[jid]["invoice_cgst"] or 0),
            invoice_sgst=float(headers[jid]["invoice_sgst"] or 0),
            invoice_igst=float(headers[jid]["invoice_igst"] or 0),
            invoice_total=float(headers[jid]["invoice_total"]) if headers[jid]["invoice_total"] is not None else None,
            paid_amount=float(headers[jid]["paid_amount"] or 0),
            lines=lines_by_job[jid],
        )
        for jid in order
    ]
    return _InvoiceData(bu_name=bu_name, jobs=jobs)


def _build_invoice_pdf(data: _InvoiceData) -> bytes:
    """The formal line-item bill — parts/service charges with GST rate/HSN each,
    per job, plus a grand total across the whole delivery. A job with no
    invoice yet (LEFT JOIN in GET_JOB_DELIVERY_INVOICE_DETAIL) still gets a
    section, just with no line items and "No charge" in place of a total —
    never silently dropped. Reimplemented fresh in reportlab from whitelisted
    public fields, not a port of the client's jsPDF buildInvoicePdf/
    buildPackedInvoicePdf, same reasoning job_intake_router.py's docstring
    already gives for job-sheet-pdf.ts."""
    esc = html.escape

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=20 * mm, rightMargin=20 * mm,
        title=f"Invoice — {data.bu_name}",
    )

    bu_style = ParagraphStyle(
        "BU", fontName="Helvetica-Bold", fontSize=18, leading=22, alignment=TA_CENTER,
        textColor=_BRAND_BLUE_DARK, spaceAfter=2,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", fontName="Helvetica", fontSize=10, leading=13, alignment=TA_CENTER, textColor=_SLATE_500,
        spaceBefore=6,
    )
    job_title_style = ParagraphStyle("JobTitle", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=_BRAND_BLUE_DARK)
    job_meta_style = ParagraphStyle("JobMeta", fontName="Helvetica", fontSize=9, leading=13, textColor=_SLATE_500)
    cell_style = ParagraphStyle("Cell", fontName="Helvetica", fontSize=9, leading=12)
    cell_bold_style = ParagraphStyle("CellBold", parent=cell_style, fontName="Helvetica-Bold")
    summary_style = ParagraphStyle("Summary", fontName="Helvetica", fontSize=9.5, leading=13, alignment=TA_CENTER, textColor=colors.HexColor("#1e293b"))
    footer_style = ParagraphStyle("Footer", fontName="Helvetica", fontSize=8, leading=11, alignment=TA_CENTER, textColor=_SLATE_500)

    elements: list = [
        Paragraph(esc(data.bu_name), bu_style),
        Paragraph("INVOICE", subtitle_style),
        Spacer(1, 16),
    ]

    grand_total = 0.0
    grand_paid = 0.0

    for job in data.jobs:
        block: list = []
        title = f"Job No: {job.job_no}"
        if job.invoice_no:
            title += f"  —  Invoice No: {job.invoice_no}"
        if job.invoice_date:
            title += f" ({job.invoice_date})"
        block.append(Paragraph(esc(title), job_title_style))
        block.append(Spacer(1, 6))

        if job.lines:
            table_data = [
                [
                    Paragraph("Description", cell_bold_style),
                    Paragraph("HSN", cell_bold_style),
                    Paragraph("Qty", cell_bold_style),
                    Paragraph("Price", cell_bold_style),
                    Paragraph("GST%", cell_bold_style),
                    Paragraph("Amount", cell_bold_style),
                ]
            ]
            for line in job.lines:
                table_data.append(
                    [
                        Paragraph(esc(line.description or "—"), cell_style),
                        Paragraph(esc(line.hsn_code or "—"), cell_style),
                        Paragraph(f"{line.qty:g}" if line.qty is not None else "—", cell_style),
                        Paragraph(_format_amount(line.price) if line.price is not None else "—", cell_style),
                        Paragraph(f"{line.gst_rate:g}%" if line.gst_rate is not None else "—", cell_style),
                        Paragraph(_format_amount(line.line_amount) if line.line_amount is not None else "—", cell_style),
                    ]
                )
            lines_table = Table(table_data, colWidths=[None, 55, 35, 65, 45, 65])
            lines_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), _BRAND_BLUE),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.6, _BORDER),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _SLATE_100]),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            block.append(lines_table)
        else:
            block.append(Paragraph(esc("No invoice line items on file."), job_meta_style))

        job_total = job.invoice_total if job.invoice_total is not None else 0.0
        job_balance = job_total - job.paid_amount
        block.append(Spacer(1, 6))
        block.append(
            Paragraph(
                f"CGST: {_format_amount(job.invoice_cgst)} · SGST: {_format_amount(job.invoice_sgst)} · "
                f"IGST: {_format_amount(job.invoice_igst)} · <b>Total: {_format_amount(job_total)}</b> · "
                f"Paid: {_format_amount(job.paid_amount)} · <b>Balance: {_format_amount(job_balance)}</b>",
                job_meta_style,
            )
        )
        block.append(Spacer(1, 10))
        block.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER))
        block.append(Spacer(1, 10))
        elements.append(KeepTogether(block))

        grand_total += job_total
        grand_paid += job.paid_amount

    if len(data.jobs) > 1:
        elements.append(
            Paragraph(
                f"Grand Total: {_format_amount(grand_total)}  —  "
                f"Paid: {_format_amount(grand_paid)}  —  "
                f"Balance: {_format_amount(grand_total - grand_paid)}",
                summary_style,
            )
        )
        elements.append(Spacer(1, 14))

    generated_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    elements += [
        Paragraph("Please retain this invoice for your reference.", footer_style),
        Paragraph(f"This is a system-generated document — generated {generated_at}.", footer_style),
    ]

    doc.build(elements)
    return buffer.getvalue()


# ─── Routes ─────────────────────────────────────────────────────────────────────


@router.get(
    "/pdf/{token}",
    dependencies=[Depends(rate_limit("job-delivery-pdf", limit=30, window_seconds=60))],
)
async def get_job_delivery_pdf(token: str) -> Response:
    data = await _load_delivery_data(token)
    if data is None:
        _raise_invalid_token()

    ref = data.items[0].job_no if len(data.items) == 1 else f"{len(data.items)}-items"
    return Response(
        content=_build_delivery_note_pdf(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="delivery-note-{ref}.pdf"'},
    )


@router.get(
    "/invoice/{token}",
    dependencies=[Depends(rate_limit("job-delivery-invoice", limit=30, window_seconds=60))],
)
async def get_job_delivery_invoice_pdf(token: str) -> Response:
    data = await _load_invoice_data(token)
    if data is None:
        _raise_invalid_token()

    ref = data.jobs[0].job_no if len(data.jobs) == 1 else f"{len(data.jobs)}-items"
    return Response(
        content=_build_invoice_pdf(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="invoice-{ref}.pdf"'},
    )
