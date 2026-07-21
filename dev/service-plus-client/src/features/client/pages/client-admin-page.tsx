import { ClientLayout, useClientSelection } from "../components/layout/client-layout";
import { AdminSection } from "../components/accounts-admin/admin-section";

function AdminContent() {
    const { selected } = useClientSelection();

    switch (selected) {
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
