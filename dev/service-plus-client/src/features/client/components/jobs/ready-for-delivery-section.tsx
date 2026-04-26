import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {ArrowLeft, CheckCircle2,
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Loader2, Plus, RefreshCw, Save, Search, Trash2, Wand2, X} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { currentFinancialYearRange } from "@/lib/utils";
import { selectCurrentBranch, selectEffectiveGstStateCode, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobDetailType, JobLookupRow } from "@/features/client/types/job";
import type { DocumentSequenceRow } from "@/features/client/types/sales";
import type { JobInvoiceFormLine, JobInvoiceLineType, JobInvoiceType } from "@/features/client/types/job-invoice";

// ─── Local types ──────────────────────────────────────────────────────────────

type SubView = "list" | "invoice";
type GenericQueryData<T> = { genericQuery: T[] | null };

type ReadyJobRow = {
    id:              number;
    job_no:          string;
    job_date:        string;
    amount:          number | null;
    customer_name:   string;
    mobile:          string;
    job_status_name: string;
    technician_name: string | null;
    has_invoice:     boolean;
};

type CompanyInfoRow = {
    id:             number;
    company_name:   string;
    gstin:          string | null;
    gst_state_code: string | null;
};

type StateRow = {
    id:             number;
    code:           string;
    name:           string;
    gst_state_code: string | null;
};

