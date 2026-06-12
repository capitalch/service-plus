import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { JobInvoiceFullRow } from "./deliver-job-schema";
import type { DivisionContextType } from "@/features/client/types/division";
import { MESSAGES } from "@/constants/messages";

type JobPaymentRow = {
    id: number;
    receipt_no: string | null;
    payment_date: string;
    payment_mode: string;
    amount: number;
    reference_no: string | null;
    remarks: string | null;
};

type JobBasicInfo = {
    job_no: string;
    alternate_job_no: string | null;
    job_date: string;
    customer_name: string;
    mobile: string;
    customer_gstin?: string | null;
    customer_email?: string | null;
    address_snapshot?: string | null;
    customer_address_line1?: string | null;
    customer_address_line2?: string | null;
    customer_landmark?: string | null;
    customer_city?: string | null;
    customer_postal_code?: string | null;
    customer_state?: string | null;
    device_details?: string | null;
    technician_name: string | null;
    amount: number | null;
    payments?: JobPaymentRow[];
};

function buildAddrLines(parts: (string | null | undefined)[]): string[] {
    return parts.filter((p): p is string => !!p && p.trim() !== "");
}

function fmtAmt(n: number | null | undefined): string {
    if (n == null) return "0.00";
    return Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function amountInWords(amount: number): string {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    function toW(n: number): string {
        if (n === 0) return "";
        if (n < 20) return ones[n] + " ";
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
        if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred " + toW(n % 100);
        if (n < 100000) return toW(Math.floor(n / 1000)) + "Thousand " + toW(n % 1000);
        if (n < 10000000) return toW(Math.floor(n / 100000)) + "Lakh " + toW(n % 100000);
        return toW(Math.floor(n / 10000000)) + "Crore " + toW(n % 10000000);
    }
    const rounded = Math.round(amount);
    const paise = Math.round((amount - rounded) * 100);
    let result = toW(rounded).trim() + " Rupees";
    if (paise > 0) result += " and " + toW(paise).trim() + " Paise";
    return result + " Only.";
}

// Minimal subset of JobDeliveryDetail needed for the PDF
export type PdfJobDetail = {
    id: number;
    job_no: string;
    alternate_job_no: string | null;
    job_date: string;
    customer_name: string;
    mobile: string;
    technician_name: string | null;
    job_status_name: string;
    amount: number | null;
    invoice_total: number | null;
    payments: {
        id: number;
        receipt_no: string | null;
        payment_date: string;
        payment_mode: string;
        amount: number;
        reference_no: string | null;
        remarks: string | null;
    }[];
};

function fmt(n: number | null | undefined): string {
    if (n == null) return "—";
    return Number(n).toFixed(2);
}

// ── Append a single-job section to an existing jsPDF document ─────────────────

function appendJobSection(
    doc: jsPDF,
    job: PdfJobDetail,
    invoice: JobInvoiceFullRow | null,
    margin: number,
    pageWidth: number,
    startY: number,
): void {
    const midX = pageWidth / 2;
    let y = startY;

    // ── Title ─────────────────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("JOB DELIVERY NOTE", midX, y, { align: "center" });
    y += 5;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;

    // ── Job info (2-column grid) ───────────────────────────────────────────────
    const infoRows: [string, string][] = [
        ["Job No", job.job_no + (job.alternate_job_no ? ` / Alt: ${job.alternate_job_no}` : "")],
        ["Job Date", job.job_date],
        ["Customer", job.customer_name],
        ["Mobile", job.mobile],
        ["Technician", job.technician_name ?? "—"],
        ["Status", job.job_status_name],
        ["Amount", `₹${fmt(job.amount)}`],
    ];
    doc.setFontSize(9);
    infoRows.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col === 0 ? margin : midX + 4;
        const cy = y + row * 6.5;
        doc.setFont("helvetica", "bold"); doc.text(`${label}:`, x, cy);
        doc.setFont("helvetica", "normal"); doc.text(value, x + 26, cy);
    });
    y += Math.ceil(infoRows.length / 2) * 6.5 + 5;

    // ── Invoice section ───────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    if (invoice) {
        doc.text(
            `Invoice: ${invoice.invoice_no}   Date: ${invoice.invoice_date.slice(0, 10)}`,
            margin, y,
        );
        y += 5;

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [["Description", "HSN", "Qty", "Price", "Taxable", "GST%", "CGST", "SGST", "IGST", "Total"]],
            body: (invoice.lines ?? []).map(l => [
                l.description,
                l.hsn_code ?? "—",
                l.qty,
                fmt(l.price),
                fmt(l.aggregate),
                `${l.gst_rate}%`,
                fmt(l.cgst_amount),
                fmt(l.sgst_amount),
                fmt(l.igst_amount),
                fmt(l.amount),
            ]),
            foot: [[
                { content: "TOTAL", colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
                fmt(invoice.aggregate), "",
                fmt(invoice.cgst_amount),
                fmt(invoice.sgst_amount),
                fmt(invoice.igst_amount),
                fmt(invoice.amount),
            ]],
            styles: { fontSize: 8, cellPadding: 1.8 },
            headStyles: { fillColor: [60, 80, 140], textColor: 255, fontStyle: "bold" },
            footStyles: { fillColor: [230, 230, 230], fontStyle: "bold" },
            columnStyles: {
                0: { cellWidth: 36 },
                2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" },
                6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" },
                9: { halign: "right" },
            },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 6;
    } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(180, 80, 0);
        doc.text("No invoice found.", margin, y);
        doc.setTextColor(0, 0, 0);
        y += 7;
    }

    // ── Receipts section ──────────────────────────────────────────────────────
    const payments = job.payments ?? [];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Receipts", margin, y);
    y += 5;

    if (payments.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text("No receipts recorded.", margin, y);
    } else {
        const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [["#", "Date", "Mode", "Amount", "Ref No", "Remarks"]],
            body: payments.map((p, i) => [
                i + 1,
                p.payment_date.slice(0, 10),
                p.payment_mode,
                fmt(p.amount),
                p.reference_no ?? "—",
                p.remarks ?? "—",
            ]),
            foot: [[
                { content: "TOTAL RECEIVED", colSpan: 3, styles: { fontStyle: "bold", halign: "right" } },
                fmt(totalPaid), "", "",
            ]],
            styles: { fontSize: 8, cellPadding: 1.8 },
            headStyles: { fillColor: [40, 120, 60], textColor: 255, fontStyle: "bold" },
            footStyles: { fillColor: [230, 230, 230], fontStyle: "bold" },
            columnStyles: { 3: { halign: "right" } },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 4;

        const balance = Math.max(0, Number(invoice?.amount ?? 0) - totalPaid);
        if (balance > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(180, 0, 0);
            doc.text(`Balance Due: ₹${balance.toFixed(2)}`, pageWidth - margin, y, { align: "right" });
            doc.setTextColor(0, 0, 0);
        }
    }
}

