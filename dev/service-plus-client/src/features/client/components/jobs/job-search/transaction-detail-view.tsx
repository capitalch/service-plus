import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { JobTransactionRow } from "@/features/client/types/job";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    tranId: number;
    jobNo:  string;
    onBack: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LabelValue({ label, value, mono = false }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">{label}</span>
            <span className={`text-sm text-[var(--cl-text)] ${mono ? "font-mono" : ""}`}>{value ?? "—"}</span>
        </div>
    );
}

function fmtAmount(val: number | null | undefined) {
    if (val == null) return "—";
    return `₹${Number(val).toFixed(2)}`;
}

function fmtDateTime(iso: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransactionDetailView({ tranId, jobNo, onBack }: Props) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [tran,    setTran]    = useState<JobTransactionRow | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<JobTransactionRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_JOB_TRANSACTION_DETAIL,
                        sqlArgs: { id: tranId },
                    }),
                },
            });
            setTran(res.data?.genericQuery?.[0] ?? null);
        } catch {
            toast.error("Failed to load transaction details.");
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, tranId]);

    useEffect(() => { void loadData(); }, [loadData]);

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <motion.div
                animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className="flex flex-1 flex-col gap-4 overflow-hidden"
            >
                <div className="flex items-center gap-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-2">
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs" onClick={onBack}>
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to {jobNo}
                    </Button>
                </div>
                <div className="flex flex-1 items-center justify-center gap-2 text-[var(--cl-text-muted)]">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading transaction…</span>
                </div>
            </motion.div>
        );
    }

    if (!tran) {
        return (
            <motion.div
                animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className="flex flex-1 flex-col gap-4 overflow-hidden"
            >
                <div className="flex items-center gap-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-2">
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs" onClick={onBack}>
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to {jobNo}
                    </Button>
                </div>
                <div className="flex flex-1 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                    Transaction not found.
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
        >
            {/* ── Header ───────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-2">
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs" onClick={onBack}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-xs text-[var(--cl-text-muted)]">
                    <span>Job Search</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{jobNo}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="font-semibold text-[var(--cl-text)]">Transaction #{tran.id}</span>
                </div>
            </div>

            {/* ── Body ─────────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="max-w-2xl">
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <div className="border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-4 py-2.5">
                            <h2 className="text-sm font-semibold text-[var(--cl-text)]">Transaction Details</h2>
                        </div>
                        <div className="p-5">
                            {/* Row 1 */}
                            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                                <LabelValue label="Transaction #"  value={tran.id} mono />
                                <LabelValue label="Job No"         value={jobNo} />
                                <LabelValue label="Date & Time"    value={fmtDateTime(tran.performed_at)} />
                            </div>

                            <div className="my-4 border-t border-[var(--cl-border)]" />

                            {/* Row 2 */}
                            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Status</span>
                                    {tran.status_name ? (
                                        <span className="inline-flex w-fit items-center rounded-full bg-[var(--cl-accent)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--cl-accent)]">
                                            {tran.status_name}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-[var(--cl-text-muted)]">—</span>
                                    )}
                                </div>
                                <LabelValue label="Technician"   value={tran.technician_name} />
                                <LabelValue label="Performed By" value={tran.performed_by_name} />
                            </div>

                            <div className="my-4 border-t border-[var(--cl-border)]" />

                            {/* Row 3 */}
                            <div className="grid grid-cols-2 gap-5">
                                <LabelValue label="Amount" value={fmtAmount(tran.amount)} mono />
                                <LabelValue label="Previous Transaction #" value={tran.previous_transaction_id} mono />
                            </div>

                            {/* Notes */}
                            {tran.remarks && tran.remarks.trim() && (
                                <>
                                    <div className="my-4 border-t border-[var(--cl-border)]" />
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Remarks</span>
                                        <p className="whitespace-pre-wrap text-sm text-[var(--cl-text)]">{tran.remarks}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
