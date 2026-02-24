import { ComponentExample } from "@/components/example1/component-example";
import { ReduxCounterContainer } from "@/components/redux-counter/redux-counter-container";
import { SuperAdminDashboard } from "@/features/super-admin/super-admin-dashboard";
import { AdminsPage } from "@/features/super-admin/pages/admins-page";
import { AuditLogsPage } from "@/features/super-admin/pages/audit-logs-page";
import { ClientsPage } from "@/features/super-admin/pages/clients-page";
import { SystemSettingsPage } from "@/features/super-admin/pages/system-settings-page";
import { UsageHealthPage } from "@/features/super-admin/pages/usage-health-page";
import { SuperAdminDashboard as SuperAdminDashboardV2 } from "@/features/super-admin-v2/super-admin-dashboard";
import { AdminsPage as AdminsPageV2 } from "@/features/super-admin-v2/pages/admins-page";
import { AuditLogsPage as AuditLogsPageV2 } from "@/features/super-admin-v2/pages/audit-logs-page";
import { ClientsPage as ClientsPageV2 } from "@/features/super-admin-v2/pages/clients-page";
import { SystemSettingsPage as SystemSettingsPageV2 } from "@/features/super-admin-v2/pages/system-settings-page";
import { UsageHealthPage as UsageHealthPageV2 } from "@/features/super-admin-v2/pages/usage-health-page";
import { SuperAdminDashboardV3 } from "@/features/super-admin-v3/super-admin-dashboard";
import { AddClientPage } from "@/features/super-admin-v3/pages/add-client-page";
import { AddAdminPage } from "@/features/super-admin-v3/pages/add-admin-page";
import { ClientsPageV3 } from "@/features/super-admin-v3/pages/clients-page";
import { AdminsPageV3 } from "@/features/super-admin-v3/pages/admins-page";
import { UsageHealthPageV3 } from "@/features/super-admin-v3/pages/usage-health-page";
import { AuditLogsPageV3 } from "@/features/super-admin-v3/pages/audit-logs-page";
import { SystemSettingsPageV3 } from "@/features/super-admin-v3/pages/system-settings-page";
import { createBrowserRouter } from "react-router-dom";

export const router1 = createBrowserRouter([
    {
        element: <ComponentExample />,
        path: "/",
    },
    {
        element: <ReduxCounterContainer />,
        path: "/redux-counter",
    },
    // ── Super Admin (v1 – preserved) ──────────────────────────────
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
    // ── Super Admin V2 (Stitch-inspired) ──────────────────────────
    {
        element: <SuperAdminDashboardV2 />,
        path: "/super-admin-v2",
    },
    {
        element: <AdminsPageV2 />,
        path: "/super-admin-v2/admins",
    },
    {
        element: <AuditLogsPageV2 />,
        path: "/super-admin-v2/audit",
    },
    {
        element: <ClientsPageV2 />,
        path: "/super-admin-v2/clients",
    },
    {
        element: <SystemSettingsPageV2 />,
        path: "/super-admin-v2/settings",
    },
    {
        element: <UsageHealthPageV2 />,
        path: "/super-admin-v2/usage",
    },
    // ── Super Admin V3 (Action Dashboard) ─────────────────────────
    {
        element: <SuperAdminDashboardV3 />,
        path: "/super-admin-v3",
    },
    {
        element: <ClientsPageV3 />,
        path: "/super-admin-v3/clients",
    },
    {
        element: <AddClientPage />,
        path: "/super-admin-v3/clients/add",
    },
    {
        element: <AdminsPageV3 />,
        path: "/super-admin-v3/admins",
    },
    {
        element: <AddAdminPage />,
        path: "/super-admin-v3/admins/add",
    },
    {
        element: <UsageHealthPageV3 />,
        path: "/super-admin-v3/usage",
    },
    {
        element: <AuditLogsPageV3 />,
        path: "/super-admin-v3/audit",
    },
    {
        element: <SystemSettingsPageV3 />,
        path: "/super-admin-v3/settings",
    },
]);
