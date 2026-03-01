/**
 * Centralized messages and error strings.
 * Only error messages and success/notification messages belong here.
 * All control display text (labels, placeholders, button text, etc.) is hardcoded in each component.
 */

export const MESSAGES = {
  // Validation Errors - Required Fields
  ERROR_CLIENT_REQUIRED: 'Please select a client',
  ERROR_EMAIL_OR_USERNAME_REQUIRED: 'Email or username is required',
  ERROR_EMAIL_REQUIRED: 'Email is required',
  ERROR_PASSWORD_REQUIRED: 'Password is required',

  // Validation Errors - Format
  ERROR_EMAIL_INVALID: 'Please enter a valid email address',
  ERROR_EMAIL_INVALID_FORMAT: 'Enter a valid email address',
  ERROR_PASSWORD_LETTER_REQUIRED: 'Must contain at least one letter',
  ERROR_PASSWORD_MIN_LENGTH: 'Password must be at least 6 characters',
  ERROR_PASSWORD_NUMBER_REQUIRED: 'Must contain at least one number',
  ERROR_USERNAME_INVALID_FORMAT: 'Username can only contain letters and numbers',
  ERROR_USERNAME_MIN_LENGTH: 'Username must be at least 5 characters',

  // Login Success/Error
  ERROR_ACCOUNT_LOCKED: 'Your account has been locked. Please contact support.',
  ERROR_INVALID_CREDENTIALS: 'Invalid username or password',
  ERROR_LOGIN_FAILED: 'Login failed. Please check your credentials.',
  ERROR_SESSION_EXPIRED: 'Your session has expired. Please login again.',
  SUCCESS_GRAPHQL_TEST: 'GraphQL test query executed successfully.',
  SUCCESS_LOGIN: 'Login successful! Redirecting...',

  // Forgot Password Success/Error
  CLIENTS_ERROR: 'Failed to load clients',
  ERROR_EMAIL_NOT_FOUND: 'No account found with this email address',
  ERROR_RESET_LINK_FAILED: 'Failed to send reset link. Please try again.',
  SUCCESS_RESET_LINK_SENT: 'Password reset link has been sent to your email',

  // Navigation
  PAGE_NOT_FOUND: 'The page you are looking for does not exist.',

  // Network Errors
  ERROR_DASHBOARD_LOAD: 'Failed to load dashboard data.',
  ERROR_NETWORK: 'Network error. Please check your connection.',
  ERROR_SERVER: 'Server error. Please try again later.',
  ERROR_TIMEOUT: 'Request timeout. Please try again.',
  ERROR_UNKNOWN: 'An unexpected error occurred. Please try again.',
} as const;

// Type for message keys
export type MessageKey = keyof typeof MESSAGES;

// Helper function to get message by key
export function getMessage(key: MessageKey): string {
  return MESSAGES[key];
}

export const VALIDATION_MESSAGES = {
  CLIENT_REQUIRED: MESSAGES.ERROR_CLIENT_REQUIRED,
  EMAIL_INVALID: MESSAGES.ERROR_EMAIL_INVALID,
  EMAIL_INVALID_FORMAT: MESSAGES.ERROR_EMAIL_INVALID_FORMAT,
  EMAIL_OR_USERNAME_REQUIRED: MESSAGES.ERROR_EMAIL_OR_USERNAME_REQUIRED,
  EMAIL_REQUIRED: MESSAGES.ERROR_EMAIL_REQUIRED,
  PASSWORD_MIN_LENGTH: MESSAGES.ERROR_PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIRED: MESSAGES.ERROR_PASSWORD_REQUIRED,
  USERNAME_INVALID_FORMAT: MESSAGES.ERROR_USERNAME_INVALID_FORMAT,
  USERNAME_MIN_LENGTH: MESSAGES.ERROR_USERNAME_MIN_LENGTH,
} as const;

export const ERROR_MESSAGES = {
  ACCOUNT_LOCKED: MESSAGES.ERROR_ACCOUNT_LOCKED,
  DASHBOARD_LOAD: MESSAGES.ERROR_DASHBOARD_LOAD,
  INVALID_CREDENTIALS: MESSAGES.ERROR_INVALID_CREDENTIALS,
  LOGIN_FAILED: MESSAGES.ERROR_LOGIN_FAILED,
  NETWORK: MESSAGES.ERROR_NETWORK,
  SERVER: MESSAGES.ERROR_SERVER,
  SESSION_EXPIRED: MESSAGES.ERROR_SESSION_EXPIRED,
  TIMEOUT: MESSAGES.ERROR_TIMEOUT,
  UNKNOWN: MESSAGES.ERROR_UNKNOWN,
} as const;

export const SUCCESS_MESSAGES = {
  GRAPHQL_TEST: MESSAGES.SUCCESS_GRAPHQL_TEST,
  LOGIN: MESSAGES.SUCCESS_LOGIN,
  RESET_LINK_SENT: MESSAGES.SUCCESS_RESET_LINK_SENT,
} as const;
