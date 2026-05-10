import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, Loader2, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { PdfPreviewModal } from "@/components/shared/pdf-preview-modal";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { JobDetailType, JobTransactionRow } from "@/features/client/types/job";
import type { CompanyInfoType } from "@/features/client/components/jobs/job-sheet-pdf";
import { getJobDetailPdfBlobUrl } from "./job-detail-pdf";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    jobId:             number;
    onBack:            () => void;
    onViewTransaction: (tranId: number) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const thClass = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

function LabelValue({ label, value }: { label: string; value: string | number | null | undefined }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">{label}</span>
            <span className="text-sm text-[var(--cl-text)]">{value ?? "—"}</span>
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
        hour: "2-digit", minute: "2-digit", hour12: true,
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JobDetailView({ jobId, onBack, onViewTransaction }: Props) {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);

    const [job,          setJob]          = useState<JobDetailType | null>(null);
    const [transactions, setTransactions] = useState<JobTransactionRow[]>([]);
    const [companyInfo,  setCompanyInfo]  = useState<CompanyInfoType | null>(null);
    const [loading,      setLoading]      = useState(true);

    const [pdfUrl,      setPdfUrl]      = useState<string | null>(null);
    const [pdfFilename, setPdfFilename] = useState("Job-Detail.pdf");
    const [showPdf,     setShowPdf]     = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = useState(0);

    useEffect(() => {
        const recalc = () => {
            if (scrollRef.current) {
                const rect = scrollRef.current.getBoundingClientRect();
                setMaxHeight(Math.max(200, window.innerHeight - rect.top - 20));
            }
        };
        const t = setTimeout(recalc, 80);
        window.addEventListener("resize", recalc);
        return () => { clearTimeout(t); window.removeEventListener("resize", recalc); };
    }, [loading]);

    const loadData = useCallback(async () => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const gq = (sqlId: string, sqlArgs?: Record<string, unknown>) =>
                apolloClient.query<GenericQueryData<any>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }),
                    },
                });

            const [jobRes, tranRes, compRes] = await Promise.all([
                gq(SQL_MAP.GET_JOB_DETAIL,              { id: jobId }),
                gq(SQL_MAP.GET_JOB_TRANSACTIONS_BY_JOB, { job_id: jobId }),
                gq(SQL_MAP.GET_COMPANY_INFO),
            ]);

            setJob(jobRes.data?.genericQuery?.[0] ?? null);
            setTransactions(tranRes.data?.genericQuery ?? []);
            setCompanyInfo(compRes.data?.genericQuery?.[0] ?? null);
        } catch {
            toast.error("Failed to load job details.");
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, jobId]);

    useEffect(() => { void loadData(); }, [loadData]);

    const handlePrint = () => {
        if (!job) return;
        const url = getJobDetailPdfBlobUrl(job, transactions, companyInfo);
        setPdfUrl(url);
        setPdfFilename(`Job-Detail_${job.job_no}.pdf`);
        setShowPdf(true);
    };

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <motion.div
                animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className="flex flex-1 flex-col gap-4 overflow-hidden"
            >
                <div className="flex items-center gap-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] py-2">
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs" onClick={onBack}>
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </Button>
                </div>
                <div className="flex flex-1 items-center justify-center gap-2 text-[var(--cl-text-muted)]">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading job details…</span>
                </div>
            </motion.div>
        );
    }

    if (!job) {
        return (
            <motion.div
                animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className="flex flex-1 flex-col gap-4 overflow-hidden"
            >
                <div className="flex items-center gap-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] py-2">
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs" onClick={onBack}>
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </Button>
                </div>
                <div className="flex flex-1 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                    Job not found.
                </div>
            </motion.div>
        );
    }

    const device = [job.product_name, job.brand_name, job.model_name].filter(Boolean).join(" / ") || null;

    return (
        <motion.div
            animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
        >
            {/* ── Header bar ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-2">
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs" onClick={onBack}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-xs text-[var(--cl-text-muted)]">
                    <span>Job Search</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="font-semibold text-[var(--cl-text)]">{job.job_no}</span>
                    {job.is_closed && (
                        <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            CLOSED
                        </span>
                    )}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => void loadData()}>
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs" onClick={handlePrint}>
                        <Printer className="h-3 w-3" /> Print PDF
                    </Button>
                </div>
            </div>

            {/* ── Scrollable body ─────────────────────────────────────────────── */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto pb-4"
                style={{ maxHeight: maxHeight > 0 ? maxHeight : undefined }}
            >
                <div className="flex flex-col gap-4">

                    {/* ── Job Info Card ───────────────────────────────────────── */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <div className="border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-4 py-2.5">
                            <h2 className="text-sm font-semibold text-[var(--cl-text)]">Job Information</h2>
                        </div>
                        <div className="p-4">
                            {/* Row 1 – identifiers */}
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <LabelValue label="Job No"    value={job.job_no} />
                                <LabelValue label="Date"      value={job.job_date} />
                                <LabelValue label="Branch"    value={globalBranch?.code ?? "—"} />
                                <LabelValue label="Batch No"  value={(job as any).batch_no ?? null} />
                            </div>

                            <div className="my-3 border-t border-[var(--cl-border)]" />

                            {/* Row 2 – customer */}
                            <div className="grid grid-cols-2 gap-4">
                                <LabelValue label="Customer"  value={job.customer_name} />
                                <LabelValue label="Mobile"    value={job.mobile} />
                            </div>
                            <div className="mt-4">
                                <LabelValue label="Address"   value={job.address_snapshot} />
                            </div>

                            <div className="my-3 border-t border-[var(--cl-border)]" />

                            {/* Row 3 – device */}
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <LabelValue label="Device"         value={device} />
                                <LabelValue label="Serial No"      value={job.serial_no} />
                                <LabelValue label="Warranty Card"  value={job.warranty_card_no} />
                                <LabelValue label="Quantity"       value={job.quantity} />
                            </div>

                            <div className="my-3 border-t border-[var(--cl-border)]" />

                            {/* Row 4 – service details */}
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <LabelValue label="Job Type"        value={job.job_type_name} />
                                <LabelValue label="Receive Manner"  value={job.job_receive_manner_name} />
                                <LabelValue label="Condition"       value={job.job_receive_condition_name} />
                                <LabelValue label="Technician"      value={job.technician_name} />
                            </div>

                            <div className="my-3 border-t border-[var(--cl-border)]" />

                            {/* Row 5 – status & financials */}
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Status</span>
                                    <span className="inline-flex w-fit items-center rounded-full bg-[var(--cl-accent)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--cl-accent)]">
                                        {job.job_status_name}
                                    </span>
                                </div>
                                <LabelValue label="Amount"         value={fmtAmount(job.amount)} />
                                <LabelValue label="Delivery Date"  value={job.delivery_date} />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Closed</span>
                                    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${job.is_closed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
                                        {job.is_closed ? "Yes" : "No"}
                                    </span>
                                </div>
                            </div>

                            {/* Narrative fields */}
                            {[
                                { label: "Problem Reported", value: job.problem_reported },
                                { label: "Diagnosis",        value: job.diagnosis },
                                { label: "Work Done",        value: job.work_done },
                                { label: "Remarks",          value: job.remarks },
                            ].filter(n => n.value && n.value.trim()).map(n => (
                                <div key={n.label} className="mt-3 border-t border-[var(--cl-border)] pt-3">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">{n.label}</span>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--cl-text)]">{n.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Transactions ─────────────────────────────────────────── */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <div className="flex items-center gap-2 border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-4 py-2.5">
                            <FileText className="h-4 w-4 text-[var(--cl-accent)]" />
                            <h2 className="text-sm font-semibold text-[var(--cl-text)]">
                                Transaction History
                                <span className="ml-2 text-xs font-normal text-[var(--cl-text-muted)]">({transactions.length})</span>
                            </h2>
                        </div>

                        {transactions.length === 0 ? (
                            <div className="flex h-20 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                                No transactions recorded for this job.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={thClass}>#</th>
                                            <th className={thClass}>Date & Time</th>
                                            <th className={thClass}>Status</th>
                                            <th className={thClass}>Technician</th>
                                            <th className={`${thClass} text-right`}>Amount</th>
                                            <th className={thClass}>Remarks</th>
                                            <th className={thClass}>Performed By</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--cl-border)]">
                                        {transactions.map((t, idx) => (
                                            <tr
                                                key={t.id}
                                                className="cursor-pointer transition-colors hover:bg-[var(--cl-accent)]/5"
                                                onClick={() => onViewTransaction(t.id)}
                                                title="Click to view transaction details"
                                            >
                                                <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{idx + 1}</td>
                                                <td className={`${tdClass} whitespace-nowrap font-mono text-xs`}>{fmtDateTime(t.performed_at)}</td>
                                                <td className={tdClass}>
                                                    {t.status_name ? (
                                                        <span className="rounded-full bg-[var(--cl-accent)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--cl-accent)]">
                                                            {t.status_name}
                                                        </span>
                                                    ) : "—"}
                                                </td>
                                                <td className={tdClass}>{t.technician_name ?? "—"}</td>
                                                <td className={`${tdClass} text-right tabular-nums`}>{fmtAmount(t.amount)}</td>
                                                <td className={`${tdClass} max-w-[200px] truncate`} title={t.remarks ?? ""}>{t.remarks ?? "—"}</td>
                                                <td className={tdClass}>{t.performed_by_name ?? "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* ── PDF Preview Modal ───────────────────────────────────────────── */}
            <PdfPreviewModal
                filename={pdfFilename}
                isOpen={showPdf}
                pdfUrl={pdfUrl}
                onClose={() => { setShowPdf(false); setPdfUrl(null); }}
            />
        </motion.div>
    );
}
