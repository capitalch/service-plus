import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobDeliveryFullDetail } from "./deliver-job-schema";
import { fmtCurrency, thClass, tdClass } from "./deliver-job-helpers";

type Props = {
    jobs:           JobDeliveryFullDetail[];
    onAddReceipt:   (job: JobDeliveryFullDetail) => void;
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

export function DeliveryModalReceiptsSection({ jobs, onAddReceipt }: Props) {
    return (
        <div className="space-y-3">
            {jobs.map(job => {
                const paid = (job.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
                const due  = Math.max(0, Number(job.amount ?? 0) - paid);
                return (
                    <div key={job.id} className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-(--cl-accent)">#{job.job_no}</span>
                                <span className="text-xs text-(--cl-text-muted)">{job.customer_name}</span>
                            </div>
                            <Button
                                className="h-6 gap-1 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                onClick={() => onAddReceipt(job)}
                            >
                                <Plus className="h-3 w-3" />
                                Add Receipt
                            </Button>
                        </div>

                        {/* Balance chips */}
                        <div className="flex flex-wrap gap-4 mb-2 text-xs">
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
                            <p className="text-xs text-(--cl-text-muted)">No receipts recorded.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse text-xs">
                                    <thead>
                                        <tr>
                                            {["#", "Date", "Mode", "Amount", "Ref No", "Remarks"].map(h => (
                                                <th key={h} className={thClass}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(job.payments ?? []).map((p, i) => (
                                            <tr key={p.id} className="hover:bg-(--cl-accent)/5">
                                                <td className={`${tdClass} text-(--cl-text-muted)`}>{i + 1}</td>
                                                <td className={tdClass}>{p.payment_date.slice(0, 10)}</td>
                                                <td className={tdClass}>
                                                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${modeBadgeClass(p.payment_mode)}`}>
                                                        {p.payment_mode}
                                                    </span>
                                                </td>
                                                <td className={`${tdClass} text-right tabular-nums font-medium`}>{fmtCurrency(p.amount)}</td>
                                                <td className={`${tdClass} font-mono`}>{p.reference_no ?? "—"}</td>
                                                <td className={tdClass}>{p.remarks ?? "—"}</td>
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
