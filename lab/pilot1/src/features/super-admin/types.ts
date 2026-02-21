// ─── Client ───────────────────────────────────────────────────────────────────

export type ClientStatusType = "Active" | "Inactive";

export type ClientType = {
  activeAdminCount: number;
  clientCode: string;
  clientName: string;
  createdDate: string;
  id: string;
  inactiveAdminCount: number;
  status: ClientStatusType;
};

export type StatsType = {
  activeAdminUsers: number;
  activeClients: number;
  inactiveAdminUsers: number;
  inactiveClients: number;
  totalAdminUsers: number;
  totalClients: number;
};

// ─── Admin Users ──────────────────────────────────────────────────────────────

export type AdminUserRoleType = "ClientAdmin" | "SuperAdmin" | "Viewer";

export type AdminUserStatusType = "Active" | "Inactive";

export type AdminUserType = {
  clientId: string;
  clientName: string;
  createdDate: string;
  email: string;
  id: string;
  lastLoginDate: string;
  name: string;
  role: AdminUserRoleType;
  status: AdminUserStatusType;
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
