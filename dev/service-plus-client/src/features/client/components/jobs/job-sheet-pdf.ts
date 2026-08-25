import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";

import type { JobDetailType, JobTransactionRow } from "@/features/client/types/job";
import type { DivisionContextType } from "@/features/client/types/division";
import { isGstDivision } from "@/features/client/types/division";
import type { JobInvoiceFullRow } from "./deliver-job/deliver-job-schema";

// ── Types used by the full job-info PDF ──────────────────────────────────────

type JobInfoPartRow = {
    id: number; part_code: string; part_name: string;
    uom: string; qty: number; remarks: string | null;
};

type JobInfoChargeRow = {
    id: number; charge_name: string; ref_no: string | null;
    description: string | null; cost_price: number; selling_price: number;
};

type JobInfoFileRow = {
    id: number; url: string; about: string; created_at: string;
};

type JobInfoPaymentRow = {
    id: number; receipt_no: string | null; payment_date: string;
    payment_mode: string; amount: number; reference_no: string | null; remarks: string | null;
};

// ── Shared "track job" info line (single job sheet + batch job sheet) ─────────

type SingleJobSheetPrintMeta = {
    clientName?:         string | null;
    buName?:             string | null;
    trackJobUrl?:        string | null;
    termsAndConditions?: string | null;
};

function buildTrackInfoLine(printMeta: SingleJobSheetPrintMeta | undefined, extra: { label: string; value: string }[]): string {
    const segments: string[] = [];
    if (printMeta?.trackJobUrl) segments.push(`Track your Job URL: ${printMeta.trackJobUrl}`);
    const nameBu = [printMeta?.clientName, printMeta?.buName].filter(Boolean).join(" -- ");
    if (nameBu) segments.push(nameBu);
    for (const e of extra) segments.push(`${e.label}: ${e.value}`);
    return segments.join("  |  ");
}

// Shrinks the font size until `text` fits within `maxWidth` on one line (floor 5.5pt),
// since client/BU names and URLs vary too much in length for a fixed size to be safe.
// Measures using the same font weight it'll actually be rendered in — bold glyphs are
// wider than normal ones, so measuring at the wrong weight risks under-shrinking.
function fitSingleLineFontSize(doc: jsPDF, text: string, maxWidth: number, startSize = 7, minSize = 5.5, step = 0.25, bold = false): number {
    let size = startSize;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    while (size > minSize && doc.getTextWidth(text) > maxWidth) {
        size -= step;
        doc.setFontSize(size);
    }
    return size;
}

// Terms & conditions notice — bold italic, full width, hard-clipped to 3 lines (a 4th+
// line is simply dropped, not shrunk to fit). Used by both the single and batch job sheet
// builders, each of which anchors it differently (fixed vs. content-relative), so wrapping
// and drawing are split: callers measure first to know the block's height, then draw at
// whatever Y that anchoring works out to.
const PT_PER_MM = 1 / 0.352778;

function wrapTermsAndConditions(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(fontSize);
    // Normalize any ₹ back to "Rs" regardless of how it got into the stored setting (e.g.
    // OS/keyboard autocorrect converting "Rs" while it was being typed into App Settings) —
    // the printed Job Sheet should never show the symbol.
    const normalized = text.replace(/₹\s*/g, "Rs ");
    return (doc.splitTextToSize(normalized, maxWidth) as string[]).slice(0, 3);
}

function drawTermsAndConditions(doc: jsPDF, lines: string[], x: number, topY: number, fontSize: number, lineHeightMm: number): void {
    if (lines.length === 0) return;
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(fontSize);
    doc.text(lines, x, topY, { lineHeightFactor: (lineHeightMm * PT_PER_MM) / fontSize });
    doc.setFont("helvetica", "normal");
}

