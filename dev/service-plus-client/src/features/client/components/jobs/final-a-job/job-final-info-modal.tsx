import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectAvailableDivisions, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { isGstDivision } from "@/features/client/types/division";
import type { JobDetailType } from "@/features/client/types/job";

import { JobChargesReadonlyPanel } from "./job-charges-readonly-modal";
import type { ChargesViewChargeLine, ChargesViewPartLine } from "./job-charges-readonly-modal";

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    jobId:   number;
    onClose: () => void;
};

// Standalone, jobId-driven read-only view of a job's finalized cost/sale
// breakdown (parts used, additional charges, cost vs. sale, GST, profit).
// Self-fetches everything it needs, so any feature can trigger it with just
// a jobId — mirrors JobDetailsModal's { jobId, onClose } convention.
export function JobFinalInfoModal({ jobId, onClose }: Props) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const availableDivisions = useAppSelector(selectAvailableDivisions);

    const [job,     setJob]     = useState<JobDetailType | null>(null);
    const [parts,   setParts]   = useState<ChargesViewPartLine[]>([]);
    const [charges, setCharges] = useState<ChargesViewChargeLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(false);

    useEffect(() => {
        if (!dbName || !schema) return;
        let cancelled = false;
        setLoading(true);
        setError(false);

        const gq = <T,>(sqlId: string, sqlArgs: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<T>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }) },
            });

        Promise.all([
            gq<JobDetailType>(SQL_MAP.GET_JOB_DETAIL, { id: jobId }),
            gq<ChargesViewPartLine>(SQL_MAP.GET_JOB_PART_USED_BY_JOB, { job_id: jobId }),
            gq<ChargesViewChargeLine>(SQL_MAP.GET_JOB_ADDITIONAL_CHARGES_BY_JOB, { job_id: jobId }),
        ]).then(([jobRes, partsRes, chargesRes]) => {
            if (cancelled) return;
            setJob(jobRes.data?.genericQuery?.[0] ?? null);
            setParts(partsRes.data?.genericQuery ?? []);
            setCharges(chargesRes.data?.genericQuery ?? []);
        }).catch(() => {
            if (cancelled) return;
            setError(true);
        }).finally(() => {
            if (cancelled) return;
            setLoading(false);
        });

        return () => { cancelled = true; };
    }, [dbName, schema, jobId]);

    if (loading || error || !job) {
        return (
            <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Job Final Info</DialogTitle>
                    </DialogHeader>
                    <div className="flex h-32 items-center justify-center gap-2 text-sm text-(--cl-text-muted)">
                        {error ? (
                            <span>Failed to load job final info.</span>
                        ) : (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading…
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    const division = job.division_id ? (availableDivisions.find(d => d.id === job.division_id) ?? null) : null;

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="max-h-[92vh] w-full max-w-[40rem] overflow-hidden border-0 bg-white p-0 shadow-none ring-0 sm:max-w-[40rem]" showCloseButton={false}>
                <DialogTitle className="sr-only">Job Final Info — #{job.job_no}</DialogTitle>
                <JobChargesReadonlyPanel
                    amount={job.amount}
                    charges={charges}
                    forceIgst={job.is_igst ?? false}
                    isGst={isGstDivision(division)}
                    isWarranty={job.job_type_code === "UNDER_WARRANTY"}
                    jobNo={job.job_no}
                    maxWidthClassName="max-w-[40rem]"
                    parts={parts}
                    onClose={onClose}
                />
            </DialogContent>
        </Dialog>
    );
}
