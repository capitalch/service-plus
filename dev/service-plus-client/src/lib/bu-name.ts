// Business-unit name rule, shared by the create and edit BU dialogs (plans/plan.md Step 3).
// Starts with a letter or digit, 3–100 characters, letters / digits / spaces and . & ' ( ) / , -
// so real business names such as "Nav Technology Pvt Ltd." pass. The server's
// BU_NAME_PATTERN (bu_admin/provisioning.py) and the portal use the same pattern.
export const BU_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9 .&'()/,-]{2,99}$/;
