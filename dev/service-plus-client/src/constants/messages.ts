/**
 * Centralized messages and error strings
 * All UI messages, validation errors, and notifications should be defined here
 */

export const MESSAGES = {
  // Login Form Labels
  LOGIN_TITLE: 'Welcome Back',
  LOGIN_SUBTITLE: 'Sign in to your account',
  CLIENT_LABEL: 'Client',
  CLIENT_PLACEHOLDER: 'Select your client',
  CLIENT_SEARCH_PLACEHOLDER: 'Type to search clients...',
  EMAIL_OR_USERNAME_LABEL: 'Email or Username',
  EMAIL_OR_USERNAME_PLACEHOLDER: 'Enter your email or username',
  PASSWORD_LABEL: 'Password',
  PASSWORD_PLACEHOLDER: 'Enter your password',
  REMEMBER_ME_LABEL: 'Remember me',
  LOGIN_BUTTON: 'Sign In',
  FORGOT_PASSWORD_LINK: 'Forgot password?',

  // Forgot Password
  FORGOT_PASSWORD_TITLE: 'Reset Password',
  FORGOT_PASSWORD_SUBTITLE: 'Enter your email to receive a password reset link',
  EMAIL_LABEL: 'Email',
  EMAIL_PLACEHOLDER: 'Enter your email address',
  SEND_RESET_LINK: 'Send Reset Link',
  BACK_TO_LOGIN: 'Back to login',
  CANCEL: 'Cancel',

  // Client Dropdown
  CLIENTS_LOADING: 'Loading clients...',
  CLIENTS_NO_RESULTS: 'No clients found',
  CLIENTS_MIN_CHARS: 'Type at least 2 characters to search',
  CLIENTS_ERROR: 'Failed to load clients',

  // Validation Errors - Required Fields
  ERROR_CLIENT_REQUIRED: 'Please select a client',
  ERROR_EMAIL_OR_USERNAME_REQUIRED: 'Email or username is required',
  ERROR_PASSWORD_REQUIRED: 'Password is required',
  ERROR_EMAIL_REQUIRED: 'Email is required',

  // Validation Errors - Format
  ERROR_EMAIL_OR_USERNAME_MIN_LENGTH: 'Email or username must be at least 3 characters',
  ERROR_PASSWORD_MIN_LENGTH: 'Password must be at least 6 characters',
  ERROR_EMAIL_INVALID: 'Please enter a valid email address',

  // Login Success/Error
  SUCCESS_LOGIN: 'Login successful! Redirecting...',
  ERROR_LOGIN_FAILED: 'Login failed. Please check your credentials.',
  ERROR_INVALID_CREDENTIALS: 'Invalid username or password',
  ERROR_ACCOUNT_LOCKED: 'Your account has been locked. Please contact support.',
  ERROR_SESSION_EXPIRED: 'Your session has expired. Please login again.',

  // Forgot Password Success/Error
  SUCCESS_RESET_LINK_SENT: 'Password reset link has been sent to your email',
  ERROR_RESET_LINK_FAILED: 'Failed to send reset link. Please try again.',
  ERROR_EMAIL_NOT_FOUND: 'No account found with this email address',

  // Network Errors
  ERROR_NETWORK: 'Network error. Please check your connection.',
  ERROR_SERVER: 'Server error. Please try again later.',
  ERROR_TIMEOUT: 'Request timeout. Please try again.',
  ERROR_UNKNOWN: 'An unexpected error occurred. Please try again.',

  // Loading States
  LOADING_LOGIN: 'Signing in...',
  LOADING_SENDING: 'Sending...',
  LOADING: 'Loading...',

  // General
  REQUIRED_FIELD_INDICATOR: '*',
  OR: 'or',
} as const;

// Type for message keys
export type MessageKey = keyof typeof MESSAGES;

// Helper function to get message by key
export const getMessage = (key: MessageKey): string => {
  return MESSAGES[key];
};

// Export individual message groups for easier imports
export const LOGIN_MESSAGES = {
  TITLE: MESSAGES.LOGIN_TITLE,
  SUBTITLE: MESSAGES.LOGIN_SUBTITLE,
  CLIENT_LABEL: MESSAGES.CLIENT_LABEL,
  CLIENT_PLACEHOLDER: MESSAGES.CLIENT_PLACEHOLDER,
  EMAIL_OR_USERNAME_LABEL: MESSAGES.EMAIL_OR_USERNAME_LABEL,
  EMAIL_OR_USERNAME_PLACEHOLDER: MESSAGES.EMAIL_OR_USERNAME_PLACEHOLDER,
  PASSWORD_LABEL: MESSAGES.PASSWORD_LABEL,
  PASSWORD_PLACEHOLDER: MESSAGES.PASSWORD_PLACEHOLDER,
  REMEMBER_ME_LABEL: MESSAGES.REMEMBER_ME_LABEL,
  LOGIN_BUTTON: MESSAGES.LOGIN_BUTTON,
  FORGOT_PASSWORD_LINK: MESSAGES.FORGOT_PASSWORD_LINK,
} as const;

export const VALIDATION_MESSAGES = {
  CLIENT_REQUIRED: MESSAGES.ERROR_CLIENT_REQUIRED,
  EMAIL_OR_USERNAME_REQUIRED: MESSAGES.ERROR_EMAIL_OR_USERNAME_REQUIRED,
  PASSWORD_REQUIRED: MESSAGES.ERROR_PASSWORD_REQUIRED,
  EMAIL_REQUIRED: MESSAGES.ERROR_EMAIL_REQUIRED,
  EMAIL_OR_USERNAME_MIN_LENGTH: MESSAGES.ERROR_EMAIL_OR_USERNAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH: MESSAGES.ERROR_PASSWORD_MIN_LENGTH,
  EMAIL_INVALID: MESSAGES.ERROR_EMAIL_INVALID,
} as const;

export const ERROR_MESSAGES = {
  LOGIN_FAILED: MESSAGES.ERROR_LOGIN_FAILED,
  INVALID_CREDENTIALS: MESSAGES.ERROR_INVALID_CREDENTIALS,
  ACCOUNT_LOCKED: MESSAGES.ERROR_ACCOUNT_LOCKED,
  SESSION_EXPIRED: MESSAGES.ERROR_SESSION_EXPIRED,
  NETWORK: MESSAGES.ERROR_NETWORK,
  SERVER: MESSAGES.ERROR_SERVER,
  TIMEOUT: MESSAGES.ERROR_TIMEOUT,
  UNKNOWN: MESSAGES.ERROR_UNKNOWN,
} as const;

export const SUCCESS_MESSAGES = {
  LOGIN: MESSAGES.SUCCESS_LOGIN,
  RESET_LINK_SENT: MESSAGES.SUCCESS_RESET_LINK_SENT,
} as const;
