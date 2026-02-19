import { createBrowserRouter } from 'react-router-dom';
import App from '../app';
import ErrorPage from '../pages/error-page';
import LoginPage from '../pages/login-page';

/**
 * Router configuration using React Router v7
 * Routes:
 * - /login: Authentication page (unprotected)
 * - /: Main application (can be protected later)
 *
 * errorElement on the root layout catches errors from all child routes
 */
export const router = createBrowserRouter([
  {
    children: [
      { element: <App />, index: true },
      { element: <LoginPage />, path: 'login' },
    ],
    errorElement: <ErrorPage />,
    path: '/',
  },
]);
