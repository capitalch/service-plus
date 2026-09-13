import { useEffect, useRef } from "react";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { EwDeliveryEventType } from "@/features/client/types/extended-warranty";
import { apolloClient } from "@/lib/apollo-client";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

/**
 * A whatsappDeliveryStatus payload. Two kinds concern Extended Warranty: "EW" is one
 * message's delivery outcome from the Meta webhook, "EW_LEAD" is any other change to a lead,
 * published by the mutations, the sender and the public interest / opt-out routes. `kind` is
 * missing on events from a server that predates it — those are job events. `schema` is
 * missing on an older server too, and the subscription filters by db_name alone, so an event
 * that carries none is taken rather than dropped.
 */
type EwLiveEventType = Partial<Omit<EwDeliveryEventType, "kind">> & {
	kind?: "EW" | "EW_LEAD" | "JOB";
	schema?: string;
};

/** Delay before a pushed change is read back — coalesces a burst into one round trip. */
const PUSH_COALESCE_MS = 350;

/**
 * Calls `onChange` whenever anything changes an Extended Warranty lead anywhere — a state or
 * stage move, a follow-up, a send, a delivery or read receipt, the customer's interest or
 * opt-out, a lead saved or deleted — including a change made by another user.
 *
 * Each caller re-reads only what it owns: the section its dashboard and grids, the bell its
 * Interested count. One subscription per caller rather than a single shared broadcaster is
 * deliberate — the bell lives for the whole session and the section only for its screen, and
 * Apollo multiplexes both over the one graphql-ws link.
 *
 * Pass `enabled` false wherever the count would not be read anyway (the add-on off, or the
 * user without the right), so those sessions open no subscription at all.
 */
export const useEwLiveRefresh = (onChange: () => void, enabled = true): void => {
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);
	const onChangeRef = useRef(onChange);

	// Kept in a ref so an inline callback cannot tear the subscription down and rebuild it.
	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		if (!enabled || !dbName) return;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const sub = apolloClient
			.subscribe<{ whatsappDeliveryStatus: EwLiveEventType | null }>({
				query: GRAPHQL_MAP.whatsappDeliveryStatus,
				variables: { db_name: dbName },
			})
			.subscribe({
				next: ({ data }) => {
					const event = data?.whatsappDeliveryStatus;
					const kind = event?.kind ?? "JOB";
					if (kind !== "EW" && kind !== "EW_LEAD") return;
					// The subscription is scoped to the tenant, not the BU; skip another BU's.
					if (event?.schema && event.schema !== schema) return;
					// The session that made the change has already refreshed itself, and one
					// send settles several messages — coalesce rather than read back per event.
					if (timer) clearTimeout(timer);
					timer = setTimeout(() => onChangeRef.current(), PUSH_COALESCE_MS);
				},
			});
		return () => {
			if (timer) clearTimeout(timer);
			sub.unsubscribe();
		};
	}, [dbName, schema, enabled]);
};
