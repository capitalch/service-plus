import { useCallback, useEffect, useRef, useState } from "react";
import {FileText, Loader2, MoreHorizontal, Pencil, RefreshCw, Save, Search, Trash2, ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon, X} from "lucide-react";
import { ViewModeToggle, type ViewMode } from "@/features/client/components/inventory/view-mode-toggle";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { currentFinancialYearRange } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { BrandOption } from "@/features/client/types/model";
import { BrandSelect } from "@/features/client/components/inventory/brand-select";
import type { Branch } from "@/types/db-schema-service";
import type { StockBranchTransferType } from "@/features/client/types/branch-transfer";
import { branchTransferFormSchema, type BranchTransferFormValues, getBranchTransferDefaultValues, getInitialTransferLine } from "./branch-transfer-schema";
import { NewBranchTransfer } from "./new-branch-transfer";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1200;

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const BranchTransferSection = () => {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId     = globalBranch?.id ?? null;

    const { from: defaultFrom, to: defaultTo } = currentFinancialYearRange();

    // Filter state
    const [fromDate,      setFromDate]      = useState(defaultFrom);
    const [toDate,        setToDate]        = useState(defaultTo);
    const [search,        setSearch]        = useState("");
    const [searchQ,       setSearchQ]       = useState("");
    const [selectedBrand, setSelectedBrand] = useState("");

    // Mode
    const [mode, setMode] = useState<ViewMode>("new");

    // Metadata
    const [brands,   setBrands]   = useState<BrandOption[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    // Data
    const [transfers, setTransfers] = useState<StockBranchTransferType[]>([]);
    const [total,     setTotal]     = useState(0);
    const [page,      setPage]      = useState(1);
    const [loading,   setLoading]   = useState(false);

    // Dialog state
    const [deleteId,  setDeleteId]  = useState<number | null>(null);
    const [deleting,  setDeleting]  = useState(false);

    // Edit state
    const [editTransfer, setEditTransfer] = useState<StockBranchTransferType | null>(null);

    // Lines lifted from child
    const selectedBrandId = selectedBrand ? Number(selectedBrand) : null;
    const [originalLineIds, setOriginalLineIds] = useState<number[]>([]);
    const [linesValid,      setLinesValid]      = useState(false);

    // Form
    const form = useForm<BranchTransferFormValues>({
        defaultValues: getBranchTransferDefaultValues(),
        mode:          "onChange",
        resolver:      zodResolver(branchTransferFormSchema) as any,
    });

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);

    const [maxHeight, setMaxHeight] = useState<number>(0);

    const recalc = useCallback(() => {
        if (scrollWrapperRef.current) {
            const rect = scrollWrapperRef.current.getBoundingClientRect();
            const availableHeight = window.innerHeight - rect.top - 60;
            setMaxHeight(Math.max(200, availableHeight));
        }
    }, []);

    useEffect(() => {
        if (mode === "view") {
            const timer = setTimeout(recalc, 100);
            window.addEventListener("resize", recalc);
            return () => {
                clearTimeout(timer);
                window.removeEventListener("resize", recalc);
            };
        }
    }, [mode, recalc, transfers.length]);

    // Load brands and branches on mount
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchMeta = async () => {
            try {
                const [brandRes, branchRes] = await Promise.all([
                    apolloClient.query<GenericQueryData<BrandOption>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
                        },
                    }),
                    apolloClient.query<GenericQueryData<Branch>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({
                                sqlId: SQL_MAP.GET_ALL_BRANCHES,
                                sqlArgs: { is_active: true }
                            }),
                        },
                    }),
                ]);
                const brandList = brandRes.data?.genericQuery ?? [];
                setBrands(brandList);
                if (brandList.length === 1) setSelectedBrand(String(brandList[0].id));
                setBranches(branchRes.data?.genericQuery ?? []);
            } catch {
                toast.error("Failed to load metadata.");
            }
        };
        void fetchMeta();
    }, [dbName, schema]);

    // Load transfers (paged)
    const loadData = useCallback(async (
        bId: number, from: string, to: string, q: string, pg: number,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bId, from_date: from, to_date: to, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<StockBranchTransferType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_STOCK_BRANCH_TRANSFERS_PAGED,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_STOCK_BRANCH_TRANSFERS_COUNT,
                            sqlArgs: commonArgs,
                        }),
                    },
                }),
            ]);
            setTransfers(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch {
            toast.error(MESSAGES.ERROR_TRANSFER_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (mode !== "view" || !branchId) return;
        void loadData(Number(branchId), fromDate, toDate, searchQ, page);
    }, [branchId, fromDate, toDate, searchQ, page, mode, loadData]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPage(1);
            setSearchQ(value);
        }, DEBOUNCE_MS);
    };

    const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
        setter(v);
        setPage(1);
    };

    const handleReset = () => {
        form.reset({ ...getBranchTransferDefaultValues(), lines: [getInitialTransferLine(selectedBrandId)] });
        setOriginalLineIds([]);
        setEditTransfer(null);
    };

    // Save
    const executeSave = async (values: BranchTransferFormValues) => {
        if (!linesValid) {
            toast.error(MESSAGES.ERROR_TRANSFER_LINE_FIELDS_REQUIRED);
            return;
        }
        if (!branchId || !values.to_branch_id || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_TRANSFER_CREATE_FAILED);
            return;
        }

        try {
            const txnRes = await apolloClient.query<GenericQueryData<{ id: number; code: string }>>({
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STOCK_TRANSACTION_TYPES }),
                },
            });
            const tTypes = txnRes.data?.genericQuery ?? [];
            const outType = tTypes.find(t => t.code === "BRANCH_TRANSFER_OUT")?.id;
            const inType  = tTypes.find(t => t.code === "BRANCH_TRANSFER_IN")?.id;

            if (!outType || !inType) {
                toast.error("Required stock transaction types (BRANCH_TRANSFER_IN/OUT) not found.");
                return;
            }

            const linePayload = (values.lines ?? []).map(line => ({
                part_id: line.part_id,
                qty:     line.qty,
                remarks: line.remarks?.trim() || null,
                xDetails: [{
                    tableName: "stock_transaction",
                    fkeyName:  "stock_branch_transfer_line_id",
                    xData: [
                        {
                            branch_id:                 branchId,
                            part_id:                   line.part_id,
                            qty:                       line.qty,
                            dr_cr:                     "C",
                            transaction_date:          values.transfer_date,
                            stock_transaction_type_id: outType,
                        },
                        {
                            branch_id:                 Number(values.to_branch_id),
                            part_id:                   line.part_id,
                            qty:                       line.qty,
                            dr_cr:                     "D",
                            transaction_date:          values.transfer_date,
                            stock_transaction_type_id: inType,
                        },
                    ],
                }],
            }));

            const headerFields = {
                transfer_date:  values.transfer_date,
                from_branch_id: branchId,
                to_branch_id:   Number(values.to_branch_id),
                ref_no:         values.ref_no?.trim() || null,
                remarks:        values.remarks?.trim() || null,
            };

            if (editTransfer) {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "stock_branch_transfer",
                    xData: {
                        id: editTransfer.id,
                        ...headerFields,
                        xDetails: {
                            tableName:  "stock_branch_transfer_line",
                            fkeyName:   "stock_branch_transfer_id",
                            deletedIds: originalLineIds,
                            xData:      linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_TRANSFER_UPDATED);
                setEditTransfer(null);
                setMode("view");
                if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, 1);
            } else {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "stock_branch_transfer",
                    xData: {
                        ...headerFields,
                        xDetails: {
                            tableName: "stock_branch_transfer_line",
                            fkeyName:  "stock_branch_transfer_id",
                            xData:     linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_TRANSFER_CREATED);
            }
            form.reset({ ...getBranchTransferDefaultValues(), lines: [getInitialTransferLine(selectedBrandId)] });
            setOriginalLineIds([]);
        } catch (err) {
            console.error(err);
            toast.error(editTransfer ? MESSAGES.ERROR_TRANSFER_UPDATE_FAILED : MESSAGES.ERROR_TRANSFER_CREATE_FAILED);
        }
    };

    // Delete
    const handleDelete = async () => {
        if (!deleteId || !dbName || !schema || !branchId) return;
        setDeleting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        deletedIds: [deleteId],
                        tableName:  "stock_branch_transfer",
                        xData:      {},
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_TRANSFER_DELETED);
            setDeleteId(null);
            void loadData(Number(branchId), fromDate, toDate, searchQ, page);
        } catch {
            toast.error(MESSAGES.ERROR_TRANSFER_DELETE_FAILED);
        } finally {
            setDeleting(false);
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
                {/* Title */}
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2 overflow-hidden">
                        <h1 className="text-lg font-bold text-[var(--cl-text)] truncate">
                            Branch Transfer
                            {mode === 'new' && !editTransfer && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)] whitespace-nowrap">— New</span>}
                            {mode === 'new' &&  editTransfer && <span className="ml-2 text-sm font-medium text-amber-500 whitespace-nowrap">— Edit</span>}
                            {mode === 'view' && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)] whitespace-nowrap">— View</span>}
                        </h1>
                        {mode === 'view' && (
                            <span className="text-xs text-[var(--cl-text-muted)] whitespace-nowrap">
                                {loading ? "Loading…" : `(${total})`}
                            </span>
                        )}
                    </div>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Mode Toggle */}
                <ViewModeToggle
                    mode={mode}
                    isEditing={!!editTransfer}
                    onNewClick={handleReset}
                    onViewClick={() => { setMode("view"); if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, page); }}
                />

                {/* Brand */}
                <div className={mode !== "new" ? "hidden md:flex md:invisible pointer-events-none" : ""}>
                    <BrandSelect
                        brands={brands}
                        value={selectedBrand}
                        onValueChange={setSelectedBrand}
                        disabled={brands.length === 0 || loading}
                        highlightEmpty={mode === "new" && !selectedBrand}
                    />
                </div>

                {/* Reset · Save — invisible in view mode */}
                <div className={`flex items-center gap-2 ${mode !== 'new' ? 'hidden md:flex md:invisible pointer-events-none' : ''}`}>
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]"
                        disabled={form.formState.isSubmitting}
                        variant="ghost"
                        onClick={handleReset}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${form.formState.isSubmitting ? 'animate-spin' : ''}`} />
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

            {mode === 'new' ? (
                <FormProvider {...form}>
                    <NewBranchTransfer
                        branchId={branchId}
                        branches={branches}
                        brandName={brands.find(b => String(b.id) === selectedBrand)?.name}
                        editTransfer={editTransfer}
                        onLinesValidChange={setLinesValid}
                        selectedBrandId={selectedBrandId}
                        setOriginalLineIds={setOriginalLineIds}
                        form={form}
                    />
                </FormProvider>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[var(--cl-surface-2)]/30">
                        <div className="flex items-center gap-1">
                            <Input
                                className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                                disabled={loading}
                                type="date"
                                value={fromDate}
                                onChange={e => handleFilterChange(setFromDate)(e.target.value)}
                            />
                            <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                            <Input
                                className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                                disabled={loading}
                                type="date"
                                value={toDate}
                                onChange={e => handleFilterChange(setToDate)(e.target.value)}
                            />
                        </div>
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                            <Input
                                className="h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-8 text-xs"
                                disabled={loading}
                                placeholder="Ref No or Branch…"
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
                        <div className="flex items-center gap-2 ml-auto">
                            <Button
                                className="h-8 px-2.5 text-xs"
                                disabled={loading || !branchId}
                                size="sm"
                                variant="outline"
                                onClick={() => { if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, page); }}
                            >
                                <RefreshCw className="mr-1.5 h-3 w-3" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Data Grid */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <div
                            ref={scrollWrapperRef}
                            className="flex-1 overflow-x-auto overflow-y-auto"
                            style={{ maxHeight: mode === "view" ? maxHeight : undefined }}
                        >
                            {loading ? (
                                <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 z-30">
                                        <tr className="bg-[var(--cl-surface-2)]">
                                            <th className={thClass} style={{ width: "5%" }}>#</th>
                                            <th className={thClass} style={{ width: "12%" }}>Date</th>
                                            <th className={thClass} style={{ width: "25%" }}>Source Branch</th>
                                            <th className={thClass} style={{ width: "25%" }}>Dest. Branch</th>
                                            <th className={thClass} style={{ width: "23%" }}>Ref No</th>
                                            <th className={`${thClass} text-center`} style={{ width: "10%" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: 15 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className={tdClass}><div className="h-4 w-4 rounded bg-[var(--cl-border)]" /></td>
                                                <td className={tdClass}><div className="h-4 w-20 rounded bg-[var(--cl-border)]" /></td>
                                                <td className={tdClass}><div className="h-4 w-48 rounded bg-[var(--cl-border)]" /></td>
                                                <td className={tdClass}><div className="h-4 w-48 rounded bg-[var(--cl-border)]" /></td>
                                                <td className={tdClass}><div className="h-4 w-32 rounded bg-[var(--cl-border)]" /></td>
                                                <td className={tdClass}><div className="mx-auto h-4 w-8 rounded bg-[var(--cl-border)]" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : transfers.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                                    No branch transfers found for the selected filters.
                                </div>
                            ) : (
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={thClass}>#</th>
                                            <th className={thClass}>Date</th>
                                            <th className={thClass}>Source Branch</th>
                                            <th className={thClass}>Dest. Branch</th>
                                            <th className={thClass}>Ref No</th>
                                            <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                        {transfers.map((t, idx) => (
                                            <tr key={t.id} className="group transition-colors hover:bg-[var(--cl-accent)]/5 dark:hover:bg-white/[0.03]">
                                                <td className={`${tdClass} text-[var(--cl-text-muted)]`} style={{ width: "5%" }}>
                                                    {(page - 1) * PAGE_SIZE + idx + 1}
                                                </td>
                                                <td className={tdClass} style={{ width: "12%" }}>
                                                    {t.transfer_date}
                                                </td>
                                                <td className={tdClass} style={{ width: "25%" }}>
                                                    {t.from_branch_name}
                                                </td>
                                                <td className={tdClass} style={{ width: "25%" }}>
                                                    {t.to_branch_name}
                                                </td>
                                                <td className={`${tdClass} font-mono`} style={{ width: "23%" }}>
                                                    {t.ref_no ?? "—"}
                                                </td>
                                                <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`} style={{ width: "10%" }}>
                                                    <div className="flex items-center justify-center">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    className="h-8 w-8 p-0 hover:bg-[var(--cl-accent)]/15 dark:hover:bg-[var(--cl-accent)]/20 transition-all duration-200"
                                                                    variant="ghost"
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">Open menu</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-[160px] bg-white dark:bg-zinc-950 border-[var(--cl-border)] shadow-[0_10px_30px_rgba(0,0,0,0.2)] z-50">
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-amber-500 focus:bg-amber-500/10 focus:text-amber-600"
                                                                    onClick={() => { setEditTransfer(t); setMode('new'); }}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    <span>Edit</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-red-500 focus:bg-red-500/10 focus:text-red-600 font-semibold"
                                                                    onClick={() => setDeleteId(t.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    <span>Delete</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Summary footer */}
                        {transfers.length > 0 && (
                            <div className="border-t border-[var(--cl-border)] bg-[var(--cl-surface-2)]">
                                <table className="min-w-full border-collapse">
                                    <tbody>
                                        <tr>
                                            <td className={tdClass} style={{ width: "5%" }}></td>
                                            <td className={tdClass} colSpan={5}>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-[var(--cl-text-muted)]">{transfers.length} lines</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2">
                            <span className="text-xs text-[var(--cl-text-muted)]">
                                Page {page} of {totalPages} · {total} records
                            </span>
                            <div className="flex items-center gap-1">
                                <Button
                                    className="h-7 w-7"
                                    disabled={page <= 1 || loading}
                                    size="icon"
                                    title="First page"
                                    variant="ghost"
                                    onClick={() => setPage(1)}
                                >
                                    <ChevronsLeftIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    className="h-7 w-7"
                                    disabled={page <= 1 || loading}
                                    size="icon"
                                    title="Previous page"
                                    variant="ghost"
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    <ChevronLeftIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    className="h-7 w-7"
                                    disabled={page >= totalPages || loading}
                                    size="icon"
                                    title="Next page"
                                    variant="ghost"
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    <ChevronRightIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    className="h-7 w-7"
                                    disabled={page >= totalPages || loading}
                                    size="icon"
                                    title="Last page"
                                    variant="ghost"
                                    onClick={() => setPage(totalPages)}
                                >
                                    <ChevronsRightIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Delete Confirm Dialog */}
                    <Dialog
                        open={deleteId !== null}
                        onOpenChange={open => { if (!open && !deleting) setDeleteId(null); }}
                    >
                        <DialogContent aria-describedby={undefined} className="sm:max-w-sm !bg-[var(--cl-surface)] text-[var(--cl-text)]">
                            <DialogHeader>
                                <DialogTitle>Delete Branch Transfer</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-[var(--cl-text-muted)]">
                                This will permanently delete the transfer and reverse all associated stock transactions.
                                This action cannot be undone.
                            </p>
                            <DialogFooter>
                                <Button
                                    disabled={deleting}
                                    variant="outline"
                                    onClick={() => setDeleteId(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    disabled={deleting}
                                    variant="destructive"
                                    onClick={() => void handleDelete()}
                                >
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
