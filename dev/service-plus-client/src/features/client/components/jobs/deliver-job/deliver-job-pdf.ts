import { jsPDF }   from "jspdf";
import autoTable   from "jspdf-autotable";

import type { JobInvoiceFullRow } from "./deliver-job-schema";
import type { DivisionContextType } from "@/features/client/types/division";

type JobPaymentRow = {
    id:           number;
    payment_date: string;
    payment_mode: string;
    amount:       number;
    reference_no: string | null;
    remarks:      string | null;
};

type JobBasicInfo = {
    job_no:                  string;
    alternate_job_no:        string | null;
    job_date:                string;
    customer_name:           string;
    mobile:                  string;
    customer_gstin?:         string | null;
    customer_email?:         string | null;
    customer_address_line1?: string | null;
    customer_address_line2?: string | null;
    customer_city?:          string | null;
    customer_postal_code?:   string | null;
    customer_state?:         string | null;
    device_details?:         string | null;
    technician_name:         string | null;
    amount:                  number | null;
    payments?:               JobPaymentRow[];
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
        if (n < 20)  return ones[n] + " ";
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
        if (n < 1000)     return ones[Math.floor(n / 100)] + " Hundred " + toW(n % 100);
        if (n < 100000)   return toW(Math.floor(n / 1000))    + "Thousand "  + toW(n % 1000);
        if (n < 10000000) return toW(Math.floor(n / 100000))  + "Lakh "      + toW(n % 100000);
        return               toW(Math.floor(n / 10000000)) + "Crore " + toW(n % 10000000);
    }
    const rounded = Math.round(amount);
    const paise   = Math.round((amount - rounded) * 100);
    let result = "Rs " + toW(rounded).trim() + " Rupees";
    if (paise > 0) result += " and " + toW(paise).trim() + " Paise";
    return result + " Only.";
}

// Minimal subset of JobDeliveryDetail needed for the PDF
export type PdfJobDetail = {
    id:                number;
    job_no:            string;
    alternate_job_no:  string | null;
    job_date:          string;
    customer_name:     string;
    mobile:            string;
    technician_name:   string | null;
    job_status_name:   string;
    amount:            number | null;
    invoice_total:     number | null;
    payments: {
        id:           number;
        payment_date: string;
        payment_mode: string;
        amount:       number;
        reference_no: string | null;
        remarks:      string | null;
    }[];
};

function fmt(n: number | null | undefined): string {
    if (n == null) return "—";
    return Number(n).toFixed(2);
}

// ── Append a single-job section to an existing jsPDF document ─────────────────

