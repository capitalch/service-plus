export type AdminDashboardStatsType = {
    activeAdminUsers:      number;
    activeBusinessUsers:   number;
    activeBu:              number;
    auditEventsWeek:       number;
    inactiveAdminUsers:    number;
    inactiveBusinessUsers: number;
    inactiveBu:            number;
    totalAdminUsers:       number;
    totalBusinessUsers:    number;
    totalBu:               number;
};

export type BusinessUnitType = {
    code:          string;
    created_at:    string;
    id:            number;
    is_active:     boolean;
    name:          string;
    schema_exists: boolean;
    updated_at:    string;
};

export type BusinessUserType = {
    bu_ids:     number[];
    created_at: string;
    email:      string;
    full_name:  string;
    id:         number;
    is_active:  boolean;
    mobile:     string | null;
    role_id:    number | null;
    role_name:  string | null;
    updated_at: string;
    username:   string;
};

export type RoleType = {
    code:        string;
    created_at:  string;
    description: string | null;
    id:          number;
    is_system:   boolean;
    name:        string;
    updated_at:  string;
};
