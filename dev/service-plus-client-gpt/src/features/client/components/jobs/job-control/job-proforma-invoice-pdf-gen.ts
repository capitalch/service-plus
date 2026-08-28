import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { JobDetailType } from "@/features/client/types/job";
import type { DivisionContextType } from "@/features/client/types/division";

// Extended part/charge types that include GST fields returned by the SQL queries
// (the simplified JobPartUsedRow / JobAdditionalChargeRow in job-detail-pdf.ts omit these)
export type ProformaPartRow = {
    id:            number;
    part_code:     string;
    part_name:     string;
    uom:           string;
    qty:           number;
    selling_price: number | null;
    gst_rate:      number | null;
    hsn_code:      string | null;
    remarks:       string | null;
};

export type ProformaChargeRow = {
    id:            number;
    charge_name:   string;
    ref_no:        string | null;
    description:   string | null;
    hsn_code:      string | null;
    gst_rate:      number;
    qty:           number;
    selling_price: number;
};

type ProformaLine = {
    description: string;
    part_code:   string | null;
    hsn_code:    string | null;
    qty:         number;
    unit_price:  number;
    aggregate:   number;
    gst_rate:    number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    amount:      number;
};

function buildAddrLines(parts: (string | null | undefined)[]): string[] {
    return parts.filter((p): p is string => !!p && p.trim() !== "");
}

