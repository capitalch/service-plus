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
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
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
                ("BACKGROUND", (0, 0), (-1, 0), _SLATE_100),
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
# Deliberately redesigned (was a plain per-job bullet list) to match the manual,
# staff-triggered Tax Invoice/receipt format field-for-field — deliver-job-pdf.ts's
# drawInvoiceContent (jsPDF+autoTable), the exact same document staff already hand
# customers in person — so a customer who downloads this from WhatsApp sees the
# identical layout: division letterhead, Customer Details/Shipping Address,
# Items table with Part/HSN sub-lines and a Disc/Aggregate/Tax/Amount breakdown,
# Receipts/Debits alongside a Cgst/Sgst/Igst summary box, and an amount-in-words
# footer line. Reimplemented fresh in reportlab from whitelisted public fields,
# not a port of the client's TS — same "don't share code across languages/apps"
# reasoning job_intake_router.py's docstring already gives for job-sheet-pdf.ts.

_INK = colors.HexColor("#141414")
_GRAY_700 = colors.HexColor("#3c3c3c")
_GRAY_500 = colors.HexColor("#646464")
_GRAY_400 = colors.HexColor("#8c8c8c")
_BOX_BORDER = colors.HexColor("#c8c8c8")
_BOX_FILL = colors.HexColor("#fcfcfc")

_RECEIPT_DISCLAIMER = (
    "Received the amounts stated above on the specified dates against their respective "
    "reference numbers. Cheque receipts are subject to realization."
)

_ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _num_to_words(n: int) -> str:
    if n == 0:
        return ""
    if n < 20:
        return _ONES[n] + " "
    if n < 100:
        return _TENS[n // 10] + (" " + _ONES[n % 10] if n % 10 else "") + " "
    if n < 1000:
        return _ONES[n // 100] + " Hundred " + _num_to_words(n % 100)
    if n < 100000:
        return _num_to_words(n // 1000) + "Thousand " + _num_to_words(n % 1000)
    if n < 10000000:
        return _num_to_words(n // 100000) + "Lakh " + _num_to_words(n % 100000)
    return _num_to_words(n // 10000000) + "Crore " + _num_to_words(n % 10000000)


def _amount_in_words(amount: float) -> str:
    """Ported from the client's own deliver-job-pdf.ts amountInWords — same Indian
    numbering (Lakh/Crore) grouping, so the two documents never disagree on how a
    total reads in words."""
    rounded = round(amount)
    paise = round((amount - rounded) * 100)
    result = _num_to_words(rounded).strip() + " Rupees"
    if paise > 0:
        result += " and " + _num_to_words(paise).strip() + " Paise"
    return result + " Only."


def _fmt2(value: float | None) -> str:
    """Plain 2-decimal, comma-grouped amount — no currency prefix, matching the
    manual PDF's own fmtAmt (the surrounding labels/headings already say Rupees)."""
    if value is None:
        return "0.00"
    return f"{value:,.2f}"


@dataclass(frozen=True)
class _InvoiceLine:
    description: str | None
    part_code: str | None
    hsn_code: str | None
    qty: float | None
    price: float | None
    aggregate: float | None
    gst_rate: float | None
    tax_amount: float | None  # this line's own cgst+sgst+igst
    line_amount: float | None


@dataclass(frozen=True)
class _InvoicePayment:
    payment_date: str
    payment_mode: str
    reference_no: str | None
    remarks: str | None
    amount: float


@dataclass(frozen=True)
class _InvoiceJob:
    job_no: str
    device: str | None
    serial_no: str | None
    branch_name: str
    division_code: str | None
    division_name: str | None
    division_address: str | None
    division_phone: str | None
    division_email: str | None
    division_gstin: str | None
    division_web_site: str | None
    division_gst_state_code: str | None
    customer_name: str
    customer_mobile: str | None
    customer_gstin: str | None
    customer_email: str | None
    customer_address: str | None
    invoice_no: str | None
    invoice_date: str | None
    aggregate: float
    cgst: float
    sgst: float
    igst: float
    total: float | None
    paid_amount: float
    lines: list[_InvoiceLine]
    payments: list[_InvoicePayment]


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

    payment_rows = await exec_sql_query(
        db_name=db_name, schema=schema, sql=PublicSql.GET_JOB_DELIVERY_PAYMENTS,
        sql_args={"job_ids": job_ids},
    )
    payments_by_job: dict[int, list[_InvoicePayment]] = {}
    for p in payment_rows:
        pdate = p["payment_date"]
        payments_by_job.setdefault(p["job_id"], []).append(
            _InvoicePayment(
                payment_date=pdate.isoformat() if hasattr(pdate, "isoformat") else str(pdate),
                payment_mode=p["payment_mode"],
                reference_no=p["reference_no"],
                remarks=p["remarks"],
                amount=float(p["amount"]),
            )
        )

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
                    part_code=r["part_code"],
                    hsn_code=r["hsn_code"],
                    qty=float(r["qty"]) if r["qty"] is not None else None,
                    price=float(r["price"]) if r["price"] is not None else None,
                    aggregate=float(r["line_aggregate"]) if r["line_aggregate"] is not None else None,
                    gst_rate=float(r["gst_rate"]) if r["gst_rate"] is not None else None,
                    tax_amount=float((r["line_cgst"] or 0) + (r["line_sgst"] or 0) + (r["line_igst"] or 0)),
                    line_amount=float(r["line_amount"]) if r["line_amount"] is not None else None,
                )
            )

    def _fmt_date(d: object) -> str | None:
        return f"{d.day}/{d.month}/{d.year}" if d is not None else None  # type: ignore[attr-defined]

    jobs = [
        _InvoiceJob(
            job_no=headers[jid]["job_no"],
            device=headers[jid]["device"] or None,
            serial_no=headers[jid]["serial_no"],
            branch_name=headers[jid]["branch_name"],
            division_code=headers[jid]["division_code"],
            division_name=headers[jid]["division_name"],
            division_address=headers[jid]["division_address"] or None,
            division_phone=headers[jid]["division_phone"],
            division_email=headers[jid]["division_email"],
            division_gstin=headers[jid]["division_gstin"],
            division_web_site=headers[jid]["division_web_site"],
            division_gst_state_code=headers[jid]["division_gst_state_code"],
            customer_name=headers[jid]["customer_name"],
            customer_mobile=headers[jid]["customer_mobile"],
            customer_gstin=headers[jid]["customer_gstin"],
            customer_email=headers[jid]["customer_email"],
            customer_address=headers[jid]["customer_address"] or None,
            invoice_no=headers[jid]["invoice_no"],
            invoice_date=_fmt_date(headers[jid]["invoice_date"]),
            aggregate=float(headers[jid]["invoice_aggregate"] or 0),
            cgst=float(headers[jid]["invoice_cgst"] or 0),
            sgst=float(headers[jid]["invoice_sgst"] or 0),
            igst=float(headers[jid]["invoice_igst"] or 0),
            total=float(headers[jid]["invoice_total"]) if headers[jid]["invoice_total"] is not None else None,
            paid_amount=float(headers[jid]["paid_amount"] or 0),
            lines=lines_by_job[jid],
            payments=payments_by_job.get(jid, []),
        )
        for jid in order
    ]
    return _InvoiceData(bu_name=bu_name, jobs=jobs)


def _build_invoice_pdf(data: _InvoiceData) -> bytes:
    """The formal Tax Invoice/receipt — one full letterhead block per job (division
    branding, Customer Details/Shipping Address, itemized GST breakdown, Receipts/
    Debits + summary box, amount in words), same as the manual staff-triggered PDF.
    A job with no invoice yet (LEFT JOIN in GET_JOB_DELIVERY_INVOICE_DETAIL) still
    gets a section, just with no line items and "No charge" in place of a total —
    never silently dropped."""
    esc = html.escape

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, topMargin=14 * mm, bottomMargin=14 * mm, leftMargin=16 * mm, rightMargin=16 * mm,
        title=f"Invoice — {data.bu_name}",
    )

    company_name_style = ParagraphStyle("CompanyName", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=_INK)
    company_info_style = ParagraphStyle("CompanyInfo", fontName="Helvetica", fontSize=8, leading=10.5, textColor=_GRAY_700)
    company_gstin_style = ParagraphStyle("CompanyGstin", fontName="Helvetica-Bold", fontSize=8, leading=10.5, textColor=_GRAY_700)
    invoice_title_style = ParagraphStyle("InvoiceTitle", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=_INK)
    invoice_meta_style = ParagraphStyle("InvoiceMeta", fontName="Helvetica", fontSize=8, leading=10.5, textColor=_GRAY_700)
    page_no_style = ParagraphStyle("PageNo", fontName="Helvetica", fontSize=8, leading=10, alignment=TA_RIGHT, textColor=_GRAY_400)
    section_label_style = ParagraphStyle("SectionLabel", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=_GRAY_700)
    cust_name_style = ParagraphStyle("CustName", fontName="Helvetica-Bold", fontSize=9.5, leading=12, textColor=_INK)
    cust_detail_style = ParagraphStyle("CustDetail", fontName="Helvetica", fontSize=8.5, leading=11, textColor=_GRAY_700)
    cell_style = ParagraphStyle("Cell", fontName="Helvetica", fontSize=8, leading=10.5, textColor=colors.HexColor("#1e1e1e"))
    cell_sub_style = ParagraphStyle("CellSub", parent=cell_style, fontSize=7, textColor=_GRAY_500)
    cell_bold_style = ParagraphStyle("CellBold", parent=cell_style, fontName="Helvetica-Bold")
    cell_right_style = ParagraphStyle("CellRight", parent=cell_style, alignment=TA_RIGHT)
    cell_right_bold_style = ParagraphStyle("CellRightBold", parent=cell_bold_style, alignment=TA_RIGHT)
    no_receipts_style = ParagraphStyle("NoReceipts", fontName="Helvetica-Oblique", fontSize=8, leading=10, textColor=_GRAY_400)
    disclaimer_style = ParagraphStyle("Disclaimer", fontName="Helvetica-Oblique", fontSize=7.5, leading=9.5, textColor=_GRAY_700)
    summary_style = ParagraphStyle("SummaryRow", fontName="Helvetica", fontSize=8.5, leading=12, textColor=_INK)
    summary_bold_style = ParagraphStyle("SummaryRowBold", parent=summary_style, fontName="Helvetica-Bold", fontSize=9)
    summary_val_style = ParagraphStyle("SummaryVal", parent=summary_style, alignment=TA_RIGHT)
    summary_val_bold_style = ParagraphStyle("SummaryValBold", parent=summary_bold_style, alignment=TA_RIGHT)
    sig_style = ParagraphStyle("Sig", fontName="Helvetica-Oblique", fontSize=8.5, leading=11, textColor=_INK)
    words_style = ParagraphStyle("Words", fontName="Helvetica-Bold", fontSize=8.5, leading=11, alignment=TA_RIGHT, textColor=_INK)
    grand_total_style = ParagraphStyle("GrandTotal", fontName="Helvetica-Bold", fontSize=10, leading=14, alignment=TA_CENTER, textColor=_INK)
    footer_style = ParagraphStyle("Footer", fontName="Helvetica", fontSize=8, leading=11, alignment=TA_CENTER, textColor=_GRAY_500)

    half_w = doc.width / 2 - 3

    elements: list = []
    grand_total = 0.0

    for job_idx, job in enumerate(data.jobs):
        block: list = []
        block.append(Paragraph("Page 1 of 1", page_no_style))

        # ── Header: Division/company (left) | Tax Invoice title (right) ─────────
        left_cell: list = [Paragraph(esc(job.division_name or data.bu_name), company_name_style)]
        info_line = "&nbsp;&nbsp;&nbsp;".join(
            esc(p) for p in [
                f"Branch: {job.branch_name}" if job.branch_name else None,
                job.division_code,
                job.division_web_site,
            ] if p
        )
        if info_line:
            left_cell.append(Paragraph(info_line, company_info_style))
        if job.division_gstin:
            left_cell.append(Paragraph(f"GSTIN: {esc(job.division_gstin)}", company_gstin_style))
        addr_line = "&nbsp;&nbsp;&nbsp;".join(
            esc(p) for p in [
                job.division_address,
                f"State: {job.division_gst_state_code}" if job.division_gst_state_code else None,
                f"Ph: {job.division_phone}" if job.division_phone else None,
                f"Email: {job.division_email}" if job.division_email else None,
            ] if p
        )
        if addr_line:
            left_cell.append(Paragraph(addr_line, company_info_style))

        invoice_title = "Tax Invoice" if job.division_gstin else "Invoice"
        right_cell: list = [Paragraph(invoice_title, invoice_title_style)]
        inv_no = esc(job.invoice_no) if job.invoice_no else "—"
        inv_date = esc(job.invoice_date) if job.invoice_date else "—"
        right_cell.append(Paragraph(f"Invoice #: <b>{inv_no}</b>&nbsp;&nbsp;&nbsp;Date: {inv_date}", invoice_meta_style))
        right_cell.append(Paragraph(f"Type: Service&nbsp;&nbsp;&nbsp;Job #: {esc(job.job_no)}", invoice_meta_style))
        if job.device:
            right_cell.append(Paragraph(esc(job.device), invoice_meta_style))
        if job.serial_no:
            right_cell.append(Paragraph(f"Serial No: {esc(job.serial_no)}", invoice_meta_style))

        header_table = Table([[left_cell, right_cell]], colWidths=[half_w, half_w])
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        block += [header_table, Spacer(1, 5), HRFlowable(width="100%", thickness=0.6, color=_BOX_BORDER), Spacer(1, 6)]

        # ── Customer Details (left) | Shipping Address (right) ──────────────────
        addr_bits = [job.customer_address] if job.customer_address else []
        if job.customer_mobile:
            addr_bits.append(f"Ph: {job.customer_mobile}")
        if job.customer_email:
            addr_bits.append(f"Email: {job.customer_email}")
        full_addr_line = ", ".join(esc(b) for b in addr_bits) if addr_bits else None

        cust_left: list = [Paragraph("Customer Details", section_label_style), Paragraph(esc(job.customer_name), cust_name_style)]
        if full_addr_line:
            cust_left.append(Paragraph(full_addr_line, cust_detail_style))
        if job.customer_gstin:
            cust_left.append(Paragraph(f"GSTIN: {esc(job.customer_gstin)}", cust_detail_style))

        ship_right: list = [Paragraph("Shipping Address", section_label_style), Paragraph(esc(job.customer_name), cust_name_style)]
        if full_addr_line:
            ship_right.append(Paragraph(full_addr_line, cust_detail_style))

        cust_table = Table([[cust_left, ship_right]], colWidths=[half_w, half_w])
        cust_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        block += [cust_table, Spacer(1, 8)]

        # ── Items table ───────────────────────────────────────────────────────
        if job.lines:
            total_qty = sum(l.qty or 0 for l in job.lines)
            total_aggregate = sum(l.aggregate or 0 for l in job.lines)
            total_tax = sum(l.tax_amount or 0 for l in job.lines)
            total_amount = sum(l.line_amount or 0 for l in job.lines)

            items_head = [
                Paragraph("#", cell_bold_style), Paragraph("Items", cell_bold_style),
                Paragraph("Qty", cell_right_bold_style), Paragraph("Price", cell_right_bold_style),
                Paragraph("Disc", cell_right_bold_style), Paragraph("Aggregate", cell_right_bold_style),
                Paragraph("Tax amount (%)", cell_right_bold_style), Paragraph("Amount", cell_right_bold_style),
            ]
            items_rows = [items_head]
            for idx, line in enumerate(job.lines, start=1):
                sub_bits = [f"Part: {line.part_code}" if line.part_code else None, f"HSN: {line.hsn_code}" if line.hsn_code else None]
                sub_line = "  ".join(esc(b) for b in sub_bits if b)
                item_cell = [Paragraph(esc(line.description or "—"), cell_style)]
                if sub_line:
                    item_cell.append(Paragraph(sub_line, cell_sub_style))
                items_rows.append([
                    Paragraph(str(idx), cell_style),
                    item_cell,
                    Paragraph(_fmt2(line.qty), cell_right_style),
                    Paragraph(_fmt2(line.price), cell_right_style),
                    Paragraph("0.00", cell_right_style),
                    Paragraph(_fmt2(line.aggregate), cell_right_style),
                    Paragraph(f"{_fmt2(line.tax_amount)} ({_fmt2(line.gst_rate)})", cell_right_style),
                    Paragraph(_fmt2(line.line_amount), cell_right_style),
                ])
            items_rows.append([
                "", Paragraph("Total", cell_bold_style),
                Paragraph(_fmt2(total_qty), cell_right_bold_style), "",
                Paragraph("0.00", cell_right_bold_style),
                Paragraph(_fmt2(total_aggregate), cell_right_bold_style),
                Paragraph(_fmt2(total_tax), cell_right_bold_style),
                Paragraph(_fmt2(total_amount), cell_right_bold_style),
            ])
            items_table = Table(items_rows, colWidths=[16, None, 34, 46, 32, 50, 66, 50], repeatRows=1)
            items_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, -1), (-1, -1), _BOX_FILL),
                ("GRID", (0, 0), (-1, -1), 0.5, _BOX_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            block.append(items_table)
        else:
            block.append(Paragraph("No invoice line items on file.", no_receipts_style))

        block.append(Spacer(1, 8))

        # ── Receipts / Debits (left) | Summary box (right) ──────────────────────
        summary_rows: list = []
        job_total = job.total if job.total is not None else 0.0
        for label, value, bold in [
            ("Aggregate amount:", job.aggregate, True),
            ("Cgst:", job.cgst, False),
            ("Sgst:", job.sgst, False),
            ("Igst:", job.igst, False),
            ("Calculated amount:", job.aggregate + job.cgst + job.sgst + job.igst, False),
            ("Invoice amount:", job_total, True),
        ]:
            lbl_style = summary_bold_style if bold else summary_style
            val_style = summary_val_bold_style if bold else summary_val_style
            summary_rows.append([Paragraph(label, lbl_style), Paragraph(_fmt2(value), val_style)])
        summary_table = Table(summary_rows, colWidths=[None, 62])
        summary_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.6, _BOX_BORDER),
            ("BACKGROUND", (0, 0), (-1, -1), _BOX_FILL),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ]))

        summary_w = 175
        receipts_w = doc.width - summary_w - 8

        if job.payments:
            pay_head = [
                Paragraph("#", cell_bold_style), Paragraph("Date", cell_bold_style), Paragraph("Mode", cell_bold_style),
                Paragraph("Ref No", cell_bold_style), Paragraph("Remarks", cell_bold_style),
                Paragraph("Amount", cell_right_bold_style), Paragraph("Status", cell_bold_style),
            ]
            pay_rows = [pay_head]
            for idx, p in enumerate(job.payments, start=1):
                pay_rows.append([
                    Paragraph(str(idx), cell_style), Paragraph(esc(p.payment_date), cell_style),
                    Paragraph(esc(p.payment_mode), cell_style), Paragraph(esc(p.reference_no or "—"), cell_style),
                    Paragraph(esc(p.remarks or "—"), cell_style), Paragraph(_fmt2(p.amount), cell_right_style),
                    Paragraph("Paid", cell_style),
                ])
            receipts_table = Table(pay_rows, colWidths=[14, 44, 36, 36, None, 44, 40], repeatRows=1)
            receipts_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, _BOX_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            receipts_block: list = [
                Paragraph("Receipts / Debits", section_label_style), Spacer(1, 3), receipts_table,
                Spacer(1, 4), Paragraph(_RECEIPT_DISCLAIMER, disclaimer_style),
            ]
        else:
            receipts_block = [
                Paragraph("Receipts / Debits", section_label_style), Spacer(1, 3),
                Paragraph("No receipts recorded.", no_receipts_style),
            ]

        rs_table = Table([[receipts_block, summary_table]], colWidths=[receipts_w, summary_w])
        rs_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (0, -1), 8),
            ("RIGHTPADDING", (1, 0), (1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        block += [rs_table, Spacer(1, 12)]

        # ── Footer: authorised signatory (left) + amount in words (right) ───────
        footer_row = Table(
            [[Paragraph("Authorised signatory", sig_style), Paragraph(_amount_in_words(job_total), words_style)]],
            colWidths=[half_w, half_w],
        )
        footer_row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        block.append(footer_row)

        if job_idx < len(data.jobs) - 1:
            block += [Spacer(1, 14), HRFlowable(width="100%", thickness=1, color=_INK), Spacer(1, 14)]

        elements.append(KeepTogether(block))
        grand_total += job_total

    if len(data.jobs) > 1:
        elements += [Spacer(1, 10), Paragraph(f"Grand Total (all jobs): {_fmt2(grand_total)}", grand_total_style)]

    generated_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    elements += [
        Spacer(1, 14),
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
