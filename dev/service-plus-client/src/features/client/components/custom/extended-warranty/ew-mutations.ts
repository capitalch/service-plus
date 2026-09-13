/**
 * Extended Warranty mutations — thin wrappers over the four EW GraphQL mutations and the one
 * genericUpdate delete, plus the send-result toasts. `sent_by` / `user_id` are never sent:
 * the server takes them from the session.
 */
import { toast } from "sonner";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import type {
	EwFollowUpActionType,
	EwFollowUpResultType,
	EwProgressStageType,
	EwResendAlertResultType,
	EwSendResponseType,
	EwStateType,
	EwTransitionResultType,
} from "@/features/client/types/extended-warranty";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";

export type EwScopeType = { dbName: string; schema: string };

type GraphQlErrorLikeType = { extensions?: { details?: unknown } };

export async function addEwFollowUp(
	scope: EwScopeType,
	payload: {
		action: EwFollowUpActionType;
		branchId: number;
		ewLeadId: number;
		nextFollowUpAt: string | null;
		notes: string;
		progressStage: EwProgressStageType;
	},
): Promise<EwFollowUpResultType> {
	const res = await apolloClient.mutate<{ addEwFollowUp: EwFollowUpResultType | null }>({
		mutation: GRAPHQL_MAP.addEwFollowUp,
		variables: {
			db_name: scope.dbName,
			schema: scope.schema,
			value: encodeObj({
				action: payload.action,
				branch_id: payload.branchId,
				ew_lead_id: payload.ewLeadId,
				next_follow_up_at: payload.nextFollowUpAt,
				notes: payload.notes,
				progress_stage: payload.progressStage,
			}),
		},
	});
	return res.data?.addEwFollowUp ?? { ok: false };
}

/** Hard delete — a New Lead with no messages only (D9); everything else is Cancelled. */
export async function deleteEwLead(scope: EwScopeType, ewLeadId: number): Promise<void> {
	await apolloClient.mutate({
		mutation: GRAPHQL_MAP.genericUpdate,
		variables: {
			db_name: scope.dbName,
			schema: scope.schema,
			value: graphQlUtils.buildGenericUpdateValue({ deletedIds: [ewLeadId], tableName: "ew_lead", xData: [] }),
		},
	});
}

/** Fills a MESSAGES template: `{count}`, `{plural}` (follows count) and `{state}`. */
export function fillMessage(template: string, values: { count?: number; state?: string }): string {
	return template
		.replace("{count}", String(values.count ?? ""))
		.replace("{plural}", values.count === 1 ? "" : "s")
		.replace("{state}", values.state ?? "");
}

/**
 * True when a save failed on the ew_lead (mobile, serial no, warranty date) unique index.
 * The constraint text travels in the GraphQL error's `extensions.details`.
 */
export function isDuplicateLeadError(err: unknown): boolean {
	const errorList =
		(err as { errors?: GraphQlErrorLikeType[]; graphQLErrors?: GraphQlErrorLikeType[] } | null)?.errors ??
		(err as { graphQLErrors?: GraphQlErrorLikeType[] } | null)?.graphQLErrors ??
		[];
	const text = [
		err instanceof Error ? err.message : String(err),
		...errorList.map((e) => String(e.extensions?.details ?? "")),
	].join(" ");
	return /ew_lead_dedup_idx|duplicate key/i.test(text);
}

export async function resendEwLeadAlert(
	scope: EwScopeType,
	branchId: number,
	ewLeadId: number,
): Promise<EwResendAlertResultType> {
	const res = await apolloClient.mutate<{ resendEwLeadAlert: EwResendAlertResultType | null }>({
		mutation: GRAPHQL_MAP.resendEwLeadAlert,
		variables: {
			db_name: scope.dbName,
			schema: scope.schema,
			value: encodeObj({ branch_id: branchId, ew_lead_id: ewLeadId }),
		},
	});
	return res.data?.resendEwLeadAlert ?? { ok: false };
}

export async function sendEwReminders(
	scope: EwScopeType,
	branchId: number,
	ewLeadIds: number[],
): Promise<EwSendResponseType> {
	const res = await apolloClient.mutate<{ sendEwReminders: EwSendResponseType | null }>({
		mutation: GRAPHQL_MAP.sendEwReminders,
		variables: {
			db_name: scope.dbName,
			schema: scope.schema,
			value: encodeObj({ branch_id: branchId, ew_lead_ids: ewLeadIds }),
		},
	});
	return res.data?.sendEwReminders ?? { results: [] };
}

/** One toast per outcome group, so a bulk send reads as a summary, not a flood. */
export function toastSendResults(response: EwSendResponseType): void {
	if (response.disabled) {
		toast.info(MESSAGES.INFO_EW_DISABLED);
		return;
	}
	function countOf(status: string): number {
		return response.results.filter((r) => r.status === status).length;
	}
	const capped = countOf("CAPPED");
	const failed = countOf("FAILED");
	const sent = countOf("SENT");
	const skipped = countOf("SKIPPED");
	if (sent) toast.success(fillMessage(MESSAGES.SUCCESS_EW_REMINDERS_SENT, { count: sent }));
	if (failed) toast.error(fillMessage(MESSAGES.ERROR_EW_SEND_SOME_FAILED, { count: failed }));
	if (capped) toast.warning(fillMessage(MESSAGES.WARN_EW_SEND_CAPPED, { count: capped }));
	if (skipped) toast.warning(fillMessage(MESSAGES.WARN_EW_SEND_SKIPPED, { count: skipped }));
}

export async function transitionEwLead(
	scope: EwScopeType,
	payload: {
		branchId: number;
		ewLeadId: number;
		notes: string | null;
		progressStage?: EwProgressStageType;
		toState: EwStateType;
	},
): Promise<EwTransitionResultType> {
	const res = await apolloClient.mutate<{ transitionEwLead: EwTransitionResultType | null }>({
		mutation: GRAPHQL_MAP.transitionEwLead,
		variables: {
			db_name: scope.dbName,
			schema: scope.schema,
			value: encodeObj({
				branch_id: payload.branchId,
				ew_lead_id: payload.ewLeadId,
				notes: payload.notes,
				progress_stage: payload.progressStage ?? null,
				to_state: payload.toState,
			}),
		},
	});
	return res.data?.transitionEwLead ?? { ok: false };
}
