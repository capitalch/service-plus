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
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCompanyName, selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { BranchType } from "@/features/client/components/masters/branch/branch";
import type { SalesInvoiceType, SalesLineType } from "@/features/client/types/sales";
import { generateSalesInvoicePdf } from "./sales-invoice-pdf-gen";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Props = {
    branch:       BranchType | null;
    invoice:      SalesInvoiceType | null;
    open:         boolean;
    onOpenChange: (open: boolean) => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };
type DetailRow = SalesInvoiceType & { lines: SalesLineType[] };

// ─── Component ────────────────────────────────────────────────────────────────

export const SalesInvoicePdfPreviewDialog = ({ branch, invoice: propInvoice, onOpenChange, open }: Props) => {
    const dbName      = useAppSelector(selectDbName);
    const schema      = useAppSelector(selectSchema);
    const companyName = useAppSelector(selectCompanyName) || "Service Plus";
    const ctxBranch   = useAppSelector(selectCurrentBranch);
    const branchName  = ctxBranch?.name || "Main Branch";

    const [detail,  setDetail]  = useState<DetailRow | null>(null);
    const [loading, setLoading] = useState(false);
    const [pdfUrl,  setPdfUrl]  = useState<string | null>(null);

    // ─── Reset State ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!open) { setDetail(null); setLoading(false); setPdfUrl(null); }
    }, [open]);

    // ─── Data Fetching & PDF Generation ──────────────────────────────────────
    useEffect(() => {
        if (!open || !propInvoice) return;

        async function process() {
            setLoading(true);
            try {
                let det       = detail;
                const invId   = propInvoice?.id;

                if (!det || det.id !== invId) {
                    const res = await apolloClient.query<GenericQueryData<DetailRow>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({
                                sqlId:   SQL_MAP.GET_SALES_INVOICE_DETAIL,
                                sqlArgs: { id: invId },
                            }),
                        },
                    });
                    det = res.data?.genericQuery?.[0] ?? null;
                    if (det) setDetail(det);
                }

                if (!det) throw new Error("Could not load invoice details");

                await new Promise(r => setTimeout(r, 150));
                const doc     = generateSalesInvoicePdf(det, companyName, branchName, branch);
                const pdfBlob = doc.output("blob");
                setPdfUrl(URL.createObjectURL(pdfBlob));
            } catch {
                toast.error("Failed to generate PDF preview");
            } finally {
                setLoading(false);
            }
        }

        void process();

        return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
    }, [open, propInvoice, dbName, schema, companyName, branchName, branch]);

    const handleDownload = () => {
        const d = detail || propInvoice;
        if (!d) return;
        generateSalesInvoicePdf(
            d as DetailRow,
            companyName,
            branchName,
            branch,
            `sales_invoice_${d.invoice_no || "doc"}.pdf`
        );
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
                            disabled={!pdfUrl}
                            onClick={handleDownload}
                        >
                            <Download className="h-3.5 w-3.5" />
                            Download
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 border-zinc-300 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white font-extrabold uppercase tracking-widest text-[10px]"
                            disabled={!pdfUrl}
                            onClick={() => window.print()}
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
                        <iframe
                            className="w-full h-full border-none"
                            src={pdfUrl}
                            title="Sales Invoice PDF Preview"
                        />
                    ) : (
                        <div className="text-zinc-400 italic text-sm">Failed to load preview. Try downloading instead.</div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
