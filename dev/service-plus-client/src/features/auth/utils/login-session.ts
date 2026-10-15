import type { LoginResponseType, UserInstanceType } from "@/lib/auth-service";

/**
 * The session user stored after a login. Shared by the login form and the live-demo page,
 * so both sessions are built the same way.
 */
export function toUserInstance(result: LoginResponseType): UserInstanceType {
	return {
		accessRights: result.accessRights,
		availableBus: result.availableBus,
		clientCode: result.clientCode,
		dbName: result.dbName,
		email: result.email,
		fullName: result.fullName,
		id: result.id,
		isDefaultCustomerDb: result.isDefaultCustomerDb ?? false,
		isDemo: result.isDemo ?? false,
		lastUsedBranchId: result.lastUsedBranchId,
		lastUsedBuId: result.lastUsedBuId,
		mobile: result.mobile,
		portalUrl: result.portalUrl ?? null,
		roleCode: result.roleCode,
		roleName: result.roleName,
		userType: result.userType,
		username: result.username,
	};
}