function fmtAmt(n: number | null | undefined): string {
    if (n == null) return "0.00";
    return Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function amountInWords(amount: number): string {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    function toW(n: number): string {
        if (n === 0) return "";
        if (n < 20) return ones[n] + " ";
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
        if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred " + toW(n % 100);
        if (n < 100000) return toW(Math.floor(n / 1000)) + "Thousand " + toW(n % 1000);
        if (n < 10000000) return toW(Math.floor(n / 100000)) + "Lakh " + toW(n % 100000);
        return toW(Math.floor(n / 10000000)) + "Crore " + toW(n % 10000000);
    }
    const rounded = Math.round(amount);
    const paise = Math.round((amount - rounded) * 100);
    let result = toW(rounded).trim() + " Rupees";
    if (paise > 0) result += " and " + toW(paise).trim() + " Paise";
    return result + " Only.";
}

function buildLines(
    parts: ProformaPartRow[],
    charges: ProformaChargeRow[],
    isIgst: boolean,
): ProformaLine[] {
    const lines: ProformaLine[] = [];

    for (const p of parts) {
        const unitPrice = Number(p.selling_price ?? 0);
        const qty       = Number(p.qty);
        const gstRate   = Number(p.gst_rate ?? 0);
        const aggregate = qty * unitPrice;
        const igst      = isIgst ? aggregate * gstRate / 100 : 0;
        const cgst      = !isIgst ? aggregate * (gstRate / 2) / 100 : 0;
        const sgst      = cgst;
        lines.push({
            description: p.part_name,
            part_code:   p.part_code || null,
            hsn_code:    p.hsn_code,
            qty,
            unit_price:  unitPrice,
            aggregate,
            gst_rate:    gstRate,
            cgst_amount: cgst,
            sgst_amount: sgst,
            igst_amount: igst,
            amount:      aggregate + cgst + sgst + igst,
        });
    }

    for (const c of charges) {
        const unitPrice = Number(c.selling_price ?? 0);
        const qty       = Number(c.qty ?? 1);
        const gstRate   = Number(c.gst_rate ?? 0);
        const aggregate = qty * unitPrice;
        const igst      = isIgst ? aggregate * gstRate / 100 : 0;
        const cgst      = !isIgst ? aggregate * (gstRate / 2) / 100 : 0;
        const sgst      = cgst;
        lines.push({
            description: c.charge_name,
            part_code:   null,
            hsn_code:    c.hsn_code,
            qty,
            unit_price:  unitPrice,
            aggregate,
            gst_rate:    gstRate,
            cgst_amount: cgst,
            sgst_amount: sgst,
            igst_amount: igst,
            amount:      aggregate + cgst + sgst + igst,
        });
    }

    return lines;
}

function buildProformaDoc(
    job: JobDetailType,
    parts: ProformaPartRow[],
    charges: ProformaChargeRow[],
    division: DivisionContextType | null,
): jsPDF {
    const doc    = new jsPDF({ format: "a4", orientation: "p", unit: "mm" });
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const M      = 10;
    const rightX = pageW - M;
    const midX   = pageW / 2;

    const isGstDivision = !!division?.gstin;
    const isIgst        = job.is_igst;
    const lines         = buildLines(parts, charges, isIgst);
    const hasGst        = isGstDivision && lines.some(l => l.gst_rate > 0);

    doc.setProperties({
        title:   `Proforma-Invoice_${job.job_no}`,
        subject: "Proforma Invoice",
        author:  division?.name ?? "Service Plus",
        creator: "Service Plus",
    });

    let y = M;

    // ── Page number ───────────────────────────────────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Page 1 of 1", rightX, y, { align: "right" });
    y += 4;

    // ── Header: company (left) | proforma title (right) ──────────────────────
    const headerTopY = y;

    // Left — company block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(division?.name ?? "Service Plus", M, y);
    y += 5;

    const infoLine = buildAddrLines([
        division?.code    ?? null,
        division?.web_site ?? null,
    ]).join("   ");
    if (infoLine) {
        const maxW = midX - M - 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(infoLine, M, y, { maxWidth: maxW });
        y += (doc.splitTextToSize(infoLine, maxW) as string[]).length * 4;
    }

    if (division?.gstin) {
        const maxW = midX - M - 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(`GSTIN: ${division.gstin}`, M, y, { maxWidth: maxW });
        y += (doc.splitTextToSize(`GSTIN: ${division.gstin}`, maxW) as string[]).length * 4;
    }

    const divDetails = buildAddrLines([
        division?.address_line1  ?? null,
        division?.address_line2  ?? null,
        division?.pincode         ? `Pin: ${division.pincode}`            : null,
        division?.gst_state_code  ? `State: ${division.gst_state_code}`   : null,
        division?.phone           ? `Ph: ${division.phone}`               : null,
        division?.email           ? `Email: ${division.email}`            : null,
    ]).join("   ");
    if (divDetails) {
        const maxW = midX - M - 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(divDetails, M, y, { maxWidth: maxW });
        y += (doc.splitTextToSize(divDetails, maxW) as string[]).length * 4;
    }

    // Right — proforma title block
    const titleX    = midX + 5;
    const titleColW = rightX - titleX;
    let ry          = headerTopY;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text("PROFORMA INVOICE", titleX, ry);
    ry += 5;

    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    const refLabel = "Ref # : ";
    const refNo    = job.job_no + (job.alternate_job_no ? ` / ${job.alternate_job_no}` : "");
    const dateStr  = `   Date: ${new Date(job.job_date).toLocaleDateString("en-IN")}`;
    doc.setFont("helvetica", "normal");
    const labelW = doc.getTextWidth(refLabel);
    doc.text(refLabel, titleX, ry);
    doc.setFont("helvetica", "bold");
    const noW = doc.getTextWidth(refNo);
    doc.text(refNo, titleX + labelW, ry);
    doc.setFont("helvetica", "normal");
    doc.text(dateStr, titleX + labelW + noW, ry, { maxWidth: titleColW });
    ry += 4.5;

    const device = buildAddrLines([job.product_name, job.brand_name, job.model_name]).join(" / ");
    if (device) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(`Device: ${device}`, titleX, ry, { maxWidth: titleColW });
        ry += (doc.splitTextToSize(`Device: ${device}`, titleColW) as string[]).length * 4;
    }

    y = Math.max(y, ry);

    // ── Divider ───────────────────────────────────────────────────────────────
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.line(M, y, rightX, y);
    y += 5;

    // ── Customer block (left) | Technician/serial (right) ────────────────────
    const custColW = midX - M - 5;
    const shipX    = midX + 5;
    const shipColW = rightX - shipX;
    const custTopY = y;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    doc.text("Bill To", M, y);
    doc.text("Service Details", shipX, y);
    y += 4.5;

    // Customer name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text(job.customer_name || "—", M, y, { maxWidth: custColW });

    const addrParts = buildAddrLines([
        job.customer_address_line1 ?? null,
        job.customer_address_line2 ?? null,
        job.customer_landmark      ?? null,
        job.customer_city          ?? null,
        job.customer_state         ?? null,
        job.customer_postal_code   ? `Pin: ${job.customer_postal_code}` : null,
    ]);
    const fullAddr = addrParts.length > 0 ? addrParts.join(", ") : (job.address_snapshot ?? null);

    const custLines = buildAddrLines([
        fullAddr,
        job.mobile ? `Ph: ${job.mobile}` : null,
        job.customer_gstin ? `GSTIN: ${job.customer_gstin}` : null,
    ]);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    const custNameLines = doc.splitTextToSize(job.customer_name || "—", custColW) as string[];
    let cy = y + custNameLines.length * 4.5;
    custLines.forEach(l => {
        const wrapped = doc.splitTextToSize(l, custColW) as string[];
        doc.text(wrapped, M, cy);
        cy += wrapped.length * 4;
    });

    // Right — service details
    const serviceRows: [string, string][] = [
        ["Technician", job.technician_name ?? "—"],
        ...(job.serial_no ? [["Serial No", job.serial_no] as [string, string]] : []),
    ];
    let sy = custTopY + 4.5;
    doc.setFontSize(8.5);
    serviceRows.forEach(([lbl, val]) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(80, 80, 80);
        doc.text(`${lbl}:`, shipX, sy);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
        doc.text(val, shipX + 25, sy, { maxWidth: shipColW - 25 });
        sy += 5;
    });

    y = Math.max(cy, sy) + 2;

    // ── Items table ───────────────────────────────────────────────────────────
    // Content width = 190mm (A4 210mm - 10 left - 10 right)
    const totalAgg  = lines.reduce((s, l) => s + l.aggregate, 0);
    const totalCgst = lines.reduce((s, l) => s + l.cgst_amount, 0);
    const totalSgst = lines.reduce((s, l) => s + l.sgst_amount, 0);
    const totalIgst = lines.reduce((s, l) => s + l.igst_amount, 0);
    const totalAmt  = lines.reduce((s, l) => s + l.amount, 0);
    const totalQty  = lines.reduce((s, l) => s + l.qty, 0);
    const totalTax  = totalCgst + totalSgst + totalIgst;

    if (hasGst && isIgst) {
        // 7 columns: # | Description | Qty | Unit Price | Aggregate | IGST | Amount
        // Fixed: 8+14+22+22+22+22 = 110; Description auto = 80mm
        autoTable(doc, {
            startY: y,
            margin: { left: M, right: M },
            theme: "grid",
            head: [[
                "#", "Description",
                { content: "Qty",        styles: { halign: "right" } },
                { content: "Unit Price", styles: { halign: "right" } },
                { content: "Aggregate",  styles: { halign: "right" } },
                { content: "IGST",       styles: { halign: "right" } },
                { content: "Amount",     styles: { halign: "right" } },
            ]],
            body: lines.map((l, i) => {
                const sub = buildAddrLines([
                    l.part_code ? `Code: ${l.part_code}` : null,
                    l.hsn_code  ? `HSN: ${l.hsn_code}`   : null,
                ]).join("  ");
                return [
                    i + 1,
                    l.description + (sub ? `\n${sub}` : ""),
                    { content: fmtAmt(l.qty),        styles: { halign: "right" } },
                    { content: fmtAmt(l.unit_price),  styles: { halign: "right" } },
                    { content: fmtAmt(l.aggregate),  styles: { halign: "right" } },
                    { content: `${fmtAmt(l.igst_amount)}\n(${fmtAmt(l.gst_rate)}%)`, styles: { halign: "right" } },
                    { content: fmtAmt(l.amount),     styles: { halign: "right" } },
                ];
            }),
            foot: [[
                "",
                { content: "Total", styles: { fontStyle: "bold" } },
                { content: fmtAmt(totalQty), styles: { halign: "right" } },
                "",
                { content: fmtAmt(totalAgg),  styles: { halign: "right" } },
                { content: fmtAmt(totalIgst), styles: { halign: "right" } },
                { content: fmtAmt(totalAmt),  styles: { halign: "right" } },
            ]],
            styles:     { fontSize: 8.5, cellPadding: 2, textColor: [30, 30, 30], overflow: "linebreak" },
            headStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20], fontStyle: "bold", fontSize: 8.5, lineColor: [180, 180, 180], lineWidth: 0.3 },
            footStyles: { fillColor: [245, 245, 245], fontStyle: "bold", textColor: [20, 20, 20], fontSize: 8.5, lineColor: [180, 180, 180], lineWidth: 0.3 },
            bodyStyles: { lineColor: [200, 200, 200], lineWidth: 0.3 },
            columnStyles: {
                0: { cellWidth: 8,  halign: "center" },
                2: { cellWidth: 14, halign: "right" },
                3: { cellWidth: 22, halign: "right" },
                4: { cellWidth: 22, halign: "right" },
                5: { cellWidth: 22, halign: "right" },
                6: { cellWidth: 22, halign: "right" },
            },
        });
    } else if (hasGst) {
        // 8 columns: # | Description | Qty | Unit Price | Aggregate | CGST | SGST | Amount
        // Fixed: 8+14+22+22+18+18+22 = 124; Description auto = 66mm
        autoTable(doc, {
            startY: y,
            margin: { left: M, right: M },
            theme: "grid",
            head: [[
                "#", "Description",
                { content: "Qty",        styles: { halign: "right" } },
                { content: "Unit Price", styles: { halign: "right" } },
                { content: "Aggregate",  styles: { halign: "right" } },
                { content: "CGST",       styles: { halign: "right" } },
                { content: "SGST",       styles: { halign: "right" } },
                { content: "Amount",     styles: { halign: "right" } },
            ]],
            body: lines.map((l, i) => {
                const sub = buildAddrLines([
                    l.part_code ? `Code: ${l.part_code}` : null,
                    l.hsn_code  ? `HSN: ${l.hsn_code}`   : null,
                ]).join("  ");
                return [
                    i + 1,
                    l.description + (sub ? `\n${sub}` : ""),
                    { content: fmtAmt(l.qty),         styles: { halign: "right" } },
                    { content: fmtAmt(l.unit_price),   styles: { halign: "right" } },
                    { content: fmtAmt(l.aggregate),   styles: { halign: "right" } },
                    { content: `${fmtAmt(l.cgst_amount)}\n(${fmtAmt(l.gst_rate / 2)}%)`, styles: { halign: "right" } },
                    { content: `${fmtAmt(l.sgst_amount)}\n(${fmtAmt(l.gst_rate / 2)}%)`, styles: { halign: "right" } },
                    { content: fmtAmt(l.amount),      styles: { halign: "right" } },
                ];
            }),
            foot: [[
                "",
                { content: "Total", styles: { fontStyle: "bold" } },
                { content: fmtAmt(totalQty),  styles: { halign: "right" } },
                "",
                { content: fmtAmt(totalAgg),  styles: { halign: "right" } },
                { content: fmtAmt(totalCgst), styles: { halign: "right" } },
                { content: fmtAmt(totalSgst), styles: { halign: "right" } },
                { content: fmtAmt(totalAmt),  styles: { halign: "right" } },
            ]],
            styles:     { fontSize: 8.5, cellPadding: 2, textColor: [30, 30, 30], overflow: "linebreak" },
            headStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20], fontStyle: "bold", fontSize: 8.5, lineColor: [180, 180, 180], lineWidth: 0.3 },
            footStyles: { fillColor: [245, 245, 245], fontStyle: "bold", textColor: [20, 20, 20], fontSize: 8.5, lineColor: [180, 180, 180], lineWidth: 0.3 },
            bodyStyles: { lineColor: [200, 200, 200], lineWidth: 0.3 },
            columnStyles: {
                0: { cellWidth: 8,  halign: "center" },
                2: { cellWidth: 14, halign: "right" },
                3: { cellWidth: 22, halign: "right" },
                4: { cellWidth: 22, halign: "right" },
                5: { cellWidth: 18, halign: "right" },
                6: { cellWidth: 18, halign: "right" },
                7: { cellWidth: 22, halign: "right" },
            },
        });
    } else {
        // 5 columns (no GST): # | Description | Qty | Unit Price | Total
        // Fixed: 8+14+26+26 = 74; Description auto = 116mm
        autoTable(doc, {
            startY: y,
            margin: { left: M, right: M },
            theme: "grid",
            head: [[
                "#", "Description",
                { content: "Qty",        styles: { halign: "right" } },
                { content: "Unit Price", styles: { halign: "right" } },
                { content: "Total",      styles: { halign: "right" } },
            ]],
            body: lines.map((l, i) => {
                const sub = buildAddrLines([
                    l.part_code ? `Code: ${l.part_code}` : null,
                    l.hsn_code  ? `HSN: ${l.hsn_code}`   : null,
                ]).join("  ");
                return [
                    i + 1,
                    l.description + (sub ? `\n${sub}` : ""),
                    { content: fmtAmt(l.qty),        styles: { halign: "right" } },
                    { content: fmtAmt(l.unit_price),  styles: { halign: "right" } },
                    { content: fmtAmt(l.amount),     styles: { halign: "right" } },
                ];
            }),
            foot: [[
                "",
                { content: "Total", styles: { fontStyle: "bold" } },
                { content: fmtAmt(totalQty), styles: { halign: "right" } },
                "",
                { content: fmtAmt(totalAmt), styles: { halign: "right" } },
            ]],
            styles:     { fontSize: 8.5, cellPadding: 2, textColor: [30, 30, 30], overflow: "linebreak" },
            headStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20], fontStyle: "bold", fontSize: 8.5, lineColor: [180, 180, 180], lineWidth: 0.3 },
            footStyles: { fillColor: [245, 245, 245], fontStyle: "bold", textColor: [20, 20, 20], fontSize: 8.5, lineColor: [180, 180, 180], lineWidth: 0.3 },
            bodyStyles: { lineColor: [200, 200, 200], lineWidth: 0.3 },
            columnStyles: {
                0: { cellWidth: 8,  halign: "center" },
                2: { cellWidth: 14, halign: "right" },
                3: { cellWidth: 26, halign: "right" },
                4: { cellWidth: 26, halign: "right" },
            },
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 3;

    if (y > pageH - 60) { doc.addPage(); y = M; }

    // ── Summary box (right) ───────────────────────────────────────────────────
    const sumBoxW = 75;
    const sumBoxX = rightX - sumBoxW;

    const jobTotal = Number(job.amount ?? totalAmt);
    const sumRows: { label: string; value: number; bold?: boolean }[] = hasGst ? [
        { label: "Aggregate amount:", value: totalAgg,  bold: true },
        ...((!isIgst) ? [
            { label: "CGST:",            value: totalCgst              },
            { label: "SGST:",            value: totalSgst              },
        ] : [
            { label: "IGST:",            value: totalIgst              },
        ]),
        { label: "Total Tax:",         value: totalTax               },
        { label: "Proforma Total:",    value: jobTotal, bold: true   },
    ] : [
        { label: "Proforma Total:",    value: jobTotal, bold: true   },
    ];

    const rowH  = 5.5;
    const boxH  = sumRows.length * rowH + 6;
    const sumTopY = y;

    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(252, 252, 252);
    doc.rect(sumBoxX, sumTopY - 1, sumBoxW, boxH, "FD");

    let sby = sumTopY + 3.5;
    for (const row of sumRows) {
        doc.setFont("helvetica", row.bold ? "bold" : "normal");
        doc.setFontSize(row.bold ? 9 : 8.5);
        doc.setTextColor(30, 30, 30);
        doc.text(row.label, sumBoxX + 3, sby);
        doc.text(fmtAmt(row.value), rightX - 2, sby, { align: "right" });
        sby += rowH;
    }

    y = sumTopY + boxH + 5;

    if (y > pageH - 20) { doc.addPage(); y = M; }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text("Authorised Signatory", M, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(amountInWords(jobTotal), rightX, y, { align: "right", maxWidth: sumBoxX - M - 4 });

    y += 8;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
        "* This is a PROFORMA INVOICE only and NOT a Tax Invoice. Amounts are subject to change.",
        M, y, { maxWidth: pageW - M * 2 },
    );

    return doc;
}

export function getProformaInvoiceBlobUrl(
    job: JobDetailType,
    parts: ProformaPartRow[],
    charges: ProformaChargeRow[],
    division: DivisionContextType | null,
): string {
    return String(buildProformaDoc(job, parts, charges, division).output("bloburl"));
}

export function downloadProformaInvoicePdf(
    job: JobDetailType,
    parts: ProformaPartRow[],
    charges: ProformaChargeRow[],
    division: DivisionContextType | null,
): void {
    buildProformaDoc(job, parts, charges, division).save(`Proforma-Invoice_${job.job_no}.pdf`);
}
