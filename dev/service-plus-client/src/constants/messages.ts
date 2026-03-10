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

  // Admin CRUD
  ERROR_ADMIN_ACTIVATE_FAILED: 'Failed to activate admin user. Please try again.',
  ERROR_ADMIN_DEACTIVATE_FAILED: 'Failed to deactivate admin user. Please try again.',
  ERROR_ADMIN_EMAIL_EXISTS: 'This email is already registered for this client.',
  ERROR_ADMIN_EMAIL_EXISTS_EDIT: 'This email is already registered for another user.',
  ERROR_ADMIN_UPDATE_FAILED: 'Failed to update admin user. Please try again.',
  ERROR_CREATE_ADMIN_FAILED: 'Failed to create admin user. Please try again.',
  SUCCESS_ADMIN_ACTIVATED: 'Admin user has been activated.',
  SUCCESS_ADMIN_CREATED: 'Admin user created. Login credentials have been emailed.',
  SUCCESS_ADMIN_DEACTIVATED: 'Admin user has been deactivated.',
  SUCCESS_ADMIN_UPDATED: 'Admin user updated successfully.',

  // Client CRUD
  ERROR_CLIENT_ADD_FAILED: 'Failed to add client. Please try again.',
  ERROR_CLIENT_CODE_EXISTS: 'This code is already in use.',
  ERROR_CLIENT_DELETE_FAILED: 'Failed to delete client. Please try again.',
  ERROR_CLIENT_DELETE_HAS_DB: 'Cannot delete this client because a database is still attached. Please detach the database first using the Detach DB option, then delete the client.',
  ERROR_CLIENT_DELETE_NOT_ALLOWED: 'Only disabled clients can be deleted.',
  ERROR_CLIENT_DETACH_DB_FAILED: 'Failed to detach database. Please try again.',
  ERROR_ORPHAN_DB_DELETE_FAILED: 'Failed to delete the database. Please try again.',
  ERROR_ORPHAN_DB_NAME_MISMATCH: 'Database name does not match. Please type the exact name.',
  INFO_CLIENT_DB_MANUAL_DELETE_ONLY: 'After detaching, the database will become an orphan. Orphan databases can be deleted from the Orphan Databases panel on this page.',
  INFO_NO_ORPHAN_DATABASES: 'No orphan databases found on the server.',
  SUCCESS_ORPHAN_DB_DELETED: 'Database has been permanently deleted from the server.',
  ERROR_CLIENT_ACTIVATE_FAILED: 'Failed to activate client. Please try again.',
  ERROR_CLIENT_ATTACH_DB_FAILED: 'Failed to attach database. Please try again.',
  ERROR_CLIENT_DEACTIVATE_FAILED: 'Failed to deactivate client. Please try again.',
  ERROR_CLIENT_NAME_EXISTS: 'This name is already in use.',
  ERROR_CLIENT_NAME_MISMATCH: 'Client name does not match. Please type the exact name.',
  ERROR_CLIENT_UPDATE_FAILED: 'Failed to update client. Please try again.',
  SUCCESS_CLIENT_ADDED: 'Client added successfully.',
  SUCCESS_CLIENT_DB_DETACHED: 'Database has been detached from the client.',
  SUCCESS_CLIENT_DELETED: 'Client has been deleted.',
  SUCCESS_CLIENT_ACTIVATED: 'Client has been activated.',
  SUCCESS_CLIENT_DB_ATTACHED: 'Database has been attached to the client.',
  SUCCESS_CLIENT_DEACTIVATED: 'Client has been deactivated.',
  SUCCESS_CLIENT_UPDATED: 'Client updated successfully.',

  // Client Initialize
  ERROR_DB_NAME_EXISTS: 'This database name is already taken.',
  ERROR_DB_NAME_REQUIRED: 'Database name is required.',
  ERROR_FULL_NAME_REQUIRED: 'Full name is required.',
  ERROR_INITIALIZE_ADMIN_FAILED: 'Failed to create admin user. Please try again.',
  ERROR_INITIALIZE_DB_FAILED: 'Failed to create database. Please try again.',
  ERROR_INITIALIZE_SEED_FAILED: 'Failed to apply seed data. Please try again.',
  SUCCESS_CLIENT_INITIALIZED: 'Client initialized successfully.',
  SUCCESS_INITIALIZE_ADMIN: 'Admin user created. Login credentials have been emailed.',
  SUCCESS_INITIALIZE_DB: 'Database created successfully.',
  SUCCESS_INITIALIZE_SEED: 'Seed data applied successfully.',

  // Network Errors
  ERROR_CLIENTS_LOAD: 'Failed to load clients data.',
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
