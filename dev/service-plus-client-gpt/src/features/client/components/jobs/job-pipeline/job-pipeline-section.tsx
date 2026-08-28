import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobBoardStatusCount, TechnicianRow } from "@/features/client/types/job";
import { JobPipelineStatusDrilldown } from "./job-pipeline-status-drilldown";
import { JobPipelineLanding } from "./job-pipeline-landing";

type View = "landing" | "detail";

type GenericQueryData<T> = { genericQuery: T[] | null };

export const JobPipelineSection = () => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const branchId      = currentBranch?.id ?? null;

    const [view,           setView]           = useState<View>("landing");
    const [selectedStatus, setSelectedStatus] = useState<JobBoardStatusCount | null>(null);
    const [technicians,    setTechnicians]    = useState<TechnicianRow[]>([]);

    useEffect(() => {
        if (!dbName || !schema || !branchId) return;
        void apolloClient.query<GenericQueryData<TechnicianRow>>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId:   SQL_MAP.GET_ALL_TECHNICIANS,
                    sqlArgs: { branch_id: branchId },
                }),
            },
        }).then(res => {
            setTechnicians(res.data?.genericQuery ?? []);
        }).catch(() => toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED));
    }, [dbName, schema, branchId]);

    function handleStatusClick(status: JobBoardStatusCount) {
        setSelectedStatus(status);
        setView("detail");
    }

    function handleBack() {
        setView("landing");
        setSelectedStatus(null);
    }

    if (view === "detail" && selectedStatus) {
        return (
            <JobPipelineStatusDrilldown
                status={selectedStatus}
                technicians={technicians}
                onBack={handleBack}
            />
        );
    }

    return <JobPipelineLanding onStatusClick={handleStatusClick} />;
};
