import { toast } from 'sonner';
import { MESSAGES } from '@/constants/messages';
import type { GraphQLError } from 'graphql';

/**
 * Type guard to check if error has GraphQL error structure
 */
function isGraphQLError(error: unknown): error is { graphQLErrors?: readonly GraphQLError[]; networkError?: Error | null; message?: string } {
  return typeof error === 'object' && error !== null && ('graphQLErrors' in error || 'networkError' in error);
}

/**
 * Helper function to handle GraphQL errors
 * Displays user-friendly error messages using Sonner toast
 */
export function handleGraphQLError(error: unknown): void {
  if (isGraphQLError(error)) {
    // Handle GraphQL errors
    if (error.graphQLErrors && error.graphQLErrors.length > 0) {
      error.graphQLErrors.forEach((gqlError: GraphQLError) => {
        toast.error(gqlError.message || MESSAGES.ERROR_UNKNOWN);
      });
    } else if (error.networkError) {
      // Handle network errors
      toast.error(MESSAGES.ERROR_NETWORK);
    } else {
      toast.error(error.message || MESSAGES.ERROR_UNKNOWN);
    }
  } else if (error instanceof Error) {
    // Handle generic errors
    toast.error(error.message || MESSAGES.ERROR_UNKNOWN);
  } else {
    toast.error(MESSAGES.ERROR_UNKNOWN);
  }
}

/**
 * Helper function to extract error message from GraphQL error
 */
export function getErrorMessage(error: unknown): string {
  if (isGraphQLError(error)) {
    if (error.graphQLErrors && error.graphQLErrors.length > 0) {
      return error.graphQLErrors[0].message;
    } else if (error.networkError) {
      return MESSAGES.ERROR_NETWORK;
    } else if (error.message) {
      return error.message;
    }
  } else if (error instanceof Error) {
    return error.message;
  }
  return MESSAGES.ERROR_UNKNOWN;
}

/**
 * Helper function to check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('authToken');
  return !!token;
}

/**
 * Helper function to clear authentication data
 */
export function clearAuthData(): void {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
}
