import { useState } from "react";
import { BookCheck, CheckCheck, CheckSquare, Loader2, Square } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";
import { selectCurrentDivision, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { PurchaseInvoicesGrid } from "./purchase-invoices-grid";
import { SalesInvoicesGrid }    from "./sales-invoices-grid";
import { JobInvoicesGrid }      from "./job-invoices-grid";
import { MoneyReceiptsGrid }    from "./money-receipts-grid";

type OuterTab = "posting" | "posted";
type InnerTab = "purchase" | "sales" | "job" | "receipts";

function TabBtn({ active, label, count, onClick }: { active: boolean; label: string; count?: number | null; onClick: () => void }) {
    return (
        <button
            className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                active
                    ? "bg-(--cl-accent) text-white shadow"
                    : "text-(--cl-text-muted) hover:bg-(--cl-hover) hover:text-(--cl-text)"
            }`}
            onClick={onClick}
        >
            {label}
            {count != null && (
                <span className={`absolute -top-2 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${
                    active
                        ? "bg-white text-(--cl-accent)"
                        : "bg-(--cl-accent) text-white"
                }`}>
                    {count}
                </span>
            )}
        </button>
    );
}

export function AccountsPostingSection() {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const division     = useAppSelector(selectCurrentDivision);

    const [outerTab, setOuterTab] = useState<OuterTab>("posting");
    const [innerTab, setInnerTab] = useState<InnerTab>("purchase");
    const [posting,  setPosting]  = useState(false);

    // Selection state — lives here so all tabs share it
    const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Set<number>>(new Set());
    const [selectedSalesIds,    setSelectedSalesIds]    = useState<Set<number>>(new Set());
    const [selectedJobIds,      setSelectedJobIds]      = useState<Set<number>>(new Set());
    const [selectedReceiptIds,  setSelectedReceiptIds]  = useState<Set<number>>(new Set());

    // Last-loaded row IDs per tab (to support "Select All" from toolbar)
    const [loadedPurchaseIds, setLoadedPurchaseIds] = useState<number[]>([]);
    const [loadedSalesIds,    setLoadedSalesIds]    = useState<number[]>([]);
    const [loadedJobIds,      setLoadedJobIds]      = useState<number[]>([]);
    const [loadedReceiptIds,  setLoadedReceiptIds]  = useState<number[]>([]);

    // Total record counts for inner tab badges
    const [totalPurchase, setTotalPurchase] = useState<number | null>(null);
    const [totalSales,    setTotalSales]    = useState<number | null>(null);
    const [totalJob,      setTotalJob]      = useState<number | null>(null);
    const [totalReceipts, setTotalReceipts] = useState<number | null>(null);

    const isPosted     = outerTab === "posted";
    const totalSelected = selectedPurchaseIds.size + selectedSalesIds.size + selectedJobIds.size + selectedReceiptIds.size;

    const handleSetOuterTab = (t: OuterTab) => {
        setOuterTab(t);
        setSelectedPurchaseIds(new Set());
        setSelectedSalesIds(new Set());
        setSelectedJobIds(new Set());
        setSelectedReceiptIds(new Set());
        setTotalPurchase(null);
        setTotalSales(null);
        setTotalJob(null);
        setTotalReceipts(null);
    };

    const handleSelectAll = () => {
        setSelectedPurchaseIds(new Set(loadedPurchaseIds));
        setSelectedSalesIds(new Set(loadedSalesIds));
        setSelectedJobIds(new Set(loadedJobIds));
        setSelectedReceiptIds(new Set(loadedReceiptIds));
    };

    const handleDeselectAll = () => {
        setSelectedPurchaseIds(new Set());
        setSelectedSalesIds(new Set());
        setSelectedJobIds(new Set());
        setSelectedReceiptIds(new Set());
    };

    const handlePostAllSelected = () => {
        toast.info(`Posting ${totalSelected} item${totalSelected !== 1 ? "s" : ""}…`);
    };

    const handleAccountsPosting = async () => {
        if (!division?.code) { toast.error("No division selected."); return; }
        if (!dbName || !schema) return;
        setPosting(true);
        try {
            const result = await apolloClient.mutate<{ accountsPosting: { error?: string } | null }>({
                mutation: GRAPHQL_MAP.accountsPosting,
                variables: {
                    db_name: dbName,
                    schema,
                    value: encodeObj({ divisionCode: division.code }),
                },
            });
            const data = result.data?.accountsPosting;
            if (data?.error) {
                toast.error(data.error);
            } else {
                toast.success("Accounts posting completed successfully.");
            }
        } catch {
            toast.error("Accounts posting failed.");
        } finally {
            setPosting(false);
        }
    };

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-2">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                        <BookCheck className="h-4 w-4" />
                    </div>
                    <h1 className="text-lg font-bold text-(--cl-text)">Accounts Posting</h1>
                </div>
                <button
                    disabled={posting || !division?.code}
                    onClick={() => void handleAccountsPosting()}
                    className="ml-auto flex items-center gap-2 rounded-md bg-(--cl-accent) px-4 py-1.5 text-sm font-semibold text-white shadow transition-colors hover:bg-(--cl-accent)/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {posting
                        ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Posting…</span></>
                        : <><BookCheck className="h-4 w-4" /><span>Accounts Posting</span></>
                    }
                </button>
            </div>

            {/* Tab bar — wraps on small screens */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {/* Outer tabs: Posting / Posted */}
                <div className="flex shrink-0 items-center gap-1 rounded-lg bg-(--cl-surface-2) p-1">
                    <TabBtn active={outerTab === "posting"} label="Posting" onClick={() => handleSetOuterTab("posting")} />
                    <TabBtn active={outerTab === "posted"}  label="Posted"  onClick={() => handleSetOuterTab("posted")}  />
                </div>

                {/* Compact action group: toggle + counts + post button — Posting tab only */}
                {outerTab === "posting" && <div className="flex shrink-0 items-stretch overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface-2) text-sm">
                    {/* Select / Deselect toggle */}
                    <button
                        className={`flex cursor-pointer items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${
                            totalSelected > 0
                                ? "bg-(--cl-accent)/10 text-(--cl-accent) hover:bg-(--cl-accent)/20"
                                : "text-(--cl-text-muted) hover:bg-(--cl-hover) hover:text-(--cl-text)"
                        }`}
                        onClick={totalSelected > 0 ? handleDeselectAll : handleSelectAll}
                    >
                        {totalSelected > 0
                            ? <><CheckSquare className="h-3.5 w-3.5" /><span>Deselect All</span></>
                            : <><Square      className="h-3.5 w-3.5" /><span>Select All</span></>
                        }
                    </button>

                    {/* Post all selected */}
                    <button
                        disabled={totalSelected === 0}
                        onClick={handlePostAllSelected}
                        className="flex cursor-pointer items-center gap-1.5 border-l border-(--cl-border) px-3 py-1.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span>Post selected{totalSelected > 0 ? ` (${totalSelected})` : ""}</span>
                    </button>

                    {/* Count labels — shown only when something is selected */}
                    {totalSelected > 0 && (
                        <div className="flex items-center gap-1 border-l border-(--cl-border) bg-white px-3 py-1.5 text-xs font-medium text-(--cl-text-muted)">
                            {selectedPurchaseIds.size > 0 && <span className="text-(--cl-accent)">{selectedPurchaseIds.size} pur</span>}
                            {selectedPurchaseIds.size > 0 && (selectedSalesIds.size > 0 || selectedJobIds.size > 0 || selectedReceiptIds.size > 0) && <span>·</span>}
                            {selectedSalesIds.size > 0    && <span className="text-(--cl-accent)">{selectedSalesIds.size} sal</span>}
                            {selectedSalesIds.size > 0    && (selectedJobIds.size > 0 || selectedReceiptIds.size > 0) && <span>·</span>}
                            {selectedJobIds.size > 0      && <span className="text-(--cl-accent)">{selectedJobIds.size} job</span>}
                            {selectedJobIds.size > 0      && selectedReceiptIds.size > 0 && <span>·</span>}
                            {selectedReceiptIds.size > 0  && <span className="text-(--cl-accent)">{selectedReceiptIds.size} rec</span>}
                        </div>
                    )}
                </div>}

                {/* Inner tabs — pushed to end */}
                <div className="ml-auto flex shrink-0 items-center gap-1 rounded-lg bg-(--cl-surface-2) p-1">
                    <TabBtn active={innerTab === "purchase"} label="Purchase Invoices" count={totalPurchase} onClick={() => setInnerTab("purchase")} />
                    <TabBtn active={innerTab === "sales"}    label="Sales Invoices"    count={totalSales}    onClick={() => setInnerTab("sales")}    />
                    <TabBtn active={innerTab === "job"}      label="Job Invoices"      count={totalJob}      onClick={() => setInnerTab("job")}      />
                    <TabBtn active={innerTab === "receipts"} label="Money Receipts"    count={totalReceipts} onClick={() => setInnerTab("receipts")} />
                </div>
            </div>

            {/* Grids — all mounted so all three load data; visibility toggled via CSS */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${innerTab !== "purchase" ? "hidden" : ""}`}>
                    <PurchaseInvoicesGrid
                        isPosted={isPosted}
                        selectedIds={selectedPurchaseIds}
                        onSelectionChange={setSelectedPurchaseIds}
                        onRowsLoaded={setLoadedPurchaseIds}
                        onTotalChange={setTotalPurchase}
                    />
                </div>
                <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${innerTab !== "sales" ? "hidden" : ""}`}>
                    <SalesInvoicesGrid
                        isPosted={isPosted}
                        selectedIds={selectedSalesIds}
                        onSelectionChange={setSelectedSalesIds}
                        onRowsLoaded={setLoadedSalesIds}
                        onTotalChange={setTotalSales}
                    />
                </div>
                <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${innerTab !== "job" ? "hidden" : ""}`}>
                    <JobInvoicesGrid
                        isPosted={isPosted}
                        selectedIds={selectedJobIds}
                        onSelectionChange={setSelectedJobIds}
                        onRowsLoaded={setLoadedJobIds}
                        onTotalChange={setTotalJob}
                    />
                </div>
                <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${innerTab !== "receipts" ? "hidden" : ""}`}>
                    <MoneyReceiptsGrid
                        isPosted={isPosted}
                        selectedIds={selectedReceiptIds}
                        onSelectionChange={setSelectedReceiptIds}
                        onRowsLoaded={setLoadedReceiptIds}
                        onTotalChange={setTotalReceipts}
                    />
                </div>
            </div>
        </motion.div>
    );
}
