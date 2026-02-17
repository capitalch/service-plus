import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ComponentExample } from "@/components/component-example";
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '@/store/slices/authSlice';

/**
 * Root App component
 * Arrow function as per CLAUDE.md conventions
 *
 * Protected route - redirects to login if not authenticated
 */
export const App = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Only render if authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <ComponentExample />;
};

export default App;