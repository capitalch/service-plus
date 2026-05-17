import { useState, useCallback } from "react";
import { ClientLayout, useClientSelection } from "../components/client-layout";
import { BatchJobSection } from "../components/jobs/batch-job/batch-job-section";
import { DeliverJobSection } from "../components/jobs/deliver-job/deliver-job-section";
import { JobSearchSection } from "../components/jobs/job-search/job-search-section";
import { OpeningJobSection } from "../components/jobs/opening-job/opening-job-section";
import { PartUsedSection } from "../components/jobs/part-used/part-used-section";
import { FinalForDeliverySection } from "../components/jobs/final-for-delivery/final-for-delivery-section";
import { ReceiptsSection } from "../components/jobs/receipts/receipts-section";
import { SingleJobSection } from "../components/jobs/single-job/single-job-section";
import { JobPipelineSection } from "../components/jobs/job-pipeline/job-pipeline-section";

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
    const { selected, onSelect } = useClientSelection();
    const [pendingBatchNo, setPendingBatchNo] = useState<number | null>(null);
    const [forceSingleJobView, setForceSingleJobView] = useState(false);

    const navigateToBatchEdit = useCallback((batchNo: number) => {
        setPendingBatchNo(batchNo);
        onSelect("Batch Jobs");
    }, [onSelect]);

    const returnToSingleJob = useCallback(() => {
        setForceSingleJobView(true);
        onSelect("Single Job");
    }, [onSelect]);

    switch (selected) {
        case "Single Job":
            return <SingleJobSection onNavigateToBatchEdit={navigateToBatchEdit} forceView={forceSingleJobView} onViewModeApplied={() => setForceSingleJobView(false)} />;
        case "Batch Jobs":
            return <BatchJobSection initialEditBatchNo={pendingBatchNo} onEditBatchNoApplied={() => setPendingBatchNo(null)} onReturnToSingleJob={returnToSingleJob} />;
        case "Opening Jobs":
            return <OpeningJobSection />;
        case "Part Used (Job)":
            return <PartUsedSection />;
        case "Receipts":
            return <ReceiptsSection />;
        case "Job Pipeline":
            return <JobPipelineSection />;
        case "Final for Delivery":
            return <FinalForDeliverySection />;
        case "Deliver Job":
            return <DeliverJobSection />;
        case "Job Search":
            return <JobSearchSection />;
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