// ── Single-job PDF (A5) ───────────────────────────────────────────────────────

export function buildDeliverJobPdf(
    job: PdfJobDetail,
    invoice: JobInvoiceFullRow | null,
): jsPDF {
    const doc = new jsPDF({ format: "a5", orientation: "p", unit: "mm" });
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();

    appendJobSection(doc, job, invoice, margin, pageWidth, margin);
    return doc;
}

// ── Multi-job PDF (A5, one section per job) ───────────────────────────────────

export function buildMultiJobDeliveryPdf(
    jobs: PdfJobDetail[],
    invoicesMap: Map<number, JobInvoiceFullRow>,
): jsPDF {
    const doc = new jsPDF({ format: "a5", orientation: "p", unit: "mm" });
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();

    jobs.forEach((job, idx) => {
        if (idx > 0) doc.addPage();
        appendJobSection(doc, job, invoicesMap.get(job.id) ?? null, margin, pageWidth, margin);
    });

    return doc;
}

// ── Professional Invoice PDF (A4, matches sample format) ─────────────────────

// Internal: draw one invoice onto `doc` starting at `yOffset`. Returns final y.
// `allowPageBreaks` must be false when drawing in the bottom half of a packed page.
function drawInvoiceContent(
    doc: jsPDF,
    job: JobBasicInfo,
    invoice: JobInvoiceFullRow,
    division: DivisionContextType | null,
    branchName: string | null | undefined,
    yOffset: number,
    allowPageBreaks: boolean,
): number {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 10;
    const midX = pageW / 2;
    const rightX = pageW - M;
    let y = yOffset + M - 4;

    // ── Page number (top right) ───────────────────────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Page 1 of 1", rightX, y, { align: "right" });
    y += 4;

    // ── Header: Company (left) | Invoice title (right) ───────────────────────
    const headerTopY = y;

    // Left — company block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(division?.name ?? "Service Plus", M, y);
    y += 5;

    const infoLine = buildAddrLines([
        branchName ? `Branch: ${branchName}` : null,
        division?.code ?? null,
        division?.web_site ?? null,
    ]).join("   ");
    if (infoLine) {
        const maxW = midX - M - 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(infoLine, M, y, { maxWidth: maxW });
        y += (doc.splitTextToSize(infoLine, maxW) as string[]).length * 4;
    }

    if (division?.gstin) {
        const maxW = midX - M - 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(`GSTIN: ${division.gstin}`, M, y, { maxWidth: maxW });
        y += (doc.splitTextToSize(`GSTIN: ${division.gstin}`, maxW) as string[]).length * 4;
    }

    const divDetails = buildAddrLines([
        division?.address_line1 ?? null,
        division?.address_line2 ?? null,
        division?.pincode        ? `Pin: ${division.pincode}`          : null,
        division?.gst_state_code ? `State: ${division.gst_state_code}` : null,
        division?.phone ? `Ph: ${division.phone}`   : null,
        division?.email ? `Email: ${division.email}` : null,
    ]).join("   ");
    if (divDetails) {
        const maxW = midX - M - 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(divDetails, M, y, { maxWidth: maxW });
        y += (doc.splitTextToSize(divDetails, maxW) as string[]).length * 4;
    }

    // Right — invoice title block
    const titleX    = midX + 5;
    const titleColW = rightX - titleX;
    let ry = headerTopY;

    const invoiceTitle = division?.gstin ? "Tax Invoice" : "Invoice";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(invoiceTitle, titleX, ry);
    ry += 5;

    // Invoice # (bold) + Date (normal) on one line
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    const invLabel = "Invoice #: ";
    const invNo    = invoice.invoice_no;
    const invDate  = `   Date: ${new Date(invoice.invoice_date).toLocaleDateString("en-IN")}`;
    doc.setFont("helvetica", "normal");
    const labelW = doc.getTextWidth(invLabel);
    doc.text(invLabel, titleX, ry);
    doc.setFont("helvetica", "bold");
    const noW = doc.getTextWidth(invNo);
    doc.text(invNo, titleX + labelW, ry);
    doc.setFont("helvetica", "normal");
    doc.text(invDate, titleX + labelW + noW, ry);
    ry += 4.5;

    // Type + Job # on one line
    const typeJobLine = buildAddrLines([
        "Type: Service",
        job.job_no ? `Job #: ${job.job_no}` : null,
    ]).join("   ");
    doc.text(typeJobLine, titleX, ry, { maxWidth: titleColW });
    ry += 4.5;

    y = Math.max(y, ry);

    // ── Divider ───────────────────────────────────────────────────────────────
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.line(M, y, rightX, y);
    y += 5;

    // ── Customer Details (left) | Shipping Address (right) ───────────────────
    const custColW = midX - M - 5;
    const shipX = midX + 5;
    const shipColW = rightX - shipX;
    const custTopY = y;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    doc.text("Customer Details", M, y);
    doc.text("Shipping Address", shipX, y);
    y += 4.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text(job.customer_name || "—", M, y, { maxWidth: custColW });

    const fullAddrLine = buildAddrLines([
        job.customer_address_line1 ?? null,
        job.customer_address_line2 ?? null,
        job.customer_landmark ?? null,
        job.customer_city ?? null,
        job.customer_state ?? null,
        job.customer_postal_code ? `Pin: ${job.customer_postal_code}` : null,
        job.mobile ? `Ph: ${job.mobile}` : null,
        job.customer_email ? `Email: ${job.customer_email}` : null,
    ]).join(", ") || null;

    const custLines = buildAddrLines([
        fullAddrLine,
        job.customer_gstin ? `GSTIN: ${job.customer_gstin}` : null,
    ]);

    const shipLines = buildAddrLines([
        job.customer_name ?? null,
        fullAddrLine,
    ]);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);

    const custNameLines = doc.splitTextToSize(job.customer_name || "—", custColW) as string[];
    let cy = y + custNameLines.length * 4.5;
    custLines.forEach(l => {
        const wrapped = doc.splitTextToSize(l, custColW) as string[];
        doc.text(wrapped, M, cy);
        cy += wrapped.length * 4;
    });

    let sy2 = custTopY + 4.5;
    shipLines.forEach(l => {
        const wrapped = doc.splitTextToSize(l, shipColW) as string[];
        doc.text(wrapped, shipX, sy2);
        sy2 += wrapped.length * 4;
    });

    y = Math.max(cy, sy2) - 1;

    // ── Items Table ───────────────────────────────────────────────────────────
    const lines = invoice.lines ?? [];
    const totalQty = lines.reduce((s, l) => s + Number(l.qty), 0);
    const totalAggregate = lines.reduce((s, l) => s + Number(l.aggregate), 0);
    const totalTax = lines.reduce((s, l) => s + Number(l.cgst_amount) + Number(l.sgst_amount) + Number(l.igst_amount), 0);
    const totalAmount = lines.reduce((s, l) => s + Number(l.amount), 0);

    autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        theme: "grid",
        head: [[
            "#", "Items",
            { content: "Qty", styles: { halign: "right" } },
            { content: "Price", styles: { halign: "right" } },
            { content: "Disc", styles: { halign: "right" } },
            { content: "Aggregate", styles: { halign: "right" } },
            { content: "Tax amount (%)", styles: { halign: "right" } },
            { content: "Amount", styles: { halign: "right" } },
        ]],
        body: lines.map((l, i) => {
            const tax = Number(l.cgst_amount) + Number(l.sgst_amount) + Number(l.igst_amount);
            const subLines = [
                l.part_code ? `Part: ${l.part_code}` : null,
                l.hsn_code  ? `HSN: ${l.hsn_code}`   : null,
            ].filter(Boolean).join("  ");
            const itemCell = l.description + (subLines ? `\n${subLines}` : "");
            return [
                i + 1,
                itemCell,
                fmtAmt(l.qty),
                fmtAmt(l.price),
                "0.00",
                fmtAmt(l.aggregate),
                `${fmtAmt(tax)} (${fmtAmt(l.gst_rate)})`,
                fmtAmt(l.amount),
            ];
        }),
        foot: [[
            "",
            { content: "Total", styles: { fontStyle: "bold" } },
            { content: fmtAmt(totalQty), styles: { halign: "right" } },
            "",
            { content: "0.00", styles: { halign: "right" } },
            { content: fmtAmt(totalAggregate), styles: { halign: "right" } },
            { content: fmtAmt(totalTax), styles: { halign: "right" } },
            { content: fmtAmt(totalAmount), styles: { halign: "right" } },
        ]],
        styles: { fontSize: 8, cellPadding: 2, textColor: [30, 30, 30] },
        headStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20], fontStyle: "bold", fontSize: 8, lineColor: [180, 180, 180], lineWidth: 0.3 },
        footStyles: { fillColor: [245, 245, 245], fontStyle: "bold", textColor: [20, 20, 20], fontSize: 8, lineColor: [180, 180, 180], lineWidth: 0.3 },
        bodyStyles: { lineColor: [200, 200, 200], lineWidth: 0.3 },
        columnStyles: {
            0: { cellWidth: 8,  halign: "center" },
            2: { cellWidth: 14, halign: "right" },
            3: { cellWidth: 20, halign: "right" },
            4: { cellWidth: 14, halign: "right" },
            5: { cellWidth: 22, halign: "right" },
            6: { cellWidth: 28, halign: "right" },
            7: { cellWidth: 22, halign: "right" },
        },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 3;

    if (allowPageBreaks && y > pageH - 65) { doc.addPage(); y = M; }

    // ── Receipts / Debits (left) | Summary box (right) ───────────────────────
    const sumBoxW = 72;
    const sumBoxX = rightX - sumBoxW;

    const payments = job.payments ?? [];

    if (payments.length > 0) {
        autoTable(doc, {
            startY: y,
            margin: { left: M, right: pageW - sumBoxX + 6 },
            theme: "grid",
            head: [
                [{ content: "Receipts / Debits", colSpan: 7, styles: { halign: "left", fontStyle: "bold", fontSize: 8.5 } }],
                [
                    "#", "Date", "Mode", "Ref No", "Remarks",
                    { content: "Amount", styles: { halign: "right" } },
                    "Status",
                ],
            ],
            body: payments.map((p, i) => [
                i + 1,
                p.payment_date.slice(0, 10),
                p.payment_mode,
                p.reference_no ?? "—",
                p.remarks ?? "—",
                { content: fmtAmt(p.amount), styles: { halign: "right" } },
                "Paid",
            ]),
            styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [30, 30, 30] },
            headStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20], fontStyle: "bold", fontSize: 7.5, lineColor: [180, 180, 180], lineWidth: 0.3 },
            bodyStyles: { lineColor: [200, 200, 200], lineWidth: 0.3 },
            columnStyles: {
                0: { cellWidth: 8, halign: "center" },
                1: { cellWidth: 22 },
                5: { cellWidth: 20, halign: "right" },
                6: { cellWidth: 14, halign: "center" },
            },
        });
    } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 30, 30);
        doc.text("Receipts / Debits", M, y);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text("No receipts recorded.", M, y + 5);
    }

    // Summary box (right side, starting at same y as section heading)
    const sumRows: { label: string; value: number; bold?: boolean }[] = [
        { label: "Aggregate amount:", value: invoice.aggregate, bold: true },
        { label: "Cgst:", value: invoice.cgst_amount },
        { label: "Sgst:", value: invoice.sgst_amount },
        { label: "Igst:", value: invoice.igst_amount },
        { label: "Calculated amount:", value: invoice.aggregate + invoice.cgst_amount + invoice.sgst_amount + invoice.igst_amount, bold: false },
        { label: "Invoice amount:", value: job.amount ?? 0, bold: true },
    ];
    const rowH = 5.5;
    const boxH = sumRows.length * rowH + 6;
    const sumTopY = y;

    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(252, 252, 252);
    doc.rect(sumBoxX, sumTopY - 1, sumBoxW, boxH, "FD");

    let sby = sumTopY + 3.5;
    for (const row of sumRows) {
        doc.setFont("helvetica", row.bold ? "bold" : "normal");
        doc.setFontSize(row.bold ? 9 : 8.5);
        doc.setTextColor(30, 30, 30);
        doc.text(row.label, sumBoxX + 3, sby);
        doc.text(fmtAmt(row.value), rightX - 2, sby, { align: "right" });
        sby += rowH;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rcptBottom = payments.length > 0 ? (doc as any).lastAutoTable.finalY : y + 10;

    if (payments.length > 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(
            MESSAGES.PDF_RECEIPT_DISCLAIMER,
            M, rcptBottom + 4,
            { maxWidth: sumBoxX - M - 6 },
        );
    }

    y = Math.max(rcptBottom + (payments.length > 0 ? 10 : 0), sumTopY + boxH) + 4;

    // ── Footer: authorised signatory (left) + amount in words (right) ─────────
    if (allowPageBreaks && y > pageH - 20) { doc.addPage(); y = M; }

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text("Authorised signatory", M, y);

    doc.setFont("helvetica", "bold");
    doc.text(amountInWords(invoice.amount), rightX, y, { align: "right", maxWidth: sumBoxX - M - 4 });

    return y + 5;
}

