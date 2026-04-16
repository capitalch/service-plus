import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/utils";
import type { PurchaseInvoiceType, PurchaseLineType } from "@/features/client/types/purchase";
import type { BranchType } from "@/features/client/components/masters/branch/branch";
import type { VendorType } from "@/features/client/types/vendor";

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
 * Generates a professional Purchase Invoice PDF.
 */
export const generatePurchaseInvoicePdf = (
    invoice:     PurchaseInvoiceType,
    lines:       PurchaseLineType[],
    companyName: string,
    branchName:  string,
    vendor:      VendorType | null,
    branch:      BranchType | null,
    saveAs?:     string
): jsPDF => {
    const doc = new jsPDF({ format: "a4", orientation: "p", unit: "mm" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin    = 14;
    const midX      = pageWidth / 2;
    let currY       = margin;

    // ─── 1. Title & Header ────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("TAX INVOICE", midX, currY, { align: "center" });
    currY += 5;

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.6);
    doc.line(margin, currY, pageWidth - margin, currY);
    currY += 8;

    // ─── 2. Parties & Information Section ───────────────────────────────────
    const colGap = 8;
    const colW   = midX - margin - (colGap / 2);
    const leftX  = margin;
    const rightX = midX + (colGap / 2);

    // Header Row 1: BILLED FROM (Left) | INVOICE DETAILS (Right)
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("BILLED FROM (Supplier)", leftX, currY);
    doc.text("INVOICE DETAILS",        rightX, currY);
    currY += 4.5;

    // Row 1 Content: Supplier Name | Invoice No
    const fromName = vendor?.name ?? invoice.supplier_name;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(fromName, leftX, currY, { maxWidth: colW });

    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text("INVOICE NO:", rightX, currY);
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(invoice.invoice_no, rightX + 22, currY);
    currY += 4.5;

    // Row 1 Cont: Supplier Address (Left) | Invoice Date (Right)
    const fromLines = buildAddressLines([
        vendor?.address_line1,
        vendor?.address_line2,
        cityStatePinLine(vendor?.city, vendor?.state_name, vendor?.pincode),
        vendor?.phone  ? `Ph: ${vendor.phone}`    : null,
        vendor?.gstin  ? `GSTIN: ${vendor.gstin}` : null,
    ]);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);

    const partyRow1ContentStartY = currY; // Start of addresses/meta
    
    // Draw supplier lines
    fromLines.forEach((l, idx) => {
        doc.text(l, leftX, partyRow1ContentStartY + (idx * 4.2), { maxWidth: colW });
    });

    // Draw Right Meta Side (Date & State Code)
    let currentMetaY = partyRow1ContentStartY;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(110, 110, 110);
    doc.text("DATE:", rightX, currentMetaY);
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(invoice.invoice_date, rightX + 22, currentMetaY);

    // Row 1 End
    const row1MaxY = Math.max(partyRow1ContentStartY + (fromLines.length * 4.2), currentMetaY + 4.2);
    currY = row1MaxY + 6;

    // Thick Divider between Row 1 and Row 2
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, currY - 3, pageWidth - margin, currY - 3);

    // Row 2 Header: BILLED TO
    currY += 2;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("BILLED TO (Buyer)", leftX, currY);
    currY += 4.5;

    const toName   = companyName;
    const toBranch = branch?.name ?? branchName;
    const toLines = buildAddressLines([
        `Branch: ${toBranch}`,
        branch?.address_line1 ?? null,
        branch?.address_line2 ?? null,
        cityStatePinLine(branch?.city, branch?.state_name, branch?.pincode),
        branch?.phone ? `Ph: ${branch.phone}`   : null,
        branch?.gstin ? `GSTIN: ${branch.gstin}` : null,
    ]);

    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(toName, leftX, currY, { maxWidth: pageWidth - (margin * 2) });
    currY += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    toLines.forEach((l, idx) => {
        doc.text(l, leftX, currY + (idx * 4.2), { maxWidth: pageWidth - (margin * 2) });
    });

    const row2End = currY + (toLines.length * 4.2);
    currY = row2End + 2;

    // Vertical Divider (spans precisely Row 1 only)
    doc.setDrawColor(220, 220, 220);
    doc.line(midX, partyRow1ContentStartY - 15, midX, row1MaxY + 2);


    // currY += 6;

    // ─── 4. Product Table ─────────────────────────────────────────────────────
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

    autoTable(doc, {
        body:   tableBody,
        head:   [["#", "Part Code", "Part Name", "HSN", "Qty", "Price", "Aggregate", "CGST", "SGST", "IGST", "Total"]],
        margin: { left: margin, right: margin },
        startY: currY,
        theme:  "grid",
        headStyles: {
            fillColor: [60, 60, 60],
            fontSize:  7,
            fontStyle: "bold",
            halign:    "center",
            textColor: [255, 255, 255],
        },
        columnStyles: {
            0:  { cellWidth: 8,  halign: "center" },
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
        }
    });

    currY = (doc as any).lastAutoTable.finalY + 10;

    // Check if near bottom, add new page if needed
    if (currY > pageHeight - 60) {
        doc.addPage();
        currY = margin;
    }

    // ─── 5. Summary & Totals Box ─────────────────────────────────────────────
    const boxW    = 85;
    const boxL    = pageWidth - margin - boxW;
    const boxR    = pageWidth - margin;
    const labelX  = boxL + 4;
    const valueX  = boxR - 4;
    const rowH    = 6;

    const computedTotal = lines.reduce((s, l) => s + Number(l.total_amount), 0);
    const physicalTotal = Number(invoice.total_amount);
    const diffAmount    = physicalTotal - computedTotal;

    // Helper for rows
    const drawSummaryRow = (label: string, value: number | string, opts?: { bold?: boolean; isGrand?: boolean; color?: [number, number, number] }) => {
        const isBold  = opts?.bold ?? false;
        const isGrand = opts?.isGrand ?? false;
        const color   = opts?.color ?? [20, 20, 20];

        doc.setFontSize(isGrand ? 10 : 8.5);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(...color);
        doc.text(label, labelX, currY);
        
        const valStr = typeof value === 'number' 
            ? `Rs. ${formatCurrency(value).replace("₹", "").trim()}`
            : value;
            
        doc.text(valStr, valueX, currY, { align: "right" });
        currY += rowH;
    };

    // Draw box background (light gray)
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(250, 250, 250);
    const boxStartY = currY - 4;
    const rowCount = 5 + (Math.abs(diffAmount) > 0.01 ? 1 : 0);
    doc.roundedRect(boxL, boxStartY, boxW, (rowCount * rowH) + 8, 2, 2, "FD");
    currY += 2;

    drawSummaryRow("Aggregate Amount", invoice.aggregate_amount);
    drawSummaryRow("Total Tax",        Number(invoice.total_tax));
    
    drawSummaryRow("computed Amount",   computedTotal, { bold: true });
    
    if (Math.abs(diffAmount) > 0.01) {
        const sign = diffAmount >= 0 ? "+" : "-";
        drawSummaryRow("Adjustment/Diff", `${sign} Rs. ${formatCurrency(Math.abs(diffAmount)).replace("₹", "").trim()}`, { color: [150, 80, 0] });
    }

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.line(boxL + 2, currY - 2, boxR - 2, currY - 2);
    currY += 3;

    drawSummaryRow("Invoice amount", physicalTotal, { bold: true, isGrand: true, color: [0, 80, 180] });

    currY += 10;

    // ─── 6. Remarks & Significance ──────────────────────────────────────────
    if (invoice.remarks) {
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
    const footerY = pageHeight - 30;
    
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    // doc.text("This is a computer generated purchase invoice document.", margin, footerY);

    const signX = pageWidth - margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text("For, " + (vendor?.name ?? invoice.supplier_name), signX, footerY, { align: "right" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Authorized Signatory", signX, footerY + 15, { align: "right" });

    if (saveAs) doc.save(saveAs);

    return doc;
};
