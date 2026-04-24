import { useCallback, useEffect, useRef, useState } from "react";
import {
    ArrowLeft, Briefcase,
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Loader2, Pencil, RefreshCw, Save, Search,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { currentFinancialYearRange } from "@/lib/utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobDetailType, JobLookupRow, TechnicianRow } from "@/features/client/types/job";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubView = "list" | "form";
type GenericQueryData<T> = { genericQuery: T[] | null };

type OpenJobRow = {
    id:                  number;
    job_no:              string;
    job_date:            string;
    is_closed:           boolean;
    amount:              number | null;
    diagnosis:           string | null;
    last_transaction_id: number | null;
    customer_name:       string;
    mobile:              string;
    job_type_name:       string;
    job_status_name:     string;
    technician_name:     string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 600;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const UpdateJobSection = () => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const currentUser   = useAppSelector(selectCurrentUser);
    const branchId      = currentBranch?.id ?? null;

    const { from: defaultFrom, to: defaultTo } = currentFinancialYearRange();

    // ── List state ──────────────────────────────────────────────────────────
    const [subView,    setSubView]    = useState<SubView>("list");
    const [fromDate,   setFromDate]   = useState(defaultFrom);
    const [toDate,     setToDate]     = useState(defaultTo);
    const [search,     setSearch]     = useState("");
    const [searchQ,    setSearchQ]    = useState("");
    const [showClosed, setShowClosed] = useState(false);
    const [page,       setPage]       = useState(1);
    const [rows,       setRows]       = useState<OpenJobRow[]>([]);
    const [total,      setTotal]      = useState(0);
    const [loading,    setLoading]    = useState(false);

    // ── Metadata ────────────────────────────────────────────────────────────
    const [jobStatuses, setJobStatuses] = useState<JobLookupRow[]>([]);
    const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
    const [metaLoaded,  setMetaLoaded]  = useState(false);

    // ── Form state ──────────────────────────────────────────────────────────
    const [selectedJob,      setSelectedJob]      = useState<JobDetailType | null>(null);
    const [loadingDetail,    setLoadingDetail]    = useState(false);
    const [jobStatusId,      setJobStatusId]      = useState("");
    const [technicianId,     setTechnicianId]     = useState("");
    const [diagnosis,        setDiagnosis]        = useState("");
    const [workDone,         setWorkDone]         = useState("");
    const [amount,           setAmount]           = useState("");
    const [deliveryDate,     setDeliveryDate]     = useState("");
    const [isClosed,         setIsClosed]         = useState(false);
    const [isFinal,          setIsFinal]          = useState(false);
    const [remarks,          setRemarks]          = useState("");
    const [transactionNotes, setTransactionNotes] = useState("");
    const [submitting,       setSubmitting]       = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollRef   = useRef<HTMLDivElement>(null);
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
    }, [recalc, rows.length, subView]);

    // Load statuses + technicians once
    useEffect(() => {
        if (!dbName || !schema || !branchId || metaLoaded) return;
        Promise.all([
            apolloClient.query<GenericQueryData<JobLookupRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_STATUSES }) },
            }),
            apolloClient.query<GenericQueryData<TechnicianRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_TECHNICIANS, sqlArgs: { branch_id: branchId } }) },
            }),
        ]).then(([statusRes, techRes]) => {
            setJobStatuses(statusRes.data?.genericQuery ?? []);
            setTechnicians(techRes.data?.genericQuery ?? []);
            setMetaLoaded(true);
        }).catch(() => toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED));
    }, [dbName, schema, branchId, metaLoaded]);

    const loadData = useCallback(async (
        bid: number, from: string, to: string, q: string, pg: number, closed: boolean,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bid, from_date: from, to_date: to, search: q, show_closed: closed };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<OpenJobRow>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_OPEN_JOBS_PAGED,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_OPEN_JOBS_COUNT,
                            sqlArgs: commonArgs,
                        }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(Number(countRes.data?.genericQuery?.[0]?.total ?? 0));
        } catch {
            toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId || subView !== "list") return;
        void loadData(branchId, fromDate, toDate, searchQ, page, showClosed);
    }, [branchId, fromDate, toDate, searchQ, page, showClosed, loadData, subView]);

    function handleSearchChange(value: string) {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    }

    async function handleRowClick(row: OpenJobRow) {
        if (!dbName || !schema) return;
        setLoadingDetail(true);
        try {
            const res = await apolloClient.query<GenericQueryData<JobDetailType>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_JOB_DETAIL,
                        sqlArgs: { id: row.id },
                    }),
                },
            });
            const job = res.data?.genericQuery?.[0] ?? null;
            if (!job) { toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED); return; }
            setSelectedJob(job);
            setJobStatusId(String(job.job_status_id));
            setTechnicianId(job.technician_id ? String(job.technician_id) : "");
            setDiagnosis(job.diagnosis ?? "");
            setWorkDone(job.work_done ?? "");
            setAmount(job.amount != null ? String(job.amount) : "");
            setDeliveryDate(job.delivery_date ?? "");
            setIsClosed(job.is_closed);
            setIsFinal(job.is_final);
            setRemarks(job.remarks ?? "");
            setTransactionNotes("");
            setSubView("form");
        } catch {
            toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED);
        } finally {
            setLoadingDetail(false);
        }
    }

    function handleBack() {
        setSubView("list");
        setSelectedJob(null);
    }

    async function handleSave() {
        if (!selectedJob || !dbName || !schema) return;
        setSubmitting(true);
        try {
            const payload = encodeObj({
                job_id:               selectedJob.id,
                last_transaction_id:  selectedJob.last_transaction_id,
                performed_by_user_id: currentUser?.id ?? null,
                transaction_notes:    transactionNotes || "",
                xData: {
                    id:            selectedJob.id,
                    job_status_id: Number(jobStatusId),
                    technician_id: technicianId ? Number(technicianId) : null,
                    diagnosis:     diagnosis || null,
                    work_done:     workDone || null,
                    amount:        amount !== "" ? Number(amount) : null,
                    delivery_date: deliveryDate || null,
                    is_closed:     isClosed,
                    is_final:      isFinal,
                    remarks:       remarks || null,
                },
            });
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.updateJob,
                variables: { db_name: dbName, schema, value: payload },
            });
            toast.success(MESSAGES.SUCCESS_JOB_UPDATED);
            setSubView("list");
            setSelectedJob(null);
            if (branchId) void loadData(branchId, fromDate, toDate, searchQ, page, showClosed);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_UPDATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ─── Form View ────────────────────────────────────────────────────────────

    if (subView === "form" && selectedJob) {
        return (
            <motion.div
                animate={{ opacity: 1 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                {/* Header */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-2">
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs"
                        disabled={submitting}
                        variant="ghost"
                        onClick={handleBack}
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to List
                    </Button>
                    <div className="flex items-baseline gap-2">
                        <span className="font-mono font-bold text-[var(--cl-accent)] text-sm">#{selectedJob.job_no}</span>
                        <span className="text-sm font-medium text-[var(--cl-text)]">{selectedJob.customer_name}</span>
                    </div>
                    <div className="flex-1" />
                    <Button
                        className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed"
                        disabled={!jobStatusId || submitting}
                        onClick={() => void handleSave()}
                    >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Update
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {/* Intake summary (read-only) */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--cl-text-muted)]">Intake Summary</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                            {([
                                ["Job No",         selectedJob.job_no],
                                ["Job Date",       selectedJob.job_date],
                                ["Customer",       selectedJob.customer_name ?? "—"],
                                ["Mobile",         selectedJob.mobile],
                                ["Job Type",       selectedJob.job_type_name],
                                ["Receive Manner", selectedJob.job_receive_manner_name],
                            ] as [string, string][]).map(([label, value]) => (
                                <div key={label}>
                                    <p className="text-[10px] uppercase tracking-wider text-[var(--cl-text-muted)]">{label}</p>
                                    <p className="text-sm font-medium text-[var(--cl-text)]">{value}</p>
                                </div>
                            ))}
                        </div>
                        {selectedJob.problem_reported && (
                            <div className="mt-3">
                                <p className="text-[10px] uppercase tracking-wider text-[var(--cl-text-muted)]">Problem Reported</p>
                                <p className="mt-0.5 text-sm text-[var(--cl-text)]">{selectedJob.problem_reported}</p>
                            </div>
                        )}
                    </div>

                    {/* Job Status + Technician */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]">
                                Job Status <span className="text-red-500">*</span>
                            </Label>
                            <Select value={jobStatusId} onValueChange={setJobStatusId}>
                                <SelectTrigger className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {jobStatuses.map(s => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]">Technician</Label>
                            <Select value={technicianId} onValueChange={setTechnicianId}>
                                <SelectTrigger className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm">
                                    <SelectValue placeholder="Select technician" />
                                </SelectTrigger>
                                <SelectContent>
                                    {technicians.map(t => (
                                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Diagnosis */}
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="uj-diagnosis">Diagnosis</Label>
                        <Textarea
                            className="min-h-[72px] border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                            id="uj-diagnosis"
                            placeholder="Technical diagnosis…"
                            value={diagnosis}
                            onChange={e => setDiagnosis(e.target.value)}
                        />
                    </div>

                    {/* Work Done */}
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="uj-work-done">Work Done</Label>
                        <Textarea
                            className="min-h-[72px] border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                            id="uj-work-done"
                            placeholder="Work performed…"
                            value={workDone}
                            onChange={e => setWorkDone(e.target.value)}
                        />
                    </div>

                    {/* Amount + Delivery Date */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="uj-amount">Amount</Label>
                            <Input
                                className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                                id="uj-amount"
                                min="0"
                                placeholder="0.00"
                                step="0.01"
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="uj-delivery-date">Delivery Date</Label>
                            <Input
                                className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                                id="uj-delivery-date"
                                type="date"
                                value={deliveryDate}
                                onChange={e => setDeliveryDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Is Closed + Is Final */}
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Switch checked={isClosed} id="uj-is-closed" onCheckedChange={setIsClosed} />
                            <Label className="text-sm text-[var(--cl-text)] cursor-pointer" htmlFor="uj-is-closed">Closed</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch checked={isFinal} id="uj-is-final" onCheckedChange={setIsFinal} />
                            <Label className="text-sm text-[var(--cl-text)] cursor-pointer" htmlFor="uj-is-final">Final</Label>
                        </div>
                    </div>

                    {/* Remarks */}
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="uj-remarks">Remarks</Label>
                        <Textarea
                            className="min-h-[60px] border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                            id="uj-remarks"
                            placeholder="Optional remarks…"
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                        />
                    </div>

                    {/* Transaction Notes */}
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="uj-txn-notes">
                            Transaction Notes
                            <span className="ml-1.5 text-[10px] font-normal normal-case text-[var(--cl-text-muted)]">(recorded in job history)</span>
                        </Label>
                        <Textarea
                            className="min-h-[60px] border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                            id="uj-txn-notes"
                            placeholder="Notes for this update…"
                            value={transactionNotes}
                            onChange={e => setTransactionNotes(e.target.value)}
                        />
                    </div>
                </div>
            </motion.div>
        );
    }

    // ─── List View ────────────────────────────────────────────────────────────

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-1">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <Briefcase className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-bold text-[var(--cl-text)]">Update Job</h1>
                        <span className="text-xs text-[var(--cl-text-muted)]">
                            {loading ? "Loading…" : `(${total})`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-1 bg-[var(--cl-surface-2)]/30">
                <div className="flex items-center gap-1">
                    <Input
                        className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                        disabled={loading}
                        type="date"
                        value={fromDate}
                        onChange={e => { setFromDate(e.target.value); setPage(1); }}
                    />
                    <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                    <Input
                        className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                        disabled={loading}
                        type="date"
                        value={toDate}
                        onChange={e => { setToDate(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                    <Input
                        className="h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-8 text-xs"
                        disabled={loading}
                        placeholder="Job no, customer or mobile…"
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        checked={showClosed}
                        id="uj-list-show-closed"
                        onCheckedChange={v => { setShowClosed(v); setPage(1); }}
                    />
                    <Label className="cursor-pointer text-xs text-[var(--cl-text-muted)]" htmlFor="uj-list-show-closed">Show Closed</Label>
                </div>
                <Button
                    className="h-8 px-2.5 text-xs"
                    disabled={loading || !branchId}
                    size="sm"
                    variant="outline"
                    onClick={() => { if (branchId) void loadData(branchId, fromDate, toDate, searchQ, page, showClosed); }}
                >
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                </Button>
            </div>

            {/* Grid */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm mx-4">
                <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: maxHeight || undefined }}>
                    {loading ? (
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr>
                                    {["#","Date","Job No","Customer","Mobile","Status","Technician","Diagnosis","Amount","Action"].map(h => (
                                        <th key={h} className={thClass}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 10 }).map((__, j) => (
                                            <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-[var(--cl-border)]" /></td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                            No jobs found for the selected filters.
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
                                    <th className={thClass}>Diagnosis</th>
                                    <th className={`${thClass} text-right`}>Amount</th>
                                    <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                {rows.map((row, idx) => (
                                    <motion.tr
                                        key={row.id}
                                        animate={{ opacity: 1 }}
                                        className="group transition-colors hover:bg-[var(--cl-accent)]/5"
                                        initial={{ opacity: 0 }}
                                        transition={{ delay: idx * 0.015, duration: 0.15 }}
                                    >
                                        <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                        <td className={tdClass}>{row.job_date}</td>
                                        <td className={`${tdClass} font-mono font-semibold text-[var(--cl-accent)]`}>
                                            #{row.job_no}
                                            {row.is_closed && (
                                                <span className="ml-1.5 rounded px-1 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40">CLOSED</span>
                                            )}
                                        </td>
                                        <td className={tdClass}>{row.customer_name}</td>
                                        <td className={`${tdClass} font-mono text-xs`}>{row.mobile}</td>
                                        <td className={tdClass}>
                                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                                                {row.job_status_name}
                                            </span>
                                        </td>
                                        <td className={tdClass}>{row.technician_name ?? "—"}</td>
                                        <td className={`${tdClass} max-w-[160px]`}>
                                            {row.diagnosis
                                                ? <span className="text-xs">{row.diagnosis.slice(0, 40)}{row.diagnosis.length > 40 ? "…" : ""}</span>
                                                : <span className="text-xs italic text-[var(--cl-text-muted)]">—</span>
                                            }
                                        </td>
                                        <td className={`${tdClass} text-right tabular-nums`}>
                                            {row.amount != null ? `₹${Number(row.amount).toFixed(2)}` : "—"}
                                        </td>
                                        <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`}>
                                            <Button
                                                className="h-7 w-7 p-0 text-[var(--cl-text-muted)] hover:text-[var(--cl-accent)]"
                                                disabled={loadingDetail}
                                                size="icon"
                                                title="Update Job"
                                                variant="ghost"
                                                onClick={() => void handleRowClick(row)}
                                            >
                                                {loadingDetail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                                            </Button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2">
                    <span className="text-xs text-[var(--cl-text-muted)]">
                        Page {page} of {totalPages} · {total} records
                    </span>
                    <div className="flex items-center gap-1">
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="First"    variant="ghost" onClick={() => setPage(1)}><ChevronsLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="Previous" variant="ghost" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Next" variant="ghost" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Last" variant="ghost" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
