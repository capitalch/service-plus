import { useCallback, useEffect, useRef, useState } from "react";
import {
    CheckCircle2,
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Eye, FileDown, Loader2, MoreVertical, Paperclip, Pencil, Receipt, ReceiptText, RefreshCw, Search, Truck, Undo2, X,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type DivisionContextType, isGstDivision } from "@/features/client/types/division";
import { PAGE_SIZE, thClass, tdClass } from "./final-a-job-helpers";
import { JobTypeBadge } from "../job-badges";
import type { FinalizedJobRow } from "./final-a-job-schema";

type Props = {
    rows:               FinalizedJobRow[];
    loading:            boolean;
    total:              number;
    page:               number;
    setPage:            (v: number | ((p: number) => number)) => void;
    search:             string;
    branchId:           number | null;
    availableDivisions: DivisionContextType[];
    undoingJobId:         number | null;
    chargesLoadingJobId:  number | null;
    deliveryLoadingJobId: number | null;
    onSearchChange:       (v: string) => void;
    onRefresh:            () => void;
    onViewJob:            (id: number) => void;
    onUndo:               (row: FinalizedJobRow) => void;
    onOpenAttach:         (id: number, jobNo: string) => void;
    onViewCharges:        (row: FinalizedJobRow) => void;
    onDeliver:            (id: number) => void;
    onProforma:           (id: number) => void;
    onPdf:                (id: number) => void;
    onReviseFinal:        (row: FinalizedJobRow) => void;
};

