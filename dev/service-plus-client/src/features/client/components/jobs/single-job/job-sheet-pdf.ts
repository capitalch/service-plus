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

function buildJobSheetDoc(job: JobDetailType, companyInfo: CompanyInfoType | null): jsPDF {
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

    doc.setDrawColor(200);
    doc.line(15, y, pageWidth - 15, y);
    y += 6;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("JOB SHEET", pageWidth / 2, y, { align: "center" });
    y += 7;

    // ── Info Grid ─────────────────────────────────────────────────────────────
    autoTable(doc, {
        body: [
            ["Job No:",    job.job_no,                   "Date:",          job.job_date],
            ["Customer:",  job.customer_name ?? "—",     "Mobile:",        job.mobile],
            ["Product:",   job.product_name  ?? "—",     "Brand:",         job.brand_name ?? "—"],
            ["Model:",     job.model_name    ?? "—",     "Serial No:",     job.serial_no  ?? "—"],
            ["Job Type:",  job.job_type_name,             "Warranty Card:", job.warranty_card_no ?? "—"],
        ],
        columnStyles: { 0: { cellWidth: 35, fontStyle: "bold" }, 2: { cellWidth: 35, fontStyle: "bold" } },
        margin:       { left: 15, right: 15 },
        startY:       y,
        styles:       { cellPadding: 2, fontSize: 9 },
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
    buildJobSheetDoc(job, companyInfo).save(`JobSheet_${job.job_no}.pdf`);
}

export function openJobSheetInTab(job: JobDetailType, companyInfo: CompanyInfoType | null): void {
    const url = buildJobSheetDoc(job, companyInfo).output("bloburl");
    window.open(String(url), "_blank");
}
