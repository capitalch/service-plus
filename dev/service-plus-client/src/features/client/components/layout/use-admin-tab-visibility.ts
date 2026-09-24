import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { ACCESS_RIGHTS, hasAccessRight } from "@/features/auth/utils/access-rights";
import { useAppSelector } from "@/store/hooks";
import { useSubscriptionTier } from "./use-subscription-tier";

// ADMIN_MENU is granted to the Manager role unconditionally (seed_security_data.py is
// not tier-aware), but Basic tier's one-user cap means USERS_MANAGE_OWN_BU can never
// actually create anyone there, and there's nothing else in Admin for a Manager besides
// Post/Unpost — so the whole tab is hidden client-side once the tier is known. Admin and
// Super Admin bypass hasAccessRight entirely (userType "A"/"S", never "B"), so they keep
// seeing Admin on every tier, same as today.
export function useIsAdminHiddenForBasicManager(): boolean {
	const currentUser = useAppSelector(selectCurrentUser);
	const subscriptionTier = useSubscriptionTier();

	return (
		currentUser?.userType === "B" &&
		hasAccessRight(currentUser, ACCESS_RIGHTS.ADMIN_MENU) &&
		subscriptionTier === "BASIC"
	);
}