type JobPartRow = {
    quantity:   number;
    part_code:  string;
    part_name:  string;
    uom:        string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1200;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function buildInvoiceNo(seq: DocumentSequenceRow): string {
    return `${seq.prefix}${seq.separator}${String(seq.next_number).padStart(seq.padding, "0")}`;
}

function emptyFormLine(): JobInvoiceFormLine {
    return { _key: crypto.randomUUID(), description: "", part_code: "", hsn_code: "", quantity: "1", unit_price: "0", gst_rate: "0" };
}

function dbLineToFormLine(line: JobInvoiceLineType): JobInvoiceFormLine {
    const gstRate = line.igst_rate > 0 ? String(line.igst_rate) : String(line.cgst_rate + line.sgst_rate);
    return {
        _key:        crypto.randomUUID(),
        description: line.description,
        part_code:   line.part_code ?? "",
        hsn_code:    line.hsn_code ?? "",
        quantity:    String(line.quantity),
        unit_price:  String(line.unit_price),
        gst_rate:    gstRate,
    };
}

function calcLine(line: JobInvoiceFormLine, isIgst: boolean) {
    const qty      = parseFloat(line.quantity)   || 0;
    const price    = parseFloat(line.unit_price) || 0;
    const gstRate  = parseFloat(line.gst_rate)   || 0;
    const taxable  = round2(qty * price);
    const cgst     = isIgst ? 0 : round2(taxable * (gstRate / 2) / 100);
    const sgst     = isIgst ? 0 : round2(taxable * (gstRate / 2) / 100);
    const igst     = isIgst ? round2(taxable * gstRate / 100) : 0;
    const total    = round2(taxable + cgst + sgst + igst);
    return { qty, price, gstRate, taxable, cgst, sgst, igst, total };
}

function buildLinePayload(line: JobInvoiceFormLine, isIgst: boolean) {
    const { qty, price, gstRate, taxable, cgst, sgst, igst, total } = calcLine(line, isIgst);
    return {
        description:    line.description.trim(),
        part_code:      line.part_code.trim() || null,
        hsn_code:       line.hsn_code.trim(),
        quantity:       qty,
        unit_price:     price,
        taxable_amount: taxable,
        cgst_rate:      isIgst ? 0 : gstRate / 2,
        sgst_rate:      isIgst ? 0 : gstRate / 2,
        igst_rate:      isIgst ? gstRate : 0,
        cgst_amount:    cgst,
        sgst_amount:    sgst,
        igst_amount:    igst,
        total_amount:   total,
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ReadyForDeliverySection = () => {
    const dbName             = useAppSelector(selectDbName);
    const schema             = useAppSelector(selectSchema);
    const currentBranch      = useAppSelector(selectCurrentBranch);
    const effectiveStateCode = useAppSelector(selectEffectiveGstStateCode);
    const branchId           = currentBranch?.id ?? null;

    const { from: defaultFrom, to: defaultTo } = currentFinancialYearRange();

    // ── List state ──────────────────────────────────────────────────────────
    const [subView,  setSubView]  = useState<SubView>("list");
    const [fromDate, setFromDate] = useState(defaultFrom);
    const [toDate,   setToDate]   = useState(defaultTo);
    const [search,   setSearch]   = useState("");
    const [searchQ,  setSearchQ]  = useState("");
    const [page,     setPage]     = useState(1);
    const [rows,     setRows]     = useState<ReadyJobRow[]>([]);
    const [total,    setTotal]    = useState(0);
    const [loading,  setLoading]  = useState(false);

    // ── Meta ────────────────────────────────────────────────────────────────
    const [companyInfo,   setCompanyInfo]   = useState<CompanyInfoRow | null>(null);
    const [docSequence,   setDocSequence]   = useState<DocumentSequenceRow | null>(null);
    const [allStates,     setAllStates]     = useState<StateRow[]>([]);
    const [readyStatusId, setReadyStatusId] = useState<number | null>(null);
    const [metaLoaded,    setMetaLoaded]    = useState(false);

    // ── Invoice state ───────────────────────────────────────────────────────
    // const [selectedRow,      setSelectedRow]      = useState<ReadyJobRow | null>(null);
    const [selectedJob,      setSelectedJob]      = useState<JobDetailType | null>(null);
    const [existingInvoice,  setExistingInvoice]  = useState<JobInvoiceType | null>(null);
    const [invoiceDate,      setInvoiceDate]      = useState(today());
    const [supplyStateCode,  setSupplyStateCode]  = useState("");
    const [isIgst,           setIsIgst]           = useState(false);
    const [lines,            setLines]            = useState<JobInvoiceFormLine[]>([emptyFormLine()]);
    const [loadingDetail,    setLoadingDetail]    = useState(false);
    const [loadingParts,     setLoadingParts]     = useState(false);
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

    // ── Load meta once ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!dbName || !schema || !branchId || metaLoaded) return;
        Promise.all([
            apolloClient.query<GenericQueryData<CompanyInfoRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_COMPANY_INFO }) },
            }),
            apolloClient.query<GenericQueryData<DocumentSequenceRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DOCUMENT_SEQUENCES, sqlArgs: { branch_id: branchId } }) },
            }),
            apolloClient.query<GenericQueryData<StateRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_STATES }) },
            }),
            apolloClient.query<GenericQueryData<JobLookupRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_STATUSES }) },
            }),
        ]).then(([compRes, seqRes, stateRes, statusRes]) => {
            const ci = compRes.data?.genericQuery?.[0] ?? null;
            setCompanyInfo(ci);

            const seqs = seqRes.data?.genericQuery ?? [];
            const jinvSeq = seqs.find(s => s.document_type_code === "JINV") ?? null;
            setDocSequence(jinvSeq);

            setAllStates(stateRes.data?.genericQuery ?? []);

            const statuses = statusRes.data?.genericQuery ?? [];
            const readyStatus = statuses.find(s => s.code === "READY");
            setReadyStatusId(readyStatus?.id ?? null);

            const defaultStateCode = ci?.gst_state_code ?? effectiveStateCode ?? "";
            setSupplyStateCode(defaultStateCode);

            setMetaLoaded(true);
        }).catch(() => toast.error(MESSAGES.ERROR_JOB_INVOICE_LOAD_FAILED));
    }, [dbName, schema, branchId, metaLoaded, effectiveStateCode]);

    // ── Load list data ──────────────────────────────────────────────────────
    const loadData = useCallback(async (bid: number, from: string, to: string, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bid, from_date: from, to_date: to, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<ReadyJobRow>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_READY_JOBS_PAGED,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_READY_JOBS_COUNT, sqlArgs: commonArgs }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(Number(countRes.data?.genericQuery?.[0]?.total ?? 0));
        } catch {
            toast.error(MESSAGES.ERROR_READY_JOBS_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId || subView !== "list") return;
        void loadData(branchId, fromDate, toDate, searchQ, page);
    }, [branchId, fromDate, toDate, searchQ, page, loadData, subView]);

    function handleSearchChange(value: string) {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    }

    // ── Open invoice view for a row ─────────────────────────────────────────
    async function handleRowClick(row: ReadyJobRow) {
        if (!dbName || !schema) return;
        setLoadingDetail(true);
        try {
            const [jobRes, invRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobDetailType>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DETAIL, sqlArgs: { id: row.id } }) },
                }),
                apolloClient.query<GenericQueryData<JobInvoiceType>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_INVOICE_BY_JOB, sqlArgs: { job_id: row.id } }) },
                }),
            ]);

            const job = jobRes.data?.genericQuery?.[0] ?? null;
            if (!job) { toast.error(MESSAGES.ERROR_JOB_INVOICE_LOAD_FAILED); return; }

            const invoice = invRes.data?.genericQuery?.[0] ?? null;

            // setSelectedRow(row);
            setSelectedJob(job);
            setExistingInvoice(invoice);

            if (invoice) {
                setInvoiceDate(invoice.invoice_date.slice(0, 10));
                setSupplyStateCode(invoice.supply_state_code ?? "");
                const hasIgst = (invoice.lines ?? []).some(l => l.igst_rate > 0);
                setIsIgst(hasIgst);
                setLines(invoice.lines?.length ? invoice.lines.map(dbLineToFormLine) : [emptyFormLine()]);
            } else {
                setInvoiceDate(today());
                setSupplyStateCode(companyInfo?.gst_state_code ?? effectiveStateCode ?? "");
                setIsIgst(false);
                setLines([emptyFormLine()]);
            }
            setSubView("invoice");
        } catch {
            toast.error(MESSAGES.ERROR_JOB_INVOICE_LOAD_FAILED);
        } finally {
            setLoadingDetail(false);
        }
    }

    function handleBack() {
        setSubView("list");
        // setSelectedRow(null);
        setSelectedJob(null);
        setExistingInvoice(null);
    }

    // ── Auto-populate lines from parts used ─────────────────────────────────
    async function handleAutoPopulate() {
        if (!dbName || !schema || !selectedJob) return;
        setLoadingParts(true);
        try {
            const res = await apolloClient.query<GenericQueryData<JobPartRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_PARTS_FOR_INVOICE, sqlArgs: { job_id: selectedJob.id } }) },
            });
            const parts = res.data?.genericQuery ?? [];
            if (!parts.length) { toast.info("No parts used found for this job."); return; }
            const partLines: JobInvoiceFormLine[] = parts.map(p => ({
                _key:        crypto.randomUUID(),
                description: p.part_name,
                part_code:   p.part_code,
                hsn_code:    "",
                quantity:    String(p.quantity),
                unit_price:  "0",
                gst_rate:    "0",
            }));
            setLines(prev => {
                const nonEmpty = prev.filter(l => l.description.trim() || l.unit_price !== "0");
                return [...nonEmpty, ...partLines];
            });
        } catch {
            toast.error(MESSAGES.ERROR_JOB_INVOICE_LOAD_FAILED);
        } finally {
            setLoadingParts(false);
        }
    }

    // ── Line mutations ───────────────────────────────────────────────────────
    function updateLine(key: string, field: keyof JobInvoiceFormLine, value: string) {
        setLines(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l));
    }
    function addLine() { setLines(prev => [...prev, emptyFormLine()]); }
    function removeLine(key: string) { setLines(prev => prev.length > 1 ? prev.filter(l => l._key !== key) : prev); }

    // ── Computed totals ──────────────────────────────────────────────────────
    const totals = useMemo(() => {
        const computed = lines.map(l => calcLine(l, isIgst));
        return {
            taxable: round2(computed.reduce((s, l) => s + l.taxable, 0)),
            cgst:    round2(computed.reduce((s, l) => s + l.cgst,    0)),
            sgst:    round2(computed.reduce((s, l) => s + l.sgst,    0)),
            igst:    round2(computed.reduce((s, l) => s + l.igst,    0)),
            tax:     round2(computed.reduce((s, l) => s + l.cgst + l.sgst + l.igst, 0)),
            total:   round2(computed.reduce((s, l) => s + l.total,   0)),
        };
    }, [lines, isIgst]);

    // ── Save ─────────────────────────────────────────────────────────────────
    async function handleSave() {
        if (!selectedJob || !dbName || !schema) return;
        if (!lines.some(l => l.description.trim())) {
            toast.error(MESSAGES.ERROR_JOB_INVOICE_LINE_REQUIRED);
            return;
        }
        if (!readyStatusId) {
            toast.error("Ready for Delivery status not configured. Check job status codes.");
            return;
        }

        setSubmitting(true);
        try {
            const linePayloads = lines.filter(l => l.description.trim()).map(l => buildLinePayload(l, isIgst));
            const isNew = !existingInvoice;

            let sqlObject: Record<string, unknown>;

            if (isNew) {
                if (!docSequence?.id) {
                    toast.error("JINV document sequence not configured.");
                    setSubmitting(false);
                    return;
                }
                const invoiceNo = buildInvoiceNo(docSequence);
                sqlObject = {
                    tableName: "job_invoice",
                    xData: {
                        job_id:            selectedJob.id,
                        company_id:        companyInfo?.id ?? null,
                        invoice_no:        invoiceNo,
                        invoice_date:      invoiceDate,
                        supply_state_code: supplyStateCode,
                        taxable_amount:    totals.taxable,
                        cgst_amount:       totals.cgst,
                        sgst_amount:       totals.sgst,
                        igst_amount:       totals.igst,
                        total_tax:         totals.tax,
                        total_amount:      totals.total,
                    },
                    xDetails: [
                        { tableName: "job_invoice_line", fkeyName: "job_invoice_id", xData: linePayloads },
                        { tableName: "job", xData: { id: selectedJob.id, job_status_id: readyStatusId } },
                        { tableName: "document_sequence", xData: { id: docSequence.id, next_number: docSequence.next_number + 1 } },
                    ],
                };
            } else {
                const existingLineIds = (existingInvoice.lines ?? []).map(l => l.id);
                const lineDetail: Record<string, unknown> = {
                    tableName: "job_invoice_line",
                    fkeyName:  "job_invoice_id",
                    xData:     linePayloads,
                };
                if (existingLineIds.length > 0) {
                    lineDetail.deletedIds = existingLineIds;
                }
                sqlObject = {
                    tableName: "job_invoice",
                    xData: {
                        id:                existingInvoice.id,
                        invoice_date:      invoiceDate,
                        supply_state_code: supplyStateCode,
                        taxable_amount:    totals.taxable,
                        cgst_amount:       totals.cgst,
                        sgst_amount:       totals.sgst,
                        igst_amount:       totals.igst,
                        total_tax:         totals.tax,
                        total_amount:      totals.total,
                    },
                    xDetails: [
                        lineDetail,
                        { tableName: "job", xData: { id: selectedJob.id, job_status_id: readyStatusId } },
                    ],
                };
            }

            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: encodeObj(sqlObject) },
            });

            toast.success(MESSAGES.SUCCESS_JOB_INVOICE_SAVED);
            handleBack();
            if (branchId) void loadData(branchId, fromDate, toDate, searchQ, page);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_INVOICE_SAVE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ─── Invoice View ─────────────────────────────────────────────────────────

    if (subView === "invoice" && selectedJob) {
        const invoiceNo = existingInvoice?.invoice_no ?? (docSequence ? buildInvoiceNo(docSequence) : "—");
        const canSave   = lines.some(l => l.description.trim()) && !submitting && !!readyStatusId;

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
                        disabled={!canSave}
                        onClick={() => void handleSave()}
                    >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Invoice &amp; Mark Ready
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {/* Job summary */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--cl-text-muted)]">Job Summary</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                            {([
                                ["Job No",      selectedJob.job_no],
                                ["Job Date",    selectedJob.job_date],
                                ["Customer",    selectedJob.customer_name ?? "—"],
                                ["Mobile",      selectedJob.mobile],
                                ["Technician",  selectedJob.technician_name ?? "—"],
                                ["Status",      selectedJob.job_status_name],
                                ["Amount",      selectedJob.amount != null ? `₹${Number(selectedJob.amount).toFixed(2)}` : "—"],
                            ] as [string, string][]).map(([lbl, val]) => (
                                <div key={lbl}>
                                    <p className="text-[10px] uppercase tracking-wider text-[var(--cl-text-muted)]">{lbl}</p>
                                    <p className="text-sm font-medium text-[var(--cl-text)]">{val}</p>
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

                    {/* Invoice header */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]">Invoice No</Label>
                            <Input
                                className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-sm font-mono"
                                readOnly
                                value={invoiceNo}
                            />
                        </div>
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="rfd-inv-date">
                                Invoice Date <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                                id="rfd-inv-date"
                                type="date"
                                value={invoiceDate}
                                onChange={e => setInvoiceDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]">Supply State</Label>
                            <Select value={supplyStateCode} onValueChange={setSupplyStateCode}>
                                <SelectTrigger className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm">
                                    <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allStates.map(s => (
                                        <SelectItem key={s.id} value={s.gst_state_code ?? s.code}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end pb-1">
                            <div className="flex items-center gap-2">
                                <Switch checked={isIgst} id="rfd-igst" onCheckedChange={v => setIsIgst(v)} />
                                <Label className="text-sm text-[var(--cl-text)] cursor-pointer" htmlFor="rfd-igst">IGST</Label>
                            </div>
                        </div>
                    </div>

                    {/* Lines section */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--cl-text-muted)]">Invoice Lines</p>
                            <Button
                                className="h-7 gap-1.5 px-2.5 text-xs"
                                disabled={loadingParts || submitting}
                                size="sm"
                                variant="outline"
                                onClick={() => void handleAutoPopulate()}
                            >
                                {loadingParts
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <Wand2 className="h-3 w-3" />
                                }
                                Auto-populate from Parts Used
                            </Button>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-[var(--cl-border)]">
                            <table className="min-w-full border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th className={`${thClass} w-8`}>#</th>
                                        <th className={thClass}>Description <span className="text-red-500">*</span></th>
                                        <th className={thClass}>Part Code</th>
                                        <th className={thClass}>HSN</th>
                                        <th className={`${thClass} w-20`}>Qty <span className="text-red-500">*</span></th>
                                        <th className={`${thClass} w-24`}>Unit Price <span className="text-red-500">*</span></th>
                                        <th className={`${thClass} w-20`}>GST %</th>
                                        <th className={`${thClass} text-right w-24`}>Taxable</th>
                                        {isIgst
                                            ? <th className={`${thClass} text-right w-24`}>IGST</th>
                                            : <>
                                                <th className={`${thClass} text-right w-24`}>CGST</th>
                                                <th className={`${thClass} text-right w-24`}>SGST</th>
                                              </>
                                        }
                                        <th className={`${thClass} text-right w-24`}>Total</th>
                                        <th className={`${thClass} w-10`}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((line, idx) => {
                                        const c = calcLine(line, isIgst);
                                        return (
                                            <tr key={line._key} className="group">
                                                <td className={`${tdClass} text-center text-[var(--cl-text-muted)]`}>{idx + 1}</td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 min-w-[160px] border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                                                        placeholder="Description"
                                                        value={line.description}
                                                        onChange={e => updateLine(line._key, "description", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 w-28 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                                                        placeholder="Part code"
                                                        value={line.part_code}
                                                        onChange={e => updateLine(line._key, "part_code", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 w-24 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                                                        placeholder="HSN"
                                                        value={line.hsn_code}
                                                        onChange={e => updateLine(line._key, "hsn_code", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 w-16 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs text-right"
                                                        min="0"
                                                        step="0.01"
                                                        type="number"
                                                        value={line.quantity}
                                                        onChange={e => updateLine(line._key, "quantity", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 w-20 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs text-right"
                                                        min="0"
                                                        step="0.01"
                                                        type="number"
                                                        value={line.unit_price}
                                                        onChange={e => updateLine(line._key, "unit_price", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 w-16 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs text-right"
                                                        min="0"
                                                        step="0.5"
                                                        type="number"
                                                        value={line.gst_rate}
                                                        onChange={e => updateLine(line._key, "gst_rate", e.target.value)}
                                                    />
                                                </td>
                                                <td className={`${tdClass} text-right tabular-nums`}>{c.taxable.toFixed(2)}</td>
                                                {isIgst
                                                    ? <td className={`${tdClass} text-right tabular-nums`}>{c.igst.toFixed(2)}</td>
                                                    : <>
                                                        <td className={`${tdClass} text-right tabular-nums`}>{c.cgst.toFixed(2)}</td>
                                                        <td className={`${tdClass} text-right tabular-nums`}>{c.sgst.toFixed(2)}</td>
                                                      </>
                                                }
                                                <td className={`${tdClass} text-right tabular-nums font-medium`}>{c.total.toFixed(2)}</td>
                                                <td className={tdClass}>
                                                    <Button
                                                        className="h-6 w-6 p-0 text-[var(--cl-text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100"
                                                        disabled={lines.length <= 1}
                                                        size="icon"
                                                        title="Remove line"
                                                        variant="ghost"
                                                        onClick={() => removeLine(line._key)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <Button
                            className="mt-2 h-7 gap-1.5 px-3 text-xs"
                            size="sm"
                            variant="outline"
                            onClick={addLine}
                        >
                            <Plus className="h-3 w-3" /> Add Line
                        </Button>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                        <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-4 min-w-[260px]">
                            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--cl-text-muted)]">Totals</p>
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between gap-8">
                                    <span className="text-[var(--cl-text-muted)]">Taxable</span>
                                    <span className="tabular-nums">₹{totals.taxable.toFixed(2)}</span>
                                </div>
                                {isIgst ? (
                                    <div className="flex justify-between gap-8">
                                        <span className="text-[var(--cl-text-muted)]">IGST</span>
                                        <span className="tabular-nums">₹{totals.igst.toFixed(2)}</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between gap-8">
                                            <span className="text-[var(--cl-text-muted)]">CGST</span>
                                            <span className="tabular-nums">₹{totals.cgst.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between gap-8">
                                            <span className="text-[var(--cl-text-muted)]">SGST</span>
                                            <span className="tabular-nums">₹{totals.sgst.toFixed(2)}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between gap-8 border-t border-[var(--cl-border)] pt-1.5 font-semibold">
                                    <span>Total</span>
                                    <span className="tabular-nums text-[var(--cl-accent)]">₹{totals.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
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
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-bold text-[var(--cl-text)]">Ready for Delivery</h1>
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
                            {search && (
                                <button
                                    className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--cl-text-muted)] text-[var(--cl-surface)] hover:bg-[var(--cl-text)] focus:outline-none"
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
                    onClick={() => { if (branchId) void loadData(branchId, fromDate, toDate, searchQ, page); }}
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
                                    {["#","Date","Job No","Customer","Mobile","Status","Technician","Amount","Invoice","Action"].map(h => (
                                        <th key={h} className={thClass}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 8 }).map((_, i) => (
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
                            No finalised jobs pending delivery for the selected filters.
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
                                    <th className={`${thClass} text-right`}>Amount</th>
                                    <th className={thClass}>Invoice</th>
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
                                        <td className={`${tdClass} font-mono font-semibold text-[var(--cl-accent)]`}>#{row.job_no}</td>
                                        <td className={tdClass}>{row.customer_name}</td>
                                        <td className={`${tdClass} font-mono text-xs`}>{row.mobile}</td>
                                        <td className={tdClass}>
                                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                                                {row.job_status_name}
                                            </span>
                                        </td>
                                        <td className={tdClass}>{row.technician_name ?? "—"}</td>
                                        <td className={`${tdClass} text-right tabular-nums`}>
                                            {row.amount != null ? `₹${Number(row.amount).toFixed(2)}` : "—"}
                                        </td>
                                        <td className={tdClass}>
                                            {row.has_invoice
                                                ? <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">✓ Invoiced</span>
                                                : <span className="text-xs text-[var(--cl-text-muted)]">—</span>
                                            }
                                        </td>
                                        <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`}>
                                            <Button
                                                className="h-7 px-2 text-xs text-[var(--cl-text-muted)] hover:text-[var(--cl-accent)]"
                                                disabled={loadingDetail}
                                                size="sm"
                                                title={row.has_invoice ? "Edit Invoice" : "Create Invoice"}
                                                variant="ghost"
                                                onClick={() => void handleRowClick(row)}
                                            >
                                                {loadingDetail
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : row.has_invoice ? "Edit" : "Invoice"
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
