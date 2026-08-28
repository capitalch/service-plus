import { toast } from "sonner";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";

// Canonical 15-character GSTIN pattern (2-digit state code, 5 letters, 4 digits,
// 1 letter, 1 entity char, the literal 'Z', 1 checksum char).
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** Trim + uppercase a raw GSTIN entry. */
export function normalizeGstin(value: string | null | undefined): string {
    return (value ?? "").trim().toUpperCase();
}

/**
 * GSTIN is optional everywhere, so an empty value is valid. A non-empty value
 * must match the 15-character pattern.
 */
export function isValidGstin(value: string | null | undefined): boolean {
    const v = normalizeGstin(value);
    return v === "" || GSTIN_REGEX.test(v);
}

type SaveCustomerGstinArgs = {
    customerId: number | null | undefined;
    gstin: string | null | undefined;
    /** The GSTIN already stored on the customer; used to skip a redundant write. */
    currentGstin?: string | null;
    dbName: string | null;
    schema: string | null;
};

/**
 * Persist a GSTIN onto the customer_contact row. No-ops when the value is empty
 * (never overwrites a stored GSTIN with blank), unchanged, or when the value is
 * malformed. Best-effort: surfaces a toast on failure but does not throw, so the
 * primary job action (create / finalize / deliver) is never rolled back by it.
 */
export async function saveCustomerGstin({
    customerId, gstin, currentGstin, dbName, schema,
}: SaveCustomerGstinArgs): Promise<void> {
    const next = normalizeGstin(gstin);
    if (!customerId || !dbName || !schema) return;
    if (next === "") return;                              // never overwrite with blank
    if (next === normalizeGstin(currentGstin)) return;    // unchanged
    if (!GSTIN_REGEX.test(next)) return;                  // caller should have blocked already

    try {
        await apolloClient.mutate({
            mutation: GRAPHQL_MAP.genericUpdate,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericUpdateValue({
                    tableName: "customer_contact",
                    xData: { id: customerId, gstin: next },
                }),
            },
        });
    } catch {
        toast.error("Job saved, but updating the customer's GSTIN failed.");
    }
}
