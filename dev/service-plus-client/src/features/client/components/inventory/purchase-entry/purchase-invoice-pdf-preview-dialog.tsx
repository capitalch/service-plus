import { useEffect, useState } from "react";
import { Loader2, Download, Printer, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";

import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCompanyName, selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { PurchaseInvoiceType, PurchaseLineType } from "@/features/client/types/purchase";
import { generatePurchaseInvoicePdf } from "./purchase-invoice-pdf-gen";

type Props = {
    invoice:      PurchaseInvoiceType | null;
    open:         boolean;
    onOpenChange: (open: boolean) => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };
type DetailRow = PurchaseInvoiceType & { lines: PurchaseLineType[] };

export const PurchaseInvoicePdfPreviewDialog = ({ invoice: propInvoice, open, onOpenChange }: Props) => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const companyName   = useAppSelector(selectCompanyName) || "Service Plus";
    const currentBranch = useAppSelector(selectCurrentBranch);
    const branchName    = currentBranch?.name || "Main Branch";

    const [detail, setDetail]   = useState<DetailRow | null>(null);
    const [pdfUrl, setPdfUrl]   = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // ─── Reset State ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!open) {
            setDetail(null);
            setPdfUrl(null);
            setLoading(false);
        }
    }, [open]);

    // ─── Data Fetching & PDF Generation ──────────────────────────────────────
    useEffect(() => {
        if (!open || !propInvoice) return;

        async function process() {
            setLoading(true);
            try {
                let currentDetail = detail;
                const invId       = propInvoice?.id; // Capture ID safely

                // 1. Fetch details if not already present or for a different invoice
                if (!currentDetail || currentDetail.id !== invId || !currentDetail.lines) {
                    const res = await apolloClient.query<GenericQueryData<DetailRow>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({
                                sqlId:   SQL_MAP.GET_PURCHASE_INVOICE_DETAIL,
                                sqlArgs: { id: invId },
                            }),
                        },
                    });
                    
                    currentDetail = res.data?.genericQuery?.[0] ?? null;
                    if (currentDetail) setDetail(currentDetail);
                }

                if (!currentDetail) throw new Error("Could not load invoice details");

                // 2. Generate PDF (tiny delay for modal entry)
                await new Promise(r => setTimeout(r, 150));
                
                const doc     = generatePurchaseInvoicePdf(currentDetail, currentDetail.lines || [], companyName, branchName);
                const pdfBlob = doc.output("blob");
                const blobUrl = URL.createObjectURL(pdfBlob);
                
                setPdfUrl(blobUrl);
            } catch (err) {
                console.error("PDF Preview Error:", err);
                toast.error("Failed to generate PDF preview");
            } finally {
                setLoading(false);
            }
        }

        process();

        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [open, propInvoice, dbName, schema, companyName, branchName]);

    const handleDownload = () => {
        const target = detail || propInvoice;
        if (!target) return;
        const lines = (target as any).lines || [];
        const filename = `purchase_invoice_${target.invoice_no || 'doc'}.pdf`;
        generatePurchaseInvoicePdf(target as DetailRow, lines, companyName, branchName, filename);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none !bg-zinc-900/10 backdrop-blur-sm">
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
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-zinc-100 rounded-full"
                            onClick={() => onOpenChange(false)}
                        >
                            <XCircle className="h-5 w-5 text-zinc-400 hover:text-red-500" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 w-full bg-zinc-100 flex items-center justify-center relative">
                    {loading ? (
                        <div className="flex flex-col items-center gap-4 text-zinc-500">
                            <Loader2 className="h-10 w-10 animate-spin text-zinc-400" />
                            <p className="text-sm font-medium animate-pulse">Generating PDF preview...</p>
                        </div>
                    ) : pdfUrl ? (
                        <iframe
                            src={pdfUrl}
                            className="w-full h-full border-none"
                            title="Invoice PDF Preview"
                        />
                    ) : (
                        <div className="text-zinc-400 italic text-sm">Failed to load preview. Try downloading instead.</div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
