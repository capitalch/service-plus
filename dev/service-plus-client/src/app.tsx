import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { selectCurrentUser, selectSessionMode } from '@/features/auth/store/auth-slice';
import { ClientDashboardPage } from '@/features/client/pages/client-dashboard-page';
import { ROUTES } from '@/router/routes';

/**
 * Root App component
 * ProtectedRoute already guards against unauthenticated access.
 * This component redirects authenticated users to their landing page
 * based on their user type and session mode.
 */
export const App = () => {
    const sessionMode = useAppSelector(selectSessionMode);
    const user        = useAppSelector(selectCurrentUser);

    if (user?.userType === 'S') return <Navigate replace to={ROUTES.superAdmin.root} />;
    if (sessionMode === 'admin') return <Navigate replace to={ROUTES.admin.root} />;

    // Client mode (type B always, type A after choosing client mode)
    return <ClientDashboardPage />;
};

export default App;
