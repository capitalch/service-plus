import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
};

type GenericQueryData<T> = { genericQuery: T[] | null };

type DetailRow = PurchaseInvoiceType & { lines: PurchaseLineType[] };

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-2 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]/50";
const tdClass = "p-2 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const ViewPurchaseInvoiceDialog = ({ invoice, open, onOpenChange }: Props) => {
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
    const totalAggregate = lines.reduce((s, l) => s + Number(l.aggregate_amount), 0);
    const totalCgst    = lines.reduce((s, l) => s + Number(l.cgst_amount), 0);
    const totalSgst    = lines.reduce((s, l) => s + Number(l.sgst_amount), 0);
    const totalIgst    = lines.reduce((s, l) => s + Number(l.igst_amount), 0);
    const grandTotal   = lines.reduce((s, l) => s + Number(l.total_amount), 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto !bg-[var(--cl-surface)] text-[var(--cl-text)]">
                <DialogHeader>
                    <DialogTitle>Purchase Invoice — {invoice?.invoice_no}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-[var(--cl-accent)]" />
                    </div>
                ) : detail ? (
                    <div className="space-y-4">
                        {/* Header info */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-4 text-sm sm:grid-cols-3">
                            <Field label="Invoice No"      value={detail.invoice_no} />
                            <Field label="Invoice Date"    value={detail.invoice_date} />
                            <Field label="Supplier"        value={detail.supplier_name} />
                            <Field label="State Code"      value={detail.supplier_state_code} />
                            <Field label="Aggregate Amount"  value={formatCurrency(detail.aggregate_amount)} />
                            <Field label="Total Tax"       value={formatCurrency(detail.total_tax)} />
                            <Field label="Total Amount"    value={formatCurrency(detail.total_amount)} className="font-semibold text-[var(--cl-accent)]" />
                            {detail.remarks && <Field label="Remarks" value={detail.remarks} className="col-span-2" />}
                        </div>

                        {/* Lines table */}
                        <div className="overflow-x-auto rounded-lg border border-[var(--cl-border)]">
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
                                <tbody className="bg-[var(--cl-surface)]">
                                    {lines.map((line, idx) => (
                                        <tr key={line.id} className="hover:bg-[var(--cl-surface-2)]/50">
                                            <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{idx + 1}</td>
                                            <td className={`${tdClass} font-mono`}>{line.part_code}</td>
                                            <td className={tdClass}>{line.part_name}</td>
                                            <td className={`${tdClass} font-mono text-xs`}>{line.hsn_code}</td>
                                            <td className={`${tdClass} text-right`}>{Number(line.quantity).toFixed(2)}</td>
                                            <td className={`${tdClass} text-right`}>{formatCurrency(line.unit_price)}</td>
                                            <td className={`${tdClass} text-right`}>{formatCurrency(line.aggregate_amount)}</td>
                                            <td className={`${tdClass} text-right text-xs`}>{formatCurrency(line.cgst_amount)}<span className="text-[var(--cl-text-muted)]"> ({line.cgst_rate}%)</span></td>
                                            <td className={`${tdClass} text-right text-xs`}>{formatCurrency(line.sgst_amount)}<span className="text-[var(--cl-text-muted)]"> ({line.sgst_rate}%)</span></td>
                                            <td className={`${tdClass} text-right text-xs`}>{formatCurrency(line.igst_amount)}<span className="text-[var(--cl-text-muted)]"> ({line.igst_rate}%)</span></td>
                                            <td className={`${tdClass} text-right font-medium`}>{formatCurrency(line.total_amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[var(--cl-surface-2)]/50 font-semibold">
                                        <td colSpan={6} className="p-2 text-right text-xs uppercase tracking-wide text-[var(--cl-text-muted)]">Totals</td>
                                        <td className="p-2 text-right text-sm">{formatCurrency(totalAggregate)}</td>
                                        <td className="p-2 text-right text-sm">{formatCurrency(totalCgst)}</td>
                                        <td className="p-2 text-right text-sm">{formatCurrency(totalSgst)}</td>
                                        <td className="p-2 text-right text-sm">{formatCurrency(totalIgst)}</td>
                                        <td className="p-2 text-right text-sm text-[var(--cl-accent)]">{formatCurrency(grandTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
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
            <p className="text-xs text-[var(--cl-text-muted)]">{label}</p>
            <p className="font-medium">{value}</p>
        </div>
    );
}
