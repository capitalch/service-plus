import { useCallback, useState } from "react";
import { BookCheck, Loader2, Save } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { MoneyReceiptsPostUnpostGrid }    from "./money-receipts-post-unpost-grid";
import { PurchaseInvoicesPostUnpostGrid } from "./purchase-invoices-post-unpost-grid";
import { SalesInvoicesPostUnpostGrid }    from "./sales-invoices-post-unpost-grid";
import { JobInvoicesPostUnpostGrid }      from "./job-invoices-post-unpost-grid";
import type { PostUnpostStats } from "./post-unpost-schema";

type InnerTab = 'receipts' | 'purchase' | 'sales' | 'job';

const TAB_TABLE: Record<InnerTab, string> = {
    receipts: 'job_payment',
    purchase: 'purchase_invoice',
    sales:    'sales_invoice',
    job:      'job_invoice',
};

function TabBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return (
        <button
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                active
                    ? 'bg-(--cl-accent) text-white shadow'
                    : 'text-(--cl-text-muted) hover:bg-(--cl-hover) hover:text-(--cl-text)'
            }`}
            onClick={onClick}
        >
            {label}
        </button>
    );
}

function StatsBar({ stats }: { stats: PostUnpostStats | null }) {
    if (!stats) return null;
    return (
        <div className="flex items-center gap-4 text-xs">
            <span className="text-(--cl-text-muted)">
                Posted: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.posted}</span>
            </span>
            <span className="text-(--cl-text-muted)">
                Unposted: <span className="font-semibold text-amber-600 dark:text-amber-400">{stats.unposted}</span>
            </span>
            <span className="text-(--cl-text-muted)">
                Total: <span className="font-semibold text-(--cl-text)">{stats.total}</span>
            </span>
        </div>
    );
}

export function PostUnpostSection() {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [innerTab, setInnerTab] = useState<InnerTab>('receipts');
    const [saving,   setSaving]   = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Pending changes per tab: Map<id, new_is_posted>
    const [pendingReceipts,  setPendingReceipts]  = useState<Map<number, boolean>>(new Map());
    const [pendingPurchase,  setPendingPurchase]  = useState<Map<number, boolean>>(new Map());
    const [pendingSales,     setPendingSales]     = useState<Map<number, boolean>>(new Map());
    const [pendingJob,       setPendingJob]       = useState<Map<number, boolean>>(new Map());

    // Stats per tab
    const [statsReceipts,  setStatsReceipts]  = useState<PostUnpostStats | null>(null);
    const [statsPurchase,  setStatsPurchase]  = useState<PostUnpostStats | null>(null);
    const [statsSales,     setStatsSales]     = useState<PostUnpostStats | null>(null);
    const [statsJob,       setStatsJob]       = useState<PostUnpostStats | null>(null);

    const activeStats: PostUnpostStats | null =
        innerTab === 'receipts' ? statsReceipts :
        innerTab === 'purchase' ? statsPurchase :
        innerTab === 'sales'    ? statsSales    :
        statsJob;

    const activePending: Map<number, boolean> =
        innerTab === 'receipts' ? pendingReceipts :
        innerTab === 'purchase' ? pendingPurchase :
        innerTab === 'sales'    ? pendingSales    :
        pendingJob;

    const setPending = (tab: InnerTab) => {
        if (tab === 'receipts') return setPendingReceipts;
        if (tab === 'purchase') return setPendingPurchase;
        if (tab === 'sales')    return setPendingSales;
        return setPendingJob;
    };

    const handleChangeToggle = useCallback((tab: InnerTab) => (id: number, currentDbValue: boolean) => {
        setPending(tab)(prev => {
            const next = new Map(prev);
            if (next.has(id)) {
                const newVal = !next.get(id)!;
                if (newVal === currentDbValue) {
                    next.delete(id);  // toggled back to DB value — no longer pending
                } else {
                    next.set(id, newVal);
                }
            } else {
                next.set(id, !currentDbValue);
            }
            return next;
        });
    }, []);

    const handleSave = async () => {
        if (!dbName || !schema || activePending.size === 0) return;
        const tableName = TAB_TABLE[innerTab];
        setSaving(true);
        try {
            await Promise.all(
                Array.from(activePending.entries()).map(([id, is_posted]) =>
                    apolloClient.mutate({
                        mutation: GRAPHQL_MAP.genericUpdate,
                        variables: {
                            db_name: dbName, schema,
                            value: graphQlUtils.buildGenericUpdateValue({ tableName, xData: { id, is_posted } }),
                        },
                    })
                )
            );
            // Clear the active pending map
            setPending(innerTab)(new Map());
            setRefreshTrigger(t => t + 1);
            toast.success(`Saved ${activePending.size} change${activePending.size !== 1 ? 's' : ''}.`);
        } catch {
            toast.error("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    const noopRowsLoaded = useCallback(() => {}, []);

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                    <BookCheck className="h-4 w-4" />
                </div>
                <h1 className="text-lg font-bold text-(--cl-text)">Post / Unpost to Accounting System</h1>
            </div>

            {/* Tab bar + stats + save */}
            <div className="flex flex-wrap items-center gap-3 px-4">
                <div className="flex items-center gap-1 rounded-lg bg-(--cl-surface-2) p-1">
                    <TabBtn active={innerTab === 'receipts'} label="Money Receipts"    onClick={() => setInnerTab('receipts')} />
                    <TabBtn active={innerTab === 'purchase'} label="Purchase Invoices" onClick={() => setInnerTab('purchase')} />
                    <TabBtn active={innerTab === 'sales'}    label="Sales Invoices"    onClick={() => setInnerTab('sales')}    />
                    <TabBtn active={innerTab === 'job'}      label="Job Invoices"      onClick={() => setInnerTab('job')}      />
                </div>

                <div className="ml-auto flex items-center gap-4">
                    <StatsBar stats={activeStats} />
                <button
                    disabled={saving || activePending.size === 0}
                    onClick={() => void handleSave()}
                    className={`flex items-center gap-2 rounded-md bg-(--cl-accent) px-4 py-1.5 text-sm font-semibold text-white shadow transition-colors hover:bg-(--cl-accent)/90 disabled:opacity-50 ${saving || activePending.size === 0 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    {saving
                        ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Saving…</span></>
                        : <><Save className="h-4 w-4" /><span>Save{activePending.size > 0 ? ` (${activePending.size})` : ''}</span></>
                    }
                </button>
                </div>
            </div>

            {/* Grids — all mounted, visibility toggled via CSS */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4">
                <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${innerTab !== 'receipts' ? 'hidden' : ''}`}>
                    <MoneyReceiptsPostUnpostGrid
                        pendingChanges={pendingReceipts}
                        onChangeToggle={handleChangeToggle('receipts')}
                        onStatsLoaded={setStatsReceipts}
                        onRowsLoaded={noopRowsLoaded}
                        refreshTrigger={refreshTrigger}
                    />
                </div>
                <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${innerTab !== 'purchase' ? 'hidden' : ''}`}>
                    <PurchaseInvoicesPostUnpostGrid
                        pendingChanges={pendingPurchase}
                        onChangeToggle={handleChangeToggle('purchase')}
                        onStatsLoaded={setStatsPurchase}
                        onRowsLoaded={noopRowsLoaded}
                        refreshTrigger={refreshTrigger}
                    />
                </div>
                <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${innerTab !== 'sales' ? 'hidden' : ''}`}>
                    <SalesInvoicesPostUnpostGrid
                        pendingChanges={pendingSales}
                        onChangeToggle={handleChangeToggle('sales')}
                        onStatsLoaded={setStatsSales}
                        onRowsLoaded={noopRowsLoaded}
                        refreshTrigger={refreshTrigger}
                    />
                </div>
                <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${innerTab !== 'job' ? 'hidden' : ''}`}>
                    <JobInvoicesPostUnpostGrid
                        pendingChanges={pendingJob}
                        onChangeToggle={handleChangeToggle('job')}
                        onStatsLoaded={setStatsJob}
                        onRowsLoaded={noopRowsLoaded}
                        refreshTrigger={refreshTrigger}
                    />
                </div>
            </div>
        </motion.div>
    );
}
