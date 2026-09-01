import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

// One code path, three callers: the single-job and batch-job creation forms
// (right after creation) and the job-details modal (for re-sending after the
// fact) all call this same mutation — see plans/plan-whatsapp.md, Step 7.
export type WhatsappJobIntakeResult = {
    customer_name: string;
    job_ids:       number[];
    status:        "SENT" | "FAILED";
    error:         string | null;
};

type SendWhatsappJobIntakeData = {
    sendWhatsappJobIntake: { results: WhatsappJobIntakeResult[]; disabled?: boolean } | null;
};

export type WhatsappJobIntakeSendOutcome = {
    results:  WhatsappJobIntakeResult[];
    disabled: boolean;
};

export async function sendWhatsappJobIntake(
    dbName: string,
    schema: string,
    branchId: number,
    jobIds: number[],
): Promise<WhatsappJobIntakeSendOutcome> {
    const res = await apolloClient.mutate<SendWhatsappJobIntakeData>({
        mutation: GRAPHQL_MAP.sendWhatsappJobIntake,
        variables: {
            db_name: dbName,
            schema,
            value: encodeObj({ branch_id: branchId, job_ids: jobIds }),
        },
    });
    return {
        results:  res.data?.sendWhatsappJobIntake?.results ?? [],
        disabled: res.data?.sendWhatsappJobIntake?.disabled ?? false,
    };
}
