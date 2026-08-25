import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import {
    AlertTriangle, ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon, Eye, Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { JobTypeBadge, StatusBadge } from "../job-badges";
import { useGridRowRetention, type GridRetentionHandle } from "../use-grid-row-retention";
import { PAGE_SIZE, getCompletionState, isRowSelectable } from "./customer-connect-helpers";
import type { CustomerConnectJobRow } from "./customer-connect-schema";

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) p-3 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "p-3 text-sm text-(--cl-text) border-b border-(--cl-border)";

function fmtCurrency(v: number | null | undefined): string {
    return v == null ? "—" : `₹${Number(v).toFixed(2)}`;
}

function fmtLastTry(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    let hours = d.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hours)}:${pad(d.getMinutes())} ${ampm}`;
}

const DELIVERY_BADGE_STYLES: Record<string, string> = {
    ACCEPTED:  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    SENT:      "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    READ:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    FAILED:    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

function WhatsappStatusCell({ row }: { row: CustomerConnectJobRow }) {
    const state = getCompletionState(row);
    if (!state || (state.success_count === 0 && state.fail_count === 0)) {
        return <span className="text-sm text-(--cl-text-muted)">—</span>;
    }
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span
                    className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2 py-0.5 text-xs font-bold text-[#128C7E] dark:text-[#25D366]"
                    title={`${state.success_count} successful attempt${state.success_count !== 1 ? "s" : ""}`}
                >
                    ✓ {state.success_count}
                </span>
                {state.fail_count > 0 && (
                    <span
                        className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/40 px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-400"
                        title={`${state.fail_count} failed attempt${state.fail_count !== 1 ? "s" : ""}${state.last_error ? ` — ${state.last_error}` : ""}`}
                    >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {state.fail_count}
                    </span>
                )}
            </div>
            {state.last_sent_at && (
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Last try: {fmtLastTry(state.last_sent_at)}
                </span>
            )}
            {state.last_status && (
                <span
                    className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-bold ${DELIVERY_BADGE_STYLES[state.last_status] ?? ""}`}
                    title={state.last_error ?? undefined}
                >
                    {state.last_status}
                </span>
            )}
        </div>
    );
}

type Props = {
    rows:                     CustomerConnectJobRow[];
    loading:                  boolean;
    total:                    number;
    page:                     number;
    setPage:                  (v: number | ((p: number) => number)) => void;
    selectedIds:              Set<number>;
    selectAllMatchingActive:  boolean;
    selectAllMatchingLoading: boolean;
    onSelectionChange:        (id: number, checked: boolean) => void;
    onSelectAllOnPage:        (checked: boolean) => void;
    onSelectAllMatching:      () => void;
    onClearSelection:         () => void;
    onViewJob:                (id: number) => void;
};

