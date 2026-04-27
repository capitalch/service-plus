import { ClientLayout, useClientSelection } from "../components/client-layout";
import { BatchJobSection } from "../components/jobs/batch-job/batch-job-section";
import { DeliverJobSection } from "../components/jobs/deliver-job/deliver-job-section";
import { JobListSection } from "../components/jobs/job-list-section";
import { OpeningJobSection } from "../components/jobs/opening-job/opening-job-section";
import { PartUsedSection } from "../components/jobs/part-used/part-used-section";
import { ReadyForDeliverySection } from "../components/jobs/ready-for-delivery/ready-for-delivery-section";
import { ReceiptsSection } from "../components/jobs/receipts/receipts-section";
import { SingleJobSection } from "../components/jobs/single-job/single-job-section";
import { UpdateJobSection } from "../components/jobs/update-job/update-job-section";

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
        case "Update Job":
            return <UpdateJobSection />;
        case "Ready for Delivery":
            return <ReadyForDeliverySection />;
        case "Deliver Job":
            return <DeliverJobSection />;
        case "Job List / Search":
            return <JobListSection />;
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
