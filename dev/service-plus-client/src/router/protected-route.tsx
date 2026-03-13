import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import {
    selectCurrentUser,
    selectIsAuthenticated,
    selectSessionMode,
} from '@/features/auth/store/auth-slice';
import { ROUTES } from './routes';

type ProtectedRoutePropsType = {
    requiredSessionMode?: 'admin' | 'client';
    requiredUserType?:    'A' | 'B' | 'S';
};

export const ProtectedRoute = ({ requiredSessionMode, requiredUserType }: ProtectedRoutePropsType) => {
    const isAuthenticated = useAppSelector(selectIsAuthenticated);
    const sessionMode     = useAppSelector(selectSessionMode);
    const user            = useAppSelector(selectCurrentUser);
    const location        = useLocation();

    if (!isAuthenticated) {
        return <Navigate replace state={{ from: location }} to={ROUTES.login} />;
    }

    if (requiredUserType && user?.userType !== requiredUserType) {
        return <Navigate replace to={ROUTES.login} />;
    }

    if (requiredSessionMode && sessionMode !== requiredSessionMode) {
        return <Navigate replace to={ROUTES.login} />;
    }

    return <Outlet />;
};
