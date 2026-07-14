import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import {
    CheckCheck,
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Eye, Loader2, Paperclip, RefreshCw, Search, X,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DivisionContextType, isGstDivision } from "@/features/client/types/division";
import { PAGE_SIZE, thClass, tdClass } from "./final-a-job-helpers";
import { JobTypeBadge } from "../job-badges";
import type { FinalJobRow } from "./final-a-job-schema";
import { useGridRowRetention, type GridRetentionHandle } from "../use-grid-row-retention";

type Props = {
    rows:               FinalJobRow[];
    loading:            boolean;
    total:              number;
    page:               number;
    setPage:            (v: number | ((p: number) => number)) => void;
    search:             string;
    branchId:           number | null;
    availableDivisions: DivisionContextType[];
    loadingDetail:      number | null;
    onSearchChange:     (v: string) => void;
    onRefresh:          () => void;
    onViewJob:          (id: number) => void;
    onOpenFinal:        (row: FinalJobRow) => void;
    onOpenAttach:       (id: number, jobNo: string) => void;
};

export const PendingJobsGrid = forwardRef<GridRetentionHandle, Props>(function PendingJobsGrid({
    rows, loading, total, page, setPage,
    search, branchId, availableDivisions, loadingDetail,
    onSearchChange, onRefresh, onViewJob, onOpenFinal, onOpenAttach,
}, ref) {
    const { scrollWrapperRef, selectedRowId, setSelectedRowId, armRestore } = useGridRowRetention(loading);
    useImperativeHandle(ref, () => ({ armRestore }), [armRestore]);
    const [maxHeight, setMaxHeight] = useState(0);

    const recalc = useCallback(() => {
        if (scrollWrapperRef.current) {
            const rect = scrollWrapperRef.current.getBoundingClientRect();
            setMaxHeight(Math.max(200, window.innerHeight - rect.top - 80));
        }
    }, [scrollWrapperRef]);

    useEffect(() => {
        const timer = setTimeout(recalc, 100);
        window.addEventListener("resize", recalc);
        return () => { clearTimeout(timer); window.removeEventListener("resize", recalc); };
    }, [recalc, rows.length]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 py-2 bg-(--cl-surface-2)/30">
            <div className="relative flex-1 sm:max-w-lg">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                <Input
                    className="h-8 border-(--cl-border) bg-white pl-8 pr-8 text-xs"
                    placeholder="Job no, alt job no, customer, mobile, email, city, technician, serial no, device…"
                    value={search}
                    onChange={e => onSearchChange(e.target.value)}
                />
                {search && (
                    <button
                        className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text) focus:outline-none"
                        type="button"
                        onClick={() => onSearchChange("")}
                    >
                        <X className="h-2.5 w-2.5" />
                    </button>
                )}
            </div>
            <Button
                className="ml-auto h-8 px-2.5 text-xs"
                disabled={loading || !branchId}
                size="sm"
                variant="outline"
                onClick={onRefresh}
            >
                <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
            </Button>
        </div>

        {/* Grid */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm">
            <div ref={scrollWrapperRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: maxHeight || undefined }}>
                {loading ? (
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr>
                                {["#", "Date", "Job No", "Customer", "Mobile", "Device Details", "Job Type", "Amount", "Actions"].map(h => (
                                    <th key={h} className={thClass}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 9 }).map((__, j) => (
                                        <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-(--cl-border)" /></td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : rows.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                        No Completed OK jobs found.
                    </div>
                ) : (
                    <table className="min-w-full border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                <th className={thClass}>#</th>
                                <th className={thClass}>Date</th>
                                <th className={thClass}>Job No</th>
                                <th className={thClass}>Customer</th>
                                <th className={thClass}>Mobile</th>
                                <th className={`${thClass} w-40`}>Device Details</th>
                                <th className={thClass}>Job Type</th>
                                <th className={`${thClass} text-right`}>Amount</th>
                                <th className={`${thClass} sticky right-0 z-20 bg-(--cl-surface-2)!`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-(--cl-border) bg-(--cl-surface)">
                            {rows.map((row, idx) => (
                                <motion.tr
                                    key={row.id}
                                    animate={{ opacity: 1 }}
                                    className={`group cursor-pointer transition-colors ${
                                        selectedRowId === row.id
                                            ? "bg-(--cl-accent)/40 hover:bg-(--cl-accent)/45"
                                            : "hover:bg-(--cl-accent)/5"
                                    }`}
                                    data-job-id={row.id}
                                    initial={{ opacity: 0 }}
                                    transition={{ delay: idx * 0.015, duration: 0.15 }}
                                    onClick={() => setSelectedRowId(row.id)}
                                >
                                    <td className={`${tdClass} text-(--cl-text-muted)`}>{(page - 1) * PAGE_SIZE + idx + 1}</td>

                                    {/* Date + division badge + GST tag */}
                                    <td className={`${tdClass} whitespace-nowrap`}>
                                        <div className="flex flex-col gap-0.5">
                                            <span>{row.job_date}</span>
                                            {row.division_id && (() => {
                                                const dv = availableDivisions.find(d => d.id === row.division_id);
                                                if (!dv) return null;
                                                const gst = isGstDivision(dv);
                                                return (
                                                    <>
                                                        <span className="font-mono text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 rounded px-1 py-0.5 w-fit">
                                                            {dv.code}
                                                        </span>
                                                        <span className={`text-[10px] font-semibold rounded px-1 py-0.5 w-fit ${gst ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40" : "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"}`}>
                                                            {gst ? "GST" : "Non-GST"}
                                                        </span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </td>

                                    {/* Job No + badges */}
                                    <td className={tdClass}>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="font-mono font-semibold text-(--cl-accent)">
                                                #{row.job_no}
                                                {row.is_final && (
                                                    <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 rounded px-1 py-0.5">FINAL</span>
                                                )}
                                                {row.is_opening_job && (
                                                    <span className="ml-1.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40 rounded px-1 py-0.5">OPENING</span>
                                                )}
                                            </div>
                                            {row.alternate_job_no && (
                                                <span className="font-mono text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 rounded px-1.5 py-0.5 w-fit">Alt: {row.alternate_job_no}</span>
                                            )}
                                            {row.purchase_date && (
                                                <span className="text-[11px] font-semibold text-(--cl-text-muted)">PUR: {row.purchase_date}</span>
                                            )}
                                            {row.batch_no != null && (
                                                <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400 w-fit bg-violet-50 dark:bg-violet-950/40 rounded px-1 py-0.5">Batch #{row.batch_no}</span>
                                            )}
                                            {row.file_count > 0 && (
                                                <button
                                                    type="button"
                                                    className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 cursor-pointer bg-blue-50 dark:bg-blue-950/40 rounded px-1.5 py-0.5 w-fit border-0 transition-colors"
                                                    onClick={e => { e.stopPropagation(); onOpenAttach(row.id, row.job_no); }}
                                                >
                                                    <Paperclip className="h-2.5 w-2.5" />
                                                    <span>{row.file_count} File{row.file_count !== 1 ? "s" : ""}</span>
                                                </button>
                                            )}
                                        </div>
                                    </td>

                                    <td className={tdClass}>
                                        <div className="flex flex-col gap-0.5">
                                            <span>{row.customer_name}</span>
                                            {row.customer_gstin && (
                                                <span className="font-mono text-[10px] text-(--cl-text-muted)">Gstin: {row.customer_gstin}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className={`${tdClass} font-mono text-xs`}>{row.mobile}</td>

                                    {/* Device details */}
                                    <td className={`${tdClass} max-w-40`}>
                                        <div className="flex flex-col gap-0.5">
                                            {row.device_details && (
                                                <span className="text-xs leading-snug">{row.device_details}</span>
                                            )}
                                            {row.serial_no && (
                                                <span className="font-mono text-[10px] text-(--cl-text-muted)">S/N: {row.serial_no}</span>
                                            )}
                                        </div>
                                    </td>

                                    <td className={tdClass}>
                                        <JobTypeBadge code={row.job_type_code} name={row.job_type_name} />
                                    </td>

                                    <td className={`${tdClass} text-right tabular-nums`}>
                                        {row.amount != null ? `₹${Number(row.amount).toFixed(2)}` : "—"}
                                    </td>

                                    {/* Actions */}
                                    <td
                                        className={`${tdClass} sticky right-0 z-10 ${
                                            selectedRowId === row.id
                                                ? "bg-(--cl-accent)/40 group-hover:bg-(--cl-accent)/45"
                                                : "bg-(--cl-surface) group-hover:bg-(--cl-surface-2)"
                                        }`}
                                        onPointerDownCapture={() => setSelectedRowId(row.id)}
                                    >
                                        <div className="flex items-center gap-1">
                                            <Button
                                                className="h-7 w-7 p-0 text-(--cl-text-muted) hover:text-(--cl-accent)"
                                                size="icon"
                                                title="View job details"
                                                variant="ghost"
                                                onClick={() => onViewJob(row.id)}
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                className="h-7 w-7 p-0 text-(--cl-text-muted) hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                                size="icon"
                                                title="Attach files"
                                                variant="ghost"
                                                onClick={() => onOpenAttach(row.id, row.job_no)}
                                            >
                                                <Paperclip className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                className="h-7 gap-1 px-2 text-xs font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950/30"
                                                disabled={loadingDetail !== null}
                                                size="sm"
                                                title="Finalise this job"
                                                variant="outline"
                                                onClick={() => onOpenFinal(row)}
                                            >
                                                {loadingDetail === row.id
                                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                                    : <CheckCheck className="h-3 w-3" />
                                                }
                                                Final
                                            </Button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-(--cl-border) px-4 py-2">
                <span className="text-xs text-(--cl-text-muted)">
                    {total === 0 ? "No jobs" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} (Page ${page} of ${totalPages})`}
                </span>
                <div className="flex items-center gap-1">
                    <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="First" variant="ghost" onClick={() => setPage(1)}><ChevronsLeftIcon className="h-4 w-4" /></Button>
                    <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="Previous" variant="ghost" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon className="h-4 w-4" /></Button>
                    <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Next" variant="ghost" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                    <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Last" variant="ghost" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                </div>
            </div>
        </div>
        </>
    );
});
