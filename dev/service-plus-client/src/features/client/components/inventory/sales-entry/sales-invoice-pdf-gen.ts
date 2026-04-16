import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/utils";
import type { SalesInvoiceType, SalesLineType } from "@/features/client/types/sales";
import type { BranchType } from "@/features/client/components/masters/branch/branch";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAddressLines(parts: (string | null | undefined)[]): string[] {
    return parts.filter((p): p is string => !!p && p.trim() !== "");
}

function cityStatePinLine(city?: string | null, state?: string | null, pincode?: string | null): string | null {
    const parts = [city, state].filter(Boolean).join(", ");
    const pin   = pincode ? ` - ${pincode}` : "";
    return parts ? parts + pin : pincode ? pincode : null;
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

/**
 * Generates a professional Sales Invoice PDF.
 */
export const generateSalesInvoicePdf = (
    invoice:     SalesInvoiceType & { lines?: SalesLineType[] },
    companyName: string,
    branchName:  string,
    branch:      BranchType | null,
    saveAs?:     string
): jsPDF => {
    const doc = new jsPDF({ format: "a4", orientation: "p", unit: "mm" });

    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin     = 14;
    const midX       = pageWidth / 2;
    let   currY      = margin;

    // ─── 1. Title & Header ────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("TAX INVOICE (SALES)", midX, currY, { align: "center" });
    currY += 5;

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.6);
    doc.line(margin, currY, pageWidth - margin, currY);
    currY += 8;

    // ─── 2. Parties & Information Section ────────────────────────────────────
    const colGap = 8;
    const colW   = midX - margin - (colGap / 2);
    const leftX  = margin;
    const rightX = midX + (colGap / 2);

    // Header Row 1: BILLED FROM (Left) | INVOICE DETAILS (Right)
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("BILLED FROM (Seller)", leftX, currY);
    doc.text("INVOICE DETAILS",      rightX, currY);
    currY += 4.5;

    // Row 1 Content: Company Name | Invoice No
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(companyName, leftX, currY, { maxWidth: colW });

    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text("INVOICE NO:", rightX, currY);
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(invoice.invoice_no, rightX + 22, currY);
    currY += 4.5;

    // Row 1 Cont: Branch / Seller Address (Left) | Invoice Date + State Code (Right)
    const fromLines = buildAddressLines([
        `Branch: ${branch?.name ?? branchName}`,
        branch?.address_line1 ?? null,
        branch?.address_line2 ?? null,
        cityStatePinLine(branch?.city, branch?.state_name, branch?.pincode),
        branch?.phone ? `Ph: ${branch.phone}`   : null,
        branch?.gstin ? `GSTIN: ${branch.gstin}` : null,
    ]);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);

    const partyRow1ContentStartY = currY;

    fromLines.forEach((l, idx) => {
        doc.text(l, leftX, partyRow1ContentStartY + (idx * 4.2), { maxWidth: colW });
    });

    let currentMetaY = partyRow1ContentStartY;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(110, 110, 110);
    doc.text("DATE:", rightX, currentMetaY);
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(invoice.invoice_date, rightX + 22, currentMetaY);
    currentMetaY += 4.2;

    if (invoice.customer_state_code) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(110, 110, 110);
        doc.text("STATE CODE:", rightX, currentMetaY);
        doc.setFontSize(9);
        doc.setTextColor(30, 30, 30);
        doc.text(invoice.customer_state_code, rightX + 22, currentMetaY);
        currentMetaY += 4.2;
    }

    const row1MaxY = Math.max(partyRow1ContentStartY + (fromLines.length * 4.2), currentMetaY);
    currY = row1MaxY + 6;

    // Divider
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, currY - 3, pageWidth - margin, currY - 3);

    // Vertical Divider
    doc.setDrawColor(220, 220, 220);
    doc.line(midX, partyRow1ContentStartY - 15, midX, row1MaxY + 2);

    // ─── 3. Billed To ─────────────────────────────────────────────────────────
    currY += 2;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("BILLED TO (Customer)", leftX, currY);
    currY += 4.5;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(invoice.customer_name || "Walk-in Customer", leftX, currY, { maxWidth: pageWidth - margin * 2 });
    currY += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);

    const customerLines = buildAddressLines([
        invoice.customer_gstin   ? `GSTIN: ${invoice.customer_gstin}` : null,
        invoice.customer_state_code ? `State Code: ${invoice.customer_state_code}` : null,
    ]);
    customerLines.forEach((l, idx) => {
        doc.text(l, leftX, currY + (idx * 4.2), { maxWidth: pageWidth - margin * 2 });
    });

    currY += (customerLines.length * 4.2) + 4;

    // ─── 4. Product Table ─────────────────────────────────────────────────────
    const lines = invoice.lines ?? [];

    const tableBody = lines.map((l, idx) => [
        idx + 1,
        l.part_code,
        l.part_name,
        l.hsn_code,
        Number(l.quantity).toFixed(2),
        formatCurrency(l.unit_price).replace("₹", ""),
        formatCurrency(l.aggregate_amount).replace("₹", ""),
        formatCurrency(l.cgst_amount).replace("₹", ""),
        formatCurrency(l.sgst_amount).replace("₹", ""),
        formatCurrency(l.igst_amount).replace("₹", ""),
        formatCurrency(l.total_amount).replace("₹", ""),
    ]);

    const totalQty       = lines.reduce((s, l) => s + Number(l.quantity),        0);
    const totalAggregate = lines.reduce((s, l) => s + Number(l.aggregate_amount), 0);
    const totalCgst      = lines.reduce((s, l) => s + Number(l.cgst_amount),      0);
    const totalIgst      = lines.reduce((s, l) => s + Number(l.igst_amount),      0);
    const totalSgst      = lines.reduce((s, l) => s + Number(l.sgst_amount),      0);
    const totalLineAmt   = lines.reduce((s, l) => s + Number(l.total_amount),     0);

    const tableFooter = [[
        "",
        "",
        "",
        "Total",
        totalQty.toFixed(2),
        "",
        formatCurrency(totalAggregate).replace("₹", ""),
        formatCurrency(totalCgst).replace("₹", ""),
        formatCurrency(totalSgst).replace("₹", ""),
        formatCurrency(totalIgst).replace("₹", ""),
        formatCurrency(totalLineAmt).replace("₹", ""),
    ]];

    autoTable(doc, {
        body:    tableBody,
        foot:    tableFooter,
        head:    [["#", "Part Code", "Part Name", "HSN", "Qty", "Price", "Aggregate", "CGST", "SGST", "IGST", "Total"]],
        margin:  { left: margin, right: margin },
        startY:  currY,
        theme:   "grid",
        footStyles: {
            fillColor: [240, 240, 240],
            fontSize:  7.5,
            fontStyle: "bold",
            halign:    "right",
            textColor: [20, 20, 20],
        },
        headStyles: {
            fillColor: [60, 60, 60],
            fontSize:  7,
            fontStyle: "bold",
            halign:    "center",
            textColor: [255, 255, 255],
        },
        columnStyles: {
            0:  { cellWidth: 8,  halign: "center" },
            3:  { halign: "right" },
            4:  { cellWidth: 12, halign: "right"  },
            5:  { cellWidth: 18, halign: "right"  },
            6:  { cellWidth: 20, halign: "right"  },
            7:  { cellWidth: 15, halign: "right"  },
            8:  { cellWidth: 15, halign: "right"  },
            9:  { cellWidth: 15, halign: "right"  },
            10: { cellWidth: 20, halign: "right"  },
        },
        styles: { cellPadding: 2, fontSize: 7.5, textColor: [30, 30, 30] },
        didDrawPage: (_data) => {
            // Re-draw header/title if table spans pages (advanced use-case)
        },
    });

    currY = (doc as any).lastAutoTable.finalY + 10;

    if (currY > pageHeight - 60) {
        doc.addPage();
        currY = margin;
    }

    // ─── 5. Summary Box ───────────────────────────────────────────────────────
    const boxW   = 85;
    const boxL   = pageWidth - margin - boxW;
    const boxR   = pageWidth - margin;
    const labelX = boxL + 4;
    const valueX = boxR - 4;
    const rowH   = 6;

    const rows: Array<{ accent?: boolean; bold?: boolean; label: string; value: number }> = [
        { label: "Aggregate Amount", value: Number(invoice.aggregate_amount) },
        { label: "CGST",             value: Number(invoice.cgst_amount) },
        { label: "SGST",             value: Number(invoice.sgst_amount) },
        { label: "IGST",             value: Number(invoice.igst_amount) },
        { label: "Total Tax",        value: Number(invoice.total_tax) },
        { accent: true, bold: true, label: "Invoice Total", value: totalLineAmt },
    ];

    const boxStartY = currY - 4;
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(boxL, boxStartY, boxW, (rows.length * rowH) + 8, 2, 2, "FD");
    currY += 2;

    for (const row of rows) {
        doc.setFontSize(row.bold ? 10 : 8.5);
        doc.setFont("helvetica", row.bold ? "bold" : "normal");
        doc.setTextColor(...(row.accent ? ([0, 80, 180] as [number, number, number]) : ([20, 20, 20] as [number, number, number])));
        doc.text(row.label, labelX, currY);
        doc.text(`Rs. ${formatCurrency(row.value).replace("₹", "").trim()}`, valueX, currY, { align: "right" });
        currY += rowH;
    }

    // ─── 6. Remarks ───────────────────────────────────────────────────────────
    if (invoice.remarks) {
        currY += 6;
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(80, 80, 80);
        doc.text("REMARKS:", margin, currY);
        currY += 4.5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 40);
        doc.text(invoice.remarks, margin, currY, { maxWidth: pageWidth / 2 - margin });
    }

    // ─── 7. Footer ────────────────────────────────────────────────────────────
    const footerY = pageHeight - 20;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text(`For, ${companyName}`, pageWidth - margin, footerY, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Authorized Signatory", pageWidth - margin, footerY + 10, { align: "right" });

    if (saveAs) doc.save(saveAs);
    return doc;
};
