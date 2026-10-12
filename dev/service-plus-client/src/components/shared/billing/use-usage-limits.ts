import { useCallback } from "react";

import { requestBillingRefresh, selectJobLimitReached, selectWhatsappLimitReached } from "@/store/context-slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

/**
 * The current BU's monthly allowances (plans/plan.md Step 8). Display and pre-disable only — the
 * server counts and refuses. Call `refreshUsage` after a job is saved or a message is sent so the
 * usage lines follow.
 */
export const useUsageLimits = () => {
	const dispatch = useAppDispatch();
	const isJobLimitReached = useAppSelector(selectJobLimitReached);
	const isWhatsappLimitReached = useAppSelector(selectWhatsappLimitReached);
	const refreshUsage = useCallback(() => dispatch(requestBillingRefresh()), [dispatch]);

	return { isJobLimitReached, isWhatsappLimitReached, refreshUsage };
};
