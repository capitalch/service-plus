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

  // Audit Logs
  ERROR_AUDIT_EXPORT_FAILED:  'Failed to export audit log. Please try again.',
  ERROR_AUDIT_LOAD_FAILED:    'Failed to load audit log entries. Please try again.',
  ERROR_AUDIT_STATS_FAILED:   'Failed to load audit log statistics. Please try again.',

  // Business Users
  ERROR_BUSINESS_USER_ACTIVATE_FAILED: 'Failed to activate business user. Please try again.',
  ERROR_BUSINESS_USER_BU_REQUIRED: 'Please select at least one business unit.',
  ERROR_BUSINESS_USER_CREATE_FAILED: 'Failed to create business user. Please try again.',
  ERROR_BUSINESS_USER_DEACTIVATE_FAILED: 'Failed to deactivate business user. Please try again.',
  ERROR_BUSINESS_USER_DELETE_FAILED: 'Failed to delete business user. Please try again.',
  ERROR_BUSINESS_USER_EMAIL_EXISTS: 'This email is already registered.',
  ERROR_BUSINESS_USER_EMAIL_EXISTS_EDIT: 'This email is already used by another user.',
  ERROR_BUSINESS_USER_LOAD_FAILED: 'Failed to load business users. Please try again.',
  ERROR_BUSINESS_USER_MAIL_CREDENTIALS_FAILED: 'Failed to send the reset link. Please try again.',
  ERROR_BUSINESS_USER_ROLE_REQUIRED: 'Please select a role.',
  ERROR_BUSINESS_USER_UPDATE_FAILED: 'Failed to update business user. Please try again.',
  ERROR_BUSINESS_USER_USERNAME_EXISTS: 'This username is already taken.',
  ERROR_BUSINESS_USER_USERNAME_EXISTS_EDIT: 'This username is already used by another user.',
  SUCCESS_BUSINESS_USER_ACTIVATED: 'Business user has been activated.',
  SUCCESS_BUSINESS_USER_CREDENTIALS_MAILED: 'Password reset link sent to the user\'s email.',
  WARN_BUSINESS_USER_BU_ROLE_ASSIGN_FAILED: 'User was created but business unit and role could not be assigned. Use the Associate BU & Role action.',
  WARN_BUSINESS_USER_CREDENTIALS_MAIL_NOT_SENT: 'Reset link could not be emailed. Please check the user\'s email address.',
  WARN_BUSINESS_USER_EMAIL_NOT_SENT: 'Business user created, but the setup email could not be sent. Use "Reset password and mail" to resend.',
  SUCCESS_BUSINESS_USER_CREATED: 'Business user created. A password setup link has been emailed.',
  SUCCESS_BUSINESS_USER_DEACTIVATED: 'Business user has been deactivated.',
  SUCCESS_BUSINESS_USER_DELETED: 'Business user has been deleted.',
  SUCCESS_BUSINESS_USER_UPDATED: 'Business user updated successfully.',
  SUCCESS_BU_ROLE_ASSOCIATED: 'Business unit and role associations updated.',

  // Business Units
  ERROR_BU_ACTIVATE_FAILED: 'Failed to activate business unit. Please try again.',
  ERROR_BU_CODE_EXISTS: 'This code is already in use.',
  ERROR_BU_SCHEMA_DELETE_FAILED:   'Failed to drop business unit schema. Please try again.',
  ERROR_BU_SCHEMA_NAME_MISMATCH:   'Schema name does not match. Please type the exact name.',
  ERROR_ORPHAN_BU_DELETE_FAILED:   'Failed to delete orphaned schema. Please try again.',
  ERROR_ORPHAN_BU_LOAD_FAILED:     'Failed to load orphaned schemas. Please try again.',
  INFO_BU_SCHEMA_DROP_WARNING:     'This will permanently drop the schema and all its data from the database.',
  SUCCESS_BU_SCHEMA_DELETED:       'Business unit and its schema have been permanently deleted.',
  SUCCESS_ORPHAN_BU_DELETED:       'Orphaned schema has been permanently deleted.',
  ERROR_BU_CODE_EXISTS_EDIT: 'This code is already used by another business unit.',
  ERROR_BU_CREATE_FAILED: 'Failed to create business unit. Please try again.',
  ERROR_BU_CREATE_SCHEMA_FAILED: 'Failed to create business unit. Please try again.',
  ERROR_BU_NAME_EXISTS: 'This name is already in use.',
  ERROR_BU_NAME_EXISTS_EDIT: 'This name is already used by another business unit.',
  ERROR_BU_DEACTIVATE_FAILED: 'Failed to deactivate business unit. Please try again.',
  ERROR_BU_DELETE_FAILED: 'Failed to delete business unit. Please try again.',
  ERROR_BU_LOAD_FAILED: 'Failed to load business units. Please try again.',
  ERROR_BU_SEED_FEED_FAILED: 'Failed to seed business unit data. Please try again.',
  ERROR_BU_UPDATE_FAILED: 'Failed to update business unit. Please try again.',
  SUCCESS_BU_ACTIVATED: 'Business unit has been activated.',
  SUCCESS_BU_CREATED: 'Business unit created successfully.',
  SUCCESS_BU_DEACTIVATED: 'Business unit has been deactivated.',
  SUCCESS_BU_DELETED: 'Business unit has been deleted.',
  SUCCESS_BU_UPDATED: 'Business unit updated successfully.',

  // Branch CRUD
  ERROR_BRANCH_CODE_EXISTS:        'This code is already in use.',
  ERROR_BRANCH_CODE_EXISTS_EDIT:   'This code is already used by another branch.',
  ERROR_BRANCH_CREATE_FAILED:      'Failed to create branch. Please try again.',
  ERROR_BRANCH_DELETE_FAILED:      'Failed to delete branch. Please try again.',
  ERROR_BRANCH_DELETE_HEAD_OFFICE: 'Head Office branch cannot be deleted.',
  ERROR_BRANCH_DELETE_IN_USE:      'This branch cannot be deleted as it is referenced by existing records.',
  ERROR_BRANCH_LOAD_FAILED:        'Failed to load branches. Please try again.',
  ERROR_BRANCH_NAME_EXISTS:        'This name is already in use.',
  ERROR_BRANCH_NAME_EXISTS_EDIT:   'This name is already used by another branch.',
  ERROR_BRANCH_UPDATE_FAILED:      'Failed to update branch. Please try again.',
  ERROR_STATES_LOAD_FAILED:        'Failed to load states. Please try again.',
  SUCCESS_BRANCH_CREATED:          'Branch created successfully.',
  SUCCESS_BRANCH_DELETED:          'Branch deleted successfully.',
  SUCCESS_BRANCH_UPDATED:          'Branch updated successfully.',

  // Financial Year CRUD
  ERROR_FY_CREATE_FAILED: 'Failed to create financial year. Please try again.',
  ERROR_FY_DATE_OVERLAP:  'Date range overlaps with an existing financial year.',
  ERROR_FY_DELETE_FAILED: 'Failed to delete financial year. Please try again.',
  ERROR_FY_ID_EXISTS:     'A financial year with this year already exists.',
  ERROR_FY_LOAD_FAILED:   'Failed to load financial years. Please try again.',
  ERROR_FY_UPDATE_FAILED: 'Failed to update financial year. Please try again.',
  SUCCESS_FY_CREATED:     'Financial year created successfully.',
  SUCCESS_FY_DELETED:     'Financial year deleted successfully.',
  SUCCESS_FY_UPDATED:     'Financial year updated successfully.',

  // State / Province CRUD
  ERROR_STATE_CODE_EXISTS:      'This code is already in use.',
  ERROR_STATE_CODE_EXISTS_EDIT: 'This code is already used by another state.',
  ERROR_STATE_CREATE_FAILED:    'Failed to create state. Please try again.',
  ERROR_STATE_DELETE_FAILED:    'Failed to delete state. Please try again.',
  ERROR_STATE_DELETE_IN_USE:    'This state cannot be deleted as it is referenced by existing records.',
  ERROR_STATE_LOAD_FAILED:      'Failed to load states. Please try again.',
  ERROR_STATE_NAME_EXISTS:      'This name is already in use.',
  ERROR_STATE_NAME_EXISTS_EDIT: 'This name is already used by another state.',
  ERROR_STATE_UPDATE_FAILED:    'Failed to update state. Please try again.',
  SUCCESS_STATE_CREATED:        'State created successfully.',
  SUCCESS_STATE_DELETED:        'State deleted successfully.',
  SUCCESS_STATE_UPDATED:        'State updated successfully.',

  // Lookup tables (shared)
  ERROR_LOOKUP_CODE_EXISTS:       'This code is already in use.',
  ERROR_LOOKUP_CODE_EXISTS_EDIT:  'This code is already used by another record.',
  ERROR_LOOKUP_DELETE_SYSTEM:     'System records cannot be deleted.',

  // Vendor CRUD
  ERROR_VENDOR_CREATE_FAILED:      'Failed to create vendor. Please try again.',
  ERROR_VENDOR_DELETE_FAILED:      'Failed to delete vendor. Please try again.',
  ERROR_VENDOR_DELETE_IN_USE:      'This vendor cannot be deleted as it is referenced by existing purchase invoices.',
  ERROR_VENDOR_LOAD_FAILED:        'Failed to load vendors. Please try again.',
  ERROR_VENDOR_NAME_EXISTS:        'This name is already in use.',
  ERROR_VENDOR_NAME_EXISTS_EDIT:   'This name is already used by another vendor.',
  ERROR_VENDOR_UPDATE_FAILED:      'Failed to update vendor. Please try again.',
  SUCCESS_VENDOR_CREATED:          'Vendor created successfully.',
  SUCCESS_VENDOR_DELETED:          'Vendor deleted successfully.',
  SUCCESS_VENDOR_UPDATED:          'Vendor updated successfully.',

  // Technician CRUD
  ERROR_TECHNICIAN_CODE_EXISTS:      'This code is already in use for this branch.',
  ERROR_TECHNICIAN_CODE_EXISTS_EDIT: 'This code is already used by another technician in this branch.',
  ERROR_TECHNICIAN_CREATE_FAILED:    'Failed to create technician. Please try again.',
  ERROR_TECHNICIAN_DELETE_FAILED:    'Failed to delete technician. Please try again.',
  ERROR_TECHNICIAN_DELETE_IN_USE:    'This technician cannot be deleted as it is referenced by existing jobs.',
  ERROR_TECHNICIAN_LOAD_FAILED:      'Failed to load technicians. Please try again.',
  ERROR_TECHNICIAN_UPDATE_FAILED:    'Failed to update technician. Please try again.',
  SUCCESS_TECHNICIAN_CREATED:        'Technician created successfully.',
  SUCCESS_TECHNICIAN_DELETED:        'Technician deleted successfully.',
  SUCCESS_TECHNICIAN_UPDATED:        'Technician updated successfully.',

  // Part Location CRUD
  ERROR_PART_LOCATION_CREATE_FAILED:      'Failed to create part location. Please try again.',
  ERROR_PART_LOCATION_DELETE_FAILED:      'Failed to delete part location. Please try again.',
  ERROR_PART_LOCATION_DELETE_IN_USE:      'This location cannot be deleted as it is referenced by existing records.',
  ERROR_PART_LOCATION_EXISTS:             'This location already exists for this branch.',
  ERROR_PART_LOCATION_EXISTS_EDIT:        'This location is already used by another record in this branch.',
  ERROR_PART_LOCATION_LOAD_FAILED:        'Failed to load part locations. Please try again.',
  ERROR_PART_LOCATION_UPDATE_FAILED:      'Failed to update part location. Please try again.',
  SUCCESS_PART_LOCATION_CREATED:          'Part location created successfully.',
  SUCCESS_PART_LOCATION_DELETED:          'Part location deleted successfully.',
  SUCCESS_PART_LOCATION_UPDATED:          'Part location updated successfully.',

  // Part Finder
  ERROR_PART_FINDER_LOAD_FAILED:               'Failed to load parts. Please try again.',
  ERROR_PART_FINDER_STOCK_BY_LOCATION_FAILED:  'Failed to load stock by location. Please try again.',
  ERROR_PART_FINDER_HISTORY_LOAD_FAILED:       'Failed to load location history. Please try again.',
  // Set Part Location
  SUCCESS_SET_PART_LOCATIONS:             'Part location(s) set successfully.',
  ERROR_SET_PART_LOCATIONS_FAILED:        'Failed to set part locations. Please try again.',
  ERROR_SET_PART_LOCATIONS_LOAD_FAILED:   'Failed to load stock data. Please try again.',
  ERROR_SET_PART_LOCATION_PART_NOT_FOUND: 'Part not found in stock for this branch.',

  // Customer CRUD
  ERROR_CUSTOMER_CREATE_FAILED:      'Failed to create customer. Please try again.',
  ERROR_CUSTOMER_DELETE_FAILED:      'Failed to delete customer. Please try again.',
  ERROR_CUSTOMER_DELETE_IN_USE:      'This customer cannot be deleted as it is referenced by existing jobs or invoices.',
  ERROR_CUSTOMER_LOAD_FAILED:        'Failed to load customers. Please try again.',
  ERROR_CUSTOMER_TYPES_LOAD_FAILED:  'Failed to load customer types. Please try again.',
  ERROR_CUSTOMER_UPDATE_FAILED:      'Failed to update customer. Please try again.',
  SUCCESS_CUSTOMER_CREATED:          'Customer created successfully.',
  SUCCESS_CUSTOMER_DELETED:          'Customer deleted successfully.',
  SUCCESS_CUSTOMER_UPDATED:          'Customer updated successfully.',

  // Roles
  ERROR_ROLES_LOAD_FAILED: 'Failed to load roles. Please try again.',
  ERROR_SEED_ROLES_FAILED: 'Failed to apply seed roles. Please try again.',
  INFO_SEED_ROLES_ALREADY_EXISTS: 'Seed roles are already present in this client\'s database.',
  SUCCESS_SEED_ROLES: 'Seed roles applied successfully.',

  // Reset Password (self-service via link)
  ERROR_RESET_PASSWORD_FAILED: 'Failed to reset password. Please try again.',
  ERROR_RESET_PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
  ERROR_RESET_PASSWORDS_MISMATCH: 'Passwords do not match.',
  ERROR_RESET_TOKEN_INVALID: 'This reset link is invalid or has expired (links are valid for 48 hours). Please request a new one.',
  SUCCESS_RESET_PASSWORD: 'Password reset successfully. You can now log in.',

  // Admin CRUD
  ERROR_ADMIN_ACTIVATE_FAILED: 'Failed to activate admin user. Please try again.',
  ERROR_ADMIN_DEACTIVATE_FAILED: 'Failed to deactivate admin user. Please try again.',
  ERROR_ADMIN_MAIL_CREDENTIALS_FAILED: 'Failed to send credentials email. Please try again.',
  ERROR_ADMIN_EMAIL_EXISTS: 'This email is already registered for this client.',
  ERROR_ADMIN_EMAIL_EXISTS_EDIT: 'This email is already registered for another user.',
  ERROR_ADMIN_USERNAME_EXISTS: 'This username is already taken for this client.',
  ERROR_ADMIN_USERNAME_REQUIRED: 'Username is required.',
  ERROR_MOBILE_INVALID: 'Enter a valid mobile number (7–15 digits, optional + prefix).',
  ERROR_ADMIN_UPDATE_FAILED: 'Failed to update admin user. Please try again.',
  ERROR_CREATE_ADMIN_FAILED: 'Failed to create admin user. Please try again.',
  SUCCESS_ADMIN_ACTIVATED: 'Admin user has been activated.',
  SUCCESS_ADMIN_CREATED: 'Admin user created. A password setup link has been emailed.',
  SUCCESS_ADMIN_CREDENTIALS_MAILED: 'Password reset link sent to the admin\'s email.',
  WARN_ADMIN_CREDENTIALS_MAIL_NOT_SENT: 'Reset link could not be emailed. Please check the admin\'s email address.',
  WARN_ADMIN_EMAIL_NOT_SENT: 'Admin user account was created, but the password setup email could not be sent. Use "Mail the Reset Password Link" to resend.',
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
  SUCCESS_CLIENT_ADDED_WITH_EMAIL: 'Client added. Welcome email sent.',
  WARN_CLIENT_WELCOME_EMAIL_NOT_SENT: 'Client added, but the welcome email could not be sent.',
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
  SUCCESS_INITIALIZE_ADMIN: 'Admin user created. A password setup link has been emailed.',
  WARN_INITIALIZE_ADMIN_EMAIL_NOT_SENT: 'Admin user account was created, but the password setup email could not be sent. Use "Mail the Reset Password Link" to resend.',
  SUCCESS_INITIALIZE_DB: 'Database created successfully.',
  SUCCESS_INITIALIZE_SEED: 'Seed data applied successfully.',

  // System Settings
  ERROR_SETTINGS_LOAD_FAILED: 'Failed to load system settings. Please try again.',

  // Usage & Health
  ERROR_USAGE_HEALTH_LOAD_FAILED: 'Failed to load usage and health data. Please try again.',

  // Test Email
  ERROR_TEST_EMAIL_FAILED: 'Failed to send test email. Check SMTP configuration.',
  SUCCESS_TEST_EMAIL_SENT: 'Test email sent successfully to capitalch@gmail.com.',

  // BU / Branch Switcher
  ERROR_BU_SWITCH_FAILED:     'Failed to switch business unit. Please try again.',
  ERROR_BRANCH_SWITCH_FAILED: 'Failed to switch branch. Please try again.',
  ERROR_BRANCHES_LOAD_FAILED: 'Failed to load branches. Please try again.',

  // Network Errors
  ERROR_CLIENTS_LOAD: 'Failed to load clients data.',
  LOADING_CLIENTS: 'Loading clients…',
  ERROR_DASHBOARD_LOAD: 'Failed to load dashboard data.',
  ERROR_NETWORK: 'Network error. Please check your connection.',
  ERROR_SERVER: 'Server error. Please try again later.',
  ERROR_TIMEOUT: 'Request timeout. Please try again.',
  ERROR_UNKNOWN: 'An unexpected error occurred. Please try again.',

  // Company Profile (Configurations)
  ERROR_COMPANY_PROFILE_LOAD_FAILED: 'Failed to load company profile. Please try again.',
  ERROR_COMPANY_PROFILE_SAVE_FAILED: 'Failed to save company profile. Please try again.',
  SUCCESS_COMPANY_PROFILE_SAVED:     'Company profile saved successfully.',

  // Document Sequences (Configurations)
  ERROR_DOCUMENT_SEQUENCE_LOAD_FAILED: 'Failed to load document sequences. Please try again.',
  ERROR_DOCUMENT_SEQUENCE_SAVE_FAILED: 'Failed to save document sequences. Please try again.',
  SUCCESS_DOCUMENT_SEQUENCE_SAVED:     'Document sequences saved successfully.',

  // Inventory
  ERROR_STOCK_OVERVIEW_LOAD_FAILED:    'Failed to load stock overview. Please try again.',
  ERROR_CONSUMPTION_LOAD_FAILED:       'Failed to load consumption data. Please try again.',
  // Purchase Entry
  ERROR_PURCHASE_LOAD_FAILED:          'Failed to load purchase invoices. Please try again.',
  ERROR_PURCHASE_CREATE_FAILED:        'Failed to create purchase invoice. Please try again.',
  ERROR_PURCHASE_DELETE_FAILED:        'Failed to delete purchase invoice. Please try again.',
  ERROR_PURCHASE_SUPPLIER_REQUIRED:    'Please select a supplier.',
  ERROR_PURCHASE_INVOICE_NO_REQUIRED:  'Invoice number is required.',
  ERROR_PURCHASE_DATE_REQUIRED:        'Invoice date is required.',
  ERROR_PURCHASE_LINES_REQUIRED:       'At least one line item is required.',
  ERROR_PURCHASE_INVOICE_EXISTS:       'This invoice number already exists for the selected supplier.',
  ERROR_PURCHASE_LINE_FIELDS_REQUIRED: 'Please fill all mandatory line fields (Part, Qty, and HSN for taxable items).',
  SUCCESS_PURCHASE_CREATED:            'Purchase invoice created successfully.',
  SUCCESS_PURCHASE_UPDATED:            'Purchase invoice updated successfully.',
  SUCCESS_PURCHASE_DELETED:            'Purchase invoice deleted successfully.',
  ERROR_PURCHASE_PHYSICAL_CHECK_FAILED: 'Physical invoice values do not match. Please correct the mismatches before saving.',
  ERROR_PURCHASE_UPDATE_FAILED:        'Failed to update purchase invoice. Please try again.',

  // Sales Entry
  ERROR_SALES_LOAD_FAILED:             'Failed to load sales invoices. Please try again.',
  ERROR_SALES_CREATE_FAILED:           'Failed to create sales invoice. Please try again.',
  ERROR_SALES_UPDATE_FAILED:           'Failed to update sales invoice. Please try again.',
  ERROR_SALES_DELETE_FAILED:           'Failed to delete sales invoice. Please try again.',
  ERROR_SALES_CUSTOMER_REQUIRED:       'Please select or enter a customer name.',
  ERROR_SALES_INVOICE_DATE_REQUIRED:   'Invoice date is required.',
  ERROR_SALES_LINES_REQUIRED:          'Please add at least one line item.',
  ERROR_SALES_LINE_FIELDS_REQUIRED:    'Each line must have a part and quantity > 0.',
  SUCCESS_SALES_CREATED:               'Sales invoice created successfully.',
  SUCCESS_SALES_UPDATED:               'Sales invoice updated successfully.',
  SUCCESS_SALES_DELETED:               'Sales invoice deleted successfully.',

  // Stock Adjustment
  ERROR_ADJUSTMENT_LOAD_FAILED:          'Failed to load stock adjustments. Please try again.',
  ERROR_ADJUSTMENT_CREATE_FAILED:        'Failed to create stock adjustment. Please try again.',
  ERROR_ADJUSTMENT_UPDATE_FAILED:        'Failed to update stock adjustment. Please try again.',
  ERROR_ADJUSTMENT_DELETE_FAILED:        'Failed to delete stock adjustment. Please try again.',
  ERROR_ADJUSTMENT_DATE_REQUIRED:        'Adjustment date is required.',
  ERROR_ADJUSTMENT_REASON_REQUIRED:      'Adjustment reason is required.',
  ERROR_ADJUSTMENT_LINE_FIELDS_REQUIRED: 'Each line needs a part and quantity > 0.',
  SUCCESS_ADJUSTMENT_CREATED:            'Stock adjustment created successfully.',
  SUCCESS_ADJUSTMENT_UPDATED:            'Stock adjustment updated successfully.',
  SUCCESS_ADJUSTMENT_DELETED:            'Stock adjustment deleted successfully.',

  // Parts Import
  ERROR_IMPORT_BRAND_REQUIRED:       'Please select a brand before uploading.',
  ERROR_IMPORT_FAILED:               'Import failed. Please try again.',
  ERROR_IMPORT_FILE_INVALID_TYPE:    'Invalid file type. Please upload a .csv, .xlsx, or .xls file.',
  ERROR_IMPORT_FILE_REQUIRED:        'Please select a file to upload.',
  ERROR_IMPORT_MAPPING_MANDATORY:    'Part Code and Part Name must be mapped before importing.',
  ERROR_IMPORT_PARSE_ERROR:          'Failed to parse the file. Please check the file format.',
  ERROR_IMPORT_UPLOAD_ERROR:         'Failed to upload file. Please try again.',
  SUCCESS_IMPORT_COMPLETE:           'Import completed successfully.',

  // Branch Transfer
  ERROR_TRANSFER_LOAD_FAILED:          'Failed to load branch transfers. Please try again.',
  ERROR_TRANSFER_CREATE_FAILED:        'Failed to create branch transfer. Please try again.',
  ERROR_TRANSFER_UPDATE_FAILED:        'Failed to update branch transfer. Please try again.',
  ERROR_TRANSFER_DELETE_FAILED:        'Failed to delete branch transfer. Please try again.',
  ERROR_TRANSFER_DATE_REQUIRED:        'Transfer date is required.',
  ERROR_TRANSFER_DESTINATION_REQUIRED: 'Destination branch is required.',
  ERROR_TRANSFER_LINE_FIELDS_REQUIRED: 'Each line needs a part and quantity > 0.',
  SUCCESS_TRANSFER_CREATED:            'Branch transfer created successfully.',
  SUCCESS_TRANSFER_UPDATED:            'Branch transfer updated successfully.',
  SUCCESS_TRANSFER_DELETED:            'Branch transfer deleted successfully.',

  // Loan Entry
  ERROR_LOAN_LOAD_FAILED:              'Failed to load loan entries. Please try again.',
  ERROR_LOAN_CREATE_FAILED:            'Failed to create loan entry. Please try again.',
  ERROR_LOAN_UPDATE_FAILED:            'Failed to update loan entry. Please try again.',
  ERROR_LOAN_DELETE_FAILED:            'Failed to delete loan entry. Please try again.',
  ERROR_LOAN_DATE_REQUIRED:            'Loan date is required.',
  ERROR_LOAN_LINE_FIELDS_REQUIRED:     'Each line needs a part, recipient (Loan To) and quantity > 0.',
  SUCCESS_LOAN_CREATED:                'Loan entry created successfully.',
  SUCCESS_LOAN_UPDATED:                'Loan entry updated successfully.',
  SUCCESS_LOAN_DELETED:                'Loan entry deleted successfully.',

  // Opening Stock
  ERROR_OPENING_STOCK_LOAD_FAILED:        'Failed to load opening stock. Please try again.',
  ERROR_OPENING_STOCK_CREATE_FAILED:      'Failed to save opening stock. Please try again.',
  ERROR_OPENING_STOCK_UPDATE_FAILED:      'Failed to update opening stock. Please try again.',
  ERROR_OPENING_STOCK_DATE_REQUIRED:      'Entry date is required.',
  ERROR_OPENING_STOCK_LINE_FIELDS_REQUIRED: 'Each line needs a part and quantity > 0.',
  ERROR_OPENING_STOCK_TXN_TYPE_MISSING:   'Opening Balance transaction type not found. Please check configuration.',
  SUCCESS_OPENING_STOCK_CREATED:          'Opening stock saved successfully.',
  SUCCESS_OPENING_STOCK_UPDATED:          'Opening stock updated successfully.',
  SUCCESS_OPENING_STOCK_DELETED:          'Opening stock entry deleted successfully.',
  ERROR_OPENING_STOCK_DELETE_FAILED:      'Failed to delete opening stock entry. Please try again.',
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
