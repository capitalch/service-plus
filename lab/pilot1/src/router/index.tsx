import { ComponentExample } from "@/components/example1/component-example";
import { ReduxCounterContainer } from "@/components/redux-counter/redux-counter-container";
import { SuperAdminDashboard } from "@/features/super-admin/super-admin-dashboard";
import { AdminsPage } from "@/features/super-admin/pages/admins-page";
import { AuditLogsPage } from "@/features/super-admin/pages/audit-logs-page";
import { ClientsPage } from "@/features/super-admin/pages/clients-page";
import { SystemSettingsPage } from "@/features/super-admin/pages/system-settings-page";
import { UsageHealthPage } from "@/features/super-admin/pages/usage-health-page";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
    {
        element: <ComponentExample />,
        path: "/",
    },
    {
        element: <ReduxCounterContainer />,
        path: "/redux-counter",
    },
    {
        element: <SuperAdminDashboard />,
        path: "/super-admin",
    },
    {
        element: <AdminsPage />,
        path: "/super-admin/admins",
    },
    {
        element: <AuditLogsPage />,
        path: "/super-admin/audit",
    },
    {
        element: <ClientsPage />,
        path: "/super-admin/clients",
    },
    {
        element: <SystemSettingsPage />,
        path: "/super-admin/settings",
    },
    {
        element: <UsageHealthPage />,
        path: "/super-admin/usage",
    },
]);
