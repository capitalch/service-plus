import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

// Sends both the delivery summary (Delivery Note/Invoice buttons) and the OTP
// message, one pair per customer — see plans/plan.md, Step 3. Result shape
// mirrors sendWhatsappJobIntake's, plus `job_ids` always reflects exactly
// which jobs this result's OTP covers, never the caller's original selection
// (the server re-filters via GET_JOBS_FOR_WHATSAPP_DELIVERY and can silently
// drop a job that isn't actually DELIVERED_OK/NOT_OK yet).
export type WhatsappJobDeliveryResult = {
    customer_name: string;
    job_ids:       number[];
    status:        "SENT" | "FAILED";
    error:         string | null;
};

type SendWhatsappJobDeliveryData = {
    sendWhatsappJobDelivery: { results: WhatsappJobDeliveryResult[]; disabled?: boolean } | null;
};

export type WhatsappJobDeliverySendOutcome = {
    results:  WhatsappJobDeliveryResult[];
    disabled: boolean;
};

export async function sendWhatsappJobDelivery(
    dbName: string,
    schema: string,
    branchId: number,
    jobIds: number[],
): Promise<WhatsappJobDeliverySendOutcome> {
    const res = await apolloClient.mutate<SendWhatsappJobDeliveryData>({
        mutation: GRAPHQL_MAP.sendWhatsappJobDelivery,
        variables: {
            db_name: dbName,
            schema,
            value: encodeObj({ branch_id: branchId, job_ids: jobIds }),
        },
    });
    return {
        results:  res.data?.sendWhatsappJobDelivery?.results ?? [],
        disabled: res.data?.sendWhatsappJobDelivery?.disabled ?? false,
    };
}
