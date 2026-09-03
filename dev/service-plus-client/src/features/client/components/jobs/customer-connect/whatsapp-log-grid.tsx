import { useCallback, useEffect, useRef, useState } from "react";
import {
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon, Eye, Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { JobTypeBadge, StatusBadge } from "../job-badges";
import { WhatsappStatusCell } from "../whatsapp-status-cell";
import { PAGE_SIZE } from "./customer-connect-helpers";
import type { CustomerConnectJobRow } from "./customer-connect-schema";

// Read-only counterpart to customer-connect-grid.tsx (plans/plan.md) — same
// visual chrome (sticky header, pagination footer, loading skeleton, empty
// state), minus the checkbox column and both "select all matching" banners:
// these tabs never send anything, so there's nothing to select. Parameterized
// over `eventKey` so one component serves both the Job Intake and Job
// Delivery log tabs, same as WhatsappStatusCell itself already is.

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) p-3 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "p-3 text-sm text-(--cl-text) border-b border-(--cl-border)";

function fmtCurrency(v: number | null | undefined): string {
    return v == null ? "—" : `₹${Number(v).toFixed(2)}`;
}

type Props = {
    rows:         CustomerConnectJobRow[];
    loading:      boolean;
    total:        number;
    page:         number;
    setPage:      (v: number | ((p: number) => number)) => void;
    eventKey:     "JOB_CREATION" | "JOB_DELIVERY";
    emptyMessage: string;
    onViewJob:    (id: number) => void;
};

export function WhatsappLogGrid({ rows, loading, total, page, setPage, eventKey, emptyMessage, onViewJob }: Props) {
    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
    const [maxHeight, setMaxHeight] = useState(0);

    const recalc = useCallback(() => {
        if (scrollWrapperRef.current) {
            const rect = scrollWrapperRef.current.getBoundingClientRect();
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm">
            <div ref={scrollWrapperRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: maxHeight || undefined }}>
                {loading ? (
                    <table className="min-w-full border-collapse">
                        <thead><tr>{["#", "Date", "Job No", "Customer", "Mobile", "Device Details", "Job Type", "Status", "Amount", "Whatsapp", "Actions"].map(h => <th key={h} className={thClass}>{h}</th>)}</tr></thead>
                        <tbody>{Array.from({ length: 8 }).map((_, i) => (<tr key={i} className="animate-pulse">{Array.from({ length: 11 }).map((__, j) => (<td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-(--cl-border)" /></td>))}</tr>))}</tbody>
                    </table>
                ) : rows.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                        {emptyMessage}
                    </div>
                ) : (
                    <table className="min-w-full border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr>
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
                            {rows.map((row, idx) => (
                                <motion.tr
                                    key={row.id}
                                    animate={{ opacity: 1 }}
                                    className={`group transition-colors cursor-pointer hover:bg-(--cl-accent)/5 ${
                                        selectedRowId === row.id ? "bg-(--cl-accent)/15" : ""
                                    }`}
                                    data-job-id={row.id}
                                    initial={{ opacity: 0 }}
                                    transition={{ delay: idx * 0.01, duration: 0.15 }}
                                    onClick={() => setSelectedRowId(row.id)}
                                >
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
                                    <td className={tdClass}>
                                        <WhatsappStatusCell
                                            state={row.whatsapp_notifications?.[eventKey] ?? null}
                                            isDeliveryConfirmation={eventKey === "JOB_DELIVERY"}
                                        />
                                    </td>
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
                            ))}
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
}
