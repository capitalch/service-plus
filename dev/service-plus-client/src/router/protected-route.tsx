import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '@/features/auth/store/auth-slice';
import { ROUTES } from './routes';

export const ProtectedRoute = () => {
    const isAuthenticated = useAppSelector(selectIsAuthenticated);
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate replace state={{ from: location }} to={ROUTES.login} />;
    }

    return <Outlet />;
};
