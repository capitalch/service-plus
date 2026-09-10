import { GRAPHQL_MAP } from "@/constants/graphql-map";
import type { EwSendResultType } from "@/features/client/types/extended-warranty";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

type SendEwRemindersDataType = {
	sendEwReminders: { disabled?: boolean; results: EwSendResultType[] } | null;
};

export type EwSendOutcomeType = {
	disabled: boolean;
	results: EwSendResultType[];
};

/**
 * Fire the reminder send for one stage.
 *
 * `sent_by` is deliberately NOT passed: the server takes it from the authenticated
 * session so the Message Log attributes every send to a real user. `branch_id` is
 * likewise re-checked server-side — a list of ids is never proof of authorisation.
 *
 * A per-customer `SKIPPED` result usually means the stage was already claimed by a
 * concurrent send, which is the exactly-once guard doing its job, not an error.
 */
export async function sendEwReminders(
	dbName: string,
	schema: string,
	branchId: number,
	ewCustomerIds: number[],
	stage: number,
): Promise<EwSendOutcomeType> {
	const res = await apolloClient.mutate<SendEwRemindersDataType>({
		mutation: GRAPHQL_MAP.sendEwReminders,
		variables: {
			db_name: dbName,
			schema,
			value: encodeObj({ branch_id: branchId, ew_customer_ids: ewCustomerIds, stage }),
		},
	});
	return {
		disabled: res.data?.sendEwReminders?.disabled ?? false,
		results: res.data?.sendEwReminders?.results ?? [],
	};
}

type AddEwFollowUpDataType = { addEwFollowUp: { ok: boolean } | null };

/**
 * The single close point for BOTH follow-up channels — the Interest grid and the deep
 * link from the staff WhatsApp alert both land here, so there is one lead and one
 * history. `staff_id` comes from the session server-side, never from here.
 */
export async function addEwFollowUp(
	dbName: string,
	schema: string,
	payload: {
		action: string;
		ewCustomerId: number;
		outcome: string;
		remarks: string | null;
		stage: number | null;
	},
): Promise<boolean> {
	const res = await apolloClient.mutate<AddEwFollowUpDataType>({
		mutation: GRAPHQL_MAP.addEwFollowUp,
		variables: {
			db_name: dbName,
			schema,
			value: encodeObj({
				action: payload.action,
				ew_customer_id: payload.ewCustomerId,
				outcome: payload.outcome,
				remarks: payload.remarks,
				stage: payload.stage,
			}),
		},
	});
	return res.data?.addEwFollowUp?.ok ?? false;
}

type ResendEwLeadAlertDataType = { resendEwLeadAlert: { ok: boolean } | null };

/** Re-send a staff alert that failed, or predates a staff number being configured. */
export async function resendEwLeadAlert(
	dbName: string,
	schema: string,
	ewCustomerId: number,
	stage: number,
): Promise<boolean> {
	const res = await apolloClient.mutate<ResendEwLeadAlertDataType>({
		mutation: GRAPHQL_MAP.resendEwLeadAlert,
		variables: {
			db_name: dbName,
			schema,
			value: encodeObj({ ew_customer_id: ewCustomerId, stage }),
		},
	});
	return res.data?.resendEwLeadAlert?.ok ?? false;
}