function buildSingleJobSheetDoc(job: JobDetailType, division: DivisionContextType | null, branchCode?: string, copies = 1, printMeta?: SingleJobSheetPrintMeta): jsPDF {
    // Standard A4 page; content fits within top 148.5 mm (half-A4 stationery)
    const doc       = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    // Signatures are anchored to the bottom edge of the printable half-A4 area
    const HALF_A4_BOTTOM = 144;

    const trackLineText     = buildTrackInfoLine(printMeta, [
        { label: "Job No", value: job.job_no },
        { label: "Mobile", value: job.mobile },
    ]);
    // -4 accounts for the table cell's own left/right padding (cellPadding: 2 each side)
    const trackLineFontSize = trackLineText ? fitSingleLineFontSize(doc, trackLineText, pageWidth - 30 - 4, 11, 5.5, 0.25, true) : 0;

    doc.setProperties({
        title: `Job-Sheet_${job.job_date}_${job.customer_name || "customer"}`,
        subject: "Job Sheet",
        author: division?.name || "Service Plus",
        creator: "Service Plus"
    });

    // yOffset places the copy in the top half (0) or bottom half (148.5) of the A4 page
    function drawContent(yOffset: number = 0) {
        // ── Header ────────────────────────────────────────────────────────────────
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.text(division?.name ?? "Electronic Gadgets Repair", pageWidth / 2, 14 + yOffset, { align: "center" });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        let y = 19 + yOffset;

        if (division) {
            const addr = [division.address_line1, division.address_line2, division.city, division.pincode]
                .filter(Boolean).join(", ");
            doc.text(addr, pageWidth / 2, y, { align: "center" });
            y += 4;

            if (division.phone || division.email) {
                const contact = [
                    division.phone && `Phone: ${division.phone}`,
                    division.email && `Email: ${division.email}`,
                ].filter(Boolean).join(" | ");
                doc.text(contact, pageWidth / 2, y, { align: "center" });
                y += 4;
            }

            if (division.gstin) {
                doc.text(`GSTIN: ${division.gstin}`, pageWidth / 2, y, { align: "center" });
                y += 5;
            }
        }

        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("JOB SHEET", pageWidth / 2, y + 1, { align: "center" });
        y += 6;

        // ── Info Grid ─────────────────────────────────────────────────────────────
        autoTable(doc, {
            body: [
                ["Job No:",   job.job_no,                  "Date:",          job.job_date],
                ...(job.purchase_date
                    ? [
                        ["Branch:",   branchCode ?? "—",         "Purchase Date:", job.purchase_date],
                        ["Customer:", job.customer_name ?? "—",  "Mobile:",        job.mobile],
                    ]
                    : [
                        ["Branch:",   branchCode ?? "—",         "Customer:",      job.customer_name ?? "—"],
                        [
                            { content: "Mobile:", styles: { fontStyle: "bold" as const } },
                            { content: job.mobile, colSpan: 3 },
                        ],
                    ]),
                [
                    { content: "Address:", styles: { fontStyle: "bold" } },
                    { content: job.address_snapshot ?? "—", colSpan: 3 },
                ],
                ["Product:",  job.product_name  ?? "—",     "Brand:",         job.brand_name ?? "—"],
                ["Model:",    job.model_name    ?? "—",      "Serial No:",     job.serial_no  ?? "—"],
                [{ content: "Qty:", styles: { fontStyle: "bold" } }, { content: String(job.qty), colSpan: 3 }],
                ["Job Type:", job.job_type_name,             "Warranty Card:", job.warranty_card_no ?? "—"],
                ["Receive Manner:",   job.job_receive_manner_name,   "Condition:",     job.job_receive_condition_name ?? "—"],
                ...(trackLineText ? [[
                    {
                        content: trackLineText,
                        colSpan: 4,
                        styles: { fontStyle: "bold" as const, halign: "center" as const, fontSize: trackLineFontSize },
                    },
                ]] : []),
            ],
            columnStyles: { 0: { cellWidth: 35, fontStyle: "bold" }, 2: { cellWidth: 35, fontStyle: "bold" } },
            margin:       { left: 15, right: 15 },
            startY:       y,
            styles:       { cellPadding: 2, fontSize: 9, lineColor: [180, 180, 180], lineWidth: 0.3 },
            theme:        "grid",
            // Alt Job No is pushed to the right edge of the Job No cell instead of taking its
            // own row — drawn manually since autoTable can't right-align part of a cell's text.
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

        y = (doc as any).lastAutoTable.finalY + 3;

        // ── Problem Reported & Remarks ───────────────────────────────────────────
        const hasRemarks = job.remarks && job.remarks.trim().length > 0;
        const halfWidth = (pageWidth - 30) / 2;

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Problem Reported:", 15, y);
        if (hasRemarks) {
            doc.text("Remarks:", pageWidth / 2, y);
        }
        y += 5;
        doc.setFont("helvetica", "normal");
        const splitProblem = doc.splitTextToSize(job.problem_reported || "—", halfWidth);
        doc.text(splitProblem, 15, y);
        let remarksLineCount = 0;
        if (hasRemarks) {
            const splitRemarks = doc.splitTextToSize(job.remarks!, halfWidth);
            doc.text(splitRemarks, pageWidth / 2, y);
            remarksLineCount = splitRemarks.length;
        }
        // Normal 9pt text's default line height (jsPDF's own lineHeightFactor, ~1.15).
        const contentBottom = y + Math.max(splitProblem.length, remarksLineCount) * 3.65;

        // ── Signatures (anchored to bottom of half-A4 area) ──────────────────────
        const sigY = HALF_A4_BOTTOM + yOffset;

        // Terms & conditions — follows directly after Problem Reported/Remarks (no dead
        // gap above it), but never later than a fixed distance above the signature line,
        // so unusually long Problem/Remarks text still can't push it into the signature.
        if (printMeta?.termsAndConditions) {
            const tncFontSize   = 6.5;
            const tncLineHeight = 2.4; // mm, baseline-to-baseline
            const tncLines      = wrapTermsAndConditions(doc, printMeta.termsAndConditions, pageWidth - 30, tncFontSize);
            const tncBlockSpan  = (tncLines.length - 1) * tncLineHeight;
            const latestFirstLineY = sigY - 4 - 1 - tncBlockSpan; // 1mm clear of the signature underline
            const tncFirstLineY    = Math.min(contentBottom + 2, latestFirstLineY);
            drawTermsAndConditions(doc, tncLines, 15, tncFirstLineY, tncFontSize, tncLineHeight);
        }

        doc.setFontSize(9);
        doc.setDrawColor(180);
        doc.line(15,             sigY - 4, 70,             sigY - 4);
        doc.line(pageWidth - 70, sigY - 4, pageWidth - 15, sigY - 4);
        doc.text("Customer Signature",  15,            sigY);
        doc.text("Authorized Signatory", pageWidth - 15, sigY, { align: "right" });

        // Cut/separation guide between two copies stacked on the same page
        if (yOffset > 0) {
            doc.setLineDashPattern([2, 2], 0);
            doc.line(15, yOffset, pageWidth - 15, yOffset);
            doc.setLineDashPattern([], 0);
        }
    }

    // Two copies share one A4 page (top/bottom half); a new page starts only every 2 copies
    const SECOND_COPY_Y_OFFSET = 148.5;
    for (let i = 0; i < copies; i++) {
        const isBottomHalf = i % 2 === 1;
        if (i > 0 && !isBottomHalf) {
            doc.addPage();
        }
        drawContent(isBottomHalf ? SECOND_COPY_Y_OFFSET : 0);
    }

    return doc;
}

export function getJobSheetBlobUrl(job: JobDetailType, division: DivisionContextType | null, branchCode?: string, copies = 1, printMeta?: SingleJobSheetPrintMeta): string {
    const doc = buildSingleJobSheetDoc(job, division, branchCode, copies, printMeta);
    return String(doc.output("bloburl"));
}

// ── Batch Job Sheet ───────────────────────────────────────────────────────────

function buildBatchJobSheetDoc(jobs: JobDetailType[], division: DivisionContextType | null, branchCode?: string, copies = 1, printMeta?: SingleJobSheetPrintMeta): jsPDF {
    const doc       = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    const batchNo   = (jobs[0] as JobDetailType & { batch_no?: number })?.batch_no ?? 0;
    const batchDate = jobs[0]?.job_date  ?? "";
    const customer  = jobs[0]?.customer_name ?? "—";
    const mobile    = jobs[0]?.mobile ?? "—";
    const address   = jobs[0]?.address_snapshot ?? "—";
    const manner    = jobs[0]?.job_receive_manner_name ?? "—";
    const branch    = branchCode ?? "—";

    // No "Job No" segment here — a batch covers multiple jobs, each already
    // listed with its own job no in the jobs table below.
    const trackLineText     = buildTrackInfoLine(printMeta, [{ label: "Mobile", value: mobile }]);
    // -2.4 accounts for the batch info grid's own cell padding (cellPadding: 1.2 each side)
    const trackLineFontSize = trackLineText ? fitSingleLineFontSize(doc, trackLineText, pageWidth - 30 - 2.4, 11, 5.5, 0.25, true) : 0;

    doc.setProperties({
        title:    `Batch-Job-Sheet_${batchNo}`,
        subject:  "Batch Job Sheet",
        author:   division?.name ?? "Service Plus",
        creator:  "Service Plus",
    });

    function drawContent(yOffset: number = 0): number {
        // ── Header (2 lines) ──────────────────────────────────────────────────
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(division?.name ?? "Electronic Gadgets Repair", pageWidth / 2, 11 + yOffset, { align: "center" });

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        let y = 16 + yOffset;

        if (division) {
            const line1 = [division.address_line1, division.address_line2, division.city, division.pincode].filter(Boolean).join(", ");
            const line2 = [division.phone && `Ph: ${division.phone}`, division.email && `Email: ${division.email}`, division.gstin && `GSTIN: ${division.gstin}`].filter(Boolean).join(" | ");
            doc.text(line1, pageWidth / 2, y, { align: "center" });
            y += 3.5;
            if (line2) {
                doc.text(line2, pageWidth / 2, y, { align: "center" });
                y += 3.5;
            }
        }

        // ── Title + Batch Info ─────────────────────────────────────────────────
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("BATCH JOB SHEET", pageWidth / 2, y + 1, { align: "center" });
        y += 6;

        autoTable(doc, {
            body: [
                ["Batch No:", `#${batchNo}`,  "Date:",     batchDate],
                ["Branch:",   branch,          "Customer:", customer],
                ["Mobile:",   mobile,          "Receive Manner:", manner],
                ["Address:",  address,          "Jobs:",     String(jobs.length)],
                ...(trackLineText ? [[
                    {
                        content: trackLineText,
                        colSpan: 4,
                        styles: { fontStyle: "bold" as const, halign: "center" as const, fontSize: trackLineFontSize },
                    },
                ]] : []),
            ],
            columnStyles: { 0: { cellWidth: 28, fontStyle: "bold" }, 2: { cellWidth: 28, fontStyle: "bold" } },
            margin:       { left: 15, right: 15 },
            startY:       y,
            styles:       { cellPadding: 1.2, fontSize: 7.5, lineColor: [180, 180, 180], lineWidth: 0.3 },
            theme:        "grid",
        });

        y = (doc as any).lastAutoTable.finalY + 3;

        // ── Jobs Table ─────────────────────────────────────────────────────────
        const showPurchaseDate = jobs.some(j => j.purchase_date);
        const colCount = showPurchaseDate ? 9 : 8;
        const head = [showPurchaseDate
            ? ["#", "Job No", "Date", "Purchase Date", "Product / Brand / Model", "Job Type", "Qty", "Condition", "Serial No"]
            : ["#", "Job No", "Date", "Product / Brand / Model", "Job Type", "Qty", "Condition", "Serial No"]];

        const body: (string | number | { content: string; colSpan: number; styles: Record<string, unknown> })[][] = [];
        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i]!;
            body.push([
                i + 1,
                job.job_no + (job.alternate_job_no ? ` (Alt: ${job.alternate_job_no})` : ""),
                job.job_date,
                ...(showPurchaseDate ? [job.purchase_date ?? "—"] : []),
                [job.product_name, job.brand_name, job.model_name].filter(Boolean).join(" / ") || "—",
                job.job_type_name,
                String(job.qty),
                job.job_receive_condition_name ?? "—",
                job.serial_no ?? "—",
            ]);

            const probRemText = [
                job.problem_reported?.trim() && job.problem_reported.trim(),
                job.remarks?.trim()        && job.remarks.trim(),
            ].filter(Boolean).join(" | ");

            if (probRemText) {
                body.push([
                    { content: probRemText, colSpan: colCount, styles: { fontSize: 6, textColor: [80, 80, 80], cellPadding: 1 } },
                ]);
            }
        }

        autoTable(doc, {
            head,
            body,
            margin:    { left: 15, right: 15 },
            startY:    y,
            styles:    { cellPadding: 1.5, fontSize: 7.5, lineColor: [200, 200, 200], lineWidth: 0.2, overflow: "linebreak" },
            headStyles: { fontSize: 6.5, fontStyle: "bold", fillColor: [240, 240, 240], textColor: [60, 60, 60] },
            columnStyles: showPurchaseDate
                ? {
                    0: { cellWidth: 8 },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 18 },
                    3: { cellWidth: 20 },
                    4: { cellWidth: 38 },
                    5: { cellWidth: 22 },
                    6: { cellWidth: 8 },
                    7: { cellWidth: 22 },
                    8: { cellWidth: 24 },
                }
                : {
                    0: { cellWidth: 8 },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 18 },
                    3: { cellWidth: 52 },
                    4: { cellWidth: 24 },
                    5: { cellWidth: 8 },
                    6: { cellWidth: 24 },
                    7: { cellWidth: 26 },
                },
            theme:     "grid",
        });

        // ── Signatures (placed after table, on same page or last page) ───────
        const finalY   = (doc as any).lastAutoTable.finalY ?? y;
        const pageHeight = doc.internal.pageSize.getHeight();
        const sigY = Math.min(finalY + 20, pageHeight - 10);

        // Terms & conditions — drawn into the existing (currently blank) `finalY + 20` gap
        // reserved for the signature block, so this never grows the page's total height.
        // Guarded against the rare case where sigY got clamped to pageHeight - 10 (content
        // ran close to the page bottom), leaving less than the usual 20mm of slack.
        if (printMeta?.termsAndConditions) {
            const tncFontSize   = 6;
            const tncLineHeight = 2.2; // mm, baseline-to-baseline
            const tncLines      = wrapTermsAndConditions(doc, printMeta.termsAndConditions, pageWidth - 30, tncFontSize);
            const tncTop        = finalY + 3;
            const tncBottom     = tncTop + (tncLines.length - 1) * tncLineHeight;
            if (tncBottom <= sigY - 5) {
                drawTermsAndConditions(doc, tncLines, 15, tncTop, tncFontSize, tncLineHeight);
            }
        }

        doc.setFontSize(7.5);
        doc.setDrawColor(180);
        doc.line(15,             sigY - 4, 60,             sigY - 4);
        doc.line(pageWidth - 60, sigY - 4, pageWidth - 15, sigY - 4);
        doc.text("Customer Signature",  15,            sigY);
        doc.text("Authorized Signatory", pageWidth - 15, sigY, { align: "right" });

        return (finalY + 20) - yOffset; // natural content height of this copy, unclamped
    }

    // Pack a second copy into the bottom half of the same page when the first
    // copy's content fits within half the page; otherwise fall back to one copy
    // per page. Since every copy renders the same jobs array, measuring the first
    // copy's height is enough to decide the layout for all remaining copies. The
    // split is anchored to the page's physical middle (not right after the content)
    // so the cut line lands in the same place regardless of content length.
    const docPageHeight = doc.internal.pageSize.getHeight();
    const HALF_PAGE = docPageHeight / 2;
    let copyHeight = 0;
    let canPackTwo = false;

    for (let i = 0; i < copies; i++) {
        const isBottomHalf = canPackTwo && i % 2 === 1;
        if (i > 0 && !isBottomHalf) {
            doc.addPage();
        }
        const yOffset = isBottomHalf ? HALF_PAGE : 0;
        const height = drawContent(yOffset);

        if (i === 0) {
            copyHeight = height;
            canPackTwo = copyHeight <= HALF_PAGE;
        }

        if (isBottomHalf) {
            doc.setLineDashPattern([2, 2], 0);
            doc.line(15, HALF_PAGE, pageWidth - 15, HALF_PAGE);
            doc.setLineDashPattern([], 0);
        }
    }

    return doc;
}

