import { useEffect, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { formatCurrency } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { PurchaseInvoiceType, PurchaseLineType } from "@/features/client/types/purchase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    invoice:      PurchaseInvoiceType | null;
    open:         boolean;
    onOpenChange: (open: boolean) => void;
    onShowPdf?:   (invoice: PurchaseInvoiceType) => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

type DetailRow = PurchaseInvoiceType & { lines: PurchaseLineType[] };

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "text-xs font-extrabold uppercase tracking-widest text-zinc-500 p-2 text-left border-b border-zinc-200 bg-zinc-100/80";
const tdClass = "p-2 text-sm text-zinc-700 border-b border-zinc-100";

// ─── Component ────────────────────────────────────────────────────────────────

export const ViewPurchaseInvoiceDialog = ({ invoice, open, onOpenChange, onShowPdf }: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [detail,  setDetail]  = useState<DetailRow | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !invoice) { setDetail(null); return; }
        setLoading(true);
        apolloClient.query<GenericQueryData<DetailRow>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId:   SQL_MAP.GET_PURCHASE_INVOICE_DETAIL,
                    sqlArgs: { id: invoice.id },
                }),
            },
        })
            .then(res => setDetail(res.data?.genericQuery?.[0] ?? null))
            .catch(() => toast.error(MESSAGES.ERROR_PURCHASE_LOAD_FAILED))
            .finally(() => setLoading(false));
    }, [open, invoice, dbName, schema]);

    const lines = detail?.lines ?? [];
    const computedTotal  = lines.reduce((s, l) => s + Number(l.total_amount), 0);
    const physicalTotal  = detail ? Number(detail.total_amount) : 0;
    const diffAmount     = physicalTotal - computedTotal;
    const totalAggregate = lines.reduce((s, l) => s + Number(l.aggregate_amount), 0);
    const totalCgst      = lines.reduce((s, l) => s + Number(l.cgst_amount), 0);
    const totalSgst      = lines.reduce((s, l) => s + Number(l.sgst_amount), 0);
    const totalIgst      = lines.reduce((s, l) => s + Number(l.igst_amount), 0);
    const totalTax       = totalCgst + totalSgst + totalIgst;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-5xl max-h-[90vh] overflow-y-auto !bg-white text-zinc-950 border-none shadow-2xl"
            >
                <DialogHeader className="flex flex-row items-center justify-between border-b border-zinc-100 pb-4 mb-2">
                    <DialogTitle className="text-xl font-bold text-zinc-800">
                        Purchase Invoice — {invoice?.invoice_no}
                    </DialogTitle>
                    <div className="flex items-center gap-2 pr-8">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 font-bold uppercase tracking-widest text-[10px]"
                            onClick={() => {
                                if (detail && onShowPdf) onShowPdf(detail);
                            }}
                        >
                            <FileDown className="h-3.5 w-3.5" />
                            Show PDF
                        </Button>

                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-[var(--cl-accent)]" />
                    </div>
                ) : detail ? (
                    <div className="space-y-4">
                        {/* Header info */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 text-sm sm:grid-cols-4 shadow-sm">
                            <Field label="Invoice No"      value={detail.invoice_no} />
                            <Field label="Invoice Date"    value={detail.invoice_date} />
                            <Field label="Supplier"        className="sm:col-span-1" value={detail.supplier_name} />
                            <Field label="State Code"      value={detail.supplier_state_code} />
                            {detail.remarks && <Field label="Remarks" value={detail.remarks} className="col-span-2 sm:col-span-4 border-t border-zinc-100 pt-2 mt-1" />}
                        </div>

                        {/* Lines table */}
                        <div className="overflow-x-auto rounded-lg border border-zinc-200">
                            <table className="min-w-full border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th className={thClass}>#</th>
                                        <th className={thClass}>Part Code</th>
                                        <th className={thClass}>Part Name</th>
                                        <th className={thClass}>HSN</th>
                                        <th className={`${thClass} text-right`}>Qty</th>
                                        <th className={`${thClass} text-right`}>Unit Price</th>
                                        <th className={`${thClass} text-right`}>Aggregate</th>
                                        <th className={`${thClass} text-right`}>CGST</th>
                                        <th className={`${thClass} text-right`}>SGST</th>
                                        <th className={`${thClass} text-right`}>IGST</th>
                                        <th className={`${thClass} text-right`}>Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {lines.map((line, idx) => (
                                        <tr key={line.id} className="hover:bg-zinc-50/80 transition-colors">
                                            <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{idx + 1}</td>
                                            <td className={`${tdClass} font-mono`}>{line.part_code}</td>
                                            <td className={tdClass}>{line.part_name}</td>
                                            <td className={`${tdClass} font-mono text-xs`}>{line.hsn_code}</td>
                                            <td className={`${tdClass} text-right`}>{Number(line.quantity).toFixed(2)}</td>
                                            <td className={`${tdClass} text-right`}>{formatCurrency(line.unit_price)}</td>
                                            <td className={`${tdClass} text-right`}>{formatCurrency(line.aggregate_amount)}</td>
                                            <td className={`${tdClass} text-right text-xs`}>{formatCurrency(line.cgst_amount)}</td>
                                            <td className={`${tdClass} text-right text-xs`}>{formatCurrency(line.sgst_amount)}</td>
                                            <td className={`${tdClass} text-right text-xs`}>{formatCurrency(line.igst_amount)}</td>
                                            <td className={`${tdClass} text-right font-medium`}>{formatCurrency(line.total_amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-zinc-100/50 font-bold border-t-2 border-zinc-200">
                                        <td colSpan={6} className="p-2 text-right text-xs uppercase tracking-widest text-zinc-500">Totals</td>
                                        <td className="p-2 text-right text-sm text-zinc-900 font-bold">{formatCurrency(totalAggregate)}</td>
                                        <td className="p-2 text-right text-sm text-zinc-900 font-bold">{formatCurrency(totalCgst)}</td>
                                        <td className="p-2 text-right text-sm text-zinc-900 font-bold">{formatCurrency(totalSgst)}</td>
                                        <td className="p-2 text-right text-sm text-zinc-900 font-bold">{formatCurrency(totalIgst)}</td>
                                        <td className="p-2 text-right text-sm text-[var(--cl-accent)] font-extrabold">{formatCurrency(computedTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Summary Footer */}
                        <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-6 rounded-xl border border-zinc-200 bg-zinc-50/30 p-5 shadow-sm">
                            <Field
                                className="text-right"
                                label="computed Amount"
                                value={formatCurrency(computedTotal)}
                            />
                            <div className="hidden h-8 w-px bg-zinc-200 sm:block" />
                            <Field
                                className="text-right"
                                label="Tax Amount"
                                value={formatCurrency(totalTax)}
                            />
                            <div className="hidden h-8 w-px bg-zinc-200 sm:block" />
                            <div className="text-right">
                                <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">Difference</p>
                                <p className={`font-semibold ${Math.abs(diffAmount) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}>
                                    {diffAmount > 0 ? "+" : ""}{formatCurrency(diffAmount)}
                                </p>
                            </div>
                            <div className="hidden h-8 w-px bg-zinc-200 sm:block" />
                            <Field
                                className="text-right"
                                label="Invoice amount"
                                value={formatCurrency(physicalTotal)}
                            />
                        </div>

                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
};

function Field({ label, value, className }: { label: string; value: string | number; className?: string }) {
    return (
        <div className={className}>
            <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="font-semibold text-zinc-800">{value}</p>
        </div>
    );
}
