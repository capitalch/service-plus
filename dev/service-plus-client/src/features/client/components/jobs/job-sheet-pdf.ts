import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";

import type { JobDetailType } from "@/features/client/types/job";
import type { DivisionContextType } from "@/features/client/types/division";

function buildSingleJobSheetDoc(job: JobDetailType, division: DivisionContextType | null, branchCode?: string, copies = 1): jsPDF {
    // Standard A4 page; content fits within top 148.5 mm (half-A4 stationery)
    const doc       = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    // Signatures are anchored to the bottom edge of the printable half-A4 area
    const HALF_A4_BOTTOM = 140;

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
        y += 9;

        // ── Info Grid ─────────────────────────────────────────────────────────────
        autoTable(doc, {
            body: [
                ["Job No:",   job.job_no,                  "Date:",          job.job_date],
                ["Branch:",   branchCode ?? "—",            "Customer:",      job.customer_name ?? "—"],
                [
                    { content: "Mobile:", styles: { fontStyle: "bold" } },
                    { content: job.mobile, colSpan: 3 },
                ],
                [
                    { content: "Address:", styles: { fontStyle: "bold" } },
                    { content: job.address_snapshot ?? "—", colSpan: 3 },
                ],
                ["Product:",  job.product_name  ?? "—",     "Brand:",         job.brand_name ?? "—"],
                ["Model:",    job.model_name    ?? "—",      "Serial No:",     job.serial_no  ?? "—"],
                [{ content: "Qty:", styles: { fontStyle: "bold" } }, { content: String(job.qty), colSpan: 3 }],
                ["Job Type:", job.job_type_name,             "Warranty Card:", job.warranty_card_no ?? "—"],
                ["Receive Manner:",   job.job_receive_manner_name,   "Condition:",     job.job_receive_condition_name ?? "—"],
            ],
            columnStyles: { 0: { cellWidth: 35, fontStyle: "bold" }, 2: { cellWidth: 35, fontStyle: "bold" } },
            margin:       { left: 15, right: 15 },
            startY:       y,
            styles:       { cellPadding: 2, fontSize: 9, lineColor: [180, 180, 180], lineWidth: 0.3 },
            theme:        "grid",
        });

        y = (doc as any).lastAutoTable.finalY + 5;

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
        if (hasRemarks) {
            const splitRemarks = doc.splitTextToSize(job.remarks!, halfWidth);
            doc.text(splitRemarks, pageWidth / 2, y);
        }

        // ── Signatures (anchored to bottom of half-A4 area) ──────────────────────
        const sigY = HALF_A4_BOTTOM + yOffset;
        doc.setFontSize(9);
        doc.setDrawColor(180);
        doc.line(15,             sigY - 4, 70,             sigY - 4);
        doc.line(pageWidth - 70, sigY - 4, pageWidth - 15, sigY - 4);
        doc.text("Customer Signature",  15,            sigY);
        doc.text("Authorized Signatory", pageWidth - 15, sigY, { align: "right" });
    }

    drawContent(0);
    for (let i = 1; i < copies; i++) {
        doc.addPage();
        drawContent(0);
    }

    return doc;
}

export function downloadJobSheet(job: JobDetailType, division: DivisionContextType | null): void {
    buildSingleJobSheetDoc(job, division).save(`JobSheet_${job.job_no}.pdf`);
}

export function getJobSheetBlobUrl(job: JobDetailType, division: DivisionContextType | null, branchCode?: string, copies = 1): string {
    const doc = buildSingleJobSheetDoc(job, division, branchCode, copies);
    return String(doc.output("bloburl"));
}

export function openJobSheetInTab(job: JobDetailType, division: DivisionContextType | null): void {
    const url = getJobSheetBlobUrl(job, division);
    window.open(url, "_blank");
}

// ── Batch Job Sheet ───────────────────────────────────────────────────────────

function buildBatchJobSheetDoc(jobs: JobDetailType[], division: DivisionContextType | null, branchCode?: string, copies = 1): jsPDF {
    const doc       = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    const batchNo   = (jobs[0] as JobDetailType & { batch_no?: number })?.batch_no ?? 0;
    const batchDate = jobs[0]?.job_date  ?? "";
    const customer  = jobs[0]?.customer_name ?? "—";
    const mobile    = jobs[0]?.mobile ?? "—";
    const address   = jobs[0]?.address_snapshot ?? "—";
    const manner    = jobs[0]?.job_receive_manner_name ?? "—";
    const branch    = branchCode ?? "—";

    doc.setProperties({
        title:    `Batch-Job-Sheet_${batchNo}`,
        subject:  "Batch Job Sheet",
        author:   division?.name ?? "Service Plus",
        creator:  "Service Plus",
    });

    function drawContent() {
        // ── Header (2 lines) ──────────────────────────────────────────────────
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(division?.name ?? "Electronic Gadgets Repair", pageWidth / 2, 11, { align: "center" });

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        let y = 16;

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
            ],
            columnStyles: { 0: { cellWidth: 28, fontStyle: "bold" }, 2: { cellWidth: 28, fontStyle: "bold" } },
            margin:       { left: 15, right: 15 },
            startY:       y,
            styles:       { cellPadding: 1.2, fontSize: 7.5, lineColor: [180, 180, 180], lineWidth: 0.3 },
            theme:        "grid",
        });

        y = (doc as any).lastAutoTable.finalY + 3;

        // ── Jobs Table ─────────────────────────────────────────────────────────
        const head = [["#", "Job No", "Date", "Product / Brand / Model", "Job Type", "Qty", "Condition", "Serial No"]];

        const body: (string | number | { content: string; colSpan: number; styles: Record<string, unknown> })[][] = [];
        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i]!;
            body.push([
                i + 1,
                job.job_no,
                job.job_date,
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
                    { content: probRemText, colSpan: 8, styles: { fontSize: 6, textColor: [80, 80, 80], cellPadding: 1 } },
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
            columnStyles: {
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

        doc.setFontSize(7.5);
        doc.setDrawColor(180);
        doc.line(15,             sigY - 4, 60,             sigY - 4);
        doc.line(pageWidth - 60, sigY - 4, pageWidth - 15, sigY - 4);
        doc.text("Customer Signature",  15,            sigY);
        doc.text("Authorized Signatory", pageWidth - 15, sigY, { align: "right" });
    }

    drawContent();
    for (let i = 1; i < copies; i++) {
        doc.addPage();
        drawContent();
    }

    return doc;
}

export function getBatchJobSheetBlobUrl(jobs: JobDetailType[], division: DivisionContextType | null, branchCode?: string, copies = 1): string {
    const doc = buildBatchJobSheetDoc(jobs, division, branchCode, copies);
    return String(doc.output("bloburl"));
}
