import { useState } from "react";
import { Briefcase, Loader2, Paperclip, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { JobDetailType } from "../../../types/job";
import { JobTypeBadge, StatusBadge } from "../job-badges";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import { useAppSelector } from "@/store/hooks";
import { selectAvailableDivisions } from "@/store/context-slice";

const thClass = "sticky top-0 z-10 text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted) p-2.5 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "p-2.5 text-sm text-(--cl-text) border-b border-(--cl-border)";

type Props = {
    isOpen: boolean;
    batchNo: number | null;
    jobs: JobDetailType[];
    loading: boolean;
    onClose: () => void;
    onPrintBatch: (jobs: JobDetailType[]) => void;
    onFileCountChange?: (jobId: number, count: number) => void;
};

export const BatchJobViewModal = ({ isOpen, batchNo, jobs, loading, onClose, onPrintBatch, onFileCountChange }: Props) => {
    const [attachJobId, setAttachJobId] = useState<number | null>(null);
    const [attachJobNo, setAttachJobNo] = useState("");
    const divisions    = useAppSelector(selectAvailableDivisions);

    if (!isOpen || !batchNo) return null;

    const firstJob     = jobs[0];
    const batchDivision = firstJob?.division_id ? divisions.find(d => d.id === firstJob.division_id) : null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent
                    aria-describedby={undefined}
                    className="sm:max-w-5xl max-h-[85vh] !p-0 overflow-hidden bg-white dark:bg-zinc-950 text-(--cl-text)"
                    onInteractOutside={e => e.preventDefault()}
                    onEscapeKeyDown={e => e.preventDefault()}
                >
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-(--cl-border)">
                        <DialogTitle className="flex items-center gap-3 text-base font-bold">
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                                <Briefcase className="h-4 w-4" />
                            </div>
                            Batch #{batchNo}
                            <span className="text-xs font-normal text-(--cl-text-muted)">
                                {jobs.length} job{jobs.length !== 1 ? "s" : ""}
                            </span>
                            {batchDivision && (
                                <span className="text-xs font-normal text-(--cl-text-muted)">
                                    · {batchDivision.name}
                                </span>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: "calc(85vh - 180px)" }}>
                        {loading ? (
                            <div className="flex items-center justify-center py-12 text-xs text-(--cl-text-muted) gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading job details…
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={thClass}>#</th>
                                            <th className={`${thClass} whitespace-nowrap`}>Date</th>
                                            <th className={thClass}>Job No</th>
                                            <th className={thClass}>Customer</th>
                                            <th className={thClass}>Mobile</th>
                                            <th className={`${thClass} w-[10rem]`}>Device Details</th>
                                            <th className={thClass}>Job Type</th>
                                            <th className={thClass}>Status</th>
                                            <th className={thClass}>Technician</th>
                                            <th className={`${thClass} text-right`}>Amount</th>
                                            <th className={thClass}>Files</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {jobs.map((job, idx) => (
                                            <tr key={job.id} className="group hover:bg-(--cl-accent)/5">
                                                <td className={`${tdClass} text-(--cl-text-muted) text-xs`}>{idx + 1}</td>
                                                <td className={`${tdClass} whitespace-nowrap text-xs`}>{job.job_date}</td>
                                                <td className={`${tdClass} font-mono text-xs font-medium text-(--cl-accent)`}>
                                                    {job.job_no}
                                                    {job.is_closed && (
                                                        <span className="ml-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 rounded px-1 py-0.5">CLOSED</span>
                                                    )}
                                                    {job.purchase_date && (
                                                        <div className="text-[11px] font-semibold text-(--cl-text-muted)">PUR: {job.purchase_date}</div>
                                                    )}
                                                </td>
                                                <td className={`${tdClass} text-xs`}>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span>{job.customer_name ?? "—"}</span>
                                                        {job.customer_gstin && (
                                                            <span className="font-mono text-[10px] text-(--cl-text-muted)">GSTIN: {job.customer_gstin}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={`${tdClass} font-mono text-xs`}>{job.mobile}</td>
                                                <td className={`${tdClass} text-xs`}>
                                                    {[job.brand_name, job.product_name, job.model_name, job.serial_no].filter(Boolean).join(" — ") || "—"}
                                                </td>
                                                <td className={`${tdClass} text-xs`}>
                                                    <JobTypeBadge code={job.job_type_code} name={job.job_type_name} />
                                                </td>
                                                <td className={`${tdClass} text-xs`}>
                                                    <StatusBadge code={job.job_status_code} name={job.job_status_name} />
                                                </td>
                                                <td className={`${tdClass} text-xs`}>{job.technician_name ?? "—"}</td>
                                                <td className={`${tdClass} text-right text-xs`}>
                                                    {job.amount != null ? `₹${Number(job.amount).toFixed(2)}` : "—"}
                                                </td>
                                                <td className={`${tdClass} text-xs`}>
                                                    {job.file_count != null && job.file_count > 0 ? (
                                                        <button
                                                            type="button"
                                                            className="flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/30 px-1.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800/30 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors cursor-pointer"
                                                            onClick={() => { setAttachJobId(job.id); setAttachJobNo(job.job_no); }}
                                                        >
                                                            <Paperclip className="h-2.5 w-2.5" />
                                                            {job.file_count}
                                                        </button>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-(--cl-surface-2)">
                                            <td colSpan={9} className={`${tdClass} font-bold text-right text-xs`}>Total</td>
                                            <td className={`${tdClass} text-right font-bold text-xs`}>
                                                ₹{jobs.reduce((sum, j) => sum + Number(j.amount ?? 0), 0).toFixed(2)}
                                            </td>
                                            <td className={`${tdClass} text-xs`}>—</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="px-6 pt-4 pb-6 border-t border-(--cl-border)">
                        <Button variant="outline" onClick={onClose}>Close</Button>
                        <Button
                            className="gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white"
                            disabled={loading || jobs.length === 0}
                            onClick={() => onPrintBatch(jobs)}
                        >
                            <Printer className="h-3.5 w-3.5" />
                            Print All ({jobs.length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <JobAttachDialog
                jobId={attachJobId}
                jobNo={attachJobNo}
                mode="view"
                onClose={() => { setAttachJobId(null); setAttachJobNo(""); }}
                onFilesChanged={count => { if (onFileCountChange && attachJobId !== null) onFileCountChange(attachJobId, count); }}
            />
        </>
    );
};