export function buildInvoicePdf(
    job: JobBasicInfo,
    invoice: JobInvoiceFullRow,
    division: DivisionContextType | null,
    branchName?: string | null,
    existingDoc?: jsPDF,
    copies = 1,
): jsPDF {
    const doc = existingDoc ?? new jsPDF({ format: "a4", orientation: "p", unit: "mm" });

    for (let i = 0; i < copies; i++) {
        if (i === 0 ? !!existingDoc : true) doc.addPage();
        drawInvoiceContent(doc, job, invoice, division, branchName, 0, true);
    }

    return doc;
}

type InvoiceItem = {
    job:      JobBasicInfo;
    invoice:  JobInvoiceFullRow;
    division: DivisionContextType | null;
};

export function buildPackedInvoicePdf(
    items: InvoiceItem[],
    branchName?: string | null,
    copies = 1,
): jsPDF {
    const allItems = copies > 1
        ? items.flatMap(item => Array<InvoiceItem>(copies).fill(item))
        : items;
    const doc = new jsPDF({ format: "a4", orientation: "p", unit: "mm" });
    let firstPage = true;

    for (const item of allItems) {
        if (!firstPage) doc.addPage();
        firstPage = false;
        drawInvoiceContent(doc, item.job, item.invoice, item.division, branchName, 0, true);
    }

    return doc;
}

