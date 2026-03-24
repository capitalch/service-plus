import { createBrowserRouter } from 'react-router-dom';
import App from '../app';
import ErrorPage from '../pages/error-page';
import LoginPage from '../features/auth/pages/login-page';
import { ResetPasswordPage } from '../features/auth/pages/reset-password-page';
import NotFoundPage from '../pages/not-found-page';
import { SuperAdminDashboard } from '@/features/super-admin/pages/super-admin-dashboard-page';
import { ClientsPage } from '@/features/super-admin/pages/clients-page';
import { UsageHealthPage } from '@/features/super-admin/pages/usage-health-page';
import { AuditLogsPage } from '@/features/super-admin/pages/audit-logs-page';
import { SystemSettingsPage } from '@/features/super-admin/pages/system-settings-page';
import { AdminDashboardPage } from '@/features/admin/pages/admin-dashboard-page';
import { AdminAuditLogsPage } from '@/features/admin/pages/admin-audit-logs-page';
import { BusinessUnitsPage } from '@/features/admin/pages/business-units-page';
import { BusinessUsersPage } from '@/features/admin/pages/business-users-page';
import { RolesPage } from '@/features/admin/pages/roles-page';
import { ClientConfigurationsPage } from '@/features/client/pages/client-configurations-page';
import { ClientDashboardPage } from '@/features/client/pages/client-dashboard-page';
import { ClientInventoryPage } from '@/features/client/pages/client-inventory-page';
import { ClientJobsPage } from '@/features/client/pages/client-jobs-page';
import { ClientMastersPage } from '@/features/client/pages/client-masters-page';
import { ClientReportsPage } from '@/features/client/pages/client-reports-page';
import { ProtectedRoute } from './protected-route';
import { ROUTES } from './routes';

/**
 * Router configuration using React Router v7
 * Routes:
 * - /login: Authentication page (unprotected)
 * - /: Main application entry (protected, redirects based on user type/session)
 * - /client/*: Client mode pages (protected, requires session mode 'client')
 * - /admin/*: Admin mode pages (protected, requires user type A + session mode 'admin')
 * - /super-admin/*: Super admin pages (protected)
 */
export const router = createBrowserRouter([
  {
    path: ROUTES.home,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          { element: <App />, index: true },
        ],
      },
      { element: <LoginPage />, path: 'login' },
      { element: <ResetPasswordPage />, path: 'reset-password' },
    ],
  },
  // Client mode routes (/client/*)
  {
    path: ROUTES.client.root,
    errorElement: <ErrorPage />,
    element: <ProtectedRoute requiredSessionMode="client" />,
    children: [
      { element: <ClientDashboardPage />,      index: true },
      { element: <ClientConfigurationsPage />, path: 'configurations' },
      { element: <ClientInventoryPage />,      path: 'inventory' },
      { element: <ClientJobsPage />,           path: 'jobs' },
      { element: <ClientMastersPage />,        path: 'masters' },
      { element: <ClientReportsPage />,        path: 'reports' },
    ],
  },
  {
    path: ROUTES.superAdmin.root,
    errorElement: <ErrorPage />,
    element: <ProtectedRoute />,
    children: [
      { element: <SuperAdminDashboard />, index: true },
      { element: <ClientsPage />,         path: 'clients' },
      { element: <UsageHealthPage />,     path: 'usage' },
      { element: <AuditLogsPage />,       path: 'audit' },
      { element: <SystemSettingsPage />,  path: 'settings' },
    ],
  },
  // Admin User routes (/admin/*)
  {
    path: ROUTES.admin.root,
    errorElement: <ErrorPage />,
    element: <ProtectedRoute requiredSessionMode="admin" requiredUserType="A" />,
    children: [
      { element: <AdminDashboardPage />,  index: true },
      { element: <AdminAuditLogsPage />,  path: 'audit' },
      { element: <BusinessUnitsPage />,   path: 'business-units' },
      { element: <BusinessUsersPage />,   path: 'users' },
      { element: <RolesPage />,           path: 'roles' },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
