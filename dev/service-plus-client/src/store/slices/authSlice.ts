import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../api/authApi';

/**
 * Authentication State Interface
 */
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  selectedClientId: string | null;
}

/**
 * Initial state
 * Loads token and user from localStorage if available
 */
function loadInitialState(): AuthState {
  const token = localStorage.getItem('authToken');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  return {
    user,
    token,
    isAuthenticated: !!token,
    selectedClientId: null,
  };
}

const initialState: AuthState = loadInitialState();

/**
 * Authentication Slice
 * Manages authentication state including user, token, and selected client
 * Token is persisted to localStorage and used by Apollo Client for protected GraphQL calls
 */
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Set authentication credentials after successful login
     */
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token: string; clientId: string }>
    ) => {
      const { user, token, clientId } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
      state.selectedClientId = clientId;

      // Persist to localStorage
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('selectedClientId', clientId);
    },

    /**
     * Clear authentication state on logout
     */
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.selectedClientId = null;

      // Clear localStorage
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('selectedClientId');
    },

    /**
     * Update user information
     */
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },

    /**
     * Set selected client
     */
    setSelectedClient: (state, action: PayloadAction<string>) => {
      state.selectedClientId = action.payload;
      localStorage.setItem('selectedClientId', action.payload);
    },
  },
});

/**
 * Export actions
 */
export const { setCredentials, logout, updateUser, setSelectedClient } = authSlice.actions;

/**
 * Export selectors
 */
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;
export const selectSelectedClientId = (state: { auth: AuthState }) => state.auth.selectedClientId;

/**
 * Export reducer
 */
export default authSlice.reducer;
