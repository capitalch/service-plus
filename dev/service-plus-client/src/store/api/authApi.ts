import { baseApi } from './baseApi';

/**
 * Type Definitions for Authentication API
 */

export interface Client {
  id: string;
  name: string;
  code?: string;
  status?: string;
}

export interface SearchClientsResponse {
  clients: Client[];
  total: number;
}

export interface LoginRequest {
  clientId: string;
  emailOrUsername: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface ApiError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}

/**
 * Authentication API endpoints using RTK Query
 * These are REST endpoints used pre-login
 * Post-login, use GraphQL via Apollo Client
 */
export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Search Clients - Unprotected REST endpoint
     * Used in login screen client dropdown
     */
    searchClients: builder.query<SearchClientsResponse, string>({
      query: (searchTerm) => ({
        url: '/clients/search',
        method: 'POST',
        body: { searchTerm },
      }),
      transformErrorResponse: (response: { status: number; data: unknown }) => ({
        status: response.status,
        message: (response.data as { message?: string })?.message || 'Failed to search clients',
        errors: (response.data as { errors?: Record<string, string[]> })?.errors,
      }),
      keepUnusedDataFor: 30, // Cache for 30 seconds
      providesTags: ['Clients'],
    }),

    /**
     * Login - Unprotected REST endpoint
     * Returns token which will be used by Apollo Client for protected GraphQL calls
     */
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      transformErrorResponse: (response: { status: number; data: unknown }) => ({
        status: response.status,
        message: (response.data as { message?: string })?.message || 'Login failed',
        errors: (response.data as { errors?: Record<string, string[]> })?.errors,
      }),
      invalidatesTags: ['Auth'],
    }),

    /**
     * Forgot Password - Unprotected REST endpoint
     * Sends password reset email
     */
    forgotPassword: builder.mutation<ForgotPasswordResponse, ForgotPasswordRequest>({
      query: (data) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body: data,
      }),
      transformErrorResponse: (response: { status: number; data: unknown }) => ({
        status: response.status,
        message: (response.data as { message?: string })?.message || 'Failed to send reset link',
        errors: (response.data as { errors?: Record<string, string[]> })?.errors,
      }),
    }),
  }),
});

/**
 * Export hooks for usage in components
 * These follow React Hook naming conventions (arrow functions for hooks)
 */
export const {
  useLazySearchClientsQuery,
  useSearchClientsQuery,
  useLoginMutation,
  useForgotPasswordMutation,
} = authApi;
