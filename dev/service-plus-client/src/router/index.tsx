import { createBrowserRouter } from 'react-router-dom';
import App from '../app';
import ErrorPage from '../pages/error-page';
import LoginPage from '../features/auth/pages/login-page';
import NotFoundPage from '../pages/not-found-page';
import { SuperAdminDashboard } from '@/features/super-admin/pages/super-admin-dashboard-page';
import { ClientsPage } from '@/features/super-admin/pages/clients-page';
import { AdminsPage } from '@/features/super-admin/pages/admins-page';
import { UsageHealthPage } from '@/features/super-admin/pages/usage-health-page';
import { AuditLogsPage } from '@/features/super-admin/pages/audit-logs-page';
import { SystemSettingsPage } from '@/features/super-admin/pages/system-settings-page';
import { ProtectedRoute } from './protected-route';
import { ROUTES } from './routes';

/**
 * Router configuration using React Router v7
 * Routes:
 * - /login: Authentication page (unprotected)
 * - /: Main application (protected)
 * - /super-admin: Super admin dashboard and nested pages (protected)
 *
 * errorElement on the root layout catches errors from all child routes
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
      { element: <LoginPage />, path: 'login' }, // Note: we keep 'login' relative to '/' as per React Router convention, or just use ROUTES.login directly.  Using the constant is better for refactoring.
    ],
  },
  {
    path: ROUTES.superAdmin.root,
    errorElement: <ErrorPage />,
    element: <ProtectedRoute />,
    children: [
      { element: <SuperAdminDashboard />, index: true },
      { element: <ClientsPage />, path: 'clients' },
      { element: <AdminsPage />, path: 'admins' },
      { element: <UsageHealthPage />, path: 'usage' },
      { element: <AuditLogsPage />, path: 'audit' },
      { element: <SystemSettingsPage />, path: 'settings' },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

