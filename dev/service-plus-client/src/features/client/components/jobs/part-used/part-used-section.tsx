import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Loader2, RefreshCw, RotateCcw, Save, Search, Trash2, X} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { partUsedFormSchema, type PartUsedFormValues, getPartUsedDefaultValues, type JobSearchRow } from "./part-used-schema";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { ViewModeToggle, type ViewMode } from "@/features/client/components/inventory/view-mode-toggle";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";

import { NewPartUsedForm } from "./new-part-used-form";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type BranchType = { id: number; name: string; code: string };

type ConsumptionRow = {
    id:          number;
    job_no:      string;
    job_date:    string;
    part_code:   string;
    part_name:   string;
    uom:         string;
    quantity:    number;
    remarks:     string | null;
    branch_name: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentMonthRange() {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const last  = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
        from: `${year}-${month}-01`,
        to:   `${year}-${month}-${String(last).padStart(2, "0")}`,
    };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1200;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const PartUsedSection = () => {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId     = globalBranch?.id ?? null;

    const form = useForm<PartUsedFormValues>({
        defaultValues: getPartUsedDefaultValues(),
        mode: "onChange",
        resolver: zodResolver(partUsedFormSchema) as any,
    });

    const { from: defaultFrom, to: defaultTo } = currentMonthRange();

    const [mode, setMode] = useState<ViewMode>("new");

    // Metadata
    const [txnTypes, setTxnTypes] = useState<StockTransactionTypeRow[]>([]);

    // View filters
    const [branches,       setBranches]       = useState<BranchType[]>([]);
    const [selectedBranch, setSelectedBranch] = useState("");
    const [fromDate,       setFromDate]       = useState(defaultFrom);
    const [toDate,         setToDate]         = useState(defaultTo);
    const [search,         setSearch]         = useState("");
    const [searchQ,        setSearchQ]        = useState("");

    // View data
    const [rows,    setRows]    = useState<ConsumptionRow[]>([]);
    const [total,   setTotal]   = useState(0);
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(false);

    // Delete
    const [deleteRow,  setDeleteRow]  = useState<ConsumptionRow | null>(null);
    const [deleting,   setDeleting]   = useState(false);

    // Form
    const [resetKey,   setResetKey]   = useState(0);
    const [linesValid, setLinesValid] = useState(false);
    const [selectedJob, setSelectedJob] = useState<JobSearchRow | null>(null);

    const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = useState(0);

    const recalc = useCallback(() => {
        if (scrollWrapperRef.current) {
            const rect = scrollWrapperRef.current.getBoundingClientRect();
            setMaxHeight(Math.max(200, window.innerHeight - rect.top - 60));
        }
    }, []);

    useEffect(() => {
        if (mode === "view") {
            const timer = setTimeout(recalc, 100);
            window.addEventListener("resize", recalc);
            return () => { clearTimeout(timer); window.removeEventListener("resize", recalc); };
        }
    }, [mode, recalc, rows.length]);

    // Load metadata once
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchMeta = async () => {
            try {
                const [branchRes, txnRes] = await Promise.all([
                    apolloClient.query<GenericQueryData<BranchType>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANCHES }) },
                    }),
                    apolloClient.query<GenericQueryData<StockTransactionTypeRow>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STOCK_TRANSACTION_TYPES }) },
                    }),
                ]);
                const fetched = branchRes.data?.genericQuery ?? [];
                setBranches(fetched);
                if (fetched.length > 0) setSelectedBranch(String(fetched[0].id));
                setTxnTypes(txnRes.data?.genericQuery ?? []);
            } catch { toast.error(MESSAGES.ERROR_BRANCH_LOAD_FAILED); }
        };
        void fetchMeta();
    }, [dbName, schema]);

    // Load view data
    const loadData = useCallback(async (
        branchIdNum: number, from: string, to: string, q: string, pg: number,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: branchIdNum, from_date: from, to_date: to, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<ConsumptionRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_PARTS_CONSUMPTION,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_PARTS_CONSUMPTION_COUNT,
                            sqlArgs: commonArgs,
                        }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch { toast.error(MESSAGES.ERROR_CONSUMPTION_LOAD_FAILED); }
        finally { setLoading(false); }
    }, [dbName, schema]);

    useEffect(() => {
        if (!selectedBranch || mode !== "view") return;
        void loadData(Number(selectedBranch), fromDate, toDate, searchQ, page);
    }, [selectedBranch, fromDate, toDate, searchQ, page, loadData, mode]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    };

    const handleDelete = async () => {
        if (!deleteRow || !dbName || !schema) return;
        setDeleting(true);
        try {
            const payload = graphQlUtils.buildGenericUpdateValue({
                tableName:  "job_part_used",
                deletedIds: [deleteRow.id],
                xData:      {},
            });
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: payload },
            });
            toast.success(MESSAGES.SUCCESS_PART_USED_DELETED);
            setDeleteRow(null);
            if (selectedBranch) void loadData(Number(selectedBranch), fromDate, toDate, searchQ, page);
        } catch { toast.error(MESSAGES.ERROR_PART_USED_DELETE_FAILED); }
        finally { setDeleting(false); }
    };

    const handleReset = () => {
        form.reset(getPartUsedDefaultValues());
        setLinesValid(false);
        setSelectedJob(null);
        setResetKey(k => k + 1);
    };

    const executeSave = async (values: PartUsedFormValues) => {
        if (!branchId || !dbName || !schema || !selectedJob) return;

        const consumeTypeId = txnTypes.find(t => t.code === "JOB_CONSUME")?.id;
        if (!consumeTypeId) {
            toast.error(MESSAGES.ERROR_PART_USED_SAVE_FAILED);
            return;
        }

        const newLines = values.newLines ?? [];
        const deletedIds = values.deletedIds ?? [];
        const validNewLines = newLines.filter(l => l.part_id && l.quantity > 0);

        const xData = validNewLines.map(line => ({
            job_id:   values.job_id,
            part_id:  line.part_id,
            quantity: line.quantity,
            remarks:  line.remarks?.trim() || null,
            xDetails: {
                tableName: "stock_transaction",
                fkeyName:  "job_part_used_id",
                xData: {
                    branch_id:                 branchId,
                    part_id:                   line.part_id,
                    quantity:                  line.quantity,
                    dr_cr:                     "C",
                    transaction_date:          selectedJob.job_date,
                    stock_transaction_type_id: consumeTypeId,
                    remarks:                   line.remarks?.trim() || null,
                },
            },
        }));

        const payload = graphQlUtils.buildGenericUpdateValue({
            tableName:  "job_part_used",
            deletedIds: deletedIds.length > 0 ? deletedIds : undefined,
            xData:      xData,
        });

        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: payload },
            });
            toast.success(MESSAGES.SUCCESS_PART_USED_SAVED);
            handleReset();
            setMode("view");
            if (selectedBranch) void loadData(Number(selectedBranch), fromDate, toDate, searchQ, 1);
        } catch {
            toast.error(MESSAGES.ERROR_PART_USED_SAVE_FAILED);
        }
    };


    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
                        <RotateCcw className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-bold text-[var(--cl-text)]">
                            Part Used (Job)
                            {mode === "new" && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)]">— New</span>}
                            {mode === "view" && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)]">— View</span>}
                        </h1>
                        {mode === "view" && (
                            <span className="text-xs text-[var(--cl-text-muted)]">
                                {loading ? "Loading…" : `(${total})`}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1" />

                <ViewModeToggle
                    isEditing={false}
                    mode={mode}
                    onNewClick={() => { handleReset(); setMode("new"); }}
                    onViewClick={() => {
                        handleReset();
                        setMode("view");
                        if (selectedBranch) void loadData(Number(selectedBranch), fromDate, toDate, searchQ, page);
                    }}
                />

                    <div className={`flex items-center gap-2 ${mode !== "new" ? "hidden md:flex md:invisible pointer-events-none" : ""}`}>
                        <Button
                            className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]"
                            disabled={form.formState.isSubmitting}
                            variant="ghost"
                            onClick={handleReset}
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${form.formState.isSubmitting ? "animate-spin" : ""}`} />
                            Reset
                        </Button>
                        <Button
                            className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest transition-all disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                            disabled={!form.formState.isValid || !linesValid || form.formState.isSubmitting}
                            onClick={form.handleSubmit(executeSave)}
                        >
                            {form.formState.isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Save
                        </Button>
                    </div>


            </div>

            {mode === "new" ? (
                <div className="flex-1 overflow-y-auto">
                    <FormProvider {...form}>
                        <NewPartUsedForm
                            key={resetKey}
                            branchId={branchId}
                            onLinesValidChange={setLinesValid}
                            onJobSelect={setSelectedJob}
                            form={form}
                        />
                    </FormProvider>
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[var(--cl-surface-2)]/30">
                        <div className="w-48">
                            <Select
                                disabled={branches.length === 0 || loading}
                                value={selectedBranch}
                                onValueChange={v => { setSelectedBranch(v); setPage(1); }}
                            >
                                <SelectTrigger className="h-8 bg-[var(--cl-surface)] text-xs">
                                    <SelectValue placeholder="Branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map(b => (
                                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-1">
                            <Input className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs" disabled={loading} type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} />
                            <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                            <Input className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs" disabled={loading} type="date" value={toDate}   onChange={e => { setToDate(e.target.value); setPage(1); }} />
                        </div>
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                            <Input className="h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-8 text-xs" disabled={loading} placeholder="Job no, part code or part name…" value={search} onChange={e => handleSearchChange(e.target.value)} />
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
                        <Button className="h-8 px-2.5 text-xs" disabled={loading || !selectedBranch} size="sm" variant="outline" onClick={() => { if (selectedBranch) void loadData(Number(selectedBranch), fromDate, toDate, searchQ, page); }}>
                            <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                        </Button>
                    </div>

                    {/* Grid */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm mx-4">
                        <div ref={scrollWrapperRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: maxHeight || undefined }}>
                            {loading ? (
                                <table className="min-w-full border-collapse">
                                    <thead><tr>{["#","Job No","Date","Part Code","Part Name","UOM","Qty","Remarks","Actions"].map(h => <th key={h} className={thClass}>{h}</th>)}</tr></thead>
                                    <tbody>{Array.from({ length: 8 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">{Array.from({ length: 9 }).map((__, j) => (
                                            <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-[var(--cl-border)]" /></td>
                                        ))}</tr>
                                    ))}</tbody>
                                </table>
                            ) : rows.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                                    No consumption records found for the selected filters.
                                </div>
                            ) : (
                                <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr>
                                            {["#","Job No","Date","Part Code","Part Name","UOM"].map(h => <th key={h} className={thClass}>{h}</th>)}
                                            <th className={`${thClass} text-right`}>Qty Used</th>
                                            <th className={thClass}>Remarks</th>
                                            <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                        {rows.map((row, idx) => (
                                            <tr key={row.id} className="group transition-colors hover:bg-[var(--cl-accent)]/5">
                                                <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                                <td className={`${tdClass} font-mono font-medium text-[var(--cl-accent)]`}>{row.job_no}</td>
                                                <td className={tdClass}>{row.job_date}</td>
                                                <td className={`${tdClass} font-mono`}>{row.part_code}</td>
                                                <td className={`${tdClass} font-medium`}>{row.part_name}</td>
                                                <td className={tdClass}>
                                                    <span className="rounded bg-[var(--cl-surface-3)] px-2 py-0.5 text-xs font-semibold">{row.uom}</span>
                                                </td>
                                                <td className={`${tdClass} text-right font-medium`}>{Number(row.quantity).toFixed(2)}</td>
                                                <td className={`${tdClass} text-xs text-[var(--cl-text-muted)] italic`}>{row.remarks || "—"}</td>
                                                <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`}>
                                                    <Button
                                                        className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10"
                                                        size="icon"
                                                        title="Delete"
                                                        variant="ghost"
                                                        onClick={() => setDeleteRow(row)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2">
                            <span className="text-xs text-[var(--cl-text-muted)]">Page {page} of {totalPages} · {total} records</span>
                            <div className="flex items-center gap-1">
                                <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="First"    onClick={() => setPage(1)}><ChevronsLeftIcon  className="h-4 w-4" /></Button>
                                <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="Previous" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon  className="h-4 w-4" /></Button>
                                <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Next" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                                <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Last" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </div>

                    {/* Delete confirmation dialog */}
                    <Dialog open={deleteRow !== null} onOpenChange={open => { if (!open && !deleting) setDeleteRow(null); }}>
                        <DialogContent aria-describedby={undefined} className="sm:max-w-sm !bg-[var(--cl-surface)] text-[var(--cl-text)]">
                            <DialogHeader>
                                <DialogTitle>Delete Part Usage</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-[var(--cl-text-muted)]">
                                Delete <span className="font-semibold text-[var(--cl-text)]">{deleteRow?.part_name}</span> ({deleteRow?.quantity} {deleteRow?.uom}) from job <span className="font-mono font-semibold text-[var(--cl-accent)]">{deleteRow?.job_no}</span>?
                                <br /><br />
                                This will also remove the stock transaction and restore the stock balance.
                            </p>
                            <DialogFooter>
                                <Button disabled={deleting} variant="outline" onClick={() => setDeleteRow(null)}>Cancel</Button>
                                <Button disabled={deleting} variant="destructive" onClick={() => void handleDelete()}>
                                    {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </motion.div>
    );
};