function appendJobSection(
    doc:       jsPDF,
    job:       PdfJobDetail,
    invoice:   JobInvoiceFullRow | null,
    margin:    number,
    pageWidth: number,
    startY:    number,
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
        ["Job No",     job.job_no + (job.alternate_job_no ? ` / Alt: ${job.alternate_job_no}` : "")],
        ["Job Date",   job.job_date],
        ["Customer",   job.customer_name],
        ["Mobile",     job.mobile],
        ["Technician", job.technician_name ?? "—"],
        ["Status",     job.job_status_name],
        ["Amount",     `₹${fmt(job.amount)}`],
    ];
    doc.setFontSize(9);
    infoRows.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x   = col === 0 ? margin : midX + 4;
        const cy  = y + row * 6.5;
        doc.setFont("helvetica", "bold");   doc.text(`${label}:`, x, cy);
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
            startY:  y,
            margin:  { left: margin, right: margin },
            head: [["Description", "HSN", "Qty", "Price", "Taxable", "GST%", "CGST", "SGST", "IGST", "Total"]],
            body: (invoice.lines ?? []).map(l => [
                l.description,
                l.hsn_code  ?? "—",
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
            styles:       { fontSize: 8, cellPadding: 1.8 },
            headStyles:   { fillColor: [60, 80, 140], textColor: 255, fontStyle: "bold" },
            footStyles:   { fillColor: [230, 230, 230], fontStyle: "bold" },
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
            startY:  y,
            margin:  { left: margin, right: margin },
            head:    [["#", "Date", "Mode", "Amount", "Ref No", "Remarks"]],
            body:    payments.map((p, i) => [
                i + 1,
                p.payment_date.slice(0, 10),
                p.payment_mode,
                fmt(p.amount),
                p.reference_no ?? "—",
                p.remarks      ?? "—",
            ]),
            foot: [[
                { content: "TOTAL RECEIVED", colSpan: 3, styles: { fontStyle: "bold", halign: "right" } },
                fmt(totalPaid), "", "",
            ]],
            styles:       { fontSize: 8, cellPadding: 1.8 },
            headStyles:   { fillColor: [40, 120, 60], textColor: 255, fontStyle: "bold" },
            footStyles:   { fillColor: [230, 230, 230], fontStyle: "bold" },
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
    job:     PdfJobDetail,
    invoice: JobInvoiceFullRow | null,
): jsPDF {
    const doc       = new jsPDF({ format: "a5", orientation: "p", unit: "mm" });
    const margin    = 14;
    const pageWidth = doc.internal.pageSize.getWidth();

    appendJobSection(doc, job, invoice, margin, pageWidth, margin);
    return doc;
}

// ── Multi-job PDF (A5, one section per job) ───────────────────────────────────

export function buildMultiJobDeliveryPdf(
    jobs:        PdfJobDetail[],
    invoicesMap: Map<number, JobInvoiceFullRow>,
): jsPDF {
    const doc       = new jsPDF({ format: "a5", orientation: "p", unit: "mm" });
    const margin    = 14;
    const pageWidth = doc.internal.pageSize.getWidth();

    jobs.forEach((job, idx) => {
        if (idx > 0) doc.addPage();
        appendJobSection(doc, job, invoicesMap.get(job.id) ?? null, margin, pageWidth, margin);
    });

    return doc;
}

// ── Professional Invoice PDF (A4, matches sample format) ─────────────────────

export function buildInvoicePdf(
    job:      JobBasicInfo,
    invoice:  JobInvoiceFullRow,
    division: DivisionContextType | null,
): jsPDF {
    const doc    = new jsPDF({ format: "a4", orientation: "p", unit: "mm" });
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const M      = 10;           // left/right margin
    const midX   = pageW / 2;
    const rightX = pageW - M;
    let   y      = M;

    // ── Page number (top right) ───────────────────────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Page 1 of 1", rightX, y, { align: "right" });
    y += 6;

    // ── Header: Company (left) | Invoice title (right) ───────────────────────
    const headerTopY = y;

    // Left — company block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(division?.name ?? "Service Plus", M, y);
    y += 5.5;

    if (division?.code) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(80, 80, 80);
        doc.text(division.code, M, y);
        y += 4;
    }

    if (division?.gstin) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 30, 30);
        doc.text(`GSTIN: ${division.gstin}`, M, y);
        y += 4;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    const addrParts = buildAddrLines([
        division?.address_line1 ?? null,
        division?.address_line2 ?? null,
    ]);
    addrParts.forEach(l => { doc.text(l, M, y); y += 4; });

    const pinState = buildAddrLines([
        division?.pincode        ? `Pin: ${division.pincode}`                : null,
        division?.gst_state_code ? `State code: ${division.gst_state_code}` : null,
    ]).join(", ");
    if (pinState) { doc.text(pinState, M, y); y += 4; }

    const contactParts = buildAddrLines([
        division?.email ? `Email: ${division.email}` : null,
        division?.phone ? `Ph: ${division.phone}`    : null,
    ]).join(", ");
    if (contactParts) { doc.text(contactParts, M, y); y += 4; }

    // Right — invoice title block (aligned to right half)
    const titleX    = midX + 5;
    const titleColW = rightX - titleX;
    let   ry        = headerTopY;

    const invoiceTitle = division?.gstin ? "TAX INVOICE" : "SERVICE INVOICE";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(invoiceTitle, titleX, ry);
    ry += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text("Original for recipient", titleX, ry);
    ry += 5.5;

    const invMeta: [string, string][] = [
        ["Invoice #:",  invoice.invoice_no],
        ["Date:",       new Date(invoice.invoice_date).toLocaleDateString("en-IN")],
        ["Type:",       "Service"],
    ];
    if (job.job_no) invMeta.push(["Job #:", job.job_no]);

    invMeta.forEach(([lbl, val]) => {
        doc.setFont("helvetica", "bold");   doc.setFontSize(8.5); doc.setTextColor(50, 50, 50);
        doc.text(lbl, titleX, ry);
        doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30);
        doc.text(val, titleX + 20, ry, { maxWidth: titleColW - 20 });
        ry += 4.5;
    });

    // y = Math.max(y, ry) + 4;

    // ── Divider ───────────────────────────────────────────────────────────────
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.line(M, y, rightX, y);
    y += 5;

    // ── Customer Details (left) | Shipping Address (right) ───────────────────
    const custColW = midX - M - 5;
    const shipX    = midX + 5;
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

    const cityStatePinParts = buildAddrLines([
        job.customer_city         ?? null,
        job.customer_state        ?? null,
        job.customer_postal_code  ? `Pin: ${job.customer_postal_code}` : null,
    ]);
    const cityStatePin = cityStatePinParts.join(", ") || null;

    const custLines = buildAddrLines([
        job.customer_address_line1 ?? null,
        job.customer_address_line2 ?? null,
        cityStatePin,
        job.mobile           ? `Ph: ${job.mobile}`               : null,
        job.customer_email   ? `Email: ${job.customer_email}`    : null,
        job.customer_gstin   ? `GSTIN: ${job.customer_gstin}`    : null,
    ]);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);

    // Customer — name line height
    const custNameLines = doc.splitTextToSize(job.customer_name || "—", custColW) as string[];
    let cy = y + custNameLines.length * 4.5;
    custLines.forEach(l => {
        const wrapped = doc.splitTextToSize(l, custColW) as string[];
        doc.text(wrapped, M, cy);
        cy += wrapped.length * 4;
    });

    // Shipping (same info — same address)
    let sy2 = custTopY + 4.5;
    const shipLines = buildAddrLines([
        job.customer_name          ?? null,
        job.customer_address_line1 ?? null,
        job.customer_address_line2 ?? null,
        cityStatePin,
        job.mobile ? `Ph: ${job.mobile}` : null,
    ]);
    shipLines.forEach(l => {
        const wrapped = doc.splitTextToSize(l, shipColW) as string[];
        doc.text(wrapped, shipX, sy2);
        sy2 += wrapped.length * 4;
    });

    y = Math.max(cy, sy2) + 2;

    // ── Items Table ───────────────────────────────────────────────────────────
    const lines = invoice.lines ?? [];
    const totalQty    = lines.reduce((s, l) => s + Number(l.qty), 0);
    const totalTax    = lines.reduce((s, l) => s + Number(l.cgst_amount) + Number(l.sgst_amount) + Number(l.igst_amount), 0);

    autoTable(doc, {
        startY:  y,
        margin:  { left: M, right: M },
        theme:   "grid",
        head:    [["#", "Items", "Qty", "Price", "Disc", "Aggregate", "Tax amount (%)", "Amount"]],
        body: lines.map((l, i) => {
            const tax = Number(l.cgst_amount) + Number(l.sgst_amount) + Number(l.igst_amount);
            const hsn = l.hsn_code ? `, HSN\n${l.hsn_code}` : "";
            return [
                i + 1,
                l.description + hsn,
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
            fmtAmt(totalQty),
            "",
            "0.00",
            fmtAmt(invoice.aggregate),
            fmtAmt(totalTax),
            fmtAmt(invoice.amount),
        ]],
        styles:       { fontSize: 8, cellPadding: 2, textColor: [30, 30, 30] },
        headStyles:   { fillColor: [255, 255, 255], textColor: [20, 20, 20], fontStyle: "bold", fontSize: 8, lineColor: [180, 180, 180], lineWidth: 0.3 },
        footStyles:   { fillColor: [255, 255, 255], fontStyle: "bold", textColor: [20, 20, 20], fontSize: 8 },
        bodyStyles:   { lineColor: [200, 200, 200], lineWidth: 0.3 },
        columnStyles: {
            0: { cellWidth: 8,  halign: "center" },
            2: { cellWidth: 14, halign: "right"  },
            3: { cellWidth: 20, halign: "right"  },
            4: { cellWidth: 14, halign: "right"  },
            5: { cellWidth: 22, halign: "right"  },
            6: { cellWidth: 28, halign: "right"  },
            7: { cellWidth: 22, halign: "right"  },
        },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;

    if (y > pageH - 65) { doc.addPage(); y = M; }

    // ── Receipts / Debits (left) | Summary box (right) ───────────────────────
    const sumBoxW = 72;
    const sumBoxX = rightX - sumBoxW;

    // Receipts heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text("Receipts / Debits", M, y);

    const payments = job.payments ?? [];
    const rcptY    = y + 4;

    if (payments.length > 0) {
        autoTable(doc, {
            startY:  rcptY,
            margin:  { left: M, right: pageW - sumBoxX + 6 },
            theme:   "grid",
            head:    [["#", "Dr. Account", "Details", "Amount", "Status"]],
            body: payments.map((p, i) => {
                const acct = p.reference_no ? `${p.payment_mode} ${p.reference_no}` : p.payment_mode;
                return [i + 1, acct, p.remarks ?? "", fmtAmt(p.amount), "Paid"];
            }),
            styles:       { fontSize: 7.5, cellPadding: 1.8, textColor: [30, 30, 30] },
            headStyles:   { fillColor: [255, 255, 255], textColor: [20, 20, 20], fontStyle: "bold", fontSize: 7.5, lineColor: [180, 180, 180], lineWidth: 0.3 },
            bodyStyles:   { lineColor: [200, 200, 200], lineWidth: 0.3 },
            columnStyles: {
                0: { cellWidth: 8,  halign: "center" },
                3: { cellWidth: 20, halign: "right"  },
                4: { cellWidth: 14, halign: "center" },
            },
        });
    } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text("No receipts recorded.", M, rcptY + 4);
    }

    // Summary box (right side, starting at same y as section heading)
    const sumRows: { label: string; value: number; bold?: boolean }[] = [
        { label: "Aggregate amount:", value: invoice.aggregate },
        { label: "Cgst:",             value: invoice.cgst_amount },
        { label: "Sgst:",             value: invoice.sgst_amount },
        { label: "Igst:",             value: invoice.igst_amount },
        { label: "Total amount:",     value: invoice.amount, bold: true },
    ];
    const rowH   = 5.5;
    const boxH   = sumRows.length * rowH + 6;
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
    const rcptBottom = payments.length > 0 ? (doc as any).lastAutoTable.finalY : rcptY + 10;
    y = Math.max(rcptBottom, sumTopY + boxH) + 8;

    // ── Footer: amount in words (left) + authorised signatory (right) ─────────
    if (y > pageH - 20) { doc.addPage(); y = M; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text(amountInWords(invoice.amount), M, y, { maxWidth: sumBoxX - M - 4 });

    doc.setFont("helvetica", "normal");
    doc.text("Authorised signatory", rightX, y, { align: "right" });

    return doc;
}

// ── Receipt-only PDF (A5) ─────────────────────────────────────────────────────

export function buildReceiptPdf(
    job: JobBasicInfo & { payments: { id: number; payment_date: string; payment_mode: string; amount: number; reference_no: string | null; remarks: string | null }[] },
): jsPDF {
    const doc       = new jsPDF({ format: "a5", orientation: "p", unit: "mm" });
    const margin    = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const midX      = pageWidth / 2;
    let   y         = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PAYMENT RECEIPT", midX, y, { align: "center" });
    y += 5;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;

    const infoRows: [string, string][] = [
        ["Job No",    job.job_no + (job.alternate_job_no ? ` / ${job.alternate_job_no}` : "")],
        ["Job Date",  job.job_date],
        ["Customer",  job.customer_name],
        ["Mobile",    job.mobile],
        ["Amount",    `₹${fmt(job.amount)}`],
    ];
    doc.setFontSize(9);
    infoRows.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x   = col === 0 ? margin : midX + 4;
        const cy  = y + row * 6.5;
        doc.setFont("helvetica", "bold");   doc.text(`${label}:`, x, cy);
        doc.setFont("helvetica", "normal"); doc.text(value, x + 26, cy);
    });
    y += Math.ceil(infoRows.length / 2) * 6.5 + 5;

    const payments   = job.payments ?? [];
    const totalPaid  = payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance    = Math.max(0, Number(job.amount ?? 0) - totalPaid);

    if (payments.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text("No receipts recorded.", margin, y);
    } else {
        autoTable(doc, {
            startY:  y,
            margin:  { left: margin, right: margin },
            head:    [["#", "Date", "Mode", "Amount", "Ref No", "Remarks"]],
            body:    payments.map((p, i) => [
                i + 1,
                p.payment_date.slice(0, 10),
                p.payment_mode,
                fmt(p.amount),
                p.reference_no ?? "—",
                p.remarks      ?? "—",
            ]),
            foot: [[
                { content: "TOTAL RECEIVED", colSpan: 3, styles: { fontStyle: "bold", halign: "right" } },
                fmt(totalPaid), "", "",
            ]],
            styles:       { fontSize: 8, cellPadding: 1.8 },
            headStyles:   { fillColor: [40, 120, 60], textColor: 255, fontStyle: "bold" },
            footStyles:   { fillColor: [230, 230, 230], fontStyle: "bold" },
            columnStyles: { 3: { halign: "right" } },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 4;

        if (balance > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(180, 0, 0);
            doc.text(`Balance Due: ₹${balance.toFixed(2)}`, pageWidth - margin, y, { align: "right" });
            doc.setTextColor(0, 0, 0);
        } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(0, 120, 60);
            doc.text("Fully Paid", pageWidth - margin, y, { align: "right" });
            doc.setTextColor(0, 0, 0);
        }
    }

    return doc;
}
