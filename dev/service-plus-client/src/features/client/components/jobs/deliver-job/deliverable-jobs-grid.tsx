import { useCallback, useEffect, useRef, useState } from "react";
import {
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Loader2, RefreshCw, Search, X,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { PAGE_SIZE, DEBOUNCE_MS, thClass, tdClass, fmtCurrency } from "./deliver-job-helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeliverableJobRow = {
    id:               number;
    job_no:           string;
    alternate_job_no: string | null;
    job_date:         string;
    amount:           number | null;
    last_transaction_id: number | null;
    customer_name:    string;
    mobile:           string;
    job_status_name:  string;
    technician_name:  string | null;
    invoice_total:    number | null;
    invoice_no:       string | null;
};

type Props = {
    rows:          DeliverableJobRow[];
    loading:       boolean;
    total:         number;
    page:          number;
    fromDate:      string;
    toDate:        string;
    search:        string;
    branchId:      number | null;
    loadingDetail: boolean;
    setPage:       (v: number | ((p: number) => number)) => void;
    onFromDate:    (v: string) => void;
    onToDate:      (v: string) => void;
    onSearch:      (v: string) => void;
    onRefresh:     () => void;
    onDeliver:     (row: DeliverableJobRow) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function DeliverableJobsGrid({
    rows, loading, total, page, fromDate, toDate, search,
    branchId, loadingDetail, setPage,
    onFromDate, onToDate, onSearch, onRefresh, onDeliver,
}: Props) {
    const scrollRef  = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    function handleSearchChange(value: string) {
        onSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); onSearch(value); }, DEBOUNCE_MS);
    }

    return (
        <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-1 bg-(--cl-surface-2)/30">
                <div className="flex items-center gap-1">
                    <Input
                        className="h-8 w-32 border-(--cl-border) bg-white text-xs"
                        disabled={loading}
                        type="date"
                        value={fromDate}
                        onChange={e => { onFromDate(e.target.value); setPage(1); }}
                    />
                    <span className="text-(--cl-text-muted) text-xs">—</span>
                    <Input
                        className="h-8 w-32 border-(--cl-border) bg-white text-xs"
                        disabled={loading}
                        type="date"
                        value={toDate}
                        onChange={e => { onToDate(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                    <Input
                        className="h-8 border-(--cl-border) bg-white pl-8 text-xs"
                        placeholder="Job no, alt job no, customer or mobile…"
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
                <Button
                    className="h-8 px-2.5 text-xs"
                    disabled={loading || !branchId}
                    size="sm"
                    variant="outline"
                    onClick={onRefresh}
                >
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                </Button>
            </div>

            {/* Grid */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm mx-4">
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-x-auto overflow-y-auto"
                    style={{ maxHeight: maxHeight || undefined }}
                >
                    {loading ? (
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr>
                                    {["#", "Date", "Job No", "Customer", "Mobile", "Status", "Technician", "Invoice", "Invoice Total", "Action"].map(h => (
                                        <th key={h} className={thClass}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 10 }).map((__, j) => (
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
                                    <th className={thClass}>#</th>
                                    <th className={thClass}>Date</th>
                                    <th className={thClass}>Job No</th>
                                    <th className={thClass}>Customer</th>
                                    <th className={thClass}>Mobile</th>
                                    <th className={thClass}>Status</th>
                                    <th className={thClass}>Technician</th>
                                    <th className={thClass}>Invoice</th>
                                    <th className={`${thClass} text-right`}>Invoice Total</th>
                                    <th className={`${thClass} sticky right-0 z-20 !bg-(--cl-surface-2)`}>Action</th>
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
                                        <td className={tdClass}>{row.job_date}</td>
                                        <td className={`${tdClass} font-mono font-semibold text-(--cl-accent)`}>
                                            #{row.job_no}
                                            {row.alternate_job_no && (
                                                <span className="block text-[10px] text-(--cl-text-muted) font-normal">
                                                    Alt: {row.alternate_job_no}
                                                </span>
                                            )}
                                        </td>
                                        <td className={tdClass}>{row.customer_name}</td>
                                        <td className={`${tdClass} font-mono text-xs`}>{row.mobile}</td>
                                        <td className={tdClass}>
                                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-(--cl-accent)/10 text-(--cl-accent)">
                                                {row.job_status_name}
                                            </span>
                                        </td>
                                        <td className={tdClass}>{row.technician_name ?? "—"}</td>
                                        <td className={`${tdClass} font-mono text-xs`}>{row.invoice_no ?? "—"}</td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(row.invoice_total)}</td>
                                        <td className={`${tdClass} sticky right-0 z-10 bg-(--cl-surface) group-hover:bg-(--cl-surface-2)`}>
                                            <Button
                                                className="h-7 px-2 text-xs text-(--cl-text-muted) hover:text-(--cl-accent)"
                                                disabled={loadingDetail}
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => onDeliver(row)}
                                            >
                                                {loadingDetail
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : "Deliver"
                                                }
                                            </Button>
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
}
