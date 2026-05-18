import { useCallback, useEffect, useState } from "react";
import { Building2, Calendar, FileText, Loader2, MapPin, Package, Paperclip, ReceiptText, RotateCcw, User, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectAvailableDivisions, selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobDetailType, JobTransactionRow } from "@/features/client/types/job";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import { STATUS_COLORS } from "./status-transitions";
import { UndoTransactionDialog } from "./undo-transaction-dialog";

type Props = {
    jobId:          number;
    onClose:        () => void;
    onJobChanged?:  () => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

type PartUsedRow = {
    id:        number;
    part_code: string;
    part_name: string;
    uom:       string;
    quantity:  number;
    remarks:   string | null;
};

type AdditionalChargeRow = {
    id:            number;
    charge_name:   string;
    ref_no:        string | null;
    description:   string | null;
    cost_price:    number;
    selling_price: number;
};

type JobFileRow = {
    id:         number;
    url:        string;
    about:      string;
    created_at: string;
};

function fmtAmount(val: number | null | undefined) {
    if (val == null) return "—";
    return `₹${Number(val).toFixed(2)}`;
}

const SECTION_COLORS: Record<string, { border: string; label: string; bar: string }> = {
    sky: { border: "border-sky-300", label: "text-sky-700", bar: "bg-sky-300" },
    violet: { border: "border-violet-300", label: "text-violet-700", bar: "bg-violet-300" },
    amber: { border: "border-amber-300", label: "text-amber-700", bar: "bg-amber-300" },
    teal: { border: "border-teal-300", label: "text-teal-700", bar: "bg-teal-300" },
    rose: { border: "border-rose-300", label: "text-rose-700", bar: "bg-rose-300" },
    emerald: { border: "border-emerald-300", label: "text-emerald-700", bar: "bg-emerald-300" },
    slate: { border: "border-slate-300", label: "text-slate-700", bar: "bg-slate-300" },
};

function InfoCard({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
    const c = SECTION_COLORS[color];
    return (
        <div className="rounded-sm bg-white">
            <div className={`px-4 py-2.5 border-b border-border/60 bg-gradient-to-r from-transparent via-white to-white`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${c?.label ?? "text-foreground"}`}>{title}</h3>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

function NarrativeBlock({ color, label, value }: { color: string; label: string; value: string | null | undefined }) {
    const c = SECTION_COLORS[color];
    if (!value?.trim()) return null;
    return (
        <div className="rounded-lg bg-white shadow-sm overflow-hidden">
            <div className={`h-1 ${c?.bar ?? "bg-muted"}`} />
            <div className="px-4 py-3">
                <span className={`text-xs font-bold uppercase tracking-wider ${c?.label ?? "text-muted-foreground"}`}>{label}</span>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground leading-relaxed">{value}</p>
            </div>
        </div>
    );
}

export const JobDetailsModal = ({ jobId, onClose, onJobChanged }: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const divisions = useAppSelector(selectAvailableDivisions);

    const [job, setJob] = useState<JobDetailType | null>(null);
    const [transactions, setTransactions] = useState<JobTransactionRow[]>([]);
    const [parts,        setParts]        = useState<PartUsedRow[]>([]);
    const [charges,      setCharges]      = useState<AdditionalChargeRow[]>([]);
    const [files,      setFiles]      = useState<JobFileRow[]>([]);
    const [attachOpen, setAttachOpen] = useState(false);
    const [loading,   setLoading]  = useState(true);
    const [undoing,   setUndoing]  = useState(false);
    const [showUndo,  setShowUndo] = useState(false);

    const loadData = useCallback(() => {
        if (!dbName || !schema) return;
        setLoading(true);
        const gq = (sqlId: string, sqlArgs?: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<unknown>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }),
                },
            });
        Promise.all([
            gq(SQL_MAP.GET_JOB_DETAIL,                    { id: jobId }),
            gq(SQL_MAP.GET_JOB_TRANSACTIONS_BY_JOB,       { job_id: jobId }),
            gq(SQL_MAP.GET_JOB_PART_USED_BY_JOB,          { job_id: jobId }),
            gq(SQL_MAP.GET_JOB_ADDITIONAL_CHARGES_BY_JOB, { job_id: jobId }),
            gq(SQL_MAP.GET_JOB_IMAGE_DOCS,                { job_id: jobId }),
        ]).then(([jobRes, tranRes, partsRes, chargesRes, filesRes]) => {
            setJob((jobRes.data?.genericQuery?.[0] ?? null) as JobDetailType | null);
            setTransactions((tranRes.data?.genericQuery ?? []) as JobTransactionRow[]);
            setParts((partsRes.data?.genericQuery ?? []) as PartUsedRow[]);
            setCharges((chargesRes.data?.genericQuery ?? []) as AdditionalChargeRow[]);
            setFiles((filesRes.data?.genericQuery ?? []) as JobFileRow[]);
        }).catch(() => {
            toast.error("Failed to load job details.");
        }).finally(() => {
            setLoading(false);
        });
    }, [dbName, schema, jobId]);

    const loadFiles = useCallback(() => {
        if (!dbName || !schema) return;
        apolloClient.query<GenericQueryData<JobFileRow>>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_IMAGE_DOCS, sqlArgs: { job_id: jobId } }) },
        }).then(res => {
            setFiles((res.data?.genericQuery ?? []) as JobFileRow[]);
        }).catch(() => {});
    }, [dbName, schema, jobId]);

    useEffect(() => { loadData(); }, [loadData]);

    function handleUndoClick() {
        if (transactions.length === 0) return;
        setShowUndo(true);
    }

    async function handleUndoConfirm() {
        const lastTxn = transactions[transactions.length - 1];
        if (!lastTxn) return;
        setShowUndo(false);
        setUndoing(true);
        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.undoJobTransaction,
                variables: {
                    db_name: dbName,
                    schema,
                    value:   encodeObj({ job_id: jobId, last_transaction_id: lastTxn.id }),
                },
            });
            toast.success("Last transaction undone.");
            loadData();
            onJobChanged?.();
        } catch (err: unknown) {
            const msg = (err as { graphQLErrors?: { message: string }[] })
                            ?.graphQLErrors?.[0]?.message ?? "Failed to undo transaction.";
            toast.error(msg);
        } finally {
            setUndoing(false);
        }
    }

    const device = job
        ? [job.product_name, job.brand_name, job.model_name].filter(Boolean).join(" / ") || null
        : null;
    const division = job?.division_id ? (divisions.find(d => d.id === job.division_id) ?? null) : null;

    const statusKey = job?.job_status_name.toUpperCase().replace(/ /g, "_") ?? "";
    const statusColorParts = STATUS_COLORS[statusKey]?.trim().split(/\s+/) ?? [];
    return (
        <>
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-xl bg-slate-50 p-0 overflow-hidden">
                {/* ── Header ── */}
                <DialogHeader className="relative overflow-hidden px-6 py-5 bg-slate-100 border-b border-slate-200">
                    <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <DialogTitle className="text-slate-900">
                                {loading || !job ? (
                                    <span className="text-lg font-bold">Job Details</span>
                                ) : (
                                    <span className="flex flex-col gap-0.5">
                                        <span className="font-mono text-2xl font-extrabold tracking-tight">#{job.job_no}</span>
                                        {job.alternate_job_no && (
                                            <span className="text-xs font-medium text-slate-500">
                                                Alt: <span className="font-mono font-semibold text-slate-700">{job.alternate_job_no}</span>
                                            </span>
                                        )}
                                    </span>
                                )}
                            </DialogTitle>
                            {job && (
                                <>
                                    <span className={`rounded-sm px-3 py-1 text-xs font-semibold ${statusColorParts[0] ?? "bg-blue-500"} text-white`}>
                                        {job.job_status_name}
                                    </span>
                                    <span className="rounded-sm bg-slate-200/60 px-3 py-1 text-[11px] font-medium text-slate-900">
                                        {job.job_type_name}
                                    </span>
                                    {job.is_closed && (
                                        <span className="rounded-sm bg-emerald-400/80 px-3 py-0.5 text-[11px] font-bold text-white">
                                            CLOSED
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    {job && (
                        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{job.job_date}</span>
                            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{currentBranch?.code ?? job.branch_code ?? "—"}</span>
                            {division && (
                                <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{division.name}</span>
                            )}
                            {job.technician_name && (
                                <span className="inline-flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" />{job.technician_name}</span>
                            )}
                            {job.customer_name && (
                                <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{job.customer_name}</span>
                            )}
                        </div>
                    )}
                </DialogHeader>

                <div className="max-h-[78vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                        </div>
                    ) : !job ? (
                        <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                            Job not found.
                        </div>
                    ) : (
                        <div className="p-5 space-y-5">

                            {/* ── Customer + Device ── */}
                            <div className="space-y-5">

                                {/* Customer */}
                                <InfoCard color="sky" title="Customer">
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-base font-bold text-slate-900">{job.customer_name ?? "—"}</p>
                                            <span className="inline-flex items-center gap-1 mt-1.5 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 border border-sky-200">
                                                <User className="h-3 w-3" />{job.mobile}
                                            </span>
                                        </div>
                                        {job.address_snapshot && (
                                            <div>
                                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Address</span>
                                                <p className="mt-0.5 text-sm text-slate-700 leading-relaxed">{job.address_snapshot}</p>
                                            </div>
                                        )}
                                    </div>
                                </InfoCard>

                                {/* Device */}
                                <InfoCard color="violet" title="Device">
                                    <div className="space-y-3">
                                        {device && (
                                            <p className="text-base font-bold text-slate-900 leading-snug">{device}</p>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {job.serial_no && (
                                                <span className="inline-flex items-center rounded-md bg-violet-50 px-2.5 py-1 text-[11px] font-mono font-semibold text-violet-700 border border-violet-200">
                                                    S/N: {job.serial_no}
                                                </span>
                                            )}
                                            {job.warranty_card_no && (
                                                <span className="inline-flex items-center rounded-md bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 border border-violet-200">
                                                    Warranty: {job.warranty_card_no}
                                                </span>
                                            )}
                                            <span className="inline-flex items-center rounded-md bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 border border-violet-200">
                                                Qty: {job.quantity}
                                            </span>
                                        </div>
                                    </div>
                                </InfoCard>
                            </div>

                            {/* ── Service Info ── */}
                            <InfoCard color="amber" title="Service Information">
                                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                    {[
                                        ["Job No", job.job_no],
                                        ["Alt Job No", job.alternate_job_no],
                                        ["Batch No", (job as JobDetailType & { batch_no?: string | null }).batch_no],
                                        ["Job Type", job.job_type_name],
                                        ["Division", division?.name],
                                        ["Technician", job.technician_name],
                                        ["Amount", fmtAmount(job.amount)],
                                        ["Estimate", fmtAmount(job.estimate_amount)],
                                        ["Delivery Date", job.delivery_date],
                                        ["Receive Mode", job.job_receive_manner_name],
                                        ["Condition", job.job_receive_condition_name],
                                    ].filter(([, v]) => v != null).map(([label, value]) => (
                                        <div key={label as string} className="border-b border-slate-100 pb-1.5">
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label as string}</span>
                                            <p className="text-sm font-medium text-slate-900 mt-0.5">{value as string}</p>
                                        </div>
                                    ))}
                                </div>
                            </InfoCard>

                            {/* ── Narrative fields ── */}
                            <div className="rounded-lg bg-white shadow-sm overflow-hidden">
                                <div className="h-1 bg-rose-300" />
                                <div className="px-4 py-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Problem Reported</span>
                                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-900 leading-relaxed min-h-[1.5rem]">
                                        {job.problem_reported?.trim() || "—"}
                                    </p>
                                </div>
                            </div>
                            <NarrativeBlock color="violet" label="Diagnosis" value={job.diagnosis} />
                            <NarrativeBlock color="emerald" label="Work Done" value={job.work_done} />

                            {/* ── Remarks (always visible) ── */}
                            <div className="rounded-lg bg-white shadow-sm overflow-hidden">
                                <div className="h-1 bg-slate-300" />
                                <div className="px-4 py-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Remarks</span>
                                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-900 leading-relaxed min-h-[1.5rem]">
                                        {job.remarks?.trim() || "—"}
                                    </p>
                                </div>
                            </div>

                            {/* ── Attachments ── */}
                            <div className="rounded-lg bg-white shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2.5 border-b border-blue-200/60 bg-gradient-to-r from-blue-50/80 to-white">
                                    <div className="flex items-center gap-2">
                                        <Paperclip className="h-4 w-4 text-blue-600" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700">Attachments</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {files.length > 0 && (
                                            <span className="inline-flex items-center justify-center rounded-sm bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                                                {files.length}
                                            </span>
                                        )}
                                        <Button
                                            className="h-6 px-2 text-[11px] text-blue-700 border-blue-300 hover:bg-blue-50"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setAttachOpen(true)}
                                        >
                                            <Paperclip className="h-3 w-3 mr-1" />
                                            {files.length === 0 ? "Attach Files" : "View / Attach"}
                                        </Button>
                                    </div>
                                </div>
                                {files.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-5">
                                        <p className="text-sm text-slate-400">No files attached.</p>
                                        <Button
                                            className="h-7 px-3 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setAttachOpen(true)}
                                        >
                                            <Paperclip className="h-3 w-3 mr-1" />
                                            Attach Files
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {files.map(f => (
                                            <div
                                                key={f.id}
                                                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-blue-50/40"
                                                onClick={() => setAttachOpen(true)}
                                            >
                                                <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                <span className="flex-1 truncate text-sm text-slate-700">{f.about || "Attachment"}</span>
                                                <span className="whitespace-nowrap text-[11px] text-slate-400">{f.created_at}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Parts Used ── */}
                            {parts.length > 0 && (
                                <div className="rounded-lg bg-white shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-200/60 bg-gradient-to-r from-violet-50/80 to-white">
                                        <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 text-violet-600" />
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700">Parts Used</h3>
                                        </div>
                                        <span className="inline-flex items-center justify-center rounded-sm bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 border border-violet-200">
                                            {parts.length}
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full border-collapse">
                                            <thead>
                                                <tr>
                                                    {["#", "Part Code", "Part Name", "UOM", "Qty", "Remarks"].map(h => (
                                                        <th key={h} className="sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 py-2.5 text-left border-b border-slate-200 bg-slate-50/80">
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parts.map((p, idx) => (
                                                    <tr key={p.id} className="odd:bg-white even:bg-slate-50/60 hover:bg-violet-50/40">
                                                        <td className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100 font-mono">{idx + 1}</td>
                                                        <td className="px-3 py-2 text-xs font-mono font-semibold text-slate-800 border-b border-slate-100">{p.part_code}</td>
                                                        <td className="px-3 py-2 text-sm text-slate-700 border-b border-slate-100">{p.part_name}</td>
                                                        <td className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">{p.uom}</td>
                                                        <td className="px-3 py-2 text-sm tabular-nums font-semibold text-slate-800 border-b border-slate-100">{Number(p.quantity).toFixed(2)}</td>
                                                        <td className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100 italic">{p.remarks || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ── Additional Charges ── */}
                            {charges.length > 0 && (
                                <div className="rounded-lg bg-white shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-200/60 bg-gradient-to-r from-amber-50/80 to-white">
                                        <div className="flex items-center gap-2">
                                            <ReceiptText className="h-4 w-4 text-amber-600" />
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700">Additional Charges</h3>
                                        </div>
                                        <span className="inline-flex items-center justify-center rounded-sm bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                            {charges.length}
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full border-collapse">
                                            <thead>
                                                <tr>
                                                    {["#", "Charge Name", "Ref No", "Description", "Cost", "Selling"].map(h => (
                                                        <th key={h} className="sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 py-2.5 text-left border-b border-slate-200 bg-slate-50/80">
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {charges.map((c, idx) => (
                                                    <tr key={c.id} className="odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/40">
                                                        <td className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100 font-mono">{idx + 1}</td>
                                                        <td className="px-3 py-2 text-sm font-semibold text-slate-800 border-b border-slate-100">{c.charge_name}</td>
                                                        <td className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">{c.ref_no || "—"}</td>
                                                        <td className="px-3 py-2 text-sm text-slate-700 border-b border-slate-100">{c.description || "—"}</td>
                                                        <td className="px-3 py-2 text-sm tabular-nums text-slate-700 border-b border-slate-100">{fmtAmount(c.cost_price)}</td>
                                                        <td className="px-3 py-2 text-sm tabular-nums font-semibold text-emerald-700 border-b border-slate-100">{fmtAmount(c.selling_price)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ── Transaction History ── */}
                            <div className="rounded-lg bg-white shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2.5 border-b border-teal-200/60 bg-gradient-to-r from-teal-50/80 to-white">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-teal-600" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700">Transaction History</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center rounded-sm bg-teal-100 px-2.5 py-0.5 text-[11px] font-bold text-teal-700 border border-teal-200">
                                            {transactions.length}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 px-2 text-[11px] text-amber-700 border-amber-300 hover:bg-amber-50 disabled:opacity-40"
                                            disabled={undoing || loading || !transactions.some(t => t.id > 0)}
                                            onClick={() => handleUndoClick()}
                                        >
                                            {undoing
                                                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                : <RotateCcw className="h-3 w-3 mr-1" />}
                                            Undo Last
                                        </Button>
                                    </div>
                                </div>

                                {transactions.length === 0 ? (
                                    <div className="flex h-20 items-center justify-center text-sm text-slate-500">
                                        No transactions recorded for this job.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full border-collapse">
                                            <thead>
                                                <tr>
                                                    {[
                                                        { label: "#", cls: "w-10" },
                                                        { label: "Date", cls: "w-32" },
                                                        { label: "Status", cls: "w-40" },
                                                        { label: "Technician", cls: "w-36" },
                                                        { label: "Amount", cls: "w-28 text-right" },
                                                        { label: "Remarks", cls: "" },
                                                    ].map(h => (
                                                        <th key={h.label} className={`sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 py-2.5 text-left border-b border-slate-200 bg-slate-50/80 ${h.cls}`}>
                                                            {h.label}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transactions.map((t, idx) => {
                                                    const statusCode = t.status_name?.toUpperCase().replace(/ /g, "_") ?? "";
                                                    const sParts = STATUS_COLORS[statusCode]?.trim().split(/\s+/) ?? [];
                                                    const sBg = sParts[0] ?? "bg-blue-500";
                                                    return (
                                                        <tr key={t.id} className="odd:bg-white even:bg-slate-50/60 transition-colors hover:bg-blue-50/40">
                                                            <td className="px-3 py-3 text-sm text-slate-500 border-b border-slate-100 font-mono">{idx + 1}</td>
                                                            <td className="px-3 py-3 text-xs font-mono whitespace-nowrap text-slate-700 border-b border-slate-100">
                                                                {t.transaction_date ?? "—"}
                                                            </td>
                                                            <td className="px-3 py-3 border-b border-slate-100">
                                                                {t.status_name ? (
                                                                    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm ${sBg}`}>
                                                                        {t.status_name}
                                                                    </span>
                                                                ) : <span className="text-slate-400">—</span>}
                                                            </td>
                                                            <td className="px-3 py-3 text-sm text-slate-700 border-b border-slate-100">{t.technician_name ?? "—"}</td>
                                                            <td className="px-3 py-3 text-sm text-right tabular-nums font-semibold text-emerald-700 border-b border-slate-100">{fmtAmount(t.amount)}</td>
                                                            <td className="px-3 py-3 text-sm text-slate-700 border-b border-slate-100 max-w-48 truncate" title={t.remarks ?? undefined}>{t.remarks ?? "—"}</td>
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

        {attachOpen && job && (
            <JobAttachDialog
                jobId={jobId}
                jobNo={job.job_no}
                onClose={() => { setAttachOpen(false); loadFiles(); }}
                onFilesChanged={() => loadFiles()}
            />
        )}

        {showUndo && job && (
            <UndoTransactionDialog
                job={{
                    job_no:                  job.job_no,
                    customer_name:           job.customer_name,
                    job_receive_manner_name: job.job_receive_manner_name,
                    device_details:          device,
                    job_status_name:         job.job_status_name,
                }}
                submitting={undoing}
                onConfirm={() => void handleUndoConfirm()}
                onClose={() => setShowUndo(false)}
            />
        )}
        </>
    );
};
