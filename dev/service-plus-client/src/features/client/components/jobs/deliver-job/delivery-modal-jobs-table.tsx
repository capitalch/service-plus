import type { DivisionContextType } from "@/features/client/types/division";
import type { JobDeliveryFullDetail } from "./deliver-job-schema";
import { thClass, tdClass, fmtCurrency } from "./deliver-job-helpers";

type Props = {
    jobs:               JobDeliveryFullDetail[];
    availableDivisions: DivisionContextType[];
};

export function DeliveryModalJobsTable({ jobs }: Props) {
    return (
        <div className="overflow-x-auto rounded-lg border border-(--cl-border)">
            <table className="min-w-full border-collapse text-sm">
                <thead>
                    <tr>
                        {[
                            "Job No", "Alt Job No", "Job Date", "Customer",
                            "Recv Manner", "Job Type", "Recv Condition",
                            "Device Details", "Qty", "Est. Amt", "Amount", "Due Amt",
                        ].map(h => (
                            <th key={h} className={thClass}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-(--cl-border) bg-(--cl-surface)">
                    {jobs.map(job => {
                        const paid = (job.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
                        const due  = Math.max(0, Number(job.amount ?? 0) - paid);
                        return (
                            <tr key={job.id} className="hover:bg-(--cl-accent)/5">
                                <td className={`${tdClass} font-mono font-semibold text-(--cl-accent) whitespace-nowrap`}>
                                    #{job.job_no}
                                </td>
                                <td className={`${tdClass} whitespace-nowrap`}>{job.alternate_job_no ?? "—"}</td>
                                <td className={`${tdClass} whitespace-nowrap`}>{job.job_date}</td>
                                <td className={tdClass}>{job.customer_name}</td>
                                <td className={tdClass}>{job.receive_manner_name}</td>
                                <td className={tdClass}>
                                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-(--cl-accent)/10 text-(--cl-accent)">
                                        {job.job_type_name}
                                    </span>
                                </td>
                                <td className={tdClass}>{job.receive_condition_name || "—"}</td>
                                <td className={`${tdClass} max-w-36`}>
                                    <span className="text-xs leading-snug">{job.device_details ?? "—"}</span>
                                </td>
                                <td className={`${tdClass} text-right tabular-nums`}>{job.qty ?? "—"}</td>
                                <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(job.estimate_amount)}</td>
                                <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(job.amount)}</td>
                                <td className={`${tdClass} text-right tabular-nums font-semibold ${due > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                    {fmtCurrency(due)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                {jobs.length > 1 && (() => {
                    const totalAmt  = jobs.reduce((s, j) => s + Number(j.amount ?? 0), 0);
                    const totalPaid = jobs.reduce((s, j) => s + (j.payments ?? []).reduce((ps, p) => ps + Number(p.amount), 0), 0);
                    const totalDue  = Math.max(0, totalAmt - totalPaid);
                    return (
                        <tfoot>
                            <tr className="bg-(--cl-surface-2)">
                                <td colSpan={9} className={`${tdClass} font-semibold text-right text-(--cl-text-muted)`}>TOTAL</td>
                                <td className={tdClass} />
                                <td className={`${tdClass} text-right tabular-nums font-bold`}>{fmtCurrency(totalAmt)}</td>
                                <td className={`${tdClass} text-right tabular-nums font-bold ${totalDue > 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtCurrency(totalDue)}</td>
                            </tr>
                        </tfoot>
                    );
                })()}
            </table>
        </div>
    );
}
