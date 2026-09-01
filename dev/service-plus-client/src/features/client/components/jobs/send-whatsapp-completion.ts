import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

// One code path, two callers: the single-job "Whatsapp" button on the
// finalize form (job_ids: [id]) and the Customer Connect bulk screen
// (job_ids: the full multi-select) both call this same mutation — see
// plans/plan-whatsapp.md §4d.
export type WhatsappCompletionResult = {
    customer_name: string;
    job_ids:       number[];
    status:        "SENT" | "FAILED";
    error:         string | null;
};

type SendWhatsappCompletionData = {
    sendWhatsappCompletion: { results: WhatsappCompletionResult[]; disabled?: boolean } | null;
};

export type WhatsappCompletionSendOutcome = {
    results:  WhatsappCompletionResult[];
    disabled: boolean;
};

export async function sendWhatsappCompletion(
    dbName: string,
    schema: string,
    branchId: number,
    jobIds: number[],
): Promise<WhatsappCompletionSendOutcome> {
    const res = await apolloClient.mutate<SendWhatsappCompletionData>({
        mutation: GRAPHQL_MAP.sendWhatsappCompletion,
        variables: {
            db_name: dbName,
            schema,
            value: encodeObj({ branch_id: branchId, job_ids: jobIds }),
        },
    });
    return {
        results:  res.data?.sendWhatsappCompletion?.results ?? [],
        disabled: res.data?.sendWhatsappCompletion?.disabled ?? false,
    };
}
