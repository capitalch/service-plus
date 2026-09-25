import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { ACCESS_RIGHTS, hasAccessRight } from "@/features/auth/utils/access-rights";
import { ClientLayout, useClientSelection } from "../components/layout/client-layout";
import { useIsAdminHiddenForBasicManager } from "../components/layout/use-admin-tab-visibility";
import { AdminSection } from "../components/accounts-admin/admin-section";
import { UsersSection } from "../components/accounts-admin/users-section";

function AdminContent() {
	const { selected } = useClientSelection();
	const currentUser = useAppSelector(selectCurrentUser);
	const hideAdmin = useIsAdminHiddenForBasicManager();
	// "Users" is Manager-only — see AdminExplorer's matching check. Admin/Super Admin
	// bypass hasAccessRight, so userType must be checked directly, not just the right.
	const canManageOwnBu =
		currentUser?.userType === "B" && hasAccessRight(currentUser, ACCESS_RIGHTS.USERS_MANAGE_OWN_BU);

	// Nav already hides the "Admin" tab for a Basic-tier Manager — this only guards a
	// stale link/bookmark landing here directly (see AdminExplorer's matching guard).
	if (hideAdmin) {
		return <p className="p-6 text-sm text-(--cl-text-muted)">Not available on your plan.</p>;
	}

	switch (selected) {
		case "Users":
			return canManageOwnBu ? <UsersSection /> : <AdminSection group="post-unpost" />;
		case "Post / Unpost":
		default:
			return <AdminSection group="post-unpost" />;
	}
}

export const ClientAdminPage = () => (
	<ClientLayout>
		<AdminContent />
	</ClientLayout>
);
