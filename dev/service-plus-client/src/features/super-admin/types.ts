// ─── Client (maps to Bu table in db-schema-security) ─────────────────────────

export type ClientType = {
  activeAdminCount: number;
  code: string;
  created_at: Date;
  id: number;
  inactiveAdminCount: number;
  is_active: boolean;
  name: string;
  updated_at: Date;
};

export type StatsType = {
  activeAdminUsers: number;
  activeBu: number;
  inactiveAdminUsers: number;
  inactiveBu: number;
  totalAdminUsers: number;
  totalBu: number;
};

// ─── Admin Users (maps to User + UserBuRole + Role in db-schema-security) ─────

export type AdminUserRoleType = "ClientAdmin" | "SuperAdmin" | "Viewer";

export type AdminUserType = {
  bu_id: number;
  bu_name: string;
  created_at: Date;
  email: string;
  full_name: string;
  id: number;
  is_active: boolean;
  is_admin: boolean;
  last_login_at: Date;
  mobile: string | null;
  role: AdminUserRoleType;
  updated_at: Date;
  username: string;
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export type ActivityActionType =
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

// ─── Usage & Health ───────────────────────────────────────────────────────────

export type ServiceHealthStatusType = "Degraded" | "Down" | "Healthy";

export type SystemServiceType = {
  id: string;
  lastChecked: string;
  name: string;
  responseTime: number;
  status: ServiceHealthStatusType;
  uptime: number;
};

export type MetricTrendType = "down" | "neutral" | "up";

export type PlatformMetricType = {
  change: number;
  id: string;
  label: string;
  trend: MetricTrendType;
  unit: string;
  value: string;
};

export type UptimeDataPointType = {
  day: string;
  uptime: number;
};

// ─── System Settings ──────────────────────────────────────────────────────────

export type SettingItemType = {
  key: string;
  label: string;
  value: string;
};

export type SettingSectionType = {
  id: string;
  items: SettingItemType[];
  title: string;
};
