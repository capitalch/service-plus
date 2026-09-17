import { ClientLayout, useClientSelection } from "../components/layout/client-layout";
import { AdminSection } from "../components/accounts-admin/admin-section";
import { AddTeamMemberSection } from "../components/accounts-admin/add-team-member-section";

function AdminContent() {
	const { selected } = useClientSelection();

	switch (selected) {
		case "My Team":
			return <AddTeamMemberSection />;
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
