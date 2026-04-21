import { ClientLayout, useClientSelection } from "../components/client-layout";
import { ConsumptionSection } from "../components/consumption-section";
import { JobSection } from "../components/jobs/job-section";

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
    return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-20">
            <div className="text-center">
                <p className="text-sm font-semibold text-[var(--cl-text)]">{label}</p>
                <p className="mt-2 text-xs text-[var(--cl-text-muted)]">
                    This jobs feature is coming soon.
                </p>
            </div>
        </div>
    );
}

// ─── Inner (needs layout context) ─────────────────────────────────────────────

function JobsContent() {
    const { selected } = useClientSelection();

    switch (selected) {
        case "New Job":
            return <JobSection />;
        case "Part Used (Job)":
            return <ConsumptionSection />;
        default:
            return <ComingSoon label={selected || "Jobs"} />;
    }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ClientJobsPage = () => (
    <ClientLayout>
        <JobsContent />
    </ClientLayout>
);
