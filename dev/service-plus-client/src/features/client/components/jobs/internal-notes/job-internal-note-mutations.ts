/**
 * Internal-note mutations. The author / editor is never sent — the server takes it from the
 * session. A `{ ok: false, reason }` result is thrown as an InternalNoteErrorType so callers
 * handle it with the GraphQL errors.
 */
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

export type InternalNoteScopeType = { dbName: string; schema: string };

type InternalNoteResultType = { ok: boolean; reason?: string } | null;

export class InternalNoteErrorType extends Error {
	reason: string;
	constructor(reason: string) {
		super(reason);
		this.reason = reason;
	}
}

export async function addJobInternalNote(
	scope: InternalNoteScopeType,
	payload: { branchId: number; jobId: number; note: string },
): Promise<void> {
	const res = await apolloClient.mutate<{ addJobInternalNote: InternalNoteResultType }>({
		mutation: GRAPHQL_MAP.addJobInternalNote,
		variables: {
			db_name: scope.dbName,
			schema: scope.schema,
			value: encodeObj({ branch_id: payload.branchId, job_id: payload.jobId, note: payload.note }),
		},
	});
	throwUnlessOk(res.data?.addJobInternalNote);
}

export async function deleteJobInternalNote(
	scope: InternalNoteScopeType,
	payload: { branchId: number; id: number },
): Promise<void> {
	const res = await apolloClient.mutate<{ deleteJobInternalNote: InternalNoteResultType }>({
		mutation: GRAPHQL_MAP.deleteJobInternalNote,
		variables: {
			db_name: scope.dbName,
			schema: scope.schema,
			value: encodeObj({ branch_id: payload.branchId, id: payload.id }),
		},
	});
	throwUnlessOk(res.data?.deleteJobInternalNote);
}

/** The server's message for a GraphQL error (e.g. read-only BU), else the fallback. */
export function internalNoteErrorMessage(err: unknown, fallback: string, notFound: string): string {
	if (err instanceof InternalNoteErrorType) return notFound;
	return (err as { graphQLErrors?: { message: string }[] })?.graphQLErrors?.[0]?.message ?? fallback;
}

function throwUnlessOk(result: InternalNoteResultType | undefined): void {
	if (!result?.ok) throw new InternalNoteErrorType(result?.reason ?? "UNKNOWN");
}

export async function updateJobInternalNote(
	scope: InternalNoteScopeType,
	payload: { branchId: number; id: number; note: string },
): Promise<void> {
	const res = await apolloClient.mutate<{ updateJobInternalNote: InternalNoteResultType }>({
		mutation: GRAPHQL_MAP.updateJobInternalNote,
		variables: {
			db_name: scope.dbName,
			schema: scope.schema,
			value: encodeObj({ branch_id: payload.branchId, id: payload.id, note: payload.note }),
		},
	});
	throwUnlessOk(res.data?.updateJobInternalNote);
}
