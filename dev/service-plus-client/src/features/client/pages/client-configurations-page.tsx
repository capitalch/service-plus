import { ClientLayout, useClientSelection } from "../components/layout/client-layout";
import { AppSettingsSection } from "../components/configurations/app-settings/app-settings-section";
import { DocumentSequenceSection } from "../components/configurations/document-sequence/document-sequence-section";
import { DivisionSection } from "../components/configurations/division/division-section";

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
    return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-20">
            <div className="text-center">
                <p className="text-sm font-semibold text-(--cl-text)">{label}</p>
                <p className="mt-2 text-xs text-(--cl-text-muted)">
                    This configuration feature is coming soon.
                </p>
            </div>
        </div>
    );
}

// ─── Inner (needs layout context) ─────────────────────────────────────────────

function ConfigurationsContent() {
    const { selected } = useClientSelection();
    const s = selected?.trim() || "";

    switch (s) {
        case "Divisions":
            return <DivisionSection />;
        case "App Settings":
            return <AppSettingsSection />;
        case "Numbering / Auto Series":
            return <DocumentSequenceSection />;
        default:
            return <ComingSoon label={s || "Configurations"} />;
    }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ClientConfigurationsPage = () => (
    <ClientLayout>
        <ConfigurationsContent />
    </ClientLayout>
);
