export type AppSettingRecord = {
    id:            number;
    setting_key:   string;
    setting_value: unknown;
    description:   string | null;
    is_editable:   boolean;
    created_at:    string;
    updated_at:    string;
};
