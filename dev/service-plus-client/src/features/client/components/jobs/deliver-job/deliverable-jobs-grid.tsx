import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Eye, Loader2, Paperclip, RefreshCw, Search, Truck, X,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { type DivisionContextType, isGstDivision } from "@/features/client/types/division";
import { PAGE_SIZE, DEBOUNCE_MS, thClass, tdClass, fmtCurrency } from "./deliver-job-helpers";
import { JobTypeBadge, StatusBadge } from "../job-badges";
import { useGridRowRetention, type GridRetentionHandle } from "../use-grid-row-retention";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeliverableJobRow = {
    id:                     number;
    job_no:                 string;
    alternate_job_no:       string | null;
    purchase_date:          string | null;
    job_date:               string;
    division_id:            number | null;
    device_details:         string | null;
    serial_no:              string | null;
    amount:                 number | null;
    last_transaction_id:    number | null;
    customer_name:          string;
    customer_gstin:         string | null;
    mobile:                 string;
    job_status_name:        string;
    job_status_code:        string;
    technician_name:        string | null;
    invoice_total:          number | null;
    invoice_no:             string | null;
    batch_no:               number | null;
    file_count:             number;
    receive_manner_name:    string;
    job_type_name:          string;
    job_type_code:          string;
    receive_condition_name: string;
    qty:                    number | null;
    estimate_amount:        number | null;
    total_paid:             number;
};

