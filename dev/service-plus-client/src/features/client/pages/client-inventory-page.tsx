import { ClientLayout, useClientSelection } from "../components/client-layout";
import { BranchTransferSection } from "../components/inventory/branch-transfer/branch-transfer-section";
import { LoanEntrySection } from "../components/inventory/loan-entry/loan-entry-section";
import { OpeningStockSection } from "../components/inventory/opening-stock/opening-stock-section";
import { PartFinderPage } from "../components/inventory/part-finder/part-finder-page";
import { PurchaseEntrySection } from "../components/inventory/purchase-entry/purchase-entry-section";
import { SalesEntrySection } from "../components/inventory/sales-entry/sales-entry-section";
import { SetPartLocationSection } from "../components/inventory/set-part-location/set-part-location-section";
import { StockAdjustmentSection } from "../components/inventory/stock-adjustment/stock-adjustment-section";
import { StockSnapshotTrigger } from "../components/inventory/stock-snapshot/stock-snapshot-trigger";
import { StockOverviewSection } from "../components/stock-overview-section";

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
    return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-20">
            <div className="text-center">
                <p className="text-sm font-semibold text-[var(--cl-text)]">{label}</p>
                <p className="mt-2 text-xs text-[var(--cl-text-muted)]">
                    This inventory feature is coming soon.
                </p>
            </div>
        </div>
    );
}

// ─── Inner (needs layout context) ─────────────────────────────────────────────

function InventoryContent() {
    const { selected } = useClientSelection();

    switch (selected) {
        case "Stock Overview":
            return <StockOverviewSection />;
        case "Purchase Entry":
            return <PurchaseEntrySection />;
        case "Sales Entry":
            return <SalesEntrySection />;
        case "Stock Adjustment":
            return <StockAdjustmentSection />;
        case "Branch Transfer":
            return <BranchTransferSection />;
        case "Loan Entry":
            return <LoanEntrySection />;
        case "Opening Stock":
            return <OpeningStockSection />;
        case "Part Finder":
            return <PartFinderPage />;
        case "Set Part Location":
            return <SetPartLocationSection />;
        case "Stock Snapshot":
            return <StockSnapshotTrigger />;
        default:
            return <ComingSoon label={selected || "Inventory"} />;
    }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ClientInventoryPage = () => (
    <ClientLayout>
        <InventoryContent />
    </ClientLayout>
);
