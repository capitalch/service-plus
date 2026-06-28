import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DivisionContextType } from "@/features/client/types/division";
import type { JobDeliveryFullDetail } from "./deliver-job-schema";
import { fmtCurrency } from "./deliver-job-helpers";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";

type Props = {
    jobs:               JobDeliveryFullDetail[];
    availableDivisions: DivisionContextType[];
    gstinByJob:         Map<number, string>;
    onGstinChange:      (jobId: number, value: string) => void;
    onViewJob?:         (id: number) => void;
};

export function DeliveryModalJobsTable({ jobs, gstinByJob, onGstinChange, onViewJob }: Props) {
    const totalAmt  = jobs.reduce((s, j) => s + Number(j.amount ?? 0), 0);
    const totalPaid = jobs.reduce((s, j) => s + (j.payments ?? []).reduce((ps, p) => ps + Number(p.amount), 0), 0);
    const totalDue  = Math.max(0, totalAmt - totalPaid);

    return (
        <div className="flex flex-col gap-2">
            {jobs.map(job => {
                const paid = (job.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
                const due  = Math.max(0, Number(job.amount ?? 0) - paid);
                const g    = gstinByJob.get(job.id) ?? "";
                return (
                    <div key={job.id} className="rounded-lg border border-(--cl-border) bg-(--cl-surface) px-4 py-3 flex flex-col gap-1.5">
                        {/* Row 1: job # · customer · mobile | job-type badge · date · view */}
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-(--cl-accent) text-base shrink-0">#{job.job_no}</span>
                            {job.alternate_job_no && (
                                <span className="text-sm text-(--cl-text-muted) shrink-0">/{job.alternate_job_no}</span>
                            )}
                            <div className="flex items-baseline gap-2 flex-1 min-w-0">
                                <span className="font-semibold text-(--cl-text) truncate text-base">{job.customer_name}</span>
                                {job.mobile && (
                                    <span className="text-sm text-(--cl-text-muted) shrink-0">{job.mobile}</span>
                                )}
                            </div>
                            {/* GSTIN — editable, saved to the customer on delivery */}
                            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">GSTIN</span>
                            <Input
                                className={`h-7 w-44 shrink-0 bg-(--cl-surface) text-xs font-mono uppercase ${g && !isValidGstin(g) ? "border-red-400" : "border-(--cl-border)"}`}
                                placeholder="15-char (optional)"
                                maxLength={15}
                                value={g}
                                title={g && !isValidGstin(g) ? "Enter a valid 15-character GSTIN" : "Customer GSTIN"}
                                onChange={e => onGstinChange(job.id, normalizeGstin(e.target.value))}
                            />
                            <span className="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-medium bg-(--cl-accent)/10 text-(--cl-accent)">
                                {job.job_type_name}
                            </span>
                            <span className="text-sm text-(--cl-text-muted) shrink-0">{job.job_date}</span>
                            {onViewJob && (
                                <Button
                                    className="h-7 gap-1.5 px-2.5 text-xs font-semibold shrink-0"
                                    size="sm"
                                    title="View job details"
                                    variant="outline"
                                    onClick={() => onViewJob(job.id)}
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                    View
                                </Button>
                            )}
                        </div>

                        {/* Row 2: recv · condition · technician — dot-separated */}
                        <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0 text-sm text-(--cl-text-muted)">
                            <span>{job.receive_manner_name}</span>
                            {job.receive_condition_name && (
                                <><span className="opacity-30">·</span><span>{job.receive_condition_name}</span></>
                            )}
                            {job.technician_name && (
                                <><span className="opacity-30">·</span><span className="text-(--cl-text)">{job.technician_name}</span></>
                            )}
                        </div>

                        {/* Row 3 (optional): device details */}
                        {job.device_details && (
                            <p className="text-sm text-(--cl-text) leading-snug line-clamp-2">{job.device_details}</p>
                        )}

                        {/* Amounts strip */}
                        <div className="flex items-center justify-end gap-4 pt-1.5 border-t border-(--cl-border)/50 text-sm tabular-nums">
                            <span className="text-(--cl-text-muted)">Est <span className="text-(--cl-text)">{fmtCurrency(job.estimate_amount)}</span></span>
                            <span className="text-(--cl-text-muted)">Amt <span className="font-semibold text-(--cl-text)">{fmtCurrency(job.amount)}</span></span>
                            <span className={`font-bold ${due > 0 ? "text-red-500" : "text-emerald-500"}`}>
                                Due {fmtCurrency(due)}
                            </span>
                        </div>
                    </div>
                );
            })}

            {/* Totals strip — only for multi-job */}
            {jobs.length > 1 && (
                <div className="flex items-center justify-between rounded-lg border border-(--cl-border) bg-(--cl-surface-2) px-4 py-2 text-sm tabular-nums">
                    <span className="text-(--cl-text-muted)">{jobs.length} jobs total</span>
                    <div className="flex items-center gap-4">
                        <span className="text-(--cl-text-muted)">Amt <span className="font-bold text-(--cl-text)">{fmtCurrency(totalAmt)}</span></span>
                        <span className={`font-bold ${totalDue > 0 ? "text-red-500" : "text-emerald-500"}`}>Due {fmtCurrency(totalDue)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
