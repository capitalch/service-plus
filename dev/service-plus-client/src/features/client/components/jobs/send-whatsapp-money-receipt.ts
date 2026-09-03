import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

// Sends the "Download Money Receipt" WhatsApp message for exactly one
// job_payment row (plans/plan.md, Step 3) — never grouped/chunked like the
// other three events, since a receipt always belongs to exactly one
// job/customer. Result shape mirrors sendWhatsappJobDelivery's, minus
// job_ids (a receipt send has no equivalent server-side re-filter to report
// back — the payment_id the caller passed is the payment_id that was sent).
export type WhatsappMoneyReceiptResult = {
    customer_name: string;
    payment_id:    number;
    status:        "SENT" | "FAILED";
    error:         string | null;
};

type SendWhatsappMoneyReceiptData = {
    sendWhatsappMoneyReceipt: { results: WhatsappMoneyReceiptResult[]; disabled?: boolean } | null;
};

export type WhatsappMoneyReceiptSendOutcome = {
    results:  WhatsappMoneyReceiptResult[];
    disabled: boolean;
};

export async function sendWhatsappMoneyReceipt(
    dbName: string,
    schema: string,
    branchId: number,
    paymentId: number,
): Promise<WhatsappMoneyReceiptSendOutcome> {
    const res = await apolloClient.mutate<SendWhatsappMoneyReceiptData>({
        mutation: GRAPHQL_MAP.sendWhatsappMoneyReceipt,
        variables: {
            db_name: dbName,
            schema,
            value: encodeObj({ branch_id: branchId, payment_id: paymentId }),
        },
    });
    return {
        results:  res.data?.sendWhatsappMoneyReceipt?.results ?? [],
        disabled: res.data?.sendWhatsappMoneyReceipt?.disabled ?? false,
    };
}
