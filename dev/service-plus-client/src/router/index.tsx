import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import LoginPage from '../pages/LoginPage';

/**
 * Router configuration using React Router v7
 * Routes:
 * - /login: Authentication page (unprotected)
 * - /: Main application (can be protected later)
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <App />,
  },
]);
