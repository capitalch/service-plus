import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { UserInstanceType } from '@/lib/auth-service';
import { clearAuthStorage, getAuthItem, setAuthItem, setRememberFlag } from '@/lib/auth-storage';

/**
 * Authentication State Interface
 */
type AuthState = {
    isAuthenticated:  boolean;
    selectedClientId: string | null;
    sessionMode:      'admin' | 'client' | null;
    token:            string | null;
    refreshToken:     string | null;
    user:             UserInstanceType | null;
}

/**
 * Initial state
 * Loads token and user from localStorage if available
 */
function loadInitialState(): AuthState {
    const token       = getAuthItem('accessToken');
    const refreshToken = getAuthItem('refreshToken');
    const userStr     = getAuthItem('user');
    const user        = userStr ? JSON.parse(userStr) : null;
    let sessionMode   = getAuthItem('sessionMode') as 'admin' | 'client' | null;

    // Self-heal stale/legacy sessions (token + user present but no valid sessionMode):
    // App/ProtectedRoute otherwise bounce forever between '/' and '/client'.
    if (token && user && user.userType !== 'S' && sessionMode !== 'admin' && sessionMode !== 'client') {
        sessionMode = 'client';
        setAuthItem('sessionMode', sessionMode);
    }

    return {
        isAuthenticated:  !!token,
        selectedClientId: null,
        sessionMode,
        token,
        refreshToken,
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
            action: PayloadAction<{ user: UserInstanceType; token: string; refreshToken: string; clientId: string; rememberMe: boolean }>
        ) => {
            const { user, token, refreshToken, clientId, rememberMe } = action.payload;
            state.isAuthenticated  = true;
            state.selectedClientId = clientId;
            state.token            = token;
            state.refreshToken     = refreshToken;
            state.user             = user;

            // Persist to localStorage (remembered) or sessionStorage (this browser session only)
            setRememberFlag(rememberMe);
            setAuthItem('accessToken', token);
            setAuthItem('refreshToken', refreshToken);
            setAuthItem('selectedClientId', clientId);
            setAuthItem('user', JSON.stringify(user));
            if (user.clientCode) {
                setAuthItem('clientCode', user.clientCode);
            }
        },

        setSessionMode: (state, action: PayloadAction<'admin' | 'client'>) => {
            state.sessionMode = action.payload;
            setAuthItem('sessionMode', action.payload);
        },

        /**
         * Update access and refresh tokens without changing user data
         */
        refreshTokens: (
            state,
            action: PayloadAction<{ token: string; refreshToken: string }>
        ) => {
            const { token, refreshToken } = action.payload;
            state.token = token;
            state.refreshToken = refreshToken;
            setAuthItem('accessToken', token);
            setAuthItem('refreshToken', refreshToken);
        },

        /**
         * Clear authentication state on logout
         */
        logout: (state) => {
            state.isAuthenticated  = false;
            state.selectedClientId = null;
            state.sessionMode      = null;
            state.token            = null;
            state.refreshToken     = null;
            state.user             = null;

            clearAuthStorage();
        },

        /**
         * Update user information
         */
        updateUser: (state, action: PayloadAction<Partial<UserInstanceType>>) => {
            if (state.user) {
                state.user = { ...state.user, ...action.payload };
                setAuthItem('user', JSON.stringify(state.user));
            }
        },

        /**
         * Set selected client
         */
        setSelectedClient: (state, action: PayloadAction<string>) => {
            state.selectedClientId = action.payload;
            setAuthItem('selectedClientId', action.payload);
        },
    },
});

/**
 * Export actions
 */
export const { logout, setCredentials, setSelectedClient, setSessionMode, updateUser, refreshTokens } = authSlice.actions;

/**
 * Export selectors
 */
export const selectAuthToken        = (state: { auth: AuthState }) => state.auth.token;
export const selectAvailableBus     = (state: { auth: AuthState }) => state.auth.user?.availableBus ?? [];
export const selectCurrentUser      = (state: { auth: AuthState }) => state.auth.user;
export const selectDbName           = (state: { auth: AuthState }) => state.auth.user?.dbName ?? null;
export const selectIsAuthenticated  = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectLastUsedBranchId = (state: { auth: AuthState }) => state.auth.user?.lastUsedBranchId ?? null;
export const selectLastUsedBuId     = (state: { auth: AuthState }) => state.auth.user?.lastUsedBuId ?? null;
export const selectRefreshToken     = (state: { auth: AuthState }) => state.auth.refreshToken;
export const selectClientCode       = (state: { auth: AuthState }) => state.auth.user?.clientCode ?? localStorage.getItem('clientCode') ?? null;
export const selectSelectedClientId = (state: { auth: AuthState }) => state.auth.selectedClientId;
export const selectSessionMode      = (state: { auth: AuthState }) => state.auth.sessionMode;

/**
 * Export reducer
 */
export default authSlice.reducer;
