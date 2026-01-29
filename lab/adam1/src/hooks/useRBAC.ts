import { useAppSelector } from "@/app/store";

type Permission =
  | "tickets:read"
  | "tickets:write"
  | "tickets:delete"
  | "clients:read"
  | "clients:write"
  | "clients:delete"
  | "technicians:read"
  | "technicians:write"
  | "technicians:delete"
  | "billing:read"
  | "billing:write"
  | "scheduling:read"
  | "scheduling:write"
  | "admin:access";

type Role = "admin" | "manager" | "technician" | "viewer";

const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    "tickets:read",
    "tickets:write",
    "tickets:delete",
    "clients:read",
    "clients:write",
    "clients:delete",
    "technicians:read",
    "technicians:write",
    "technicians:delete",
    "billing:read",
    "billing:write",
    "scheduling:read",
    "scheduling:write",
    "admin:access",
  ],
  manager: [
    "tickets:read",
    "tickets:write",
    "tickets:delete",
    "clients:read",
    "clients:write",
    "technicians:read",
    "billing:read",
    "billing:write",
    "scheduling:read",
    "scheduling:write",
  ],
  technician: [
    "tickets:read",
    "tickets:write",
    "clients:read",
    "scheduling:read",
  ],
  viewer: ["tickets:read", "clients:read", "scheduling:read"],
};

export function useRBAC() {
  const user = useAppSelector((state) => state.auth.user);
  const userRoles = (user?.roles || []) as Role[];

  const hasPermission = (permission: Permission): boolean => {
    return userRoles.some((role) => {
      const permissions = rolePermissions[role];
      return permissions?.includes(permission);
    });
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some((permission) => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every((permission) => hasPermission(permission));
  };

  const hasRole = (role: Role): boolean => {
    return userRoles.includes(role);
  };

  const hasAnyRole = (roles: Role[]): boolean => {
    return roles.some((role) => hasRole(role));
  };

  const isAdmin = hasRole("admin");
  const isManager = hasAnyRole(["admin", "manager"]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    isAdmin,
    isManager,
    userRoles,
  };
}
