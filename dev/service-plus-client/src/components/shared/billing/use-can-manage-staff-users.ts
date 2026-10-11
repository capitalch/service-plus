import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { selectBilling } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

/**
 * Whether the current user may add Receptionist / Technician users: a Manager, on Standard or
 * above. A BU with no plan is not billed, so it counts as unlimited. Mirrors the server's
 * require_manager_creates_staff_user, which is what actually refuses; this only hides the screen.
 */
export const useCanManageStaffUsers = (): boolean => {
	const billing = useAppSelector(selectBilling);
	const user = useAppSelector(selectCurrentUser);
	const planOk = !billing?.planCode || billing.planCode === "standard" || billing.planCode === "enterprise";
	return user?.userType === "B" && user.roleCode === "MANAGER" && planOk;
};
