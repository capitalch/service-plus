import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";

import type { JobDetailType } from "@/features/client/types/job";

export type CompanyInfoType = {
    address_line1:  string;
    address_line2:  string | null;
    city:           string | null;
    company_name:   string;
    email:          string | null;
    gstin:          string | null;
    gst_state_code: string | null;
    id:             number;
    phone:          string | null;
    pincode:        string | null;
};

function buildSingleJobSheetDoc(job: JobDetailType, companyInfo: CompanyInfoType | null): jsPDF {
    // Standard A4 page; content fits within top 148.5 mm (half-A4 stationery)
    const doc       = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    // Signatures are anchored to the bottom edge of the printable half-A4 area
    const HALF_A4_BOTTOM = 140;

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(companyInfo?.company_name ?? "Electronic Gadgets Repair", pageWidth / 2, 14, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let y = 19;

    if (companyInfo) {
        const addr = [companyInfo.address_line1, companyInfo.address_line2, companyInfo.city, companyInfo.pincode]
            .filter(Boolean).join(", ");
        doc.text(addr, pageWidth / 2, y, { align: "center" });
        y += 4;

        if (companyInfo.phone || companyInfo.email) {
            const contact = [
                companyInfo.phone && `Phone: ${companyInfo.phone}`,
                companyInfo.email && `Email: ${companyInfo.email}`,
            ].filter(Boolean).join(" | ");
            doc.text(contact, pageWidth / 2, y, { align: "center" });
            y += 4;
        }

        if (companyInfo.gstin) {
            doc.text(`GSTIN: ${companyInfo.gstin}`, pageWidth / 2, y, { align: "center" });
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
            ["Branch:",   job.branch_code ?? "—",       "Customer:",      job.customer_name ?? "—"],
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
            [{ content: "Qty:", styles: { fontStyle: "bold" } }, { content: String(job.quantity), colSpan: 3 }],
            ["Job Type:", job.job_type_name,             "Warranty Card:", job.warranty_card_no ?? "—"],
            ["Manner:",   job.job_receive_manner_name,   "Condition:",     job.job_receive_condition_name ?? "—"],
        ],
        columnStyles: { 0: { cellWidth: 35, fontStyle: "bold" }, 2: { cellWidth: 35, fontStyle: "bold" } },
        margin:       { left: 15, right: 15 },
        startY:       y,
        styles:       { cellPadding: 2, fontSize: 9, lineColor: [180, 180, 180], lineWidth: 0.3 },
        theme:        "grid",
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    // ── Problem Reported ──────────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Problem Reported:", 15, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const splitProblem = doc.splitTextToSize(job.problem_reported || "—", pageWidth - 30);
    doc.text(splitProblem, 15, y);

    // ── Signatures (anchored to bottom of half-A4 area) ──────────────────────
    const sigY = HALF_A4_BOTTOM;
    doc.setFontSize(9);
    doc.setDrawColor(180);
    doc.line(15,             sigY - 4, 70,             sigY - 4);
    doc.line(pageWidth - 70, sigY - 4, pageWidth - 15, sigY - 4);
    doc.text("Customer Signature",  15,            sigY);
    doc.text("Authorized Signatory", pageWidth - 15, sigY, { align: "right" });

    return doc;
}

export function downloadJobSheet(job: JobDetailType, companyInfo: CompanyInfoType | null): void {
    buildSingleJobSheetDoc(job, companyInfo).save(`JobSheet_${job.job_no}.pdf`);
}

export function getJobSheetBlobUrl(job: JobDetailType, companyInfo: CompanyInfoType | null): string {
    const doc = buildSingleJobSheetDoc(job, companyInfo);
    return String(doc.output("bloburl"));
}

export function openJobSheetInTab(job: JobDetailType, companyInfo: CompanyInfoType | null): void {
    const url = getJobSheetBlobUrl(job, companyInfo);
    window.open(url, "_blank");
}
