import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';

/**
 * Apollo Client configuration for GraphQL operations
 * Used for protected API calls after login
 * Token is automatically added to Authorization header from localStorage
 *
 * Note: Token is managed by Redux (authSlice) and persisted to localStorage
 * Pre-login REST API calls use RTK Query (see store/api/authApi.ts)
 */

// GraphQL endpoint - adjust based on your backend configuration
const GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql';

// HTTP link for GraphQL queries and mutations
const httpLink = new HttpLink({
  uri: GRAPHQL_ENDPOINT,
});

// Auth middleware to add Authorization header with token
const authMiddleware = new ApolloLink((operation, forward) => {
  // Get token from localStorage (managed by Redux authSlice)
  const token = localStorage.getItem('authToken');

  // Add authorization header to context
  operation.setContext({
    headers: {
      authorization: token ? `Bearer ${token}` : '',
    },
  });

  return forward(operation);
});

// Create Apollo Client instance with auth middleware
export const apolloClient = new ApolloClient({
  link: authMiddleware.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});

/**
 * Helper function to set auth token
 */
export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
}

/**
 * Helper function to get auth token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}
