import { selectBilling } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

/**
 * Whether the current BU gets the Enterprise-only features: adding branches and divisions, and
 * the integration app settings. True on Enterprise, and for a BU with no plan (not billed) — the
 * server sets no limits there. On Lite / Basic / Standard those controls are hidden, not disabled.
 */
export const useHasEnterpriseFeatures = (): boolean => {
	const billing = useAppSelector(selectBilling);
	return !billing?.planCode || billing.planCode === "enterprise";
};
