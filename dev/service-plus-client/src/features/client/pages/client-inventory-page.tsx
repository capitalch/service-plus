import { ClientLayout, useClientSelection } from "../components/client-layout";
import { PurchaseEntrySection } from "../components/inventory/purchase-entry/purchase-entry-section";
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
