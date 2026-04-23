import { ClientLayout, useClientSelection } from "../components/client-layout";
import { BatchJobSection } from "../components/jobs/batch-job/batch-job-section";
import { OpeningJobSection } from "../components/jobs/opening-job/opening-job-section";
import { PartUsedSection } from "../components/jobs/part-used/part-used-section";
import { ReceiptsSection } from "../components/jobs/receipts/receipts-section";
import { SingleJobSection } from "../components/jobs/single-job/single-job-section";

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
        case "Single Job":
            return <SingleJobSection />;
        case "Batch Jobs":
            return <BatchJobSection />;
        case "Opening Jobs":
            return <OpeningJobSection />;
        case "Part Used (Job)":
            return <PartUsedSection />;
        case "Receipts":
            return <ReceiptsSection />;
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
