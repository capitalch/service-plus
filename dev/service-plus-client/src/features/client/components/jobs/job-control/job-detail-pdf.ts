import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";

import type { JobDetailType } from "@/features/client/types/job";
import type { JobTransactionRow } from "@/features/client/types/job";
import type { DivisionContextType } from "@/features/client/types/division";

export type JobPartUsedRow = {
    id:            number;
    part_code:     string;
    part_name:     string;
    uom:           string;
    qty:           number;
    selling_price: number | null;
    remarks:       string | null;
};

export type JobAdditionalChargeRow = {
    id:            number;
    charge_name:   string;
    ref_no:        string | null;
    description:   string | null;
    selling_price: number;
};

function fmt(val: string | number | null | undefined, fallback = "—"): string {
    if (val == null || val === "") return fallback;
    return String(val);
}

function fmtAmount(val: number | null | undefined): string {
    if (val == null) return "—";
    return `₹${Number(val).toFixed(2)}`;
}

function fmtDateTime(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
    });
}

function buildJobDetailDoc(
    job: JobDetailType,
    transactions: JobTransactionRow[],
    division: DivisionContextType | null,
    parts: JobPartUsedRow[] = [],
    charges: JobAdditionalChargeRow[] = [],
): jsPDF {
    const doc       = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setProperties({
        title:   `Job-Detail_${job.job_no}`,
        subject: "Job Detail Report",
        author:  division?.name ?? "Service Plus",
        creator: "Service Plus",
    });

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(division?.name ?? "Service Plus", pageWidth / 2, 14, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let y = 19;

    if (division) {
        const addr = [division.address_line1, division.address_line2, division.city, division.pincode]
            .filter(Boolean).join(", ");
        doc.text(addr, pageWidth / 2, y, { align: "center" });
        y += 4;
        const contact = [
            division.phone && `Phone: ${division.phone}`,
            division.email && `Email: ${division.email}`,
        ].filter(Boolean).join(" | ");
        if (contact) { doc.text(contact, pageWidth / 2, y, { align: "center" }); y += 4; }
        if (division.gstin) { doc.text(`GSTIN: ${division.gstin}`, pageWidth / 2, y, { align: "center" }); y += 4; }
    }

    // ── Title ─────────────────────────────────────────────────────────────────
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("JOB DETAIL REPORT", pageWidth / 2, y + 1, { align: "center" });
    y += 8;

    // ── Job Info ──────────────────────────────────────────────────────────────
    const device = [job.product_name, job.brand_name, job.model_name].filter(Boolean).join(" / ") || "—";

    autoTable(doc, {
        body: [
            ["Job No:",        fmt(job.job_no),              "Date:",           fmt(job.job_date)],
            ["Status:",        fmt(job.job_status_name),     "Technician:",     fmt(job.technician_name)],
            ["Customer:",      fmt(job.customer_name),        "Mobile:",         fmt(job.mobile)],
            ["Address:",       { content: fmt(job.address_snapshot), colSpan: 3 }],
            ["Device:",        fmt(device),                   "Serial No:",      fmt(job.serial_no)],
            ["Warranty Card:", fmt(job.warranty_card_no),     "Qty:",            fmt(job.qty)],
            ["Job Type:",      fmt(job.job_type_name),        "Receive Manner:", fmt(job.job_receive_manner_name)],
            ["Condition:",     fmt(job.job_receive_condition_name), "Amount:",   fmtAmount(job.amount)],
            ["Delivery Date:", fmt(job.delivery_date),        "Closed:",         job.is_closed ? "Yes" : "No"],
        ],
        columnStyles: { 0: { cellWidth: 34, fontStyle: "bold" }, 2: { cellWidth: 34, fontStyle: "bold" } },
        margin:  { left: 14, right: 14 },
        startY:  y,
        styles:  { cellPadding: 2, fontSize: 8.5, lineColor: [200, 200, 200], lineWidth: 0.3 },
        theme:   "grid",
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    // ── Narrative fields ──────────────────────────────────────────────────────
    const narratives: { label: string; value: string | null }[] = [
        { label: "Problem Reported", value: job.problem_reported },
        { label: "Diagnosis",        value: job.diagnosis },
        { label: "Work Done",        value: job.work_done },
        { label: "Remarks",          value: job.remarks },
    ].filter(n => n.value && n.value.trim());

    if (narratives.length > 0) {
        doc.setFontSize(9);
        for (const n of narratives) {
            if (y > pageHeight - 30) { doc.addPage(); y = 14; }
            doc.setFont("helvetica", "bold");
            doc.text(`${n.label}:`, 14, y);
            y += 4;
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(n.value!, pageWidth - 28);
            doc.text(lines, 14, y);
            y += lines.length * 4 + 3;
        }
        y += 2;
    }

    // ── Parts Used ────────────────────────────────────────────────────────────
    const partsSelling   = parts.reduce((s, p) => s + Number(p.selling_price ?? 0) * Number(p.qty), 0);
    const chargesSelling = charges.reduce((s, c) => s + Number(c.selling_price ?? 0), 0);
    const grandTotal     = partsSelling + chargesSelling;

    if (parts.length > 0) {
        if (y > pageHeight - 40) { doc.addPage(); y = 14; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Parts Used", 14, y);
        y += 5;
        autoTable(doc, {
            head: [["#", "Code", "Part Name", "UOM", "Qty", "Unit Price", "Total"]],
            body: parts.map((p, i) => [
                String(i + 1),
                fmt(p.part_code),
                fmt(p.part_name),
                fmt(p.uom),
                Number(p.qty).toFixed(2),
                fmtAmount(p.selling_price),
                p.selling_price != null ? fmtAmount(Number(p.selling_price) * Number(p.qty)) : "—",
            ]),
            margin:     { left: 14, right: 14 },
            startY:     y,
            styles:     { cellPadding: 1.8, fontSize: 7.5, lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" },
            headStyles: { fontSize: 7, fontStyle: "bold", fillColor: [240, 240, 240], textColor: [50, 50, 50] },
            columnStyles: { 0: { cellWidth: 8 }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
            theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── Additional Charges ────────────────────────────────────────────────────
    if (charges.length > 0) {
        if (y > pageHeight - 40) { doc.addPage(); y = 14; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Additional Charges", 14, y);
        y += 5;
        autoTable(doc, {
            head: [["#", "Charge Name", "Ref No", "Description", "Amount"]],
            body: charges.map((c, i) => [
                String(i + 1),
                fmt(c.charge_name),
                fmt(c.ref_no),
                fmt(c.description),
                fmtAmount(c.selling_price),
            ]),
            margin:     { left: 14, right: 14 },
            startY:     y,
            styles:     { cellPadding: 1.8, fontSize: 7.5, lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" },
            headStyles: { fontSize: 7, fontStyle: "bold", fillColor: [240, 240, 240], textColor: [50, 50, 50] },
            columnStyles: { 0: { cellWidth: 8 }, 4: { halign: "right" } },
            theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    if ((parts.length > 0 || charges.length > 0) && grandTotal > 0) {
        if (y > pageHeight - 30) { doc.addPage(); y = 14; }
        autoTable(doc, {
            body: [
                ...(parts.length   > 0 ? [["Parts",   fmtAmount(partsSelling)]]   : []),
                ...(charges.length > 0 ? [["Charges", fmtAmount(chargesSelling)]] : []),
                ["Grand Total", fmtAmount(grandTotal)],
            ],
            margin:       { left: pageWidth - 84, right: 14 },
            startY:       y,
            styles:       { cellPadding: 1.8, fontSize: 8.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
            columnStyles: { 0: { fontStyle: "bold", cellWidth: 34 }, 1: { halign: "right" } },
            theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── Transactions ──────────────────────────────────────────────────────────
    if (y > pageHeight - 50) { doc.addPage(); y = 14; }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Transaction History", 14, y);
    y += 5;

    if (transactions.length === 0) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "italic");
        doc.text("No transactions recorded.", 14, y);
    } else {
        const head = [["#", "Date & Time", "Status", "Technician", "Amount", "Remarks", "Performed By"]];
        const body = transactions.map((t, i) => [
            String(i + 1),
            fmtDateTime(t.performed_at),
            fmt(t.status_name),
            fmt(t.technician_name),
            fmtAmount(t.amount),
            fmt(t.remarks),
            fmt(t.performed_by_name),
        ]);

        autoTable(doc, {
            head,
            body,
            margin:     { left: 14, right: 14 },
            startY:     y,
            styles:     { cellPadding: 1.8, fontSize: 7.5, lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" },
            headStyles: { fontSize: 7, fontStyle: "bold", fillColor: [240, 240, 240], textColor: [50, 50, 50] },
            columnStyles: {
                0: { cellWidth: 8 },
                1: { cellWidth: 32 },
                2: { cellWidth: 26 },
                3: { cellWidth: 26 },
                4: { cellWidth: 18, halign: "right" },
                5: { cellWidth: 40, overflow: "linebreak" },
                6: { cellWidth: 26 },
            },
            theme: "grid",
            didDrawPage: (_data) => {
                const pg = doc.getNumberOfPages();
                doc.setFontSize(7);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(150);
                doc.text(`Page ${pg}`, pageWidth - 14, pageHeight - 6, { align: "right" });
                doc.setTextColor(0);
            },
        });
    }

    return doc;
}

export function getJobDetailPdfBlobUrl(
    job: JobDetailType,
    transactions: JobTransactionRow[],
    division: DivisionContextType | null,
    parts: JobPartUsedRow[] = [],
    charges: JobAdditionalChargeRow[] = [],
): string {
    return String(buildJobDetailDoc(job, transactions, division, parts, charges).output("bloburl"));
}

export function downloadJobDetailPdf(
    job: JobDetailType,
    transactions: JobTransactionRow[],
    division: DivisionContextType | null,
    parts: JobPartUsedRow[] = [],
    charges: JobAdditionalChargeRow[] = [],
): void {
    buildJobDetailDoc(job, transactions, division, parts, charges).save(`Job-Detail_${job.job_no}.pdf`);
}
