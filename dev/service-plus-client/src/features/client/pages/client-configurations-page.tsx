import { ClientLayout, useClientSelection } from "../components/client-layout";
import { CompanyProfileSection } from "../components/company-profile-section";
import { DocumentSequenceSection } from "../components/document-sequence-section";

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
    return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-20">
            <div className="text-center">
                <p className="text-sm font-semibold text-[var(--cl-text)]">{label}</p>
                <p className="mt-2 text-xs text-[var(--cl-text-muted)]">
                    This configuration feature is coming soon.
                </p>
            </div>
        </div>
    );
}

// ─── Inner (needs layout context) ─────────────────────────────────────────────

function ConfigurationsContent() {
    const { selected } = useClientSelection();

    switch (selected) {
        case "Company Profile":
            return <CompanyProfileSection />;
        case "Numbering / Auto Series":
            return <DocumentSequenceSection />;
        default:
            return <ComingSoon label={selected || "Configurations"} />;
    }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ClientConfigurationsPage = () => (
    <ClientLayout>
        <ConfigurationsContent />
    </ClientLayout>
);
