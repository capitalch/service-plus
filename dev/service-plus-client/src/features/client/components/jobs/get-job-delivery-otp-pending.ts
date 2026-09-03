import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

type GetJobDeliveryOtpPendingData = {
    getJobDeliveryOtpPending: { job_ids: number[]; otp_pending: boolean } | null;
};

// Feeds the "Verify Code" affordance (plans/plan.md, Step 4) — whether a
// still-valid, unconfirmed code is already waiting for this exact job set, so
// a staff member who lost the OTP dialog (refresh, interruption) can resume
// verification instead of triggering a resend that would invalidate the code
// the customer already has in hand.
export async function getJobDeliveryOtpPending(
    dbName: string,
    schema: string,
    jobIds: number[],
): Promise<boolean> {
    const res = await apolloClient.query<GetJobDeliveryOtpPendingData>({
        fetchPolicy: "network-only",
        query:       GRAPHQL_MAP.getJobDeliveryOtpPending,
        variables: {
            db_name: dbName,
            schema,
            value: encodeObj({ job_ids: jobIds }),
        },
    });
    return res.data?.getJobDeliveryOtpPending?.otp_pending ?? false;
}