export function getBatchJobSheetBlobUrl(jobs: JobDetailType[], division: DivisionContextType | null, branchCode?: string, copies = 1, printMeta?: SingleJobSheetPrintMeta): string {
    const doc = buildBatchJobSheetDoc(jobs, division, branchCode, copies, printMeta);
    return String(doc.output("bloburl"));
}

// ── Full Job Info PDF ─────────────────────────────────────────────────────────

type JobInfoInput = {
    job:          JobDetailType;
    division:     DivisionContextType | null;
    branchCode?:  string;
    transactions: JobTransactionRow[];
    parts:        JobInfoPartRow[];
    charges:      JobInfoChargeRow[];
    files:        JobInfoFileRow[];
    invoice:      JobInvoiceFullRow | null;
    payments:     JobInfoPaymentRow[];
};

function fmt(val: number | null | undefined) {
    return val == null ? "—" : `Rs.${Number(val).toFixed(2)}`;
}

function sectionHeader(doc: jsPDF, text: string, y: number, pageWidth: number): number {
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y, pageWidth - 28, 6, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(text.toUpperCase(), 16, y + 4.2);
    doc.setTextColor(0, 0, 0);
    return y + 9;
}

function narrativeBlock(doc: jsPDF, label: string, value: string | null | undefined, y: number, pageWidth: number): number {
    if (!value?.trim()) return y;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value.trim(), pageWidth - 28);
    doc.text(lines, 14, y);
    return y + lines.length * 4 + 3;
}

