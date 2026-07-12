// ─── Client (maps to Bu table in db-schema-security) ─────────────────────────

export type ClientType = {
    activeAdminCount: number;
    activeBuCount: number;
    address_line1: string | null;
    address_line2: string | null;
    admins: ClientAdminType[];
    city: string | null;
    code: string;
    country_code: string | null;
    created_at: string;
    db_name: string | null;
    db_name_valid: boolean;
    email: string | null;
    gstin: string | null;
    id: number;
    inactiveAdminCount: number;
    inactiveBuCount: number;
    is_active: boolean;
    name: string;
    pan: string | null;
    phone: string | null;
    pincode: string | null;
    state: string | null;
    updated_at: string;
};

export type StatsType = {
    activeAdminUsers: number;
    activeBu: number;
    activeClients: number;
    activeUsers: number;
    inactiveAdminUsers: number;
    inactiveBu: number;
    inactiveClients: number;
    inactiveUsers: number;
    totalAdminUsers: number;
    totalBu: number;
    totalClients: number;
    totalUsers: number;
};

// ─── Client Admin User (used in Admins page) ──────────────────────────────────

export type ClientAdminType = {
    created_at: string;
    email: string;
    full_name: string;
    id: number;
    is_active: boolean;
    mobile: string | null;
    updated_at: string;
    username: string;
};

// ─── Admin Users (maps to User + UserBuRole + Role in db-schema-security) ─────

type AdminUserRoleType = "ClientAdmin" | "SuperAdmin" | "Viewer";

export type AdminUserType = {
    bu_id: number;
    bu_name: string;
    created_at: string;
    email: string;
    full_name: string;
    id: number;
    is_active: boolean;
    is_admin: boolean;
    last_login_at: string;
    mobile: string | null;
    role: AdminUserRoleType;
    updated_at: string;
    username: string;
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────

type ActivityActionType =
    | "Admin Added"
    | "Admin Deactivated"
    | "Client Created"
    | "Client Disabled"
    | "Login"
    | "Password Reset"
    | "Settings Changed";

export type ActivityLogItemType = {
    action: ActivityActionType;
    actorEmail: string;
    actorName: string;
    id: string;
    ipAddress: string;
    targetName: string;
    timestamp: string;
};

type AuditActorType = { type: string; username: string };

type AuditResourceType = { id: string | null; name: string | null; type: string };

export type AuditEntryType = {
    action:    string;
    actor:     AuditActorType;
    detail:    string | null;
    id:        string;
    outcome:   "failure" | "success";
    resource:  AuditResourceType;
    timestamp: string;
};

export type AuditLogPageType = {
    items:      AuditEntryType[];
    page:       number;
    pageSize:   number;
    totalItems: number;
    totalPages: number;
};

type AuditActionCountType = { action: string; count: number };

type AuditActorCountType = { actor: string; count: number };

type AuditOutcomeCountType = { failure: number; success: number };

type AuditTimeSeriesPointType = { count: number; date: string };

export type AuditStatsType = {
    actionCounts:  AuditActionCountType[];
    actorCounts:   AuditActorCountType[];
    outcomeCounts: AuditOutcomeCountType;
    timeSeries:    AuditTimeSeriesPointType[];
    totalEvents:   number;
};

// ─── Usage & Health ───────────────────────────────────────────────────────────

export type HealthStatusType = "Degraded" | "Down" | "Healthy";

export type ServiceCheckType = {
    detail:     string | null;
    latency_ms: number | null;
    name:       string;
    status:     HealthStatusType;
};

type AuditLogHealthType = {
    file_count:  number;
    last_write:  string | null;
    size_bytes:  number;
    today_count: number;
    week_count:  number;
};

export type DbSizeType = {
    db_name:    string;
    size_bytes: number;
};

type PlatformStatsType = {
    active_clients:   number;
    inactive_clients: number;
    total_admins:     number;
    total_clients:    number;
    total_dbs:        number;
};

type ServerInfoType = {
    algorithm:   string;
    app_name:    string;
    app_version: string;
    debug:       boolean;
    host:        string;
    port:        number;
    uptime:      string;
};

export type UsageHealthType = {
    audit_log:      AuditLogHealthType;
    db_sizes:       DbSizeType[];
    overall_status: HealthStatusType;
    platform_stats: PlatformStatsType;
    server_info:    ServerInfoType;
    services:       ServiceCheckType[];
};

// ─── System Settings (read-only, mirroring config.py) ────────────────────────

type ApplicationSettingsType = {
    app_name:    string;
    app_version: string;
    debug:       boolean;
    host:        string;
    port:        number;
};

type AuditLogSettingsType = {
    audit_log_dir:            string;
    audit_log_max_read_days:  number;
    audit_log_retention_days: number;
};

type SecuritySettingsType = {
    access_token_expire_minutes: number;
    algorithm:                   string;
    refresh_token_expire_days:   number;
};

type SmtpSettingsType = {
    smtp_from:     string;
    smtp_host:     string;
    smtp_password: string;
    smtp_port:     number;
    smtp_user:     string;
};

type SuperAdminSettingsType = {
    super_admin_email:         string;
    super_admin_mobile:        string;
    super_admin_password_hash: string;
    super_admin_username:      string;
};

export type SystemSettingsType = {
    application: ApplicationSettingsType;
    audit_log:   AuditLogSettingsType;
    security:    SecuritySettingsType;
    smtp:        SmtpSettingsType;
    super_admin: SuperAdminSettingsType;
};
