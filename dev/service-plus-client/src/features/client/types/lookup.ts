export type LookupRecord = {
    id:            number;
    code:          string;
    name:          string;
    description:   string | null;
    display_order: number | null;
    prefix:        string | null;
    is_active:     boolean;
    is_system:     boolean;
};

export type LookupMessages = {
    createFailed: string;
    created:      string;
    deleteFailed: string;
    deleted:      string;
    deleteInUse:  string;
    loadFailed:   string;
    updateFailed: string;
    updated:      string;
};

export type LookupConfig = {
    // SQL IDs
    checkCodeExistsSqlId:          string;
    checkCodeExistsExcludeIdSqlId: string;
    checkInUseSqlId:               string;
    getAllSqlId:                   string;
    // Table
    tableName:                     string;
    // Field visibility
    codeLettersOnly:               boolean;  // true = only [A-Z_], false = [A-Z0-9_]
    hasDescription:                boolean;
    hasDisplayOrder:               boolean;
    hasIsActive:                   boolean;
    hasPrefix:                     boolean;
    hasSystemFlag?:                boolean;  // false = table has no is_system column (e.g. brand)
    // UI text
    sectionTitle:                  string;
    sectionDescription:            string;
    // Messages
    messages:                      LookupMessages;
};