function checkPage(doc: jsPDF, y: number, needed = 20): number {
    if (y + needed > doc.internal.pageSize.getHeight() - 15) {
        doc.addPage();
        return 15;
    }
    return y;
}

function buildJobInfoDoc({ job, division, branchCode, transactions, parts, charges, files, invoice, payments }: JobInfoInput): jsPDF {
    const doc        = new jsPDF();
    const pageWidth   = doc.internal.pageSize.getWidth();
    const gstEnabled  = isGstDivision(division);

    doc.setProperties({
        title:   `Job-Info_${job.job_no}`,
        subject: "Job Information Report",
        author:  division?.name ?? "Service Plus",
        creator: "Service Plus",
    });

    // ── Page header helper (called once per page if needed) ──────────────────
    let y = 12;

    // Company name
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(division?.name ?? "Service Plus", pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    if (division) {
        const addr = [division.address_line1, division.address_line2, division.city, division.pincode].filter(Boolean).join(", ");
        if (addr) { doc.text(addr, pageWidth / 2, y, { align: "center" }); y += 3.5; }
        const contact = [division.phone && `Ph: ${division.phone}`, division.email && `Email: ${division.email}`, division.gstin && `GSTIN: ${division.gstin}`].filter(Boolean).join(" | ");
        if (contact) { doc.text(contact, pageWidth / 2, y, { align: "center" }); y += 3.5; }
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("JOB INFORMATION REPORT", pageWidth / 2, y + 1, { align: "center" });
    y += 8;

    doc.setDrawColor(180);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;

    // ── 1. Job Overview ───────────────────────────────────────────────────────
    y = sectionHeader(doc, "Job Overview", y, pageWidth);
    const overviewRows: (string | { content: string; colSpan: number; styles: Record<string, unknown> })[][] = [
        ["Job No:", job.job_no, "Date:", job.job_date],
        ["Status:", `${job.job_status_name}${job.is_final && !job.is_closed ? "  [FINAL]" : ""}`, "Job Type:", job.job_type_name],
        ["Branch:", branchCode ?? "—", "Division:", division?.name ?? "—"],
    ];
    autoTable(doc, {
        body: overviewRows,
        startY: y, margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 1.8, lineColor: [210, 210, 210], lineWidth: 0.2 },
        columnStyles: { 0: { cellWidth: 30, fontStyle: "bold" }, 2: { cellWidth: 30, fontStyle: "bold" } },
        theme: "grid",
        // Alt Job No is pushed to the right edge of the Job No cell instead of taking its
        // own row — same treatment as the Job Sheet PDF (job-sheet-pdf.ts's single job
        // sheet builder), drawn manually since autoTable can't right-align part of a cell.
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

    // ── 2. Customer ───────────────────────────────────────────────────────────
    y = checkPage(doc, y, 30);
    y = sectionHeader(doc, "Customer", y, pageWidth);
    const customerRows: (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[][] = [
        ["Name:", job.customer_name ?? "—", "Mobile:", job.mobile],
        [{ content: "Address:", styles: { fontStyle: "bold" } }, { content: job.address_snapshot ?? "—", colSpan: 3 }],
    ];
    if (gstEnabled && job.customer_gstin) customerRows.push(["GSTIN:", job.customer_gstin, "", ""]);
    autoTable(doc, {
        body: customerRows,
        startY: y, margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 1.8, lineColor: [210, 210, 210], lineWidth: 0.2 },
        columnStyles: { 0: { cellWidth: 30, fontStyle: "bold" }, 2: { cellWidth: 30, fontStyle: "bold" } },
        theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    // ── 3. Device ─────────────────────────────────────────────────────────────
    y = checkPage(doc, y, 30);
    y = sectionHeader(doc, "Device", y, pageWidth);
    autoTable(doc, {
        body: [
            ["Product:", job.product_name ?? "—", "Brand:", job.brand_name ?? "—"],
            ["Model:", job.model_name ?? "—", "Serial No:", job.serial_no ?? "—"],
            ["Qty:", String(job.qty), "Warranty Card:", job.warranty_card_no ?? "—"],
            ["Receive Mode:", job.job_receive_manner_name, "Condition:", job.job_receive_condition_name ?? "—"],
        ],
        startY: y, margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 1.8, lineColor: [210, 210, 210], lineWidth: 0.2 },
        columnStyles: { 0: { cellWidth: 30, fontStyle: "bold" }, 2: { cellWidth: 30, fontStyle: "bold" } },
        theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    // ── 4. Service Details ────────────────────────────────────────────────────
    y = checkPage(doc, y, 25);
    y = sectionHeader(doc, "Service Details", y, pageWidth);
    autoTable(doc, {
        body: [
            ["Technician:", job.technician_name ?? "—", "Delivery Date:", job.delivery_date ?? "—"],
            ["Amount:", fmt(job.amount), "Estimate:", fmt(job.estimate_amount)],
        ],
        startY: y, margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 1.8, lineColor: [210, 210, 210], lineWidth: 0.2 },
        columnStyles: { 0: { cellWidth: 30, fontStyle: "bold" }, 2: { cellWidth: 30, fontStyle: "bold" } },
        theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    // ── 5. Narrative fields ───────────────────────────────────────────────────
    y = checkPage(doc, y, 20);
    y = sectionHeader(doc, "Notes", y, pageWidth);
    y = narrativeBlock(doc, "Problem Reported", job.problem_reported || "—", y, pageWidth);
    y = narrativeBlock(doc, "Diagnosis", job.diagnosis, y, pageWidth);
    y = narrativeBlock(doc, "Work Done", job.work_done, y, pageWidth);
    y = narrativeBlock(doc, "Remarks", job.remarks, y, pageWidth);
    y += 2;

    // ── 6. Parts Used ─────────────────────────────────────────────────────────
    if (parts.length > 0) {
        y = checkPage(doc, y, 25);
        y = sectionHeader(doc, `Parts Used (${parts.length})`, y, pageWidth);
        autoTable(doc, {
            head: [["#", "Part Code", "Part Name", "UOM", "Qty", "Remarks"]],
            body: parts.map((p, i) => [i + 1, p.part_code, p.part_name, p.uom, Number(p.qty).toFixed(2), p.remarks ?? "—"]),
            startY: y, margin: { left: 14, right: 14 },
            styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [210, 210, 210], lineWidth: 0.2 },
            headStyles: { fontSize: 7, fontStyle: "bold", fillColor: [245, 245, 245], textColor: [60, 60, 60] },
            columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 24 }, 3: { cellWidth: 16 }, 4: { cellWidth: 14 } },
            theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── 7. Additional Charges ─────────────────────────────────────────────────
    if (charges.length > 0) {
        y = checkPage(doc, y, 25);
        y = sectionHeader(doc, `Additional Charges (${charges.length})`, y, pageWidth);
        autoTable(doc, {
            head: [["#", "Charge", "Ref No", "Description", "Cost", "Selling"]],
            body: charges.map((c, i) => [i + 1, c.charge_name, c.ref_no ?? "—", c.description ?? "—", fmt(c.cost_price), fmt(c.selling_price)]),
            startY: y, margin: { left: 14, right: 14 },
            styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [210, 210, 210], lineWidth: 0.2 },
            headStyles: { fontSize: 7, fontStyle: "bold", fillColor: [245, 245, 245], textColor: [60, 60, 60] },
            columnStyles: { 0: { cellWidth: 8 }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 } },
            theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── 8. Invoice ────────────────────────────────────────────────────────────
    if (invoice) {
        y = checkPage(doc, y, 35);
        y = sectionHeader(doc, `Invoice #${invoice.invoice_no}  (${invoice.invoice_date})`, y, pageWidth);
        // GST columns/rows only render when the division is GST-registered — matches
        // job-proforma-invoice-pdf-gen.ts's established GST-vs-non-GST branch, rather than
        // gating on the invoice's own tax amounts (which are already 0 for a non-GST division,
        // but showing "GST% 0% / Tax Rs.0.00" columns there reads as if tax were charged and
        // waived, not as "tax doesn't apply here").
        autoTable(doc, {
            head: gstEnabled
                ? [["#", "Description", "HSN", "Qty", "Price", "Taxable", "GST%", "Tax", "Total"]]
                : [["#", "Description", "Qty", "Price", "Total"]],
            body: invoice.lines.map((l, i) => gstEnabled
                ? [
                    i + 1,
                    l.description,
                    l.hsn_code ?? "—",
                    Number(l.qty).toFixed(2),
                    fmt(l.price),
                    fmt(l.aggregate),
                    `${l.gst_rate}%`,
                    fmt(l.cgst_amount + l.sgst_amount + l.igst_amount),
                    fmt(l.amount),
                ]
                : [
                    i + 1,
                    l.description,
                    Number(l.qty).toFixed(2),
                    fmt(l.price),
                    fmt(l.amount),
                ]),
            startY: y, margin: { left: 14, right: 14 },
            styles: { fontSize: 7, cellPadding: 1.4, lineColor: [210, 210, 210], lineWidth: 0.2 },
            headStyles: { fontSize: 6.5, fontStyle: "bold", fillColor: [245, 245, 245], textColor: [60, 60, 60] },
            columnStyles: gstEnabled
                ? {
                    0: { cellWidth: 8 },
                    2: { cellWidth: 16 },
                    3: { cellWidth: 12 },
                    4: { cellWidth: 20 },
                    5: { cellWidth: 20 },
                    6: { cellWidth: 12 },
                    7: { cellWidth: 18 },
                    8: { cellWidth: 20 },
                }
                : {
                    0: { cellWidth: 8 },
                    2: { cellWidth: 24 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 30 },
                },
            theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 2;
        // Invoice totals
        const totals: [string, string][] = gstEnabled
            ? [
                ["Taxable Amount", fmt(invoice.aggregate)],
                ...(invoice.cgst_amount > 0 ? ([["CGST", fmt(invoice.cgst_amount)], ["SGST", fmt(invoice.sgst_amount)]] as [string, string][]) : []),
                ...(invoice.igst_amount > 0 ? ([["IGST", fmt(invoice.igst_amount)]] as [string, string][]) : []),
                ["Grand Total", fmt(invoice.amount)],
            ]
            : [["Grand Total", fmt(invoice.amount)]];
        autoTable(doc, {
            body: totals,
            startY: y, margin: { left: pageWidth / 2, right: 14 },
            styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [210, 210, 210], lineWidth: 0.2 },
            columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
            theme: "grid",
            didParseCell(data) {
                if (data.row.index === totals.length - 1) {
                    data.cell.styles.fontStyle = "bold";
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            },
        });
        y = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── 9. Payments ───────────────────────────────────────────────────────────
    if (payments.length > 0) {
        y = checkPage(doc, y, 25);
        const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
        y = sectionHeader(doc, `Payments (${payments.length})  —  Total: ${fmt(paidTotal)}`, y, pageWidth);
        autoTable(doc, {
            head: [["#", "Date", "Mode", "Receipt No", "Reference", "Amount", "Remarks"]],
            body: payments.map((p, i) => [i + 1, p.payment_date, p.payment_mode, p.receipt_no ?? "—", p.reference_no ?? "—", fmt(p.amount), p.remarks ?? "—"]),
            startY: y, margin: { left: 14, right: 14 },
            styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [210, 210, 210], lineWidth: 0.2 },
            headStyles: { fontSize: 7, fontStyle: "bold", fillColor: [245, 245, 245], textColor: [60, 60, 60] },
            columnStyles: { 0: { cellWidth: 8 }, 5: { cellWidth: 22 } },
            theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 4;

        // Excess payment note — once the amount is locked (finalised or closed),
        // any receipt beyond the job total must be settled through accounts.
        const totalAmt = Number(job.amount ?? 0);
        const excess   = paidTotal - totalAmt;
        if ((job.is_final || job.is_closed) && excess > 0.005) {
            y = checkPage(doc, y, 18);
            const note  = `Excess payment of ${fmt(excess)} - receipts exceed the job total of ${fmt(totalAmt)}. This job is finalised; the excess is to be adjusted or refunded through the accounting system.`;
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            const lines = doc.splitTextToSize(note, pageWidth - 32);
            const boxH  = lines.length * 4 + 4;
            doc.setFillColor(253, 232, 232);
            doc.setDrawColor(216, 140, 140);
            doc.rect(14, y, pageWidth - 28, boxH, "FD");
            doc.setTextColor(170, 40, 40);
            doc.text(lines, 16, y + 4.5);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "normal");
            y += boxH + 4;
        }
    }

    // ── 10. Transaction History ───────────────────────────────────────────────
    if (transactions.length > 0) {
        y = checkPage(doc, y, 25);
        y = sectionHeader(doc, `Transaction History (${transactions.length})`, y, pageWidth);
        autoTable(doc, {
            head: [["#", "Date", "Status", "Technician", "Amount", "Performed By", "Remarks"]],
            body: transactions.map((t, i) => [i + 1, t.transaction_date ?? "—", t.status_name ?? "—", t.technician_name ?? "—", fmt(t.amount), t.performed_by_name ?? "—", t.remarks ?? "—"]),
            startY: y, margin: { left: 14, right: 14 },
            styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [210, 210, 210], lineWidth: 0.2 },
            headStyles: { fontSize: 7, fontStyle: "bold", fillColor: [245, 245, 245], textColor: [60, 60, 60] },
            columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 28 }, 4: { cellWidth: 20 } },
            theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 5;
    }

    // ── 11. Attachments ───────────────────────────────────────────────────────
    if (files.length > 0) {
        y = checkPage(doc, y, 20);
        y = sectionHeader(doc, `Attachments (${files.length})`, y, pageWidth);
        autoTable(doc, {
            head: [["#", "Description", "Date"]],
            body: files.map((f, i) => [i + 1, f.about || "Attachment", f.created_at]),
            startY: y, margin: { left: 14, right: 14 },
            styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [210, 210, 210], lineWidth: 0.2 },
            headStyles: { fontSize: 7, fontStyle: "bold", fillColor: [245, 245, 245], textColor: [60, 60, 60] },
            columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 36 } },
            theme: "grid",
        });
    }

    // ── Footer: page numbers ──────────────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 6, { align: "right" });
        doc.text(`Job #${job.job_no}  |  Generated ${new Date().toLocaleDateString()}`, 14, doc.internal.pageSize.getHeight() - 6);
        doc.setTextColor(0);
    }

    return doc;
}

export function getJobInfoBlobUrl(input: JobInfoInput): string {
    return String(buildJobInfoDoc(input).output("bloburl"));
}
