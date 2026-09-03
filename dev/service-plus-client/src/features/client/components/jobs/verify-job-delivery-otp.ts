import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

// Every status the server can return (plans/plan.md, Step 3) — kept as
// distinct values, not collapsed into a boolean, so the OTP dialog can show
// the right next step (retry vs. resend) instead of one generic error.
export type VerifyJobDeliveryOtpStatus =
    | "CONFIRMED"
    | "INCORRECT_CODE"
    | "EXPIRED"
    | "TOO_MANY_ATTEMPTS"
    | "NO_PENDING_OTP"
    | "JOB_SET_MISMATCH";

type VerifyJobDeliveryOtpResult = { status: VerifyJobDeliveryOtpStatus; job_ids: number[] };

type VerifyJobDeliveryOtpData = {
    verifyJobDeliveryOtp: VerifyJobDeliveryOtpResult | null;
};

export async function verifyJobDeliveryOtp(
    dbName: string,
    schema: string,
    jobIds: number[],
    code: string,
): Promise<VerifyJobDeliveryOtpResult> {
    const res = await apolloClient.mutate<VerifyJobDeliveryOtpData>({
        mutation: GRAPHQL_MAP.verifyJobDeliveryOtp,
        variables: {
            db_name: dbName,
            schema,
            value: encodeObj({ job_ids: jobIds, code }),
        },
    });
    // Mirrors sendWhatsappJobDelivery's own defensive fallback — a null
    // payload (network hiccup surfaced as data: null rather than a thrown
    // error) reads as "no pending code found" rather than a false CONFIRMED.
    return res.data?.verifyJobDeliveryOtp ?? { status: "NO_PENDING_OTP", job_ids: jobIds };
}
