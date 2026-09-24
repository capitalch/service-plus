import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { useAppSelector } from "@/store/hooks";

export type SubscriptionTierType = "BASIC" | "ENTERPRISE" | "PRO";

// subscriptionTier rides on the login/token-refresh response (server resolves it from
// public.client — see app/routers/auth/helper.py's login_helper — while looking up
// db_name from client_id, so it costs nothing extra). It is NOT re-fetched over
// genericQuery: that path requires db_name: "" to reach the client-registry database,
// which require_own_tenant rejects for every caller except Super Admin — confirmed live
// against auth_guards.py, so a genericQuery-based fetch here would silently return null
// for every Manager/Admin, the exact bug this hook replaced.
export function useSubscriptionTier(): SubscriptionTierType | null {
	const currentUser = useAppSelector(selectCurrentUser);
	return currentUser?.subscriptionTier ?? null;
}
