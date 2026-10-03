import { useCallback, useEffect, useState } from "react";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";

type CountRowType = { pending: number };

type UseEnquiryCountOptionsType = {
	/** "" for the Super Admin's control plane. */
	dbName: string | null;
	enabled: boolean;
	/** "security" for lt sign-ups, "public" for Enterprise. */
	schema: string;
	sqlId: string;
};

/**
 * The pending-enquiry count behind an approver's bell: read on mount, then pushed by the
 * salesEnquiryCount subscription whenever a sign-up arrives or is decided. Also returns a
 * `refresh` for the screen that just changed something.
 */
export const useEnquiryCount = ({ dbName, enabled, schema, sqlId }: UseEnquiryCountOptionsType) => {
	const [count, setCount] = useState(0);

	const refresh = useCallback(async () => {
		if (!enabled || dbName == null) return;
		try {
			const res = await apolloClient.query<{ genericQuery: CountRowType[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId }) },
			});
			setCount(res.data?.genericQuery?.[0]?.pending ?? 0);
		} catch {
			// The badge is a convenience; the Enquiries page shows the real list.
		}
	}, [dbName, enabled, schema, sqlId]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	useEffect(() => {
		if (!enabled || dbName == null) return;
		const sub = apolloClient
			.subscribe<{ salesEnquiryCount: CountRowType | null }>({
				query: GRAPHQL_MAP.salesEnquiryCount,
				variables: { db_name: dbName },
			})
			.subscribe({
				next: ({ data }) => {
					const pending = data?.salesEnquiryCount?.pending;
					if (typeof pending === "number") setCount(pending);
				},
			});
		return () => sub.unsubscribe();
	}, [dbName, enabled]);

	return { count, refresh };
};
