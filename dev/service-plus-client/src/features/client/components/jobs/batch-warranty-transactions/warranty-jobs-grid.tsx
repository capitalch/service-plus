import { useMemo } from "react";
import { Eye } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import type { WarrantyBatchJobRow } from "@/features/client/types/job";
import { StatusBadge } from "../job-badges";

const thClass = "text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) p-3 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "p-3 text-sm text-(--cl-text) border-b border-(--cl-border)";

// table-layout: fixed with a shared <colgroup> forces the header and body to
// use the exact same column widths — with the default auto layout, a sticky
// <th> and a plain <td> can compute slightly different box widths for the
// same column, drifting the whole header row out of alignment with the body.
function ColGroup() {
    return (
        <colgroup>
            <col className="w-10" />
            <col className="w-32" />
            <col className="w-28" />
            <col />
            <col className="w-28" />
            <col className="w-32" />
            <col className="w-14" />
        </colgroup>
    );
}

function matchesSearch(row: WarrantyBatchJobRow, q: string): boolean {
    const haystack = [
        row.job_no, row.alternate_job_no, row.device_details, row.serial_no,
        row.job_status_name, row.technician_name,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
}

type Props = {
    rows:              WarrantyBatchJobRow[];
    loading:           boolean;
    search:            string;
    selectedIds:       Set<number>;
    onSelectionChange: (id: number, checked: boolean) => void;
    onViewJob:         (id: number) => void;
};

export function WarrantyJobsGrid({ rows, loading, search, selectedIds, onSelectionChange, onViewJob }: Props) {
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? rows.filter(r => matchesSearch(r, q)) : rows;
    }, [rows, search]);

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm">
            {!loading && (
                <div className="flex items-center justify-between border-b border-(--cl-border) bg-(--cl-surface-2)/30 px-3 py-1.5 text-xs text-(--cl-text-muted)">
                    <span>
                        {search ? `${filteredRows.length} of ${rows.length} job${rows.length !== 1 ? "s" : ""}` : `${rows.length} job${rows.length !== 1 ? "s" : ""}`}
                    </span>
                    {selectedIds.size > 0 && (
                        <span className="font-semibold text-(--cl-accent)">{selectedIds.size} selected</span>
                    )}
                </div>
            )}
            <div className="flex-1 overflow-x-auto overflow-y-auto">
                {loading ? (
                    <table className="w-full table-fixed border-collapse">
                        <ColGroup />
                        <thead>
                            <tr>
                                {["", "Job No", "Date", "Device", "Status", "Technician", ""].map((h, i) => (
                                    <th key={i} className={thClass}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 7 }).map((__, j) => (
                                        <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-(--cl-border)" /></td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : rows.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                        No open, zero-parts warranty jobs for this customer.
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                        No jobs match your search.
                    </div>
                ) : (
                    <table className="w-full table-fixed border-collapse">
                        <ColGroup />
                        <thead>
                            <tr>
                                <th className={thClass} />
                                <th className={thClass}>Job No</th>
                                <th className={thClass}>Date</th>
                                <th className={thClass}>Device</th>
                                <th className={thClass}>Status</th>
                                <th className={thClass}>Technician</th>
                                <th className={thClass}>View</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-(--cl-border) bg-(--cl-surface)">
                            {filteredRows.map((row, idx) => (
                                <motion.tr
                                    key={row.id}
                                    animate={{ opacity: 1 }}
                                    className={`transition-colors hover:bg-(--cl-accent)/5 ${selectedIds.has(row.id) ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}`}
                                    initial={{ opacity: 0 }}
                                    transition={{ delay: idx * 0.015, duration: 0.15 }}
                                >
                                    <td className={tdClass}>
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                className="h-3.5 w-3.5 rounded border-(--cl-border) accent-emerald-600 cursor-pointer"
                                                checked={selectedIds.has(row.id)}
                                                onChange={e => onSelectionChange(row.id, e.target.checked)}
                                            />
                                        </div>
                                    </td>
                                    <td className={tdClass}>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-mono font-semibold text-(--cl-accent)">{row.job_no}</span>
                                            {row.alternate_job_no && (
                                                <span className="font-mono text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 rounded px-1.5 py-0.5 w-fit">Alt: {row.alternate_job_no}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className={`${tdClass} whitespace-nowrap`}>{row.job_date}</td>
                                    <td className={tdClass}>
                                        <div className="flex flex-col gap-0.5">
                                            {row.device_details && <span className="text-xs leading-snug">{row.device_details}</span>}
                                            {row.serial_no && <span className="font-mono text-[10px] text-(--cl-text-muted)">S/N: {row.serial_no}</span>}
                                        </div>
                                    </td>
                                    <td className={tdClass}>
                                        <div className="flex flex-col gap-0.5">
                                            <StatusBadge code={row.job_status_code} name={row.job_status_name} />
                                            {row.is_final && (
                                                <span className="w-fit rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                                    FINAL
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className={tdClass}>{row.technician_name ?? "-"}</td>
                                    <td className={tdClass}>
                                        <Button
                                            className="h-7 w-7 p-0 text-(--cl-text-muted) hover:text-(--cl-accent)"
                                            size="icon"
                                            title="View job details"
                                            variant="ghost"
                                            onClick={() => onViewJob(row.id)}
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