// ── Delivery Note / Certificate PDF (A5) ─────────────────────────────────────

export type DeliveryNoteJobInfo = {
    job_no:                  string;
    alternate_job_no:        string | null;
    job_date:                string;
    customer_name:           string;
    mobile:                  string;
    customer_address_line1?: string | null;
    customer_address_line2?: string | null;
    customer_landmark?:      string | null;
    customer_city?:          string | null;
    customer_postal_code?:   string | null;
    customer_state?:         string | null;
    device_details?:         string | null;
    technician_name:         string | null;
    amount:                  number | null;
    invoice_no?:             string | null;
    receipt_nos?:            string[];
    delivery_ok?:            boolean | null;
    delivery_date:           string;
    delivery_manner?:        string | null;
    remarks?:                string | null;
};

function dashedLine(doc: jsPDF, x1: number, y: number, x2: number) {
    doc.setLineDashPattern([1.2, 1.5], 0);
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.25);
    doc.line(x1, y, x2, y);
    doc.setLineDashPattern([], 0);
}

function drawDeliveryNoteContent(
    doc: jsPDF,
    job: DeliveryNoteJobInfo,
    division: DivisionContextType | null,
    branchName?: string | null,
) {
    const M     = 10;
    const pageW = doc.internal.pageSize.getWidth();   // 148.5 mm (A5)
    const pageH = doc.internal.pageSize.getHeight();  // 210 mm
    const cW    = pageW - M * 2;
    const midX  = pageW / 2;
    let y = M;

    // ── Company header ────────────────────────────────────────────────────────
    const entityName = division?.name ?? branchName ?? "";
    if (entityName) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(entityName.toUpperCase(), midX, y, { align: "center" });
        y += 5;
        const hdrAddr = buildAddrLines([
            division?.address_line1, division?.address_line2, division?.city, division?.pincode,
        ]);
        if (hdrAddr.length > 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.text(hdrAddr.join("  ·  "), midX, y, { align: "center" });
            y += 4;
        }
        if (division?.gstin) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.text(`GSTIN: ${division.gstin}`, midX, y, { align: "center" });
            y += 4;
        }
    }

    // thick rule
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.8);
    doc.line(M, y, pageW - M, y);
    y += 4.5;

    // ── Title ─────────────────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("DELIVERY CERTIFICATE", midX, y, { align: "center" });
    y += 4.5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text(
        "This certifies that the customer has received the serviced item described below.",
        midX, y, { align: "center" },
    );
    doc.setTextColor(0, 0, 0);
    y += 5;
    doc.setDrawColor(170, 170, 170);
    doc.setLineWidth(0.25);
    doc.line(M, y, pageW - M, y);
    y += 4;

    // ── Info box ──────────────────────────────────────────────────────────────
    const col1X  = M + 3;
    const col2X  = M + cW / 2 + 3;
    const colW   = cW / 2 - 5;
    const lblW   = 20;

    // Pre-measure right column
    doc.setFontSize(8);
    const nameLines = doc.splitTextToSize(job.customer_name, colW) as string[];
    const addrParts = buildAddrLines([
        job.customer_address_line1 ?? null, job.customer_address_line2 ?? null,
        job.customer_landmark ?? null,      job.customer_city ?? null,
        job.customer_state ?? null,
        job.customer_postal_code ? `Pin: ${job.customer_postal_code}` : null,
    ]);
    const addrWrapped = addrParts.length > 0
        ? (doc.splitTextToSize(addrParts.join(", "), colW) as string[])
        : [];

    const leftRows: [string, string][] = [
        ["Job No",     `#${job.job_no}${job.alternate_job_no ? ` / ${job.alternate_job_no}` : ""}`],
        ["Job Date",   job.job_date],
        ["Del. Date",  job.delivery_date || "—"],
        ["Technician", job.technician_name ?? "—"],
    ];
    const leftH  = 4 + leftRows.length * 5.5;
    const rightH = 4 + 4.5 + nameLines.length * 4.5 + addrWrapped.length * 3.8 + (job.mobile ? 4 : 0);
    const boxH   = Math.max(leftH, rightH) + 5;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(210, 215, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, cW, boxH, 2, 2, "FD");
    // vertical divider
    doc.setDrawColor(210, 215, 220);
    doc.setLineWidth(0.25);
    doc.line(M + cW / 2, y + 2, M + cW / 2, y + boxH - 2);

    let ly = y + 4;
    doc.setFontSize(8);
    leftRows.forEach(([lbl, val]) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(90, 90, 90);
        doc.text(`${lbl}:`, col1X, ly);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(val, col1X + lblW, ly, { maxWidth: colW - lblW });
        ly += 5.5;
    });

    let ry = y + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("CUSTOMER", col2X, ry);
    ry += 4.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(nameLines, col2X, ry);
    ry += nameLines.length * 4.5;
    if (addrWrapped.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(50, 50, 50);
        doc.text(addrWrapped, col2X, ry);
        ry += addrWrapped.length * 3.8;
    }
    if (job.mobile) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(`Ph: ${job.mobile}`, col2X, ry);
    }

    y += boxH + 4;

    // ── Device / Service ──────────────────────────────────────────────────────
    if (job.device_details) {
        dashedLine(doc, M, y, pageW - M);
        y += 3.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text("DEVICE / SERVICE", M, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        const devLines = doc.splitTextToSize(job.device_details, cW) as string[];
        doc.text(devLines, M, y);
        y += devLines.length * 4.5 + 2;
    }

    // ── Documents ─────────────────────────────────────────────────────────────
    const hasInvoice  = !!job.invoice_no;
    const receiptNos  = (job.receipt_nos ?? []).filter(Boolean);
    const hasReceipts = receiptNos.length > 0;
    if (hasInvoice || hasReceipts) {
        dashedLine(doc, M, y, pageW - M);
        y += 3.5;
        doc.setFontSize(8);
        if (hasInvoice) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(90, 90, 90);
            doc.text("Invoice No:", M, y);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 0, 0);
            doc.text(job.invoice_no!, M + 22, y);
        }
        if (hasReceipts) {
            const rcptX = hasInvoice ? midX + 2 : M;
            doc.setFont("helvetica", "bold");
            doc.setTextColor(90, 90, 90);
            doc.text(`Receipt No${receiptNos.length > 1 ? "s" : ""}:`, rcptX, y);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 0, 0);
            doc.text(receiptNos.join(", "), rcptX + 22, y, { maxWidth: pageW - M - rcptX - 22 });
        }
        y += 5;
    }

    // ── Delivery status ───────────────────────────────────────────────────────
    {
        dashedLine(doc, M, y, pageW - M);
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text("DELIVERY STATUS", M, y);

        const label = job.delivery_ok === false ? "Not OK" : "OK";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(label, M + 35, y);

        y += 5;
    }

    // ── Remarks ───────────────────────────────────────────────────────────────
    if (job.remarks?.trim()) {
        dashedLine(doc, M, y, pageW - M);
        y += 3.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text("REMARKS", M, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        const remLines = doc.splitTextToSize(job.remarks.trim(), cW) as string[];
        doc.text(remLines, M, y);
        y += remLines.length * 4.2 + 2;
    }

    // ── Signatures (pinned toward bottom) ─────────────────────────────────────
    const sigAreaTop = Math.max(y + 6, pageH - M - 24);
    dashedLine(doc, M, sigAreaTop, pageW - M);
    const sigLineY = sigAreaTop + 13;
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.45);
    doc.line(M,            sigLineY, M + 52,        sigLineY);
    doc.line(pageW - M - 52, sigLineY, pageW - M,   sigLineY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text("Customer Signature", M, sigLineY + 4);
    doc.text("Date: ___________", M, sigLineY + 8);
    doc.text("Authorised Signatory", pageW - M, sigLineY + 4, { align: "right" });
}

