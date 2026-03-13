import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { UserInstanceType } from '@/features/auth/services/auth-service';

/**
 * Authentication State Interface
 */
type AuthState = {
    isAuthenticated:  boolean;
    selectedClientId: string | null;
    sessionMode:      'admin' | 'client' | null;
    token:            string | null;
    user:             UserInstanceType | null;
}

/**
 * Initial state
 * Loads token and user from localStorage if available
 */
function loadInitialState(): AuthState {
    const token       = localStorage.getItem('accessToken');
    const userStr     = localStorage.getItem('user');
    const user        = userStr ? JSON.parse(userStr) : null;
    const sessionMode = localStorage.getItem('sessionMode') as 'admin' | 'client' | null;

    return {
        isAuthenticated:  !!token,
        selectedClientId: null,
        sessionMode,
        token,
        user,
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
            action: PayloadAction<{ user: UserInstanceType; token: string; clientId: string }>
        ) => {
            const { user, token, clientId } = action.payload;
            state.isAuthenticated  = true;
            state.selectedClientId = clientId;
            state.token            = token;
            state.user             = user;

            // Persist to localStorage
            localStorage.setItem('accessToken', token);
            localStorage.setItem('selectedClientId', clientId);
            localStorage.setItem('user', JSON.stringify(user));
        },

        setSessionMode: (state, action: PayloadAction<'admin' | 'client'>) => {
            state.sessionMode = action.payload;
            localStorage.setItem('sessionMode', action.payload);
        },

        /**
         * Clear authentication state on logout
         */
        logout: (state) => {
            state.isAuthenticated  = false;
            state.selectedClientId = null;
            state.sessionMode      = null;
            state.token            = null;
            state.user             = null;

            // Clear localStorage
            localStorage.removeItem('accessToken');
            localStorage.removeItem('selectedClientId');
            localStorage.removeItem('sessionMode');
            localStorage.removeItem('user');
        },

        /**
         * Update user information
         */
        updateUser: (state, action: PayloadAction<Partial<UserInstanceType>>) => {
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
export const { logout, setCredentials, setSelectedClient, setSessionMode, updateUser } = authSlice.actions;

/**
 * Export selectors
 */
export const selectAuthToken       = (state: { auth: AuthState }) => state.auth.token;
export const selectCurrentUser     = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectSelectedClientId = (state: { auth: AuthState }) => state.auth.selectedClientId;
export const selectSessionMode     = (state: { auth: AuthState }) => state.auth.sessionMode;

/**
 * Export reducer
 */
export default authSlice.reducer;
