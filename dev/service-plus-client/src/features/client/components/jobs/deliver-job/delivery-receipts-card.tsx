import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { thClass, tdClass, fmtCurrency } from "./deliver-job-helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobPayment = {
    id:           number;
    payment_date: string;
    payment_mode: string;
    amount:       number;
    reference_no: string | null;
    remarks:      string | null;
};

type Props = {
    payments:     JobPayment[];
    invoiceTotal: number | null;
    onAddReceipt: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function modeBadgeClass(mode: string): string {
    switch (mode) {
        case "Cash":            return "bg-emerald-500/10 text-emerald-700";
        case "Card":            return "bg-blue-500/10 text-blue-700";
        case "UPI":             return "bg-purple-500/10 text-purple-700";
        case "Cheque":          return "bg-slate-500/10 text-slate-600";
        case "Online Transfer": return "bg-amber-500/10 text-amber-700";
        default:                return "bg-(--cl-surface-2) text-(--cl-text-muted)";
    }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeliveryReceiptsCard({ payments, invoiceTotal, onAddReceipt }: Props) {
    const alreadyPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const balance     = Math.max(0, Number(invoiceTotal ?? 0) - alreadyPaid);

    return (
        <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-(--cl-text-muted)">
                    Receipts
                </p>
                <Button
                    className="h-7 gap-1 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    onClick={onAddReceipt}
                >
                    <Plus className="h-3 w-3" />
                    Add Receipt
                </Button>
            </div>

            {/* Balance summary chips */}
            <div className="flex flex-wrap gap-6 mb-4">
                <div>
                    <p className="text-[10px] uppercase tracking-wider text-(--cl-text-muted)">Invoice Total</p>
                    <p className="text-sm font-semibold text-(--cl-text)">{fmtCurrency(invoiceTotal)}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-wider text-(--cl-text-muted)">Total Received</p>
                    <p className="text-sm font-semibold text-emerald-600">{fmtCurrency(alreadyPaid)}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-wider text-(--cl-text-muted)">Balance Due</p>
                    <p className={`text-sm font-semibold ${balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmtCurrency(balance)}
                    </p>
                </div>
            </div>

            {/* Payments table */}
            {(payments ?? []).length === 0 ? (
                <p className="text-sm text-(--cl-text-muted)">No receipts yet.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                        <thead>
                            <tr>
                                {["#", "Date", "Mode", "Amount", "Ref No", "Remarks"].map(h => (
                                    <th key={h} className={thClass}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((p, i) => (
                                <tr key={p.id} className="hover:bg-(--cl-accent)/5">
                                    <td className={`${tdClass} text-(--cl-text-muted)`}>{i + 1}</td>
                                    <td className={tdClass}>{p.payment_date.slice(0, 10)}</td>
                                    <td className={tdClass}>
                                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${modeBadgeClass(p.payment_mode)}`}>
                                            {p.payment_mode}
                                        </span>
                                    </td>
                                    <td className={`${tdClass} text-right tabular-nums font-medium`}>{fmtCurrency(p.amount)}</td>
                                    <td className={`${tdClass} font-mono text-xs`}>{p.reference_no ?? "—"}</td>
                                    <td className={tdClass}>{p.remarks ?? "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                        {payments.length > 1 && (
                            <tfoot>
                                <tr className="bg-(--cl-surface-2)">
                                    <td colSpan={3} className={`${tdClass} font-semibold text-right text-(--cl-text-muted)`}>
                                        TOTAL
                                    </td>
                                    <td className={`${tdClass} text-right tabular-nums font-bold text-emerald-600`}>
                                        {fmtCurrency(alreadyPaid)}
                                    </td>
                                    <td colSpan={2} className={tdClass} />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </div>
    );
}
