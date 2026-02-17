import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Base API configuration for RTK Query
 * Used for REST endpoints (pre-login: client search, login, forgot password)
 * Post-login protected calls use GraphQL via Apollo Client
 */

// API Base URL - adjust based on your backend configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Base API instance
 * Other API slices can inject endpoints into this base API
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers) => {
      headers.set('Content-Type', 'application/json');
      return headers;
    },
  }),
  tagTypes: ['Auth', 'Clients'],
  endpoints: () => ({}),
});
