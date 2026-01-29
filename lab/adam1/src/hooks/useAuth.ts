import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { setCredentials, logout as logoutAction, setAuthLoading } from "@/stores/auth.slice";
import { toast } from "sonner";

interface LoginCredentials {
  email: string;
  password: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, token, isAuthenticated, isLoading } = useAppSelector(
    (state) => state.auth
  );

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      dispatch(setAuthLoading(true));
      try {
        // TODO: Replace with actual GraphQL mutation
        // This is a placeholder for the login logic
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });

        if (!response.ok) {
          throw new Error("Login failed");
        }

        const data = await response.json();
        dispatch(
          setCredentials({
            user: data.user as User,
            token: data.token,
          })
        );
        toast.success("Logged in successfully");
        return true;
      } catch (error) {
        toast.error("Login failed. Please check your credentials.");
        return false;
      } finally {
        dispatch(setAuthLoading(false));
      }
    },
    [dispatch]
  );

  const logout = useCallback(() => {
    dispatch(logoutAction());
    toast.success("Logged out successfully");
  }, [dispatch]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}
