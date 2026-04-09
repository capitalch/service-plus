import { useEffect, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { formatCurrency } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCompanyName, selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { SalesInvoiceType, SalesLineType } from "@/features/client/types/sales";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    invoice:      SalesInvoiceType | null;
    open:         boolean;
    onOpenChange: (open: boolean) => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };
type DetailRow = SalesInvoiceType & { lines: SalesLineType[] };

// ─── PDF Generator ────────────────────────────────────────────────────────────

function generateSalesInvoicePdf(
    invoice:     DetailRow,
    companyName: string,
    branchName:  string,
    saveAs?:     string
): jsPDF {
    const doc        = new jsPDF({ format: "a4", orientation: "p", unit: "mm" });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin     = 14;
    const midX       = pageWidth / 2;
    let   currY      = margin;

    // ── Title ──────────────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("TAX INVOICE (SALES)", midX, currY, { align: "center" });
    currY += 5;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.6);
    doc.line(margin, currY, pageWidth - margin, currY);
    currY += 8;

    // ── Company / Billed From ──────────────────────────────────────────────
    const colGap = 8;
    const colW   = midX - margin - colGap / 2;
    const leftX  = margin;
    const rightX = midX + colGap / 2;

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("BILLED FROM (Seller)", leftX, currY);
    doc.text("INVOICE DETAILS",      rightX, currY);
    currY += 4.5;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(companyName, leftX, currY, { maxWidth: colW });

    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text("INVOICE NO:", rightX, currY);
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(invoice.invoice_no, rightX + 24, currY);
    currY += 4.5;

    const partyStartY = currY;

    // Branch info on left
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Branch: ${branchName}`, leftX, currY, { maxWidth: colW });
    currY += 4.2;

    // Date / State on right
    let metaY = partyStartY;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(110, 110, 110);
    doc.text("DATE:", rightX, metaY);
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(invoice.invoice_date, rightX + 24, metaY);
    metaY += 4.2;

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(110, 110, 110);
    doc.text("STATE CODE:", rightX, metaY);
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(invoice.customer_state_code || "—", rightX + 24, metaY);

    const row1EndY = Math.max(currY, metaY + 4.2);
    currY = row1EndY + 4;

    // Vertical divider
    doc.setDrawColor(220, 220, 220);
    doc.line(midX, partyStartY - 13, midX, row1EndY);

    // ── Customer / Billed To ───────────────────────────────────────────────
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, currY - 2, pageWidth - margin, currY - 2);
    currY += 4;

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
    if (invoice.customer_gstin) {
        doc.text(`GSTIN: ${invoice.customer_gstin}`, leftX, currY);
        currY += 4.2;
    }
    if (invoice.customer_state_code) {
        doc.text(`State Code: ${invoice.customer_state_code}`, leftX, currY);
        currY += 4.2;
    }
    currY += 4;

    // ── Line Items Table ───────────────────────────────────────────────────
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

    autoTable(doc, {
        body:    tableBody,
        head:    [["#", "Part Code", "Part Name", "HSN", "Qty", "Price", "Aggregate", "CGST", "SGST", "IGST", "Total"]],
        margin:  { left: margin, right: margin },
        startY:  currY,
        theme:   "grid",
        headStyles: {
            fillColor: [60, 60, 60],
            fontSize:  7,
            fontStyle: "bold",
            halign:    "center",
            textColor: [255, 255, 255],
        },
        columnStyles: {
            0:  { cellWidth: 8,  halign: "center" },
            4:  { cellWidth: 12, halign: "right" },
            5:  { cellWidth: 18, halign: "right" },
            6:  { cellWidth: 20, halign: "right" },
            7:  { cellWidth: 15, halign: "right" },
            8:  { cellWidth: 15, halign: "right" },
            9:  { cellWidth: 15, halign: "right" },
            10: { cellWidth: 20, halign: "right" },
        },
        styles: { cellPadding: 2, fontSize: 7.5, textColor: [30, 30, 30] },
    });

    currY = (doc as any).lastAutoTable.finalY + 10;
    if (currY > pageHeight - 60) { doc.addPage(); currY = margin; }

    // ── Summary Box ────────────────────────────────────────────────────────
    const boxW    = 85;
    const boxL    = pageWidth - margin - boxW;
    const boxR    = pageWidth - margin;
    const labelX  = boxL + 4;
    const valueX  = boxR - 4;
    const rowH    = 6;

    const computedTotal = lines.reduce((s, l) => s + Number(l.total_amount), 0);

    const rows: Array<{ label: string; value: number; bold?: boolean; accent?: boolean }> = [
        { label: "Aggregate Amount", value: Number(invoice.aggregate_amount) },
        { label: "CGST",             value: Number(invoice.cgst_amount) },
        { label: "SGST",             value: Number(invoice.sgst_amount) },
        { label: "IGST",             value: Number(invoice.igst_amount) },
        { label: "Total Tax",        value: Number(invoice.total_tax) },
        { label: "Invoice Total",    value: computedTotal, bold: true, accent: true },
    ];

    const boxStartY = currY - 4;
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(boxL, boxStartY, boxW, rows.length * rowH + 8, 2, 2, "FD");
    currY += 2;

    for (const row of rows) {
        doc.setFontSize(row.bold ? 10 : 8.5);
        doc.setFont("helvetica", row.bold ? "bold" : "normal");
        doc.setTextColor(...(row.accent ? ([0, 80, 180] as [number, number, number]) : ([20, 20, 20] as [number, number, number])));
        doc.text(row.label, labelX, currY);
        doc.text(`Rs. ${formatCurrency(row.value).replace("₹", "").trim()}`, valueX, currY, { align: "right" });
        currY += rowH;
    }

    // ── Remarks ────────────────────────────────────────────────────────────
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

    // ── Footer ─────────────────────────────────────────────────────────────
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SalesInvoicePdfPreviewDialog = ({ invoice: propInvoice, open, onOpenChange }: Props) => {
    const dbName      = useAppSelector(selectDbName);
    const schema      = useAppSelector(selectSchema);
    const companyName = useAppSelector(selectCompanyName) || "Service Plus";
    const branch      = useAppSelector(selectCurrentBranch);
    const branchName  = branch?.name || "Main Branch";

    const [detail,  setDetail]  = useState<DetailRow | null>(null);
    const [pdfUrl,  setPdfUrl]  = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) { setDetail(null); setPdfUrl(null); setLoading(false); }
    }, [open]);

    useEffect(() => {
        if (!open || !propInvoice) return;

        async function process() {
            setLoading(true);
            try {
                let det = detail;
                const invId = propInvoice?.id;
                if (!det || det.id !== invId) {
                    const res = await apolloClient.query<GenericQueryData<DetailRow>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName, schema,
                            value: graphQlUtils.buildGenericQueryValue({
                                sqlId: SQL_MAP.GET_SALES_INVOICE_DETAIL,
                                sqlArgs: { id: invId },
                            }),
                        },
                    });
                    det = res.data?.genericQuery?.[0] ?? null;
                    if (det) setDetail(det);
                }
                if (!det) throw new Error("No detail");

                await new Promise(r => setTimeout(r, 150));
                const doc  = generateSalesInvoicePdf(det, companyName, branchName);
                const blob = doc.output("blob");
                setPdfUrl(URL.createObjectURL(blob));
            } catch {
                toast.error("Failed to generate PDF preview");
            } finally {
                setLoading(false);
            }
        }

        void process();
        return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, propInvoice, dbName, schema, companyName, branchName]);

    const handleDownload = () => {
        const d = detail || propInvoice;
        if (!d) return;
        generateSalesInvoicePdf(d as DetailRow, companyName, branchName,
            `sales_invoice_${d.invoice_no || "doc"}.pdf`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none !bg-zinc-900/10 backdrop-blur-sm"
            >
                <DialogHeader className="bg-white border-b border-zinc-200 p-4 shrink-0 flex flex-row items-center justify-between">
                    <DialogTitle className="text-lg font-bold text-zinc-900">
                        Invoice Preview — {propInvoice?.invoice_no}
                    </DialogTitle>
                    <div className="flex items-center gap-3 pr-10">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 border-zinc-300 font-extrabold uppercase tracking-widest text-[10px]"
                            onClick={handleDownload}
                            disabled={!pdfUrl}
                        >
                            <Download className="h-3.5 w-3.5" />
                            Download
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 border-zinc-300 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white font-extrabold uppercase tracking-widest text-[10px]"
                            onClick={() => window.print()}
                            disabled={!pdfUrl}
                        >
                            <Printer className="h-3.5 w-3.5" />
                            Print
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 w-full bg-zinc-100 flex items-center justify-center relative">
                    {loading ? (
                        <div className="flex flex-col items-center gap-4 text-zinc-500">
                            <Loader2 className="h-10 w-10 animate-spin text-zinc-400" />
                            <p className="text-sm font-medium animate-pulse">Generating PDF preview…</p>
                        </div>
                    ) : pdfUrl ? (
                        <iframe src={pdfUrl} className="w-full h-full border-none" title="Sales Invoice PDF" />
                    ) : (
                        <div className="text-zinc-400 italic text-sm">Failed to load preview. Try downloading instead.</div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
