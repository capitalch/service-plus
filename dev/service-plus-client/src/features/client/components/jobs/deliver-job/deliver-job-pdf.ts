import { jsPDF }   from "jspdf";
import autoTable   from "jspdf-autotable";

import type { JobInvoiceFullRow } from "./deliver-job-schema";

// Minimal subset of JobDeliveryDetail needed for the PDF
export type PdfJobDetail = {
    job_no:            string;
    alternate_job_no:  string | null;
    job_date:          string;
    customer_name:     string;
    mobile:            string;
    technician_name:   string | null;
    job_status_name:   string;
    problem_reported:  string | null;
    diagnosis:         string | null;
    work_done:         string | null;
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

export function buildDeliverJobPdf(
    job:     PdfJobDetail,
    invoice: JobInvoiceFullRow | null,
): jsPDF {
    const doc       = new jsPDF({ format: "a4", orientation: "p", unit: "mm" });
    const margin    = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const midX      = pageWidth / 2;
    let   y         = margin;

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

    // Optional narrative fields
    const narrative: [string, string][] = [
        ["Problem Reported", job.problem_reported ?? ""],
        ["Diagnosis",        job.diagnosis        ?? ""],
        ["Work Done",        job.work_done        ?? ""],
    ].filter(([, v]) => v.trim() !== "") as [string, string][];

    if (narrative.length > 0) {
        narrative.forEach(([label, value]) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.text(`${label}:`, margin, y);
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(value, pageWidth - margin * 2 - 28);
            doc.text(lines, margin + 28, y);
            y += lines.length * 4.5 + 2;
        });
        y += 2;
    }

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
        y += 6;
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

    return doc;
}
