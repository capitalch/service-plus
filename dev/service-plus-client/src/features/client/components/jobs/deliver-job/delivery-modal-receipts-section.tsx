import { Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobDeliveryFullDetail } from "./deliver-job-schema";
import { fmtCurrency } from "./deliver-job-helpers";

type Props = {
    jobs:             JobDeliveryFullDetail[];
    onAddReceipt:     (job: JobDeliveryFullDetail) => void;
    loadingPdfJobId?: number | null;
    onPrintReceipt?:  (job: JobDeliveryFullDetail) => void;
};

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

export function DeliveryModalReceiptsSection({ jobs, onAddReceipt, loadingPdfJobId, onPrintReceipt }: Props) {
    return (
        <div className="space-y-3">
            {jobs.map(job => {
                const paid = (job.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
                const due  = Math.max(0, Number(job.amount ?? 0) - paid);
                return (
                    <div key={job.id} className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) px-4 py-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <span className="font-mono text-sm font-bold text-(--cl-accent)">#{job.job_no}</span>
                                <span className="text-sm text-(--cl-text-muted)">{job.customer_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {onPrintReceipt && (job.payments ?? []).length > 0 && (
                                    <Button
                                        className="h-8 gap-1 px-2 text-sm"
                                        disabled={loadingPdfJobId === job.id}
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onPrintReceipt(job)}
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                        Print
                                    </Button>
                                )}
                                <Button
                                    className="h-8 gap-1.5 px-3 text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                    disabled={due === 0}
                                    onClick={() => onAddReceipt(job)}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Receipt
                                </Button>
                            </div>
                        </div>

                        {/* Balance chips */}
                        <div className="flex flex-wrap gap-5 mb-3 text-sm">
                            <span className="text-(--cl-text-muted)">
                                Amount: <strong className="text-(--cl-text)">{fmtCurrency(job.amount)}</strong>
                            </span>
                            <span className="text-(--cl-text-muted)">
                                Received: <strong className="text-emerald-600">{fmtCurrency(paid)}</strong>
                            </span>
                            <span className="text-(--cl-text-muted)">
                                Due: <strong className={due > 0 ? "text-red-600" : "text-emerald-600"}>{fmtCurrency(due)}</strong>
                            </span>
                        </div>

                        {/* Receipts table */}
                        {(job.payments ?? []).length === 0 ? (
                            <p className="text-sm text-(--cl-text-muted)">No receipts recorded.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-md border border-(--cl-border)">
                                <table className="min-w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-(--cl-surface-2)">
                                            {["Receipt No", "Date", "Mode", "Amount", "Ref No", "Remarks"].map(h => (
                                                <th key={h} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) border-b border-(--cl-border) ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-(--cl-border) bg-(--cl-surface)">
                                        {(job.payments ?? []).map((p, i) => (
                                            <tr key={p.id} className="hover:bg-(--cl-accent)/5">
                                                <td className="px-3 py-2 text-sm font-mono font-semibold text-(--cl-accent)">{p.receipt_no ?? `#${i + 1}`}</td>
                                                <td className="px-3 py-2 text-sm">{p.payment_date.slice(0, 10)}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${modeBadgeClass(p.payment_mode)}`}>
                                                        {p.payment_mode}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-sm text-right tabular-nums font-semibold">{fmtCurrency(p.amount)}</td>
                                                <td className="px-3 py-2 text-sm font-mono">{p.reference_no ?? "—"}</td>
                                                <td className="px-3 py-2 text-sm">{p.remarks ?? "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
