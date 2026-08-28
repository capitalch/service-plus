import { useCallback, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";

import type { BrandOption } from "@/features/client/types/model";
import { BrandSelect } from "@/features/client/components/inventory/brand-select";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { OpeningStockListItem } from "@/features/client/types/stock-opening-balance";
import { openingStockSchema, type OpeningStockFormValues, getOpeningStockDefaultValues, getInitialOpeningStockLine } from "./opening-stock-schema";
import { NewOpeningStock } from "./new-opening-stock";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Component ────────────────────────────────────────────────────────────────

export const OpeningStockSection = () => {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId     = globalBranch?.id ?? null;

    const [selectedBrand, setSelectedBrand] = useState("");

    // Metadata
    const [brands,   setBrands]   = useState<BrandOption[]>([]);
    const [txnTypes, setTxnTypes] = useState<StockTransactionTypeRow[]>([]);

    // The branch's single opening-stock entry, if one already exists.
    const [existingEntry, setExistingEntry] = useState<OpeningStockListItem | null>(null);
    const [entryLoading,  setEntryLoading]  = useState(false);

    // Dialog state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting,          setDeleting]          = useState(false);

    // Lines lifted from child
    const selectedBrandId = selectedBrand ? Number(selectedBrand) : null;
    const [originalLineIds, setOriginalLineIds] = useState<number[]>([]);
    const [linesValid,      setLinesValid]      = useState(false);

    // Form
    const form = useForm<OpeningStockFormValues>({
        defaultValues: getOpeningStockDefaultValues(),
        mode:          "onChange",
        resolver:      zodResolver(openingStockSchema) as any,
    });

    // Load brands and txnTypes on mount
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchMeta = async () => {
            try {
                const [brandRes, txnRes] = await Promise.all([
                    apolloClient.query<GenericQueryData<BrandOption>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
                        },
                    }),
                    apolloClient.query<GenericQueryData<StockTransactionTypeRow>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STOCK_TRANSACTION_TYPES }),
                        },
                    }),
                ]);
                const brandList = brandRes.data?.genericQuery ?? [];
                setBrands(brandList);
                if (brandList.length === 1) setSelectedBrand(String(brandList[0].id));
                setTxnTypes(txnRes.data?.genericQuery ?? []);
            } catch {
                toast.error(MESSAGES.ERROR_OPENING_STOCK_LOAD_FAILED);
            }
        };
        void fetchMeta();
    }, [dbName, schema]);

    // A branch can only ever have one opening-stock entry (DB-unique on
    // branch_id). Check whether one already exists whenever the branch changes.
    const checkExistingEntry = useCallback(async (bId: number) => {
        if (!dbName || !schema) return;
        setEntryLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<OpeningStockListItem>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: bId, limit: 1, offset: 0, search: "" },
                        sqlId:   SQL_MAP.GET_OPENING_STOCK_PAGED,
                    }),
                },
            });
            const found = res.data?.genericQuery?.[0] ?? null;
            setExistingEntry(found);
            // NewOpeningStock's populate-on-editEntry effect only acts when editEntry is
            // truthy, so switching to a branch with no entry needs an explicit blank reset
            // here — otherwise the previous branch's lines would stay on screen.
            if (!found) {
                form.reset({ ...getOpeningStockDefaultValues(), lines: [getInitialOpeningStockLine(selectedBrandId)] });
                setOriginalLineIds([]);
            }
        } catch {
            toast.error(MESSAGES.ERROR_OPENING_STOCK_LOAD_FAILED);
        } finally {
            setEntryLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId) {
            setExistingEntry(null);
            form.reset({ ...getOpeningStockDefaultValues(), lines: [getInitialOpeningStockLine(selectedBrandId)] });
            setOriginalLineIds([]);
            return;
        }
        void checkExistingEntry(Number(branchId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId, checkExistingEntry]);

    const handleReset = () => {
        if (existingEntry) {
            // Discard unsaved local edits by re-triggering NewOpeningStock's
            // populate-from-server effect (it re-fetches on editEntry identity change).
            setExistingEntry({ ...existingEntry });
        } else {
            form.reset({ ...getOpeningStockDefaultValues(), lines: [getInitialOpeningStockLine(selectedBrandId)] });
            setOriginalLineIds([]);
        }
    };

    const executeSave = async (values: OpeningStockFormValues) => {
        if (!linesValid) {
            toast.error(MESSAGES.ERROR_OPENING_STOCK_LINE_FIELDS_REQUIRED);
            return;
        }
        const openingBalTypeId = txnTypes.find(t => t.code === "OPENING")?.id;
        if (!openingBalTypeId) {
            toast.error(MESSAGES.ERROR_OPENING_STOCK_TXN_TYPE_MISSING);
            return;
        }
        if (!branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_OPENING_STOCK_CREATE_FAILED);
            return;
        }
        if (!selectedBrandId) {
            toast.error(MESSAGES.ERROR_OPENING_STOCK_BRAND_REQUIRED);
            return;
        }

        const linePayload = (values.lines ?? []).map(line => ({
            part_id:   line.part_id,
            qty:       line.qty,
            remarks:   line.remarks.trim() || null,
            unit_cost: line.unit_cost > 0 ? line.unit_cost : null,
            xDetails: [{
                fkeyName:  "stock_opening_balance_line_id",
                tableName: "stock_transaction",
                xData: [{
                    branch_id:                 branchId,
                    dr_cr:                     "D",
                    part_id:                   line.part_id,
                    qty:                       line.qty,
                    stock_transaction_type_id: openingBalTypeId,
                    transaction_date:          values.entry_date,
                }],
            }],
        }));

        const headerFields = {
            entry_date: values.entry_date,
            brand_id:   selectedBrandId,
            ref_no:     values.ref_no?.trim() || null,
            remarks:    values.remarks?.trim() || null,
        };

        try {
            if (existingEntry) {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "stock_opening_balance",
                    xData: {
                        id: existingEntry.id,
                        ...headerFields,
                        xDetails: {
                            deletedIds: originalLineIds,
                            fkeyName:   "stock_opening_balance_id",
                            tableName:  "stock_opening_balance_line",
                            xData:      linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_OPENING_STOCK_UPDATED);
                await checkExistingEntry(Number(branchId));
            } else {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "stock_opening_balance",
                    xData: {
                        branch_id: branchId,
                        ...headerFields,
                        xDetails: {
                            fkeyName:  "stock_opening_balance_id",
                            tableName: "stock_opening_balance_line",
                            xData:     linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_OPENING_STOCK_CREATED);
                // The branch now has its one-and-only entry — load it so any
                // further parts added go through the update path, not another insert.
                await checkExistingEntry(Number(branchId));
            }
            setOriginalLineIds([]);
        } catch {
            toast.error(existingEntry ? MESSAGES.ERROR_OPENING_STOCK_UPDATE_FAILED : MESSAGES.ERROR_OPENING_STOCK_CREATE_FAILED);
        }
    };

    // Delete
    const handleDelete = async () => {
        if (!existingEntry || !dbName || !schema) return;
        setDeleting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        deletedIds: [existingEntry.id],
                        tableName:  "stock_opening_balance",
                        xData:      {},
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_OPENING_STOCK_DELETED);
            setDeleteConfirmOpen(false);
            setExistingEntry(null);
            form.reset({ ...getOpeningStockDefaultValues(), lines: [getInitialOpeningStockLine(selectedBrandId)] });
            setOriginalLineIds([]);
        } catch {
            toast.error(MESSAGES.ERROR_OPENING_STOCK_DELETE_FAILED);
        } finally {
            setDeleting(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-1">
                {/* Title */}
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                        <FileText className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="flex items-baseline gap-2 overflow-hidden">
                        <h1 className="text-lg font-bold text-(--cl-text) truncate">
                            Opening Stock
                            {entryLoading && <span className="ml-2 text-sm font-medium text-(--cl-text-muted) whitespace-nowrap">— Loading…</span>}
                            {!entryLoading && existingEntry && <span className="ml-2 text-sm font-medium text-amber-500 whitespace-nowrap">— Edit</span>}
                            {!entryLoading && !existingEntry && <span className="ml-2 text-sm font-medium text-(--cl-text-muted) whitespace-nowrap">— New</span>}
                        </h1>
                        {!entryLoading && existingEntry && (
                            <span className="truncate text-xs text-(--cl-text-muted)">
                                {MESSAGES.INFO_OPENING_STOCK_EXISTING_ENTRY}
                            </span>
                        )}
                    </div>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Brand */}
                <BrandSelect
                    brands={brands}
                    value={selectedBrand}
                    onValueChange={setSelectedBrand}
                    disabled={brands.length === 0 || entryLoading}
                    highlightEmpty={!existingEntry && !selectedBrand}
                />

                {/* Delete — only when an entry exists */}
                {existingEntry && (
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-red-600 hover:bg-red-500/10 hover:text-red-700"
                        disabled={form.formState.isSubmitting || entryLoading}
                        variant="ghost"
                        onClick={() => setDeleteConfirmOpen(true)}
                    >
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        Delete
                    </Button>
                )}

                {/* Reset · Save */}
                <div className="flex items-center gap-2">
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-(--cl-text)"
                        disabled={form.formState.isSubmitting || entryLoading}
                        variant="ghost"
                        onClick={handleReset}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${form.formState.isSubmitting ? "animate-spin" : ""}`} />
                        Reset
                    </Button>
                    <Button
                        className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest transition-all disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                        disabled={!form.formState.isValid || !linesValid || !selectedBrandId || form.formState.isSubmitting || entryLoading}
                        onClick={form.handleSubmit(executeSave)}
                    >
                        {form.formState.isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save
                    </Button>
                </div>
            </div>

            <FormProvider {...form}>
                <NewOpeningStock
                    branchId={branchId}
                    brandName={brands.find(b => String(b.id) === selectedBrand)?.name}
                    editEntry={existingEntry}
                    onLinesValidChange={setLinesValid}
                    selectedBrandId={selectedBrandId}
                    setOriginalLineIds={setOriginalLineIds}
                    form={form}
                />
            </FormProvider>

            {/* Delete Confirm Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onOpenChange={open => { if (!open && !deleting) setDeleteConfirmOpen(false); }}
            >
                <DialogContent aria-describedby={undefined} className="sm:max-w-sm !bg-white text-(--cl-text)">
                    <DialogHeader>
                        <DialogTitle>Delete Opening Stock Entry</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-(--cl-text-muted)">
                        This will permanently delete the opening stock entry and all associated stock transactions.
                        This action cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button
                            disabled={deleting}
                            variant="outline"
                            onClick={() => setDeleteConfirmOpen(false)}
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
        </motion.div>
    );
};
