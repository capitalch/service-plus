import { createBrowserRouter } from 'react-router-dom';
import App from '../app';
import ErrorPage from '../pages/error-page';
import LoginPage from '../pages/login-page';
import { SuperAdminDashboard } from '@/features/super-admin/super-admin-dashboard';
import { ClientsPage } from '@/features/super-admin/pages/clients-page';
import { AdminsPage } from '@/features/super-admin/pages/admins-page';
import { UsageHealthPage } from '@/features/super-admin/pages/usage-health-page';
import { AuditLogsPage } from '@/features/super-admin/pages/audit-logs-page';
import { SystemSettingsPage } from '@/features/super-admin/pages/system-settings-page';

/**
 * Router configuration using React Router v7
 * Routes:
 * - /login: Authentication page (unprotected)
 * - /: Main application (can be protected later)
 * - /super-admin: Super admin dashboard and nested pages
 *
 * errorElement on the root layout catches errors from all child routes
 */
export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <ErrorPage />,
    children: [
      { element: <App />, index: true },
      { element: <LoginPage />, path: 'login' },
    ],
  },
  {
    path: '/super-admin',
    errorElement: <ErrorPage />,
    children: [
      { element: <SuperAdminDashboard />, index: true },
      { element: <ClientsPage />, path: 'clients' },
      { element: <AdminsPage />, path: 'admins' },
      { element: <UsageHealthPage />, path: 'usage' },
      { element: <AuditLogsPage />, path: 'audit' },
      { element: <SystemSettingsPage />, path: 'settings' },
    ],
  },
]);
