import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi';
import authReducer from './slices/authSlice';

/**
 * Redux store configuration
 * Includes RTK Query API middleware for REST endpoints (pre-login)
 * Auth slice manages authentication state and token (used by Apollo Client post-login)
 */
export const store = configureStore({
  reducer: {
    // Auth slice - manages user, token, and authentication state
    auth: authReducer,

    // RTK Query API - handles REST endpoints for pre-login operations
    [baseApi.reducerPath]: baseApi.reducer,
  },

  // Add RTK Query middleware for caching and request handling
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
