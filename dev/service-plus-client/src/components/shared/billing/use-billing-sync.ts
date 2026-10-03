import { useEffect } from "react";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { selectBillingRefreshTick, selectSchema, setBilling } from "@/store/context-slice";
import type { BuBillingType } from "@/store/context-slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

/**
 * Keeps `context.billing` in step with the server: reads buBillingStatus when the BU changes,
 * when the window regains focus, and when a write was refused for billing (the Apollo error
 * link bumps the refresh tick). The status is never computed in the browser.
 */
export const useBillingSync = (): void => {
	const dispatch = useAppDispatch();
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);
	const tick = useAppSelector(selectBillingRefreshTick);

	useEffect(() => {
		if (!dbName || !schema) {
			dispatch(setBilling(null));
			return;
		}
		let cancelled = false;

		async function load() {
			try {
				const res = await apolloClient.query<{ buBillingStatus: BuBillingType | null }>({
					fetchPolicy: "network-only",
					query: GRAPHQL_MAP.buBillingStatus,
					variables: { db_name: dbName, schema },
				});
				if (!cancelled) dispatch(setBilling(res.data?.buBillingStatus ?? null));
			} catch {
				// Unknown status: show nothing and block nothing; the server still guards writes.
			}
		}

		load();
		window.addEventListener("focus", load);
		return () => {
			cancelled = true;
			window.removeEventListener("focus", load);
		};
	}, [dbName, dispatch, schema, tick]);
};
