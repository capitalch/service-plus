import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportPdfMetaType = { label: string; value: string };

export type ReportPdfColumnType = {
    align?: "center" | "left" | "right";
    dataKey: string;
    header: string;
    width?: number;
};

export type ReportPdfRowType = Record<string, number | string>;

export type ReportPdfOptionsType = {
    columns:      ReportPdfColumnType[];
    fileName?:    string;
    footerNote?:  string;
    meta?:        ReportPdfMetaType[];
    orientation?: "landscape" | "portrait";
    rows:         ReportPdfRowType[];
    subtitle?:    string;
    title:        string;
    totalsRow?:   ReportPdfRowType;
};

function nowIso(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${dd} ${hh}:${mm}`;
}

function sanitizeFileName(s: string): string {
    return s.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80);
}

export function exportReportPdf(opts: ReportPdfOptionsType): jsPDF {
    const orientation = opts.orientation ?? "portrait";
    const doc = new jsPDF({ format: "a4", orientation, unit: "mm" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin    = 12;
    let currY       = margin;

    // ── Title ───────────────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(opts.title, margin, currY);
    currY += 5;

    if (opts.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        doc.text(opts.subtitle, margin, currY);
        currY += 4;
    }

    // ── Meta strip ──────────────────────────────────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    const metaItems: string[] = [];
    if (opts.meta) {
        for (const m of opts.meta) metaItems.push(`${m.label}: ${m.value}`);
    }
    metaItems.push(`Generated: ${nowIso()}`);
    doc.text(metaItems.join("   |   "), margin, currY);
    currY += 3;

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(margin, currY, pageWidth - margin, currY);
    currY += 4;

    // ── Body table ──────────────────────────────────────────────────────────
    const head = [opts.columns.map(c => c.header)];
    const body = opts.rows.map(r => opts.columns.map(c => {
        const v = r[c.dataKey];
        return v == null ? "" : String(v);
    }));
    const foot = opts.totalsRow
        ? [opts.columns.map(c => {
            const v = opts.totalsRow?.[c.dataKey];
            return v == null ? "" : String(v);
        })]
        : undefined;

    autoTable(doc, {
        body,
        columnStyles: Object.fromEntries(opts.columns.map((c, i) => [
            i,
            {
                cellWidth: c.width,
                halign:    c.align ?? "left",
            },
        ])),
        foot,
        footStyles:    { fillColor: [235, 235, 235], fontStyle: "bold", textColor: 20 },
        head,
        headStyles:    { fillColor: [40, 60, 100], halign: "left", textColor: 255 },
        margin:        { left: margin, right: margin },
        startY:        currY,
        styles:        { fontSize: 8 },
        theme:         "striped",
    });

    // ── Footer ──────────────────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: "right" });
        if (opts.footerNote) {
            doc.text(opts.footerNote, margin, pageHeight - 5);
        }
    }

    if (opts.fileName) {
        doc.save(sanitizeFileName(opts.fileName) + ".pdf");
    }
    return doc;
}
