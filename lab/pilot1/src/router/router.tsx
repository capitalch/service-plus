import { LandingPage } from "@/features/landing/landing-page";
import { ComponentExample } from "@/components/example1/component-example";
import { createBrowserRouter } from "react-router-dom";
import { RootElement } from "./root-element";
import { SuperAdminPage } from "@/features/super-admin/super-admin-page";
import { AdminsPage } from "@/features/super-admin/pages/admins-page";
import { ClientsPage } from "@/features/super-admin/pages/clients-page";
import { AuditLogsPage } from "@/features/super-admin/pages/audit-logs-page";
import { UsageHealthPage } from "@/features/super-admin/pages/usage-health-page";
import { SystemSettingsPage } from "@/features/super-admin/pages/system-settings-page";
import { SuperAdminV2Page } from "@/features/super-admin-v2/super-admin-page";
import { AdminsPage as AdminsPageV2 } from "@/features/super-admin-v2/pages/admins-page";
import { AuditLogsPage as AuditLogsPageV2 } from "@/features/super-admin-v2/pages/audit-logs-page";
import { ClientsPage as ClientsPageV2 } from "@/features/super-admin-v2/pages/clients-page";
import { SystemSettingsPage as SystemSettingsPageV2 } from "@/features/super-admin-v2/pages/system-settings-page";
import { UsageHealthPage as UsageHealthPageV2 } from "@/features/super-admin-v2/pages/usage-health-page";
import { SuperAdminV3Page } from "@/features/super-admin-v3/super-admin-page";
import { AddAdminPage as AddAdminPageV3 } from "@/features/super-admin-v3/pages/add-admin-page";
import { AddClientPage as AddClientPageV3 } from "@/features/super-admin-v3/pages/add-client-page";
import { AdminsPageV3 } from "@/features/super-admin-v3/pages/admins-page";
import { AuditLogsPageV3 } from "@/features/super-admin-v3/pages/audit-logs-page";
import { ClientsPageV3 } from "@/features/super-admin-v3/pages/clients-page";
import { SystemSettingsPageV3 } from "@/features/super-admin-v3/pages/system-settings-page";
import { UsageHealthPageV3 } from "@/features/super-admin-v3/pages/usage-health-page";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <RootElement />,
        children: [
            {
                path: "example1",
                element: <ComponentExample />,
            },
            {
                path: "super-admin",
                children: [
                    {
                        index: true,
                        element: <SuperAdminPage />,
                    },
                    {
                        path: "admins",
                        element: <AdminsPage />,
                    },
                    {
                        path: "clients",
                        element: <ClientsPage />,
                    },
                    {
                        path: "audit",
                        element: <AuditLogsPage />,
                    },
                    {
                        path: "usage",
                        element: <UsageHealthPage />,
                    },
                    {
                        path: "settings",
                        element: <SystemSettingsPage />,
                    },
                ],
            },
            {
                path: "super-admin-v2",
                children: [
                    {
                        index: true,
                        element: <SuperAdminV2Page />,
                    },
                    {
                        path: "admins",
                        element: <AdminsPageV2 />,
                    },
                    {
                        path: "clients",
                        element: <ClientsPageV2 />,
                    },
                    {
                        path: "audit",
                        element: <AuditLogsPageV2 />,
                    },
                    {
                        path: "usage",
                        element: <UsageHealthPageV2 />,
                    },
                    {
                        path: "settings",
                        element: <SystemSettingsPageV2 />,
                    },
                ],
            },
            {
                path: "super-admin-v3",
                children: [
                    {
                        index: true,
                        element: <SuperAdminV3Page />,
                    },
                    {
                        path: "admins",
                        children: [
                            {
                                index: true,
                                element: <AdminsPageV3 />,
                            },
                            {
                                path: "add",
                                element: <AddAdminPageV3 />,
                            },
                        ],
                    },
                    {
                        path: "clients",
                        children: [
                            {
                                index: true,
                                element: <ClientsPageV3 />,
                            },
                            {
                                path: "add",
                                element: <AddClientPageV3 />,
                            },
                        ],
                    },
                    {
                        path: "audit",
                        element: <AuditLogsPageV3 />,
                    },
                    {
                        path: "usage",
                        element: <UsageHealthPageV3 />,
                    },
                    {
                        path: "settings",
                        element: <SystemSettingsPageV3 />,
                    },
                ],
            },
        ],
    },
    {
        path: "landing",
        element: <LandingPage />,
    },
]);