type Props = {
    rows:               DeliverableJobRow[];
    loading:            boolean;
    total:              number;
    page:               number;
    search:             string;
    branchId:           number | null;
    availableDivisions: DivisionContextType[];
    loadingDetail:      number | null;
    selectedIds:        Set<number>;
    setPage:            (v: number | ((p: number) => number)) => void;
    onSearch:           (v: string) => void;
    onRefresh:          () => void;
    onViewJob:          (id: number) => void;
    onDeliver:          (row: DeliverableJobRow) => void;
    onOpenAttach:       (id: number, jobNo: string) => void;
    onSelectionChange:  (id: number, checked: boolean) => void;
    onSelectAll:        (checked: boolean) => void;
    onDeliverSelected:  () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export const DeliverableJobsGrid = forwardRef<GridRetentionHandle, Props>(function DeliverableJobsGrid({
    rows, loading, total, page, search,
    branchId, availableDivisions, loadingDetail, selectedIds, setPage,
    onSearch, onRefresh, onViewJob, onDeliver, onOpenAttach,
    onSelectionChange, onSelectAll, onDeliverSelected,
}, ref) {
    const { scrollWrapperRef, selectedRowId, setSelectedRowId, armRestore } = useGridRowRetention(loading);
    useImperativeHandle(ref, () => ({ armRestore }), [armRestore]);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    const totalPages   = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const allChecked   = rows.length > 0 && rows.every(r => selectedIds.has(r.id));
    const someChecked  = rows.some(r => selectedIds.has(r.id));

    function handleSearchChange(value: string) {
        onSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); onSearch(value); }, DEBOUNCE_MS);
    }

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
                        onChange={e => handleSearchChange(e.target.value)}
                    />
                    {search && (
                        <button
                            className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text) focus:outline-none"
                            type="button"
                            onClick={() => handleSearchChange("")}
                        >
                            <X className="h-2.5 w-2.5" />
                        </button>
                    )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Button
                        className="h-8 px-2.5 text-xs"
                        disabled={loading || !branchId}
                        size="sm"
                        variant="outline"
                        onClick={onRefresh}
                    >
                        <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                    </Button>
                    {selectedIds.size > 0 && (
                        <Button
                            className="h-9 gap-2 px-4 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md tracking-wide"
                            disabled={loadingDetail !== null}
                            onClick={onDeliverSelected}
                        >
                            {loadingDetail === -1
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Truck className="h-4 w-4" />
                            }
                            Deliver Selected ({selectedIds.size})
                        </Button>
                    )}
                </div>
            </div>

            {/* Grid */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm">
                <div
                    ref={scrollWrapperRef}
                    className="flex-1 overflow-x-auto overflow-y-auto"
                    style={{ maxHeight: maxHeight || undefined }}
                >
                    {loading ? (
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr>
                                    {["", "#", "Date", "Job No", "Customer", "Mobile", "Device Details", "Technician", "Status", "Amount", "Action"].map(h => (
                                        <th key={h} className={thClass}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 11 }).map((__, j) => (
                                            <td key={j} className={tdClass}>
                                                <div className="h-4 w-16 rounded bg-(--cl-border)" />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                            No jobs ready for delivery for the selected filters.
                        </div>
                    ) : (
                        <table className="min-w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <th className={`${thClass} w-8`}>
                                        <input
                                            type="checkbox"
                                            className="h-3.5 w-3.5 rounded border-(--cl-border) accent-emerald-600 cursor-pointer"
                                            checked={allChecked}
                                            ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                                            onChange={e => onSelectAll(e.target.checked)}
                                        />
                                    </th>
                                    <th className={thClass}>#</th>
                                    <th className={thClass}>Date</th>
                                    <th className={thClass}>Job No</th>
                                    <th className={thClass}>Customer</th>
                                    <th className={thClass}>Mobile</th>
                                    <th className={`${thClass} w-40`}>Device Details</th>
                                    <th className={thClass}>Technician</th>
                                    <th className={thClass}>Status</th>
                                    <th className={`${thClass} text-right`}>Amount</th>
                                    <th className={`${thClass} sticky right-0 z-20 bg-(--cl-surface-2)!`}>Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-(--cl-border) bg-(--cl-surface)">
                                {rows.map((row, idx) => (
                                    <motion.tr
                                        key={row.id}
                                        animate={{ opacity: 1 }}
                                        className={`group cursor-pointer transition-colors hover:bg-(--cl-accent)/5 ${
                                            selectedIds.has(row.id)
                                                ? "bg-emerald-50 dark:bg-emerald-950/20"
                                                : selectedRowId === row.id
                                                    ? "bg-(--cl-accent)/15"
                                                    : ""
                                        }`}
                                        data-job-id={row.id}
                                        initial={{ opacity: 0 }}
                                        transition={{ delay: idx * 0.015, duration: 0.15 }}
                                        onClick={() => setSelectedRowId(row.id)}
                                    >
                                        <td className={tdClass}>
                                            <input
                                                type="checkbox"
                                                className="h-3.5 w-3.5 rounded border-(--cl-border) accent-emerald-600 cursor-pointer"
                                                checked={selectedIds.has(row.id)}
                                                onChange={e => { e.stopPropagation(); onSelectionChange(row.id, e.target.checked); }}
                                            />
                                        </td>
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
                                        <td className={tdClass}>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="font-mono font-semibold text-(--cl-accent)">
                                                    #{row.job_no}
                                                </div>
                                                {row.alternate_job_no && (
                                                    <span className="text-[10px] text-(--cl-text-muted)">Alt: {row.alternate_job_no}</span>
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
                                                {row.receive_manner_name && (
                                                    <span className="text-[10px] text-(--cl-text-muted)">{row.receive_manner_name}</span>
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

                                        <td className={tdClass}>{row.technician_name ?? "—"}</td>
                                        <td className={tdClass}>
                                            <div className="flex flex-col items-start gap-0.5">
                                                <StatusBadge code={row.job_status_code} name={row.job_status_name} />
                                                {row.job_type_name && (
                                                    <JobTypeBadge code={row.job_type_code} name={row.job_type_name} />
                                                )}
                                            </div>
                                        </td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(row.amount)}</td>
                                        <td
                                            className={`${tdClass} sticky right-0 z-10 ${
                                                selectedRowId === row.id
                                                    ? "bg-(--cl-accent)/15 group-hover:bg-(--cl-accent)/20"
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
                                                    className="h-8 gap-1.5 px-3 text-xs font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950/30"
                                                    disabled={loadingDetail === row.id}
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => onDeliver(row)}
                                                >
                                                    {loadingDetail === row.id
                                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        : <Truck className="h-3.5 w-3.5" />
                                                    }
                                                    Deliver
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
                        {total === 0
                            ? "No jobs"
                            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} jobs (Page ${page} of ${totalPages})`
                        }
                    </span>
                    <div className="flex items-center gap-1">
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="First"    variant="ghost" onClick={() => setPage(1)}><ChevronsLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="Previous" variant="ghost" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Next" variant="ghost" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Last" variant="ghost" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>
        </>
    );
});
