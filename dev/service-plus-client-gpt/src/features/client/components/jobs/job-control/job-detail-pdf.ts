import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";

import type { JobDetailType } from "@/features/client/types/job";
import type { JobTransactionRow } from "@/features/client/types/job";
import type { DivisionContextType } from "@/features/client/types/division";
import { isGstDivision } from "@/features/client/types/division";

export type JobPartUsedRow = {
    id:            number;
    part_code:     string;
    part_name:     string;
    qty:           number;
    selling_price: number | null;
    gst_rate:      number | null;
    hsn_code:      string | null;
    remarks:       string | null;
};

export type JobAdditionalChargeRow = {
    id:            number;
    charge_name:   string;
    ref_no:        string | null;
    description:   string | null;
    hsn_code:      string | null;
    gst_rate:      number;
    selling_price: number;
};

function fmt(val: string | number | null | undefined, fallback = "—"): string {
    if (val == null || val === "") return fallback;
    return String(val);
}

function fmtAmount(val: number | null | undefined): string {
    if (val == null) return "—";
    return `Rs.${Number(val).toFixed(2)}`;
}

function fmtDateTime(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${date}\n${time}`;
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
    // Same GST computation as job-final-info-modal.tsx's JobChargesReadonlyPanel — GST is
    // derived live from each part/charge's own gst_rate, not from a saved invoice (a job may
    // not be invoiced yet, but this report should still show the same GST breakdown staff
    // already see in "Final Info").
    const gstEnabled = isGstDivision(division);
    const forceIgst  = job.is_igst ?? false;

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
            ...(gstEnabled && job.customer_gstin ? [["GSTIN:", { content: fmt(job.customer_gstin), colSpan: 3 }]] : []),
            ["Device:",        fmt(device),                   "Serial No:",      fmt(job.serial_no)],
            ["Warranty Card:", fmt(job.warranty_card_no),     "Qty:",            fmt(job.qty)],
            ["Job Type:",      fmt(job.job_type_name),        "Receive Manner:", fmt(job.job_receive_manner_name)],
            ["Condition:",     fmt(job.job_receive_condition_name), "Amount:",   fmtAmount(job.amount)],
            ["Delivery Date:", fmt(job.delivery_date),        "Closed:",         job.is_closed ? "Yes" : "No"],
        ],
        columnStyles: { 0: { cellWidth: 36, fontStyle: "bold" }, 2: { cellWidth: 36, fontStyle: "bold" } },
        margin:  { left: 14, right: 14 },
        startY:  y,
        styles:  { cellPadding: 2.5, fontSize: 9, lineColor: [200, 200, 200], lineWidth: 0.3, overflow: "linebreak" },
        theme:   "grid",
        // Alt Job No is pushed to the right edge of the Job No cell instead of taking its
        // own row — same treatment as the Job Sheet PDF (job-sheet-pdf.ts), drawn manually
        // since autoTable can't right-align part of a cell's text.
        didDrawCell: data => {
            if (data.row.index === 0 && data.column.index === 1 && job.alternate_job_no) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(90, 90, 90);
                doc.text(`Alt: ${job.alternate_job_no}`, data.cell.x + data.cell.width - 2, data.cell.y + data.cell.height / 2 + 1, { align: "right" });
                doc.setTextColor(0, 0, 0);
            }
        },
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
        doc.setFontSize(10);
        for (const n of narratives) {
            if (y > pageHeight - 30) { doc.addPage(); y = 14; }
            doc.setFont("helvetica", "bold");
            doc.text(`${n.label}:`, 14, y);
            y += 5;
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(n.value!, pageWidth - 28);
            doc.text(lines, 14, y);
            y += lines.length * 5 + 3;
        }
        y += 2;
    }

    // ── Parts Used ────────────────────────────────────────────────────────────
    // GST-inclusive amount per line — identical formula to job-final-info-modal.tsx's
    // partSaleGst(): GST only applies when the division is GST-registered.
    const partGstRate = (p: JobPartUsedRow) => gstEnabled ? (p.gst_rate ?? 0) : 0;
    const partAmount  = (p: JobPartUsedRow) => Number(p.selling_price ?? 0) * (1 + partGstRate(p) / 100) * Number(p.qty);
    const chargeGstRate = (c: JobAdditionalChargeRow) => gstEnabled ? (c.gst_rate ?? 0) : 0;
    const chargeAmount  = (c: JobAdditionalChargeRow) => Number(c.selling_price ?? 0) * (1 + chargeGstRate(c) / 100);

    const partsTotal   = parts.reduce((s, p) => s + partAmount(p), 0);
    const chargesTotal = charges.reduce((s, c) => s + chargeAmount(c), 0);
    const grandTotal   = partsTotal + chargesTotal;
    // The job's own recorded amount is the authoritative total (matches what's actually
    // billed) — fall back to the live parts/charges calculation only when it isn't set.
    const effectiveTotal = (job.amount != null && job.amount > 0) ? job.amount : grandTotal;

    // CGST/SGST (or IGST, per the job's is_igst flag) portion already folded into the
    // totals above — broken out here purely for transparency, not added again.
    const partsGstAmt   = gstEnabled ? parts.reduce((s, p) => s + Number(p.selling_price ?? 0) * Number(p.qty) * partGstRate(p) / 100, 0) : 0;
    const chargesGstAmt = gstEnabled ? charges.reduce((s, c) => s + Number(c.selling_price ?? 0) * chargeGstRate(c) / 100, 0) : 0;
    const totalGstAmt   = partsGstAmt + chargesGstAmt;
    const cgstAmt = forceIgst ? 0 : totalGstAmt / 2;
    const sgstAmt = forceIgst ? 0 : totalGstAmt / 2;
    const igstAmt = forceIgst ? totalGstAmt : 0;

    if (parts.length > 0) {
        if (y > pageHeight - 40) { doc.addPage(); y = 14; }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Parts Used", 14, y);
        y += 6;
        autoTable(doc, {
            head: gstEnabled
                ? [["#", "Code", "Part Name", "HSN", "GST%", "Qty", "Unit Price", "Total"]]
                : [["#", "Code", "Part Name", "Qty", "Unit Price", "Total"]],
            body: parts.map((p, i) => gstEnabled
                ? [
                    String(i + 1), fmt(p.part_code), fmt(p.part_name),
                    fmt(p.hsn_code), `${partGstRate(p)}%`,
                    Number(p.qty).toFixed(2), fmtAmount(p.selling_price),
                    p.selling_price != null ? fmtAmount(partAmount(p)) : "—",
                ]
                : [
                    String(i + 1), fmt(p.part_code), fmt(p.part_name),
                    Number(p.qty).toFixed(2), fmtAmount(p.selling_price),
                    p.selling_price != null ? fmtAmount(partAmount(p)) : "—",
                ]),
            margin:     { left: 14, right: 14 },
            startY:     y,
            styles:     { cellPadding: 2.5, fontSize: 9, lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" },
            headStyles: { fontSize: 8.5, fontStyle: "bold", fillColor: [240, 240, 240], textColor: [50, 50, 50] },
            columnStyles: gstEnabled
                ? {
                    0: { cellWidth: 7 }, 1: { cellWidth: 20 },
                    3: { cellWidth: 18 }, 4: { cellWidth: 14, halign: "right" },
                    5: { cellWidth: 14, halign: "right" }, 6: { cellWidth: 26, halign: "right" }, 7: { cellWidth: 26, halign: "right" },
                }
                : {
                    0: { cellWidth: 7 }, 1: { cellWidth: 26 },
                    3: { cellWidth: 17, halign: "right" }, 4: { cellWidth: 32, halign: "right" }, 5: { cellWidth: 32, halign: "right" },
                },
            theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── Additional Charges ────────────────────────────────────────────────────
    if (charges.length > 0) {
        if (y > pageHeight - 40) { doc.addPage(); y = 14; }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Additional Charges", 14, y);
        y += 6;
        autoTable(doc, {
            head: gstEnabled
                ? [["#", "Charge Name", "Ref No", "Description", "HSN", "GST%", "Amount"]]
                : [["#", "Charge Name", "Ref No", "Description", "Amount"]],
            body: charges.map((c, i) => gstEnabled
                ? [String(i + 1), fmt(c.charge_name), fmt(c.ref_no), fmt(c.description), fmt(c.hsn_code), `${chargeGstRate(c)}%`, fmtAmount(chargeAmount(c))]
                : [String(i + 1), fmt(c.charge_name), fmt(c.ref_no), fmt(c.description), fmtAmount(chargeAmount(c))]),
            margin:     { left: 14, right: 14 },
            startY:     y,
            styles:     { cellPadding: 2.5, fontSize: 9, lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" },
            headStyles: { fontSize: 8.5, fontStyle: "bold", fillColor: [240, 240, 240], textColor: [50, 50, 50] },
            columnStyles: gstEnabled
                ? {
                    0: { cellWidth: 7 }, 1: { cellWidth: 38 }, 2: { cellWidth: 22 }, 3: { cellWidth: 47 },
                    4: { cellWidth: 18 }, 5: { cellWidth: 14, halign: "right" }, 6: { cellWidth: 26, halign: "right" },
                }
                : {
                    0: { cellWidth: 7 }, 1: { cellWidth: 48 }, 2: { cellWidth: 28 }, 3: { cellWidth: 67 }, 4: { cellWidth: 32, halign: "right" },
                },
            theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    // GST info shown here the same way job-final-info-modal.tsx's "Final Info" panel
    // shows it — computed live from parts/charges' own gst_rate, not from a saved
    // invoice, so it's available even for a job that hasn't been invoiced yet.
    if ((parts.length > 0 || charges.length > 0) && grandTotal > 0) {
        if (y > pageHeight - 30) { doc.addPage(); y = 14; }
        autoTable(doc, {
            body: [
                ...(parts.length   > 0 ? [["Parts",   fmtAmount(partsTotal)]]   : []),
                ...(charges.length > 0 ? [["Charges", fmtAmount(chargesTotal)]] : []),
                ...(gstEnabled && totalGstAmt > 0
                    ? (forceIgst ? [["IGST (incl. above)", fmtAmount(igstAmt)]] : [["CGST (incl. above)", fmtAmount(cgstAmt)], ["SGST (incl. above)", fmtAmount(sgstAmt)]])
                    : []),
                ["Calculated", fmtAmount(grandTotal)],
                ["Grand Total", fmtAmount(effectiveTotal)],
            ],
            margin:       { left: pageWidth - 84, right: 14 },
            startY:       y,
            styles:       { cellPadding: 2.5, fontSize: 9.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
            columnStyles: { 0: { fontStyle: "bold", cellWidth: 36 }, 1: { cellWidth: 34, halign: "right" } },
            theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── Transactions ──────────────────────────────────────────────────────────
    if (y > pageHeight - 50) { doc.addPage(); y = 14; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Transaction History", 14, y);
    y += 6;

    if (transactions.length === 0) {
        doc.setFontSize(9);
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
            styles:     { cellPadding: 2.5, fontSize: 9, lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" },
            headStyles: { fontSize: 8.5, fontStyle: "bold", fillColor: [240, 240, 240], textColor: [50, 50, 50] },
            columnStyles: {
                0: { cellWidth: 7 },
                1: { cellWidth: 28 },
                2: { cellWidth: 26 },
                3: { cellWidth: 26 },
                4: { cellWidth: 30, halign: "right" },
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