export function buildDeliveryNotePdf(
    jobs: DeliveryNoteJobInfo[],
    division: DivisionContextType | null,
    branchName?: string | null,
): jsPDF {
    const doc = new jsPDF({ format: "a5", orientation: "l", unit: "mm" });
    jobs.forEach((job, i) => {
        if (i > 0) doc.addPage();
        drawDeliveryNoteContent(doc, job, division, branchName);
    });
    return doc;
}

// ── Receipt-only PDF (A5) ─────────────────────────────────────────────────────

export function buildReceiptPdf(
    job: JobBasicInfo & { payments: { id: number; receipt_no: string | null; payment_date: string; payment_mode: string; amount: number; reference_no: string | null; remarks: string | null }[] },
    division?: DivisionContextType | null,
): jsPDF {
    const doc = new jsPDF({ format: "a5", orientation: "p", unit: "mm" });
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const midX = pageWidth / 2;
    let y = margin;

    // Division header
    if (division?.name) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(division.name.toUpperCase(), midX, y, { align: "center" });
        y += 5.5;
        const addrParts: string[] = [];
        if (division.address_line1) addrParts.push(division.address_line1);
        if (division.address_line2) addrParts.push(division.address_line2);
        if (division.city)          addrParts.push(division.city);
        if (division.pincode)       addrParts.push(division.pincode);
        if (addrParts.length > 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(addrParts.join(", "), midX, y, { align: "center" });
            y += 4.5;
        }
        if (division.gstin) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.text(`GSTIN: ${division.gstin}`, midX, y, { align: "center" });
            y += 4.5;
        }
        doc.setDrawColor(60, 60, 60);
        doc.setLineWidth(0.6);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("PAYMENT RECEIPT", midX, y, { align: "center" });
    y += 5;
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    const payments = job.payments ?? [];
    const firstReceiptNo = payments.length > 0 ? (payments[0].receipt_no ?? String(payments[0].id)) : null;

    // const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
    // const balance = Math.max(0, Number(job.amount ?? 0) - totalPaid);

    const addrParts = buildAddrLines([
        job.customer_address_line1 ?? null,
        job.customer_address_line2 ?? null,
        job.customer_landmark ?? null,
        job.customer_city ?? null,
        job.customer_state ?? null,
        job.customer_postal_code ? `Pin: ${job.customer_postal_code}` : null,
    ]);
    const customerAddr = addrParts.length > 0
        ? addrParts.join(", ")
        : (job.address_snapshot ?? null);

    // Left column: job info; right column: customer details
    const leftRows: [string, string][] = [
        ["Job No",   job.job_no + (job.alternate_job_no ? ` / ${job.alternate_job_no}` : "")],
        ["Rcpt No",  firstReceiptNo ?? "—"],
        ["Job Date", job.job_date],
    ];
    doc.setFontSize(9);
    leftRows.forEach(([label, value], i) => {
        const cy = y + i * 6.5;
        doc.setFont("helvetica", "bold"); doc.text(`${label}:`, margin, cy);
        doc.setFont("helvetica", "normal"); doc.text(value, margin + 22, cy);
    });

    // Right column: customer block
    let ry = y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Customer:", midX + 4, ry);
    ry += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(job.customer_name, midX + 4, ry, { maxWidth: midX - margin - 4 });
    ry += (doc.splitTextToSize(job.customer_name, midX - margin - 4) as string[]).length * 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (customerAddr) {
        const wrapped = doc.splitTextToSize(customerAddr, midX - margin - 4) as string[];
        doc.text(wrapped, midX + 4, ry);
        ry += wrapped.length * 4;
    }
    if (job.mobile) {
        doc.text(`Ph: ${job.mobile}`, midX + 4, ry);
        ry += 4;
    }

    y = Math.max(y + leftRows.length * 6.5, ry);

    if (payments.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text("No receipts recorded.", margin, y);
    } else {
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [["Rcpt No", "Date", "Mode", { content: "Amount", styles: { halign: "right" } }, "Ref No", "Remarks"]],
            body: payments.map(p => [
                p.receipt_no ?? String(p.id),
                p.payment_date.slice(0, 10),
                p.payment_mode,
                fmt(p.amount),
                p.reference_no ?? "—",
                p.remarks ?? "—",
            ]),
            styles: { fontSize: 8, cellPadding: 1.8, textColor: [0, 0, 0], fillColor: [255, 255, 255], lineWidth: 0.3, lineColor: [0, 0, 0] },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", lineWidth: 0.3, lineColor: [0, 0, 0] },
            alternateRowStyles: { fillColor: [255, 255, 255] },
            columnStyles: { 3: { halign: "right" } },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 6;

        // if (balance > 0) {
        //     doc.setFont("helvetica", "bold");
        //     doc.setFontSize(10);
        //     doc.text(`Balance Due: ₹${balance.toFixed(2)}`, pageWidth - margin, y, { align: "right" });
        //     y += 6;
        // }

        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        const disclaimerLines = doc.splitTextToSize(MESSAGES.PDF_RECEIPT_DISCLAIMER, pageWidth - margin * 2) as string[];
        doc.text(disclaimerLines, margin, y);
        y += disclaimerLines.length * 4 + 6;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Authorised Signatory", pageWidth - margin, y, { align: "right" });
    }

    return doc;
}
