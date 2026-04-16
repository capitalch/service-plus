import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { BrandOption } from "@/features/client/types/model";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { OpeningStockType } from "@/features/client/types/stock-opening-balance";
import { BrandSelect } from "@/features/client/components/inventory/brand-select";
import { NewOpeningStock, type NewOpeningStockHandle } from "./new-opening-stock";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };
type Mode = "edit" | "loading" | "new" | "view";

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-10 border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]";
const tdClass = "border-b border-[var(--cl-border)] p-3 text-sm text-[var(--cl-text)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const OpeningStockSection = () => {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId     = globalBranch?.id ?? null;

    // Metadata
    const [brands,   setBrands]   = useState<BrandOption[]>([]);
    const [txnTypes, setTxnTypes] = useState<StockTransactionTypeRow[]>([]);
    const [selectedBrand, setSelectedBrand] = useState("");

    // State
    const [mode,    setMode]    = useState<Mode>("loading");
    const [existing, setExisting] = useState<OpeningStockType | null>(null);

    // Form coordination
    const formRef      = useRef<NewOpeningStockHandle>(null);
    const [formValid,  setFormValid]  = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Load metadata once
    useEffect(() => {
        if (!dbName || !schema) return;
        Promise.all([
            apolloClient.query<GenericQueryData<BrandOption>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }) },
            }),
            apolloClient.query<GenericQueryData<StockTransactionTypeRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STOCK_TRANSACTION_TYPES }) },
            }),
        ]).then(([brandRes, txnRes]) => {
            const brandList = brandRes.data?.genericQuery ?? [];
            setBrands(brandList);
            if (brandList.length === 1) setSelectedBrand(String(brandList[0].id));
            setTxnTypes(txnRes.data?.genericQuery ?? []);
        }).catch(() => toast.error(MESSAGES.ERROR_OPENING_STOCK_LOAD_FAILED));
    }, [dbName, schema]);

    // Load opening balance for current branch
    const loadEntry = useCallback(async () => {
        if (!dbName || !schema || !branchId) { setMode("new"); return; }
        setMode("loading");
        try {
            const res = await apolloClient.query<GenericQueryData<OpeningStockType>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_OPENING_BALANCE_BY_BRANCH,
                        sqlArgs: { branch_id: branchId },
                    }),
                },
            });
            const row = res.data?.genericQuery?.[0] ?? null;
            setExisting(row);
            setMode(row ? "view" : "new");
        } catch {
            toast.error(MESSAGES.ERROR_OPENING_STOCK_LOAD_FAILED);
            setMode("new");
        }
    }, [dbName, schema, branchId]);

    useEffect(() => { void loadEntry(); }, [loadEntry]);

    // ── Render ────────────────────────────────────────────────────────────────

    const isFormMode = mode === "new" || mode === "edit";

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:overflow-y-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* ── Header bar ── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-1">
                {/* Title */}
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <FileText className="h-4 w-4" />
                    </div>
                    <h1 className="truncate text-lg font-bold text-[var(--cl-text)]">
                        Opening Stock
                        {mode === "new"  && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)] whitespace-nowrap">— New</span>}
                        {mode === "edit" && <span className="ml-2 text-sm font-medium text-amber-500 whitespace-nowrap">— Edit</span>}
                        {mode === "view" && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)] whitespace-nowrap">— View</span>}
                    </h1>
                </div>

                <div className="flex-1" />

                {/* Brand selector (form modes only) */}
                {isFormMode && (
                    <BrandSelect
                        brands={brands}
                        disabled={brands.length === 0}
                        highlightEmpty={isFormMode && !selectedBrand}
                        value={selectedBrand}
                        onValueChange={setSelectedBrand}
                    />
                )}

                {/* View mode — Edit button */}
                {mode === "view" && (
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest"
                        variant="outline"
                        onClick={() => setMode("edit")}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                    </Button>
                )}

                {/* Form mode — Reset + Save */}
                {isFormMode && (
                    <div className="flex items-center gap-2">
                        <Button
                            className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]"
                            disabled={submitting}
                            variant="ghost"
                            onClick={() => {
                                if (mode === "edit") { setMode("view"); }
                                formRef.current?.reset();
                            }}
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${submitting ? "animate-spin" : ""}`} />
                            {mode === "edit" ? "Cancel" : "Reset"}
                        </Button>
                        <Button
                            className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 font-extrabold uppercase tracking-widest text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:opacity-30"
                            disabled={!formValid || submitting}
                            onClick={() => formRef.current?.submit()}
                        >
                            {submitting
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <FileText className="h-3.5 w-3.5" />
                            }
                            Save
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Body ── */}
            {mode === "loading" && (
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--cl-accent)]" />
                </div>
            )}

            {isFormMode && (
                <div className="overflow-y-auto px-0.5">
                    <NewOpeningStock
                        ref={formRef}
                        branchId={branchId}
                        brandName={brands.find(b => String(b.id) === selectedBrand)?.name}
                        editEntry={mode === "edit" ? existing : null}
                        selectedBrandId={selectedBrand ? Number(selectedBrand) : null}
                        txnTypes={txnTypes}
                        onStatusChange={s => { setFormValid(s.isValid); setSubmitting(s.isSubmitting); }}
                        onSuccess={() => void loadEntry()}
                    />
                </div>
            )}

            {mode === "view" && existing && (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-0.5">
                    {/* Header info */}
                    <div className="flex flex-wrap gap-6 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Entry Date</span>
                            <span className="font-mono text-sm font-semibold text-[var(--cl-text)]">{existing.entry_date}</span>
                        </div>
                        {existing.ref_no && (
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Ref No</span>
                                <span className="font-mono text-sm text-[var(--cl-text)]">{existing.ref_no}</span>
                            </div>
                        )}
                        {existing.remarks && (
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Remarks</span>
                                <span className="text-sm text-[var(--cl-text)]">{existing.remarks}</span>
                            </div>
                        )}
                        <div className="ml-auto flex flex-col items-end gap-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Lines</span>
                            <span className="font-mono text-sm font-semibold text-emerald-500">{existing.lines.length}</span>
                        </div>
                    </div>

                    {/* Lines table */}
                    <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <div className="overflow-x-auto overflow-y-auto h-full">
                            <table className="min-w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={thClass} style={{ width: "4%" }}>#</th>
                                        <th className={thClass} style={{ width: "15%" }}>Part Code</th>
                                        <th className={thClass} style={{ width: "35%" }}>Part Name</th>
                                        <th className={`${thClass} text-right`} style={{ width: "10%" }}>Qty</th>
                                        <th className={`${thClass} text-right`} style={{ width: "12%" }}>Unit Cost</th>
                                        <th className={`${thClass} text-right`} style={{ width: "12%" }}>Value</th>
                                        <th className={thClass} style={{ width: "12%" }}>Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                    {existing.lines.length === 0 ? (
                                        <tr>
                                            <td className="p-6 text-center text-sm text-[var(--cl-text-muted)]" colSpan={7}>
                                                No line items found.
                                            </td>
                                        </tr>
                                    ) : existing.lines.map((line, idx) => (
                                        <tr key={line.id} className="transition-colors hover:bg-[var(--cl-accent)]/5 dark:hover:bg-white/[0.03]">
                                            <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{idx + 1}</td>
                                            <td className={`${tdClass} font-mono text-xs`}>{line.part_code}</td>
                                            <td className={tdClass}>{line.part_name}</td>
                                            <td className={`${tdClass} text-right font-mono`}>{Number(line.qty).toFixed(3)}</td>
                                            <td className={`${tdClass} text-right font-mono`}>
                                                {line.unit_cost != null ? Number(line.unit_cost).toFixed(2) : "—"}
                                            </td>
                                            <td className={`${tdClass} text-right font-mono font-semibold text-[var(--cl-accent)]`}>
                                                {line.unit_cost != null
                                                    ? (Number(line.qty) * Number(line.unit_cost)).toFixed(2)
                                                    : "—"}
                                            </td>
                                            <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{line.remarks ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {existing.lines.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-[var(--cl-border)] bg-[var(--cl-surface-2)]/50">
                                            <td className="p-3 text-xs font-black uppercase tracking-widest text-[var(--cl-text-muted)]" colSpan={3}>
                                                Total
                                            </td>
                                            <td className="p-3 text-right font-mono text-sm font-bold text-[var(--cl-text)]">
                                                {existing.lines.reduce((s, l) => s + Number(l.qty), 0).toFixed(3)}
                                            </td>
                                            <td className="p-3" />
                                            <td className="p-3 text-right font-mono text-sm font-black text-[var(--cl-accent)]">
                                                {existing.lines
                                                    .reduce((s, l) => s + (l.unit_cost != null ? Number(l.qty) * Number(l.unit_cost) : 0), 0)
                                                    .toFixed(2)}
                                            </td>
                                            <td className="p-3" />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
};
