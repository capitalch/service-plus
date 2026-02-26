import { Navigate } from 'react-router-dom';
import { ROUTES } from '@/router/routes';

/**
 * Root App component
 * ProtectedRoute already guards against unauthenticated access.
 * This component simply redirects authenticated users to their landing page.
 */
export const App = () => {
    return <Navigate replace to={ROUTES.superAdmin.root} />;
};

export default App;
