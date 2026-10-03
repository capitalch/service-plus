import type { DocumentNode } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";

import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

/** Runs one enquiry mutation (`value` is the URL-encoded JSON payload) and returns its result. */
export async function runEnquiryMutation<T>(
	mutation: DocumentNode,
	field: string,
	dbName: string,
	payload: Record<string, unknown>,
): Promise<T> {
	const res = await apolloClient.mutate<Record<string, T>>({
		mutation,
		variables: { db_name: dbName, schema: "security", value: encodeObj(payload) },
	});
	return res.data?.[field] as T;
}

/** The server's message for a refused enquiry action, else `fallback`. */
export function enquiryErrorMessage(error: unknown, fallback: string): string {
	if (CombinedGraphQLErrors.is(error) && error.errors[0]?.message) return error.errors[0].message;
	return fallback;
}

/** The server's refusal code (e.g. EXTRA_BU_CONFIRM_REQUIRED), when it sent one. */
export function enquiryErrorCode(error: unknown): string | null {
	if (!CombinedGraphQLErrors.is(error)) return null;
	const code = error.errors[0]?.extensions?.code;
	return typeof code === "string" ? code : null;
}
