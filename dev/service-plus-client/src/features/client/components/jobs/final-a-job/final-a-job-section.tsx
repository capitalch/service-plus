import { useCallback, useEffect, useRef, useState } from "react";
import {
    AlertTriangle, ArrowLeft, CheckCheck, CheckCircle2,
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Eye, Loader2, Paperclip, Plus, RefreshCw, Search, Trash2, X, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectAvailableDivisions, selectCurrentBranch, selectCurrentDivision, selectDefaultGstRate, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobDetailType } from "@/features/client/types/job";
import { isGstDivision } from "@/features/client/types/division";
import type { BrandOption } from "@/features/client/types/model";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import { PartCodeInput, type PartRow } from "../../inventory/part-code-input";
import { JobDetailsModal } from "../job-pipeline/job-details-modal";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import {
    type FinalJobRow,
    type EditableChargeLine,
    emptyChargeLine,
} from "./final-a-job-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubView = "list" | "final";
type GenericQueryData<T> = { genericQuery: T[] | null };

type LoadedPartRow = {
    id:            number;
    part_id:       number;
    brand_id:      number | null;
    part_code:     string;
    part_name:     string;
    uom:           string;
    quantity:      number;
    cost_price:    number | null;
    selling_price: number | null;
    gst_rate:      number | null;
    remarks:       string | null;
};

type EditablePartLine = {
    _key:          string;
    id?:           number;        // present for rows loaded from DB
    brand_id:      number | null;
    part_id:       number | null;
    part_code:     string;
    part_name:     string;
    cost_price:    string;
    selling_price: string;
    sale_pr_gst:   string;
    gst_rate:      string;
    quantity:      number;
    remarks:       string;
};

type AdditionalChargeRow = {
    id:            number;
    charge_name:   string;
    ref_no:        string | null;
    description:   string | null;
    cost_price:    number;
    selling_price: number;
};

// ─── Change Division Modal ────────────────────────────────────────────────────

type ChangeDivisionModalProps = {
    open:              boolean;
    currentDivisionId: number | null;
    divisions:         { id: number; name: string }[];
    onApply:           (id: number) => Promise<void>;
    onClose:           () => void;
};

