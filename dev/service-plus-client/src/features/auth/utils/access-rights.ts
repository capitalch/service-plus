import type { UserInstanceType } from '@/lib/auth-service';

export const ACCESS_RIGHTS = {
    JOBS_RECEIPTS: 'JOBS_RECEIPTS',
    JOBS_OPENING_JOBS: 'JOBS_OPENING_JOBS',
    JOBS_ACCOUNTS_POSTING: 'JOBS_ACCOUNTS_POSTING',
    MASTERS_MENU: 'MASTERS_MENU',
    CONFIG_MENU: 'CONFIG_MENU',
    ADMIN_MENU: 'ADMIN_MENU',
    JOBS_DELIVER_JOB: 'JOBS_DELIVER_JOB',
    INVENTORY_PURCHASE_ENTRY: 'INVENTORY_PURCHASE_ENTRY',
    INVENTORY_SALES_ENTRY: 'INVENTORY_SALES_ENTRY',
    INVENTORY_STOCK_ADJUSTMENT: 'INVENTORY_STOCK_ADJUSTMENT',
    INVENTORY_BRANCH_TRANSFER: 'INVENTORY_BRANCH_TRANSFER',
    INVENTORY_OPENING_STOCK: 'INVENTORY_OPENING_STOCK',
    INVENTORY_SET_PART_LOCATION: 'INVENTORY_SET_PART_LOCATION',
} as const;

export type AccessRightCode = typeof ACCESS_RIGHTS[keyof typeof ACCESS_RIGHTS];

/**
 * userType 'S' (super-admin) and 'A' (business admin) bypass every
 * access-right check, everywhere — "no restrictions on Admin".
 */
export function hasAccessRight(
    user: Pick<UserInstanceType, 'accessRights' | 'userType'> | null,
    code: AccessRightCode,
): boolean {
    if (user?.userType === 'S' || user?.userType === 'A') return true;
    return !!user?.accessRights?.includes(code);
}

export const ROLE_SHORT_NAMES: Record<string, string> = {
    MANAGER: 'Man',
    TECHNICIAN: 'Tech',
    RECEPTIONIST: 'Rec',
};

/** Falls back to the full role name if `roleCode` is missing/unmapped. */
export function getRoleDisplayName(
    user: Pick<UserInstanceType, 'roleCode' | 'roleName'> | null,
    short: boolean,
): string | undefined {
    if (!short) return user?.roleName || undefined;
    if (user?.roleCode && ROLE_SHORT_NAMES[user.roleCode]) {
        return ROLE_SHORT_NAMES[user.roleCode];
    }
    return user?.roleName || undefined;
}
