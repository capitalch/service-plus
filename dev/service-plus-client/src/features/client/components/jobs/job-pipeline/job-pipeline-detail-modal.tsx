import { useCallback, useEffect, useState } from "react";
import { Calendar, FileText, Loader2, MapPin, User, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobDetailType, JobTransactionRow } from "@/features/client/types/job";
import { STATUS_COLORS } from "./status-transitions";

type Props = {
    jobId:   number;
    onClose: () => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

function LabelValue({ label, value }: { label: string; value: string | number | null | undefined }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--cl-text-muted)]">{label}</span>
            <span className="text-sm font-medium text-[var(--cl-text)]">{value ?? "—"}</span>
        </div>
    );
}

function SectionCard({ title, icon, color, titleColor, children }: {
    title: string;
    icon?: React.ReactNode;
    color: string;
    titleColor: string;
    children: React.ReactNode;
}) {
    return (
        <div className={`rounded-xl border-l-4 ${color} bg-white dark:bg-zinc-900 shadow-sm overflow-hidden`}>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-zinc-800">
                {icon && <span className="opacity-80">{icon}</span>}
                <h3 className={`font-serif text-sm font-bold italic tracking-wide ${titleColor}`}>{title}</h3>
            </div>
            <div className="p-4">{children}</div>
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

const TRAN_ROW_COLORS = [
    "bg-sky-50     dark:bg-sky-950",
    "bg-violet-50  dark:bg-violet-950",
    "bg-emerald-50 dark:bg-emerald-950",
    "bg-amber-50   dark:bg-amber-950",
    "bg-rose-50    dark:bg-rose-950",
    "bg-teal-50    dark:bg-teal-950",
];

export const JobPipelineDetailModal = ({ jobId, onClose }: Props) => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const [job,          setJob]          = useState<JobDetailType | null>(null);
    const [transactions, setTransactions] = useState<JobTransactionRow[]>([]);
    const [loading,      setLoading]      = useState(true);

    const loadData = useCallback(async () => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const gq = (sqlId: string, sqlArgs?: Record<string, unknown>) =>
                apolloClient.query<GenericQueryData<any>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }),
                    },
                });

            const [jobRes, tranRes] = await Promise.all([
                gq(SQL_MAP.GET_JOB_DETAIL,              { id: jobId }),
                gq(SQL_MAP.GET_JOB_TRANSACTIONS_BY_JOB, { job_id: jobId }),
            ]);

            setJob(jobRes.data?.genericQuery?.[0] ?? null);
            setTransactions(tranRes.data?.genericQuery ?? []);
        } catch {
            toast.error("Failed to load job details.");
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, jobId]);

    useEffect(() => { void loadData(); }, [loadData]);

    const device = job
        ? [job.product_name, job.brand_name, job.model_name].filter(Boolean).join(" / ") || null
        : null;

    const statusKey       = job?.job_status_name.toUpperCase().replace(/ /g, "_") ?? "";
    const statusColorParts = STATUS_COLORS[statusKey]?.trim().split(/\s+/) ?? [];
    const statusBg        = statusColorParts[0] ?? "bg-[var(--cl-accent)]";

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="max-w-5xl w-[95vw] bg-white dark:bg-zinc-950 border-[var(--cl-border)] p-0 overflow-hidden">

                {/* ── Colored hero header ── */}
                <DialogHeader className={`relative overflow-hidden px-6 py-5 ${statusBg}`}>
                    <div className="relative z-10">
                        <DialogTitle className="flex flex-wrap items-center gap-3 text-white">
                            {loading || !job ? (
                                <span className="font-serif text-lg font-bold italic">Job Details</span>
                            ) : (
                                <>
                                    <span className="font-mono text-2xl font-extrabold tracking-tight">#{job.job_no}</span>
                                    <span className="rounded-full bg-white/20 px-3 py-0.5 text-sm font-semibold backdrop-blur-sm">
                                        {job.job_status_name}
                                    </span>
                                    {job.is_closed && (
                                        <span className="rounded-full bg-emerald-400/90 px-3 py-0.5 text-[11px] font-bold text-white">
                                            CLOSED
                                        </span>
                                    )}
                                </>
                            )}
                        </DialogTitle>
                        {job && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{job.job_date}</span>
                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{currentBranch?.code ?? "—"}</span>
                                {job.technician_name && (
                                    <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{job.technician_name}</span>
                                )}
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className="max-h-[75vh] overflow-y-auto px-5 py-4 bg-white dark:bg-zinc-950">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center gap-2 text-sm text-[var(--cl-text-muted)]">
                            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                        </div>
                    ) : !job ? (
                        <div className="flex h-48 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                            Job not found.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">

                            {/* ── Customer ── */}
                            <SectionCard title="Customer" icon={<User className="h-4 w-4 text-sky-500" />} color="border-sky-400" titleColor="text-sky-600 dark:text-sky-400">
                                <div className="grid grid-cols-2 gap-4">
                                    <LabelValue label="Customer" value={job.customer_name} />
                                    <LabelValue label="Mobile"   value={job.mobile} />
                                    {job.address_snapshot && (
                                        <div className="col-span-2">
                                            <LabelValue label="Address" value={job.address_snapshot} />
                                        </div>
                                    )}
                                </div>
                            </SectionCard>

                            {/* ── Device ── */}
                            <SectionCard title="Device" icon={<Wrench className="h-4 w-4 text-violet-500" />} color="border-violet-400" titleColor="text-violet-600 dark:text-violet-400">
                                <div className="grid grid-cols-2 gap-4">
                                    <LabelValue label="Serial No"     value={job.serial_no} />
                                    <LabelValue label="Warranty Card" value={job.warranty_card_no} />
                                    <LabelValue label="Quantity"      value={job.quantity} />
                                    <div className="col-span-2">
                                        <LabelValue label="Device" value={device} />
                                    </div>
                                </div>
                            </SectionCard>

                            {/* ── Service Info ── */}
                            <SectionCard title="Service Info" icon={<FileText className="h-4 w-4 text-amber-500" />} color="border-amber-400" titleColor="text-amber-600 dark:text-amber-400">
                                <div className="grid grid-cols-2 gap-4">
                                    <LabelValue label="Job No"        value={job.job_no} />
                                    <LabelValue label="Batch No"      value={(job as any).batch_no ?? null} />
                                    <LabelValue label="Amount"        value={fmtAmount(job.amount)} />
                                    <LabelValue label="Delivery Date" value={job.delivery_date} />
                                    <LabelValue label="Job Type"       value={job.job_type_name} />
                                    <LabelValue label="Receive Manner" value={job.job_receive_manner_name} />
                                    <LabelValue label="Condition"  value={job.job_receive_condition_name} />
                                    <LabelValue label="Technician" value={job.technician_name} />
                                </div>
                            </SectionCard>

                            {/* ── Narrative fields ── */}
                            {[
                                { label: "Problem Reported", value: job.problem_reported, cls: "border-l-4 border-rose-400   bg-rose-50   dark:bg-rose-950" },
                                { label: "Diagnosis",        value: job.diagnosis,        cls: "border-l-4 border-violet-400 bg-violet-50 dark:bg-violet-950" },
                                { label: "Work Done",        value: job.work_done,        cls: "border-l-4 border-emerald-400 bg-emerald-50 dark:bg-emerald-950" },
                                { label: "Remarks",          value: job.remarks,          cls: "border-l-4 border-slate-400  bg-slate-50  dark:bg-slate-800" },
                            ].filter(n => n.value?.trim()).map(n => (
                                <div key={n.label} className={`rounded-lg px-4 py-3 ${n.cls}`}>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--cl-text-muted)]">{n.label}</span>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--cl-text)]">{n.value}</p>
                                </div>
                            ))}

                            {/* ── Transaction History ── */}
                            <div className="rounded-xl border-l-4 border-teal-400 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-zinc-800">
                                    <FileText className="h-4 w-4 text-teal-500 opacity-80" />
                                    <h3 className="font-serif text-sm font-bold italic tracking-wide text-teal-600 dark:text-teal-400">
                                        Transaction History
                                        <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-sans font-bold not-italic text-teal-700 dark:bg-teal-950 dark:text-teal-400">
                                            {transactions.length}
                                        </span>
                                    </h3>
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
                                                    {["#", "Date & Time", "Status", "Technician", "Amount", "Remarks", "Performed By"].map(h => (
                                                        <th key={h} className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 p-3 text-left border-b border-zinc-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transactions.map((t, idx) => {
                                                    const rowBg      = TRAN_ROW_COLORS[idx % TRAN_ROW_COLORS.length];
                                                    const statusCode = t.status_name?.toUpperCase().replace(/ /g, "_") ?? "";
                                                    const sBg        = STATUS_COLORS[statusCode]?.trim().split(/\s+/)[0] ?? "bg-[var(--cl-accent)]";
                                                    return (
                                                        <tr key={t.id} className={`${rowBg} transition-colors hover:brightness-95`}>
                                                            <td className="p-3 text-sm text-[var(--cl-text-muted)] border-b border-[var(--cl-border)] font-mono">{idx + 1}</td>
                                                            <td className="p-3 text-xs font-mono whitespace-nowrap text-[var(--cl-text)] border-b border-[var(--cl-border)]">{fmtDateTime(t.performed_at)}</td>
                                                            <td className="p-3 border-b border-[var(--cl-border)]">
                                                                {t.status_name ? (
                                                                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white ${sBg}`}>
                                                                        {t.status_name}
                                                                    </span>
                                                                ) : <span className="text-[var(--cl-text-muted)]">—</span>}
                                                            </td>
                                                            <td className="p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]">{t.technician_name ?? "—"}</td>
                                                            <td className="p-3 text-sm text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 border-b border-[var(--cl-border)]">{fmtAmount(t.amount)}</td>
                                                            <td className="p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)] max-w-[200px] truncate" title={t.remarks ?? ""}>{t.remarks ?? "—"}</td>
                                                            <td className="p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]">{t.performed_by_name ?? "—"}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
