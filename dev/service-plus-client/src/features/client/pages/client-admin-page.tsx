import { ClientLayout, useClientSelection } from "../components/client-layout";
import { AdminSection } from "../components/admin/admin-section";

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