export function FinalizedJobsGrid({
    rows, loading, total, page, setPage,
    search, branchId, availableDivisions, undoingJobId, chargesLoadingJobId, deliveryLoadingJobId,
    onSearchChange, onRefresh, onViewJob, onUndo, onOpenAttach, onViewCharges,
    onDeliver, onProforma, onPdf, onReviseFinal,
}: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = useState(0);

    const recalc = useCallback(() => {
        if (scrollRef.current) {
            const rect = scrollRef.current.getBoundingClientRect();
            setMaxHeight(Math.max(200, window.innerHeight - rect.top - 80));
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(recalc, 100);
        window.addEventListener("resize", recalc);
        return () => { clearTimeout(timer); window.removeEventListener("resize", recalc); };
    }, [recalc, rows.length]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 py-1 bg-(--cl-surface-2)/30">
            <div className="relative flex-1 sm:max-w-lg">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                <Input
                    className="h-8 border-(--cl-border) bg-white pl-8 pr-8 text-xs"
                    placeholder="Job no, alt job no, customer, mobile, technician, serial no, device…"
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
            <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: maxHeight || undefined }}>
                {loading ? (
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr>
                                {["#", "Date", "Job No", "Customer", "Mobile", "Device Details", "Technician", "Amount", "Actions"].map(h => (
                                    <th key={h} className={thClass}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 10 }).map((__, j) => (
                                        <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-(--cl-border)" /></td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : rows.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                        No finalized jobs found.
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
                                <th className={thClass}>Technician</th>
                                <th className={`${thClass} text-right`}>Amount</th>
                                <th className={`${thClass} sticky right-0 z-20 bg-(--cl-surface-2)!`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-(--cl-border) bg-(--cl-surface)">
                            {rows.map((row, idx) => (
                                <motion.tr
                                    key={row.id}
                                    animate={{ opacity: 1 }}
                                    className="group transition-colors hover:bg-(--cl-accent)/5"
                                    initial={{ opacity: 0 }}
                                    transition={{ delay: idx * 0.015, duration: 0.15 }}
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
                                            <div className="font-mono font-semibold text-(--cl-accent)">#{row.job_no}</div>
                                            {row.is_posted && (
                                                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded px-1 py-0.5 w-fit">
                                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                                    Posted
                                                </span>
                                            )}
                                            {row.alternate_job_no && (
                                                <span className="text-[10px] text-(--cl-text-muted)">Alt: {row.alternate_job_no}</span>
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
                                            {row.job_type_name && (
                                                <JobTypeBadge code={row.job_type_code} name={row.job_type_name} className="w-fit" />
                                            )}
                                        </div>
                                    </td>
                                    <td className={`${tdClass} font-mono text-xs`}>{row.mobile}</td>

                                    {/* device_details already contains serial_no (built by SQL CONCAT_WS) */}
                                    <td className={`${tdClass} max-w-40`}>
                                        <span className="text-xs leading-snug">{row.device_details || "—"}</span>
                                    </td>

                                    <td className={tdClass}>{row.technician_name ?? "—"}</td>
                                    <td className={`${tdClass} text-right tabular-nums`}>
                                        {row.amount != null ? `₹${Number(row.amount).toFixed(2)}` : "—"}
                                    </td>

                                    {/* Actions */}
                                    <td className={`${tdClass} sticky right-0 z-10 bg-(--cl-surface) group-hover:bg-(--cl-surface-2)`}>
                                        <div className="flex items-center gap-1">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        className="h-7 w-7 p-0"
                                                        size="icon"
                                                        title="Actions"
                                                        variant="outline"
                                                    >
                                                        <MoreVertical className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="min-w-44">
                                                    <DropdownMenuItem
                                                        className="gap-2 text-xs text-sky-700 dark:text-sky-400 focus:text-sky-700 dark:focus:text-sky-400"
                                                        onSelect={() => onViewJob(row.id)}
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                        View
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="gap-2 text-xs text-blue-700 dark:text-blue-400 focus:text-blue-700 dark:focus:text-blue-400"
                                                        onSelect={() => onDeliver(row.id)}
                                                    >
                                                        {deliveryLoadingJobId === row.id
                                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            : <Truck className="h-3.5 w-3.5" />
                                                        }
                                                        Deliver Job
                                                    </DropdownMenuItem>
                                                    {Number(row.amount) > 0 && (
                                                        <DropdownMenuItem
                                                            className="gap-2 text-xs text-purple-700 dark:text-purple-400 focus:text-purple-700 dark:focus:text-purple-400"
                                                            onSelect={() => onProforma(row.id)}
                                                        >
                                                            <Receipt className="h-3.5 w-3.5" />
                                                            Proforma Invoice
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        className="gap-2 text-xs text-teal-700 dark:text-teal-400 focus:text-teal-700 dark:focus:text-teal-400"
                                                        disabled={chargesLoadingJobId === row.id}
                                                        onSelect={() => onViewCharges(row)}
                                                    >
                                                        {chargesLoadingJobId === row.id
                                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            : <ReceiptText className="h-3.5 w-3.5" />
                                                        }
                                                        Charges
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="gap-2 text-xs text-emerald-700 dark:text-emerald-400 focus:text-emerald-700 dark:focus:text-emerald-400"
                                                        onSelect={() => onPdf(row.id)}
                                                    >
                                                        <FileDown className="h-3.5 w-3.5" />
                                                        Print / Save as PDF
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="gap-2 text-xs text-orange-700 dark:text-orange-400 focus:text-orange-700 dark:focus:text-orange-400"
                                                        disabled={row.is_posted}
                                                        title={row.is_posted ? "Cannot revise a posted job" : undefined}
                                                        onSelect={() => onReviseFinal(row)}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        Revise Final
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="gap-2 text-xs text-amber-700 dark:text-amber-400 focus:text-amber-700 dark:focus:text-amber-400"
                                                        disabled={undoingJobId === row.id || row.is_posted}
                                                        title={row.is_posted ? "Cannot undo a posted job" : undefined}
                                                        onSelect={() => onUndo(row)}
                                                    >
                                                        {undoingJobId === row.id
                                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            : <Undo2 className="h-3.5 w-3.5" />
                                                        }
                                                        Undo Final
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
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
}