export const CustomerConnectGrid = forwardRef<GridRetentionHandle, Props>(function CustomerConnectGrid({
    rows, loading, total, page, setPage, selectedIds, selectAllMatchingActive, selectAllMatchingLoading,
    onSelectionChange, onSelectAllOnPage, onSelectAllMatching, onClearSelection, onViewJob,
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

    const totalPages   = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const selectableRows = rows.filter(isRowSelectable);
    const allChecked  = selectableRows.length > 0 && selectableRows.every(r => selectedIds.has(r.id));
    const someChecked = selectableRows.some(r => selectedIds.has(r.id));
    const showSelectAllMatchingBanner = allChecked && total > rows.length && !selectAllMatchingActive;

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm">
            {showSelectAllMatchingBanner && (
                <div className="flex items-center justify-center gap-1 border-b border-(--cl-border) bg-sky-50 dark:bg-sky-950/30 px-4 py-2 text-xs text-sky-800 dark:text-sky-300">
                    <span>All {rows.length} eligible jobs on this page are selected.</span>
                    <button
                        type="button"
                        className="font-semibold underline underline-offset-2 hover:text-sky-900 dark:hover:text-sky-200 cursor-pointer disabled:opacity-50"
                        disabled={selectAllMatchingLoading}
                        onClick={onSelectAllMatching}
                    >
                        {selectAllMatchingLoading ? "Selecting…" : `Select all ${total} matching`}
                    </button>
                </div>
            )}
            {selectAllMatchingActive && (
                <div className="flex items-center justify-center gap-1 border-b border-(--cl-border) bg-sky-50 dark:bg-sky-950/30 px-4 py-2 text-xs text-sky-800 dark:text-sky-300">
                    <span>All {total} matching jobs are selected.</span>
                    <button
                        type="button"
                        className="font-semibold underline underline-offset-2 hover:text-sky-900 dark:hover:text-sky-200 cursor-pointer"
                        onClick={onClearSelection}
                    >
                        Clear selection
                    </button>
                </div>
            )}
            <div ref={scrollWrapperRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: maxHeight || undefined }}>
                {loading ? (
                    <table className="min-w-full border-collapse">
                        <thead><tr>{["", "#", "Date", "Job No", "Customer", "Mobile", "Device Details", "Job Type", "Status", "Amount", "Whatsapp", "Actions"].map(h => <th key={h} className={thClass}>{h}</th>)}</tr></thead>
                        <tbody>{Array.from({ length: 8 }).map((_, i) => (<tr key={i} className="animate-pulse">{Array.from({ length: 12 }).map((__, j) => (<td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-(--cl-border)" /></td>))}</tr>))}</tbody>
                    </table>
                ) : rows.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                        No jobs are eligible for the completion message.
                    </div>
                ) : (
                    <table className="min-w-full border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                <th className={`${thClass} w-8`}>
                                    <label className="flex h-7 w-7 cursor-pointer items-center justify-center">
                                        <input
                                            type="checkbox"
                                            className="h-4.5 w-4.5 rounded border-(--cl-border) accent-emerald-600 cursor-pointer"
                                            checked={allChecked}
                                            ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                                            onChange={e => onSelectAllOnPage(e.target.checked)}
                                        />
                                    </label>
                                </th>
                                <th className={thClass}>#</th>
                                <th className={`${thClass} whitespace-nowrap`}>Date</th>
                                <th className={thClass}>Job No</th>
                                <th className={thClass}>Customer</th>
                                <th className={thClass}>Mobile</th>
                                <th className={`${thClass} w-40`}>Device Details</th>
                                <th className={thClass}>Job Type</th>
                                <th className={thClass}>Status</th>
                                <th className={`${thClass} text-right`}>Amount</th>
                                <th className={thClass}>
                                    <span className="inline-flex items-center gap-1.5">
                                        <WhatsAppIcon className="h-3.5 w-3.5" />
                                        Whatsapp
                                    </span>
                                </th>
                                <th className={`${thClass} sticky right-0 z-20 !bg-(--cl-surface-2)`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-(--cl-border) bg-(--cl-surface)">
                            {rows.map((row, idx) => {
                                const selectable = isRowSelectable(row);
                                return (
                                    <motion.tr
                                        key={row.id}
                                        animate={{ opacity: 1 }}
                                        className={`group transition-colors ${!selectable ? "opacity-50" : "cursor-pointer hover:bg-(--cl-accent)/5"} ${
                                            selectedIds.has(row.id)
                                                ? "bg-emerald-50 dark:bg-emerald-950/20"
                                                : selectedRowId === row.id
                                                    ? "bg-(--cl-accent)/15"
                                                    : ""
                                        }`}
                                        data-job-id={row.id}
                                        initial={{ opacity: 0 }}
                                        transition={{ delay: idx * 0.01, duration: 0.15 }}
                                        onClick={() => selectable && setSelectedRowId(row.id)}
                                    >
                                        <td className={tdClass}>
                                            <label
                                                className={`flex h-7 w-7 items-center justify-center ${selectable ? "cursor-pointer" : "cursor-not-allowed"}`}
                                                title={!selectable ? "Customer has no valid mobile number" : undefined}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-4.5 w-4.5 rounded border-(--cl-border) accent-emerald-600 cursor-pointer disabled:cursor-not-allowed"
                                                    checked={selectedIds.has(row.id)}
                                                    disabled={!selectable}
                                                    onChange={e => { e.stopPropagation(); onSelectionChange(row.id, e.target.checked); }}
                                                />
                                            </label>
                                        </td>
                                        <td className={`${tdClass} text-(--cl-text-muted)`}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                        <td className={`${tdClass} whitespace-nowrap`}>{row.job_date}</td>
                                        <td className={tdClass}>
                                            <div className="flex flex-col items-start gap-1">
                                                <span className="font-mono font-semibold text-(--cl-accent)">{row.job_no}</span>
                                                {row.alternate_job_no && (
                                                    <span className="w-fit text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 rounded px-1.5 py-0.5">Alt: {row.alternate_job_no}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={tdClass}>{row.customer_name}</td>
                                        <td className={`${tdClass} font-mono text-xs`}>{row.mobile || "—"}</td>
                                        <td className={`${tdClass} max-w-40 text-xs`}>{row.device_details || "—"}</td>
                                        <td className={tdClass}><JobTypeBadge code={row.job_type_code} name={row.job_type_name} /></td>
                                        <td className={tdClass}><StatusBadge code={row.job_status_code} name={row.job_status_name} /></td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(row.amount)}</td>
                                        <td className={tdClass}><WhatsappStatusCell row={row} /></td>
                                        <td
                                            className={`${tdClass} sticky right-0 z-10 ${
                                                selectedRowId === row.id
                                                    ? "bg-(--cl-accent)/15 group-hover:bg-(--cl-accent)/20"
                                                    : "bg-(--cl-surface) group-hover:bg-(--cl-surface-2)"
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                className="flex h-7 w-7 items-center justify-center rounded text-(--cl-text-muted) hover:text-(--cl-accent) hover:bg-(--cl-accent)/10 cursor-pointer"
                                                title="View job details"
                                                onClick={e => { e.stopPropagation(); onViewJob(row.id); }}
                                            >
                                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-(--cl-border) px-4 py-2">
                <span className="text-xs text-(--cl-text-muted)">
                    {total === 0 ? "No jobs" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} job${total !== 1 ? "s" : ""} (Page ${page} of ${totalPages})`}
                </span>
                <div className="flex items-center gap-1">
                    <button className="flex h-7 w-7 items-center justify-center rounded text-(--cl-text-muted) hover:bg-(--cl-accent)/10 hover:text-(--cl-accent) disabled:opacity-30 cursor-pointer" disabled={page <= 1 || loading} title="First" onClick={() => setPage(1)}><ChevronsLeftIcon className="h-4 w-4 text-muted-foreground" /></button>
                    <button className="flex h-7 w-7 items-center justify-center rounded text-(--cl-text-muted) hover:bg-(--cl-accent)/10 hover:text-(--cl-accent) disabled:opacity-30 cursor-pointer" disabled={page <= 1 || loading} title="Previous" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon className="h-4 w-4 text-muted-foreground" /></button>
                    {loading && <Loader2 className="h-4 w-4 animate-spin text-(--cl-accent) mx-1" />}
                    <button className="flex h-7 w-7 items-center justify-center rounded text-(--cl-text-muted) hover:bg-(--cl-accent)/10 hover:text-(--cl-accent) disabled:opacity-30 cursor-pointer" disabled={page >= totalPages || loading} title="Next" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4 text-muted-foreground" /></button>
                    <button className="flex h-7 w-7 items-center justify-center rounded text-(--cl-text-muted) hover:bg-(--cl-accent)/10 hover:text-(--cl-accent) disabled:opacity-30 cursor-pointer" disabled={page >= totalPages || loading} title="Last" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4 text-muted-foreground" /></button>
                </div>
            </div>
        </div>
    );
});
