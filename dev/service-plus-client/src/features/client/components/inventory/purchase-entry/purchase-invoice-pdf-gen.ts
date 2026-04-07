import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/utils";
import type { PurchaseInvoiceType, PurchaseLineType } from "@/features/client/types/purchase";

export const generatePurchaseInvoicePdf = (
    invoice:      PurchaseInvoiceType,
    lines:        PurchaseLineType[],
    companyName:  string,
    branchName:   string,
    saveAs?:      string
): jsPDF => {
    const doc = new jsPDF({
        orientation: "p",
        unit:        "mm",
        format:      "a4",
    });

    const pageWidth  = doc.internal.pageSize.getWidth();
    const margin     = 15;
    let currY        = margin;

    // ─── Header ───────────────────────────────────────────────────────────────
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(companyName, pageWidth / 2, currY, { align: "center" });
    currY += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(branchName, pageWidth / 2, currY, { align: "center" });
    currY += 10;

    doc.setDrawColor(200);
    doc.line(margin, currY, pageWidth - margin, currY);
    currY += 7;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("PURCHASE INVOICE", pageWidth / 2, currY, { align: "center" });
    currY += 10;

    // ─── Info Section ─────────────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Supplier Details:", margin, currY);
    doc.text("Invoice Details:", pageWidth / 2, currY);
    currY += 5;

    doc.setFont("helvetica", "normal");
    
    // Left: Supplier
    doc.text(`Supplier: ${invoice.supplier_name}`, margin, currY);
    doc.text(`State Code: ${invoice.supplier_state_code}`, margin, currY + 4);
    
    // Right: Invoice Info
    doc.text(`Invoice No: ${invoice.invoice_no}`, pageWidth / 2, currY);
    doc.text(`Date: ${invoice.invoice_date}`, pageWidth / 2, currY + 4);
    
    currY += 12;

    // ─── Table ────────────────────────────────────────────────────────────────
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
        startY: currY,
        margin: { left: margin, right: margin },
        head:   [["#", "Part Code", "Part Name", "HSN", "Qty", "Price", "Aggregate", "CGST", "SGST", "IGST", "Total"]],
        body:   tableBody,
        theme:  "grid",
        headStyles: {
            fillColor: [240, 240, 240],
            textColor: [60, 60, 60],
            fontSize:  7,
            fontStyle: "bold",
            halign:    "center",
        },
        styles: {
            fontSize: 7,
            cellPadding: 2,
        },
        columnStyles: {
            0: { cellWidth: 8,  halign: "center" }, // #
            4: { cellWidth: 12, halign: "right" },  // Qty
            5: { cellWidth: 18, halign: "right" },  // Price
            6: { cellWidth: 20, halign: "right" },  // Aggregate
            7: { cellWidth: 15, halign: "right" },  // CGST
            8: { cellWidth: 15, halign: "right" },  // SGST
            9: { cellWidth: 15, halign: "right" },  // IGST
            10: { cellWidth: 20, halign: "right" }, // Total
        },
    });

    currY = (doc as any).lastAutoTable.finalY + 10;

    // ─── Totals ───────────────────────────────────────────────────────────────
    const summaryX = pageWidth - margin - 60;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    
    const fields = [
        { label: "Aggregate Amount:", value: invoice.aggregate_amount },
        { label: "Total Tax:",       value: invoice.total_tax },
        { label: "Grand Total:",     value: invoice.total_amount, bold: true },
    ];

    fields.forEach(f => {
        if (f.bold) doc.setFont("helvetica", "bold");
        else doc.setFont("helvetica", "normal");

        doc.text(f.label, summaryX, currY);
        doc.text("Rs. " + formatCurrency(f.value).replace("₹", ""), pageWidth - margin, currY, { align: "right" });
        currY += 5;
    });

    if (invoice.remarks) {
        currY += 5;
        doc.setFont("helvetica", "bold");
        doc.text("Remarks:", margin, currY);
        currY += 4;
        doc.setFont("helvetica", "normal");
        doc.text(invoice.remarks, margin, currY, { maxWidth: pageWidth / 2 });
    }

    // ─── Footer ───────────────────────────────────────────────────────────────
    const footerY = doc.internal.pageSize.getHeight() - 30;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("This is a computer generated invoice.", margin, footerY);

    doc.setFont("helvetica", "bold");
    doc.text("For, " + companyName, pageWidth - margin, footerY, { align: "right" });
    doc.text("Authorized Signatory", pageWidth - margin, footerY + 15, { align: "right" });

    if (saveAs) {
        doc.save(saveAs);
    }

    return doc;
};
