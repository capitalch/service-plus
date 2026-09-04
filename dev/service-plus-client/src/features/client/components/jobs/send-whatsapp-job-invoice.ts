import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

// Sends the "Download Invoice" WhatsApp message for exactly one job
// (plans/plan.md) — a resend path from the Delivered Jobs grid for jobs
// that already left the live paperless-delivery session. Never
// grouped/chunked, same precedent as sendWhatsappMoneyReceipt — an
// invoice always belongs to exactly one job/customer. Result shape
// mirrors WhatsappMoneyReceiptResult, `payment_id` swapped for `job_id`.
export type WhatsappJobInvoiceResult = {
    customer_name: string;
    job_id:        number;
    status:        "SENT" | "FAILED";
    error:         string | null;
};

type SendWhatsappJobInvoiceData = {
    sendWhatsappJobInvoice: { results: WhatsappJobInvoiceResult[]; disabled?: boolean } | null;
};

export type WhatsappJobInvoiceSendOutcome = {
    results:  WhatsappJobInvoiceResult[];
    disabled: boolean;
};

export async function sendWhatsappJobInvoice(
    dbName: string,
    schema: string,
    branchId: number,
    jobId: number,
): Promise<WhatsappJobInvoiceSendOutcome> {
    const res = await apolloClient.mutate<SendWhatsappJobInvoiceData>({
        mutation: GRAPHQL_MAP.sendWhatsappJobInvoice,
        variables: {
            db_name: dbName,
            schema,
            value: encodeObj({ branch_id: branchId, job_id: jobId }),
        },
    });
    return {
        results:  res.data?.sendWhatsappJobInvoice?.results ?? [],
        disabled: res.data?.sendWhatsappJobInvoice?.disabled ?? false,
    };
}