function ChangeDivisionModal({ open, currentDivisionId, divisions, onApply, onClose }: ChangeDivisionModalProps) {
    const [pending, setPending] = useState<number | null>(currentDivisionId);
    const [saving,  setSaving]  = useState(false);

    useEffect(() => {
        if (open) setPending(currentDivisionId);
    }, [open, currentDivisionId]);

    async function handleApply() {
        if (!pending) return;
        setSaving(true);
        try {
            await onApply(pending);
            onClose();
        } catch {
            // error already toasted by parent
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
            <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                    <DialogTitle>Change Division</DialogTitle>
                </DialogHeader>
                <div className="py-2">
                    <Select
                        disabled={saving}
                        value={pending ? String(pending) : ""}
                        onValueChange={v => setPending(Number(v))}
                    >
                        <SelectTrigger className="w-full text-sm border-[var(--cl-border)] bg-white">
                            <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                        <SelectContent>
                            {divisions.map(d => (
                                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button disabled={saving} variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={!pending || saving} onClick={() => void handleApply()}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1600;

const thClass  = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass  = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";


function emptyPartLine(gstRate = 0): EditablePartLine {
    return { _key: crypto.randomUUID(), brand_id: null, part_id: null, part_code: "", part_name: "", cost_price: "0", selling_price: "0", sale_pr_gst: "0", gst_rate: String(gstRate), quantity: 1, remarks: "" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FinalAJobSection = () => {
    const dbName             = useAppSelector(selectDbName);
    const schema             = useAppSelector(selectSchema);
    const currentBranch      = useAppSelector(selectCurrentBranch);
    const availableDivisions = useAppSelector(selectAvailableDivisions);
    const currentDivision    = useAppSelector(selectCurrentDivision);
    const defaultGstRate     = useAppSelector(selectDefaultGstRate);
    const branchId           = currentBranch?.id ?? null;

    // ── List state ──────────────────────────────────────────────────────────
    const [subView,  setSubView]  = useState<SubView>("list");
    const [search,   setSearch]   = useState("");
    const [searchQ,  setSearchQ]  = useState("");
    const [page,     setPage]     = useState(1);
    const [rows,     setRows]     = useState<FinalJobRow[]>([]);
    const [total,    setTotal]    = useState(0);
    const [loading,  setLoading]  = useState(false);

    const [viewJobId,   setViewJobId]   = useState<number | null>(null);
    const [attachJobId, setAttachJobId] = useState<number | null>(null);
    const [attachJobNo, setAttachJobNo] = useState<string>("");

    // ── Final sub-view state ────────────────────────────────────────────────
    const [selectedJob,        setSelectedJob]        = useState<JobDetailType | null>(null);
    const [selectedRow,        setSelectedRow]        = useState<FinalJobRow | null>(null);
    const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
    const [loadingDetail,      setLoadingDetail]      = useState(false);
    const [submitting,         setSubmitting]         = useState(false);
    const [changeDivOpen,      setChangeDivOpen]      = useState(false);

    // Unified editable parts
    const [partLines,        setPartLines]        = useState<EditablePartLine[]>([]);
    const [deletedPartIds,   setDeletedPartIds]   = useState<number[]>([]);

    // Additional charges (full CRUD)
    const [chargeLines,      setChargeLines]      = useState<EditableChargeLine[]>([]);
    const [deletedChargeIds, setDeletedChargeIds] = useState<number[]>([]);

    // Meta
    const [brands,           setBrands]           = useState<BrandOption[]>([]);
    const [jobConsumeTypeId, setJobConsumeTypeId] = useState<number | null>(null);

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

    // ── Load brands + JOB_CONSUME type once ─────────────────────────────────
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchMeta = async () => {
            try {
                const [brandsRes, txnRes] = await Promise.all([
                    apolloClient.query<GenericQueryData<BrandOption>>({
                        fetchPolicy: "network-only",
                        query:       GRAPHQL_MAP.genericQuery,
                        variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }) },
                    }),
                    apolloClient.query<GenericQueryData<StockTransactionTypeRow>>({
                        fetchPolicy: "network-only",
                        query:       GRAPHQL_MAP.genericQuery,
                        variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STOCK_TRANSACTION_TYPES }) },
                    }),
                ]);
                setBrands(brandsRes.data?.genericQuery ?? []);
                const consume = txnRes.data?.genericQuery?.find(t => t.code === "JOB_CONSUME");
                setJobConsumeTypeId(consume?.id ?? null);
            } catch { /* silent */ }
        };
        void fetchMeta();
    }, [dbName, schema]);

    // ── Load list ───────────────────────────────────────────────────────────
    const loadData = useCallback(async (bid: number, q: string, pg: number, divisionId: number | null = null) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bid, division_id: divisionId, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<FinalJobRow>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_COMPLETED_JOBS_PAGED,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_COMPLETED_JOBS_COUNT, sqlArgs: commonArgs }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(Number(countRes.data?.genericQuery?.[0]?.total ?? 0));
        } catch {
            toast.error(MESSAGES.ERROR_FINAL_JOBS_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId || subView !== "list") return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadData(branchId, searchQ, page, currentDivision?.id ?? null);
    }, [branchId, searchQ, page, loadData, subView, currentDivision]);

    function handleSearchChange(value: string) {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    }

    // ── Open Final sub-view ─────────────────────────────────────────────────
    async function handleOpenFinal(row: FinalJobRow) {
        if (!dbName || !schema) return;
        setLoadingDetail(true);
        try {
            const [jobRes, partsRes, chargesRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobDetailType>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DETAIL, sqlArgs: { id: row.id } }) },
                }),
                apolloClient.query<GenericQueryData<LoadedPartRow>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_PART_USED_BY_JOB, sqlArgs: { job_id: row.id } }) },
                }),
                apolloClient.query<GenericQueryData<AdditionalChargeRow>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_ADDITIONAL_CHARGES_BY_JOB, sqlArgs: { job_id: row.id } }) },
                }),
            ]);

            const job = jobRes.data?.genericQuery?.[0] ?? null;
            if (!job) { toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED); return; }

            const parts   = partsRes.data?.genericQuery   ?? [];
            const charges = chargesRes.data?.genericQuery ?? [];

            setSelectedJob(job);
            setSelectedRow(row);
            setSelectedDivisionId(row.division_id);
            setPartLines(
                parts.length > 0
                    ? parts.map(p => ({
                        _key:          crypto.randomUUID(),
                        id:            p.id,
                        brand_id:      p.brand_id,
                        part_id:       p.part_id,
                        part_code:     p.part_code,
                        part_name:     p.part_name,
                        cost_price:    String(p.cost_price ?? 0),
                        selling_price: String(p.selling_price ?? 0),
                        sale_pr_gst:   ((p.selling_price ?? 0) * (1 + (p.gst_rate ?? 0) / 100)).toFixed(2),
                        gst_rate:      String(p.gst_rate ?? 0),
                        quantity:      Number(p.quantity),
                        remarks:       p.remarks ?? "",
                    }))
                    : [],
            );
            setDeletedPartIds([]);
            setChargeLines(charges.map(c => ({
                _key:          crypto.randomUUID(),
                id:            c.id,
                charge_name:   c.charge_name,
                ref_no:        c.ref_no ?? "",
                description:   c.description ?? "",
                cost_price:    String(c.cost_price),
                selling_price: String(c.selling_price),
            })));
            setDeletedChargeIds([]);
            setSubView("final");
        } catch {
            toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED);
        } finally {
            setLoadingDetail(false);
        }
    }

    function handleBack() {
        setSubView("list");
        setSelectedJob(null);
        setSelectedRow(null);
        setSelectedDivisionId(null);
        setPartLines([]);
        setDeletedPartIds([]);
    }

    // ── Change division (saves to DB + refreshes job detail) ────────────────
    async function handleChangeDivision(newDivisionId: number) {
        if (!dbName || !schema || !selectedJob) return;
        await apolloClient.mutate({
            mutation:  GRAPHQL_MAP.genericUpdate,
            variables: {
                db_name: dbName,
                schema,
                value: encodeObj({ tableName: "job", xData: { id: selectedJob.id, division_id: newDivisionId } }),
            },
        });
        const jobRes = await apolloClient.query<GenericQueryData<JobDetailType>>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DETAIL, sqlArgs: { id: selectedJob.id } }) },
        });
        const refreshed = jobRes.data?.genericQuery?.[0];
        if (refreshed) setSelectedJob(refreshed);
        setSelectedDivisionId(newDivisionId);
        toast.success("Division updated.");
    }

    // ── Part mutations ──────────────────────────────────────────────────────
    function addPartLine() {
        setPartLines(prev => [...prev, emptyPartLine(defaultGstRate)]);
    }

    function removePartLine(key: string, id?: number) {
        setPartLines(prev => prev.filter(l => l._key !== key));
        if (id !== undefined) setDeletedPartIds(prev => [...prev, id]);
    }

    function updatePartLine(key: string, patch: Partial<EditablePartLine>) {
        setPartLines(prev => prev.map(l => l._key === key ? { ...l, ...patch } : l));
    }

    function handlePartSelect(key: string, part: PartRow) {
        updatePartLine(key, {
            part_id:       part.id,
            part_code:     part.part_code,
            part_name:     part.part_name,
            brand_id:      part.brand_id,
            cost_price:    String(part.cost_price ?? 0),
            selling_price: String(part.selling_price ?? 0),
        });
    }

    // ── Charge mutations ────────────────────────────────────────────────────
    function addChargeLine() {
        setChargeLines(prev => [...prev, emptyChargeLine()]);
    }

    function removeChargeLine(key: string, id?: number) {
        setChargeLines(prev => prev.filter(c => c._key !== key));
        if (id !== undefined) setDeletedChargeIds(prev => [...prev, id]);
    }

    function updateChargeLine(key: string, field: keyof EditableChargeLine, value: string) {
        setChargeLines(prev => prev.map(c => c._key === key ? { ...c, [field]: value } : c));
    }

    // ── Save final ──────────────────────────────────────────────────────────
    async function handleSaveFinal() {
        if (!selectedJob || !dbName || !schema || !branchId) return;

        const newParts = partLines.filter(l => !l.id && l.part_id && l.quantity > 0);
        if (newParts.length > 0 && !jobConsumeTypeId) {
            toast.error("Stock transaction type not loaded. Please try again.");
            return;
        }

        setSubmitting(true);
        try {
            const chargeUpsertRows = chargeLines
                .filter(c => c.charge_name.trim())
                .map(c => ({
                    ...(c.id !== undefined ? { id: c.id } : {}),
                    job_id:        selectedJob.id,
                    charge_name:   c.charge_name.trim(),
                    ref_no:        c.ref_no.trim() || null,
                    description:   c.description.trim() || null,
                    cost_price:    parseFloat(c.cost_price)    || 0,
                    selling_price: parseFloat(c.selling_price) || 0,
                }));

            const xDetails: Record<string, unknown>[] = [];

            // Existing part updates (have id)
            const existingUpdates = partLines
                .filter(l => l.id !== undefined && l.part_id)
                .map(l => ({
                    id:            l.id,
                    job_id:        selectedJob.id,
                    part_id:       l.part_id,
                    cost_price:    parseFloat(l.cost_price)    || 0,
                    selling_price: parseFloat(l.selling_price) || 0,
                    gst_rate:      parseFloat(l.gst_rate)      || 0,
                    quantity:      l.quantity,
                    remarks:       l.remarks.trim() || null,
                }));

            // New part inserts (no id, valid part_id) with stock transactions
            const newInserts = newParts.map(l => ({
                job_id:        selectedJob.id,
                part_id:       l.part_id,
                cost_price:    parseFloat(l.cost_price)    || 0,
                selling_price: parseFloat(l.selling_price) || 0,
                gst_rate:      parseFloat(l.gst_rate)      || 0,
                quantity:      l.quantity,
                remarks:       l.remarks.trim() || null,
                xDetails: {
                    tableName: "stock_transaction",
                    fkeyName:  "job_part_used_id",
                    xData: {
                        branch_id:                 branchId,
                        part_id:                   l.part_id,
                        quantity:                  l.quantity,
                        dr_cr:                     "C",
                        transaction_date:          selectedJob.job_date,
                        stock_transaction_type_id: jobConsumeTypeId,
                        remarks:                   l.remarks.trim() || null,
                    },
                },
            }));

            const allPartXData = [...existingUpdates, ...newInserts];
            if (allPartXData.length > 0 || deletedPartIds.length > 0) {
                xDetails.push({
                    tableName:  "job_part_used",
                    fkeyName:   "job_id",
                    ...(deletedPartIds.length > 0 ? { deletedIds: deletedPartIds } : {}),
                    xData:      allPartXData,
                });
            }

            xDetails.push({
                tableName:  "job_additional_charge",
                fkeyName:   "job_id",
                ...(deletedChargeIds.length > 0 ? { deletedIds: deletedChargeIds } : {}),
                xData:      chargeUpsertRows,
            });

            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: encodeObj({
                        tableName: "job",
                        xData:     { id: selectedJob.id, is_final: true, division_id: selectedDivisionId },
                        xDetails,
                    }),
                },
            });

            toast.success("Job marked as final.");
            handleBack();
            if (branchId) void loadData(branchId, searchQ, page, currentDivision?.id ?? null);
        } catch {
            toast.error("Failed to save. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ─── Final sub-view ───────────────────────────────────────────────────────

    if (subView === "final" && selectedJob && selectedRow) {
        const isWarranty = selectedRow.job_type_code === "UNDER_WARRANTY";
        const division   = availableDivisions.find(d => d.id === selectedDivisionId) ?? null;
        const isGst      = isGstDivision(division);

        const partsTotal       = partLines.reduce((sum, l) => { const agg = (parseFloat(l.selling_price) || 0) * l.quantity; return sum + agg * (1 + (parseFloat(l.gst_rate) || 0) / 100); }, 0);
        const profitTotal      = partLines.reduce((sum, l) => sum + ((parseFloat(l.selling_price) || 0) - (parseFloat(l.cost_price) || 0)) * l.quantity, 0);
        const chargesCostTotal = chargeLines.reduce((sum, c) => sum + (parseFloat(c.cost_price) || 0), 0);
        const chargesSaleTotal = chargeLines.reduce((sum, c) => sum + (parseFloat(c.selling_price) || 0), 0);
        const grandTotal       = partsTotal + chargesSaleTotal;

        return (
            <>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                {/* Header */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] py-2">
                    <Button
                        className="h-8 gap-1.5 font-semibold text-[var(--cl-accent)] border border-[var(--cl-accent)] hover:bg-[var(--cl-accent)] hover:text-white transition-colors"
                        disabled={submitting}
                        size="sm"
                        variant="outline"
                        onClick={handleBack}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <div className="flex items-baseline gap-2">
                        <span className="font-mono font-bold text-[var(--cl-accent)] text-sm">#{selectedJob.job_no}</span>
                        <span className="text-sm font-medium text-[var(--cl-text)]">{selectedJob.customer_name}</span>
                    </div>
                    <div className="flex-1" />
                    {/* Division display + change button + refresh */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 leading-none">
                            <span className="text-[10px] uppercase tracking-wider text-[var(--cl-text-muted)]">Division</span>
                            <span className="text-xs font-semibold text-[var(--cl-text)]">
                                {division?.name ?? <span className="italic text-[var(--cl-text-muted)]">No division</span>}
                            </span>
                        </div>
                        <Button
                            className="h-7 px-2 text-xs"
                            size="sm"
                            variant="outline"
                            onClick={() => setChangeDivOpen(true)}
                        >
                            Change Division
                        </Button>
                        <Button
                            className="h-7 w-7 p-0 text-[var(--cl-text-muted)] hover:text-[var(--cl-accent)]"
                            disabled={loadingDetail || submitting}
                            size="icon"
                            title="Refresh"
                            variant="ghost"
                            onClick={() => void handleOpenFinal(selectedRow)}
                        >
                            {loadingDetail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                    {/* GST / Non-GST badge */}
                    <div className={`flex items-center gap-1 px-1.5 py-1 rounded-sm border shadow-sm ${
                        isGst ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                    }`}>
                        {isGst
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            : <XCircle      className="h-3.5 w-3.5 text-red-600" />
                        }
                        <span className={`text-[10.5px] font-bold uppercase tracking-tighter ${isGst ? "text-emerald-700" : "text-red-700"}`}>
                            {isGst ? "GST" : "Non-GST"}
                        </span>
                    </div>
                    {!isWarranty && (
                        <Button
                            className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider disabled:opacity-40"
                            disabled={submitting}
                            onClick={() => void handleSaveFinal()}
                        >
                            {submitting
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <CheckCheck className="h-3.5 w-3.5" />
                            }
                            Save &amp; Mark Final
                        </Button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-5 py-4">

                    {/* Warranty banner */}
                    {isWarranty && (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            This is a warranty job — parts used and additional charges cannot be modified.
                        </div>
                    )}

                    {/* Job Summary */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-4 py-4">
                        <div className="mb-3 flex items-center gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--cl-text-muted)]">Job Summary</p>
                            <button
                                type="button"
                                className="flex items-center gap-1 text-[10px] font-medium text-[var(--cl-accent)] hover:underline cursor-pointer"
                                onClick={() => setViewJobId(selectedJob.id)}
                            >
                                <Eye className="h-3 w-3" />
                                View Details
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                            {([
                                ["Job No",     selectedJob.alternate_job_no ? `${selectedJob.job_no} · Alt: ${selectedJob.alternate_job_no}` : selectedJob.job_no],
                                ["Job Date",   selectedJob.job_date],
                                ["Customer",   selectedJob.customer_name ?? "—"],
                                ["Mobile",     selectedJob.mobile],
                                ["Technician", selectedJob.technician_name ?? "—"],
                                ["Job Type",   selectedJob.job_type_name],
                                ["Status",     selectedJob.job_status_name],
                                ["Amount / Estimate", `${selectedJob.amount != null ? `₹${Number(selectedJob.amount).toFixed(2)}` : "—"}  ·  Est: ${selectedJob.estimate_amount != null ? `₹${Number(selectedJob.estimate_amount).toFixed(2)}` : "—"}`],
                            ] as [string, string][]).map(([lbl, val]) => (
                                <div key={lbl}>
                                    <p className="text-[10px] uppercase tracking-wider text-[var(--cl-text-muted)]">{lbl}</p>
                                    <p className="text-sm font-medium text-[var(--cl-text)]">{val}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Parts Used — unified editable table */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]/60">
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--cl-text-muted)]">Parts Used</p>
                        </div>
                        {!isWarranty && partLines.length === 0 && (
                            <div className="flex items-center justify-center py-6">
                                <Button
                                    className="h-8 gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                    size="sm"
                                    variant="outline"
                                    onClick={addPartLine}
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add Part
                                </Button>
                            </div>
                        )}
                        {partLines.length > 0 && (
                            <div className="flex flex-col gap-1 bg-white">
                                {partLines.map((line, idx) => {
                                    const aggregate = (parseFloat(line.selling_price) || 0) * line.quantity;
                                    const gstRate   = parseFloat(line.gst_rate) || 0;
                                    const amount    = aggregate * (1 + gstRate / 100);
                                    const cgst      = aggregate * gstRate / 200;
                                    const sgst      = cgst;
                                    const igst      = aggregate * gstRate / 100;
                                    const profit    = ((parseFloat(line.selling_price) || 0) - (parseFloat(line.cost_price) || 0)) * line.quantity;
                                    return (
                                        <div key={line._key} className="px-1 py-3 space-y-2.5 bg-[var(--cl-surface)] hover:bg-[var(--cl-surface-2)]/50 transition-colors">
                                            {/* ── Identity row ── */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="w-5 shrink-0 text-center text-xs font-semibold text-[var(--cl-text-muted)]">{idx + 1}</span>
                                                {/* Brand */}
                                                <div className="w-36 shrink-0">
                                                    {isWarranty ? (
                                                        <span className="text-xs text-[var(--cl-text-muted)]">{brands.find(b => b.id === line.brand_id)?.name ?? "—"}</span>
                                                    ) : (
                                                        <Select
                                                            value={line.brand_id ? String(line.brand_id) : ""}
                                                            onValueChange={v => updatePartLine(line._key, { brand_id: Number(v), part_id: null, part_code: "", part_name: "" })}
                                                        >
                                                            <SelectTrigger className="h-7 text-xs bg-transparent border-[var(--cl-border)]">
                                                                <SelectValue placeholder="Brand" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {brands.map(b => (
                                                                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                                {/* Part Code */}
                                                <div className="w-44 shrink-0">
                                                    {isWarranty ? (
                                                        <span className="font-mono text-xs font-semibold text-[var(--cl-accent)]">{line.part_code || "—"}</span>
                                                    ) : (
                                                        <PartCodeInput
                                                            brandId={line.brand_id}
                                                            partCode={line.part_code}
                                                            partId={line.part_id}
                                                            partName={line.part_name}
                                                            selectedBrandId={line.brand_id}
                                                            brandName={brands.find(b => b.id === line.brand_id)?.name}
                                                            showName={false}
                                                            onChange={code => {
                                                                if (!code.trim()) {
                                                                    updatePartLine(line._key, { part_code: "", part_id: null, part_name: "" });
                                                                } else {
                                                                    updatePartLine(line._key, { part_code: code });
                                                                }
                                                            }}
                                                            onClear={() => updatePartLine(line._key, { part_code: "", part_id: null, part_name: "" })}
                                                            onSelect={part => handlePartSelect(line._key, part)}
                                                        />
                                                    )}
                                                </div>
                                                {/* Part Name */}
                                                <div className="min-w-[140px] flex-1">
                                                    <Input
                                                        className="h-7 border-[var(--cl-border)] bg-white text-xs"
                                                        disabled={isWarranty}
                                                        placeholder="Part name"
                                                        value={line.part_name}
                                                        onChange={e => updatePartLine(line._key, { part_name: e.target.value })}
                                                    />
                                                </div>
                                                {/* Remarks */}
                                                <div className="min-w-[120px] flex-1">
                                                    <Input
                                                        className="h-7 border-[var(--cl-border)] bg-white text-xs"
                                                        disabled={isWarranty}
                                                        placeholder="Remarks…"
                                                        value={line.remarks}
                                                        onChange={e => updatePartLine(line._key, { remarks: e.target.value })}
                                                    />
                                                </div>
                                                {/* Actions */}
                                                {!isWarranty && (
                                                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                                        <Button
                                                            className="h-8 w-8 p-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                                            size="icon"
                                                            title="Add row"
                                                            onClick={addPartLine}
                                                        >
                                                            <Plus className="h-4.5 w-4.5" />
                                                        </Button>
                                                        <Button
                                                            className="h-6 w-6 p-0 text-[var(--cl-text-muted)] hover:text-red-500 hover:bg-red-500/10"
                                                            size="icon"
                                                            title="Remove part"
                                                            variant="ghost"
                                                            onClick={() => removePartLine(line._key, line.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            {/* ── Pricing row ── */}
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-7">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--cl-text-muted)] whitespace-nowrap">Cost</span>
                                                    <Input
                                                        className="h-6 w-20 border-[var(--cl-border)] bg-white text-xs text-right"
                                                        disabled={isWarranty}
                                                        min="0" step="0.01" type="number"
                                                        value={line.cost_price}
                                                        onChange={e => updatePartLine(line._key, { cost_price: e.target.value })}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--cl-text-muted)] whitespace-nowrap">GST%</span>
                                                    <Input
                                                        className="h-6 w-14 border-[var(--cl-border)] bg-white text-xs text-right"
                                                        disabled={isWarranty}
                                                        min="0" step="0.01" type="number"
                                                        value={line.gst_rate}
                                                        onChange={e => {
                                                            const gst = e.target.value;
                                                            const sp = parseFloat(line.selling_price) || 0;
                                                            updatePartLine(line._key, {
                                                                gst_rate: gst,
                                                                sale_pr_gst: (sp * (1 + (parseFloat(gst) || 0) / 100)).toFixed(2),
                                                            });
                                                        }}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--cl-text-muted)] whitespace-nowrap">Qty</span>
                                                    <Input
                                                        className={`h-6 w-16 border-[var(--cl-border)] bg-white text-xs text-right ${line.quantity <= 0 ? "border-red-500" : ""}`}
                                                        disabled={isWarranty}
                                                        min={0.01} step="0.01" type="number"
                                                        value={line.quantity}
                                                        onChange={e => updatePartLine(line._key, { quantity: parseFloat(e.target.value) || 0 })}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--cl-text-muted)] whitespace-nowrap">Sale</span>
                                                    <Input
                                                        className="h-6 w-20 border-[var(--cl-border)] bg-white text-xs text-right"
                                                        disabled={isWarranty}
                                                        min="0" step="0.01" type="number"
                                                        value={line.selling_price}
                                                        onChange={e => {
                                                            const sp = e.target.value;
                                                            const gst = parseFloat(line.gst_rate) || 0;
                                                            updatePartLine(line._key, {
                                                                selling_price: sp,
                                                                sale_pr_gst: ((parseFloat(sp) || 0) * (1 + gst / 100)).toFixed(2),
                                                            });
                                                        }}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--cl-text-muted)] whitespace-nowrap">+GST</span>
                                                    <Input
                                                        className="h-6 w-20 border-[var(--cl-border)] bg-white text-xs text-right"
                                                        disabled={isWarranty}
                                                        min="0" step="0.01" type="number"
                                                        value={line.sale_pr_gst}
                                                        onChange={e => {
                                                            const spgst = e.target.value;
                                                            const gst = parseFloat(line.gst_rate) || 0;
                                                            updatePartLine(line._key, {
                                                                sale_pr_gst: spgst,
                                                                selling_price: ((parseFloat(spgst) || 0) / (1 + gst / 100)).toFixed(2),
                                                            });
                                                        }}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </div>
                                                {/* GST breakdown (read-only) */}
                                                <div className="flex items-center gap-3 border-l border-[var(--cl-border)] pl-3">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--cl-text-muted)] whitespace-nowrap">CGST</span>
                                                        <span className="tabular-nums text-xs text-[var(--cl-text)]">{cgst.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--cl-text-muted)] whitespace-nowrap">SGST</span>
                                                        <span className="tabular-nums text-xs text-[var(--cl-text)]">{sgst.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--cl-text-muted)] whitespace-nowrap">IGST</span>
                                                        <span className="tabular-nums text-xs text-[var(--cl-text)]">{igst.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                {/* Computed totals */}
                                                <div className="ml-auto flex items-center gap-4">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-[var(--cl-text-muted)]">Agg</span>
                                                        <span className="tabular-nums text-sm text-[var(--cl-text-muted)]">{aggregate.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-[var(--cl-text-muted)]">Profit</span>
                                                        <span className={`tabular-nums text-sm font-semibold ${profit < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                                            {profit < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(profit))}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 rounded bg-[var(--cl-surface-2)] px-2 py-0.5">
                                                        <span className="text-[10px] text-[var(--cl-text-muted)]">Amt</span>
                                                        <span className="tabular-nums text-sm font-bold text-[var(--cl-text)]">₹{fmtCurrency(amount)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {deletedPartIds.length > 0 && (
                            <p className="px-4 py-2 text-xs text-red-500">
                                {deletedPartIds.length} part{deletedPartIds.length !== 1 ? "s" : ""} marked for removal.
                            </p>
                        )}
                        {partLines.length > 0 && (
                            <div className="flex items-center justify-end gap-6 px-4 py-2.5 border-t-2 border-[var(--cl-border)] bg-[var(--cl-surface-2)]/60">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Profit</span>
                                    <span className={`tabular-nums text-sm font-semibold ${profitTotal < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                        {profitTotal < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(profitTotal))}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Parts Total</span>
                                    <span className="tabular-nums text-base font-bold text-[var(--cl-text)]">₹{fmtCurrency(partsTotal)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Additional Charges */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]/60">
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--cl-text-muted)]">Additional Charges</p>
                        </div>
                        {!isWarranty && chargeLines.length === 0 && (
                            <div className="flex items-center justify-center py-6">
                                <Button
                                    className="h-8 gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                    size="sm"
                                    variant="outline"
                                    onClick={addChargeLine}
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add Charge
                                </Button>
                            </div>
                        )}
                        {chargeLines.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className={thClass}>#</th>
                                            <th className={thClass}>Charge Name <span className="text-red-500">*</span></th>
                                            <th className={thClass}>Ref No</th>
                                            <th className={`${thClass} w-full`}>Description</th>
                                            <th className={`${thClass} text-right`}>Cost Price</th>
                                            <th className={`${thClass} text-right`}>Sale Price <span className="text-red-500">*</span></th>
                                            {!isWarranty && <th className={thClass}></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chargeLines.map((c, idx) => (
                                            <tr key={c._key} className="group">
                                                <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{idx + 1}</td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 min-w-[140px] border-[var(--cl-border)] bg-white text-xs"
                                                        disabled={isWarranty}
                                                        placeholder="Charge name"
                                                        value={c.charge_name}
                                                        onChange={e => updateChargeLine(c._key, "charge_name", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 w-28 border-[var(--cl-border)] bg-white text-xs"
                                                        disabled={isWarranty}
                                                        placeholder="Ref no"
                                                        value={c.ref_no}
                                                        onChange={e => updateChargeLine(c._key, "ref_no", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 min-w-[160px] border-[var(--cl-border)] bg-white text-xs"
                                                        disabled={isWarranty}
                                                        placeholder="Description"
                                                        value={c.description}
                                                        onChange={e => updateChargeLine(c._key, "description", e.target.value)}
                                                    />
                                                </td>
                                                <td className={`${tdClass} text-right`}>
                                                    <div className="flex justify-end">
                                                        <Input
                                                            className="h-7 w-24 border-[var(--cl-border)] bg-white text-xs text-right"
                                                            disabled={isWarranty}
                                                            min="0"
                                                            step="0.01"
                                                            type="number"
                                                            value={c.cost_price}
                                                            onChange={e => updateChargeLine(c._key, "cost_price", e.target.value)}
                                                        />
                                                    </div>
                                                </td>
                                                <td className={`${tdClass} text-right`}>
                                                    <div className="flex justify-end">
                                                        <Input
                                                            className="h-7 w-24 border-[var(--cl-border)] bg-white text-xs text-right"
                                                            disabled={isWarranty}
                                                            min="0"
                                                            step="0.01"
                                                            type="number"
                                                            value={c.selling_price}
                                                            onChange={e => updateChargeLine(c._key, "selling_price", e.target.value)}
                                                        />
                                                    </div>
                                                </td>
                                                {!isWarranty && (
                                                    <td className={`${tdClass} px-1 align-middle`}>
                                                        <div className="flex items-center gap-1.5">
                                                            <Button
                                                                className="h-8 w-8 p-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                                                size="icon"
                                                                title="Add row"
                                                                onClick={addChargeLine}
                                                            >
                                                                <Plus className="h-4.5 w-4.5" />
                                                            </Button>
                                                            <Button
                                                                className="h-6 w-6 p-0 text-[var(--cl-text-muted)] hover:text-red-500 hover:bg-red-500/10"
                                                                size="icon"
                                                                title="Remove charge"
                                                                variant="ghost"
                                                                onClick={() => removeChargeLine(c._key, c.id)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-[var(--cl-surface-2)]/60">
                                            <td colSpan={4} className="p-3 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] text-right border-t-2 border-[var(--cl-border)]">Total</td>
                                            <td className="p-3 text-right border-t-2 border-[var(--cl-border)]">
                                                <span className="tabular-nums text-sm font-semibold text-[var(--cl-text)]">₹{fmtCurrency(chargesCostTotal)}</span>
                                            </td>
                                            <td className="p-3 text-right border-t-2 border-[var(--cl-border)]">
                                                <span className="tabular-nums text-sm font-bold text-[var(--cl-text)]">₹{fmtCurrency(chargesSaleTotal)}</span>
                                            </td>
                                            {!isWarranty && <td className="border-t-2 border-[var(--cl-border)]" />}
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Grand Summary */}
                    <div className="rounded-lg border-2 border-[var(--cl-accent)]/30 bg-[var(--cl-surface)] overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--cl-text-muted)]">Grand Total</p>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--cl-text-muted)]">Parts</span>
                                    <span className="tabular-nums text-sm font-semibold text-[var(--cl-text)]">₹{fmtCurrency(partsTotal)}</span>
                                </div>
                                <span className="text-[var(--cl-text-muted)]">+</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--cl-text-muted)]">Charges</span>
                                    <span className="tabular-nums text-sm font-semibold text-[var(--cl-text)]">₹{fmtCurrency(chargesSaleTotal)}</span>
                                </div>
                                <span className="text-[var(--cl-text-muted)]">=</span>
                                <div className="flex items-center gap-2 rounded bg-[var(--cl-accent)]/10 px-3 py-1">
                                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--cl-accent)]">Total</span>
                                    <span className="tabular-nums text-lg font-bold text-[var(--cl-accent)]">₹{fmtCurrency(grandTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </motion.div>
            {viewJobId !== null && (
                <JobDetailsModal jobId={viewJobId} onClose={() => setViewJobId(null)} />
            )}

            <ChangeDivisionModal
                currentDivisionId={selectedDivisionId}
                divisions={availableDivisions}
                open={changeDivOpen}
                onApply={handleChangeDivision}
                onClose={() => setChangeDivOpen(false)}
            />
            </>
        );
    }

    // ─── List view ────────────────────────────────────────────────────────────

    return (
        <>
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
                        <h1 className="text-lg font-bold text-[var(--cl-text)]">Final a Job</h1>
                        <span className="text-xs text-[var(--cl-text-muted)]">
                            {loading ? "Loading…" : `(${total})`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-1 bg-[var(--cl-surface-2)]/30">
                <div className="relative flex-1 sm:max-w-lg">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                    <Input
                        className="h-8 border-[var(--cl-border)] bg-white pl-8 pr-8 text-xs"
                        placeholder="Job no, alt job no, customer, mobile, email, city, technician, serial no, device…"
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
                    className="ml-auto h-8 px-2.5 text-xs"
                    disabled={loading || !branchId}
                    size="sm"
                    variant="outline"
                    onClick={() => { if (branchId) void loadData(branchId, searchQ, page, currentDivision?.id ?? null); }}
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
                                    {["#", "Date", "Job No", "Customer", "Mobile", "Device Details", "Job Type", "Amount", "Actions"].map(h => (
                                        <th key={h} className={thClass}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 9 }).map((__, j) => (
                                            <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-[var(--cl-border)]" /></td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                            No Completed OK jobs found.
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
                                    <th className={`${thClass} w-40`}>Device Details</th>
                                    <th className={thClass}>Job Type</th>
                                    <th className={`${thClass} text-right`}>Amount</th>
                                    <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Actions</th>
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

                                        {/* Date + division badge */}
                                        <td className={`${tdClass} whitespace-nowrap`}>
                                            <div className="flex flex-col gap-0.5">
                                                <span>{row.job_date}</span>
                                                {row.division_id && (() => {
                                                    const dv = availableDivisions.find(d => d.id === row.division_id);
                                                    return dv ? (
                                                        <span className="font-mono text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 rounded px-1 py-0.5 w-fit">
                                                            {dv.code}
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </td>

                                        {/* Job No + badges */}
                                        <td className={tdClass}>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="font-mono font-semibold text-[var(--cl-accent)]">
                                                    #{row.job_no}
                                                    {row.is_final && (
                                                        <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 rounded px-1 py-0.5">FINAL</span>
                                                    )}
                                                </div>
                                                {row.alternate_job_no && (
                                                    <span className="text-[10px] text-[var(--cl-text-muted)]">Alt: {row.alternate_job_no}</span>
                                                )}
                                                {row.batch_no != null && (
                                                    <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400 w-fit bg-violet-50 dark:bg-violet-950/40 rounded px-1 py-0.5">Batch #{row.batch_no}</span>
                                                )}
                                                {row.file_count > 0 && (
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 cursor-pointer bg-blue-50 dark:bg-blue-950/40 rounded px-1.5 py-0.5 w-fit border-0 transition-colors"
                                                        onClick={e => { e.stopPropagation(); setAttachJobId(row.id); setAttachJobNo(row.job_no); }}
                                                    >
                                                        <Paperclip className="h-2.5 w-2.5" />
                                                        <span>{row.file_count} File{row.file_count !== 1 ? "s" : ""}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>

                                        <td className={tdClass}>{row.customer_name}</td>
                                        <td className={`${tdClass} font-mono text-xs`}>{row.mobile}</td>

                                        {/* Device details */}
                                        <td className={`${tdClass} max-w-[10rem]`}>
                                            <div className="flex flex-col gap-0.5">
                                                {row.device_details && (
                                                    <span className="text-xs leading-snug">{row.device_details}</span>
                                                )}
                                                {row.serial_no && (
                                                    <span className="font-mono text-[10px] text-[var(--cl-text-muted)]">S/N: {row.serial_no}</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className={tdClass}>
                                            <span className="text-xs text-[var(--cl-text-muted)]">{row.job_type_name}</span>
                                        </td>

                                        <td className={`${tdClass} text-right tabular-nums`}>
                                            {row.amount != null ? `₹${Number(row.amount).toFixed(2)}` : "—"}
                                        </td>

                                        {/* Actions */}
                                        <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`}>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    className="h-7 w-7 p-0 text-[var(--cl-text-muted)] hover:text-[var(--cl-accent)]"
                                                    size="icon"
                                                    title="View job details"
                                                    variant="ghost"
                                                    onClick={() => setViewJobId(row.id)}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    className="h-7 gap-1 px-2 text-xs font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950/30"
                                                    disabled={loadingDetail}
                                                    size="sm"
                                                    title="Finalise this job"
                                                    variant="outline"
                                                    onClick={() => void handleOpenFinal(row)}
                                                >
                                                    {loadingDetail
                                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                                        : <CheckCheck className="h-3 w-3" />
                                                    }
                                                    Final
                                                </Button>
                                            </div>
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
                        {total === 0 ? "No jobs" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} (Page ${page} of ${totalPages})`}
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

        {viewJobId !== null && (
            <JobDetailsModal jobId={viewJobId} onClose={() => setViewJobId(null)} />
        )}

        {attachJobId !== null && (
            <JobAttachDialog
                jobId={attachJobId}
                jobNo={attachJobNo}
                onClose={() => { setAttachJobId(null); setAttachJobNo(""); }}
            />
        )}
        </>
    );
};
