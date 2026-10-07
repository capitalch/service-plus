import { ACCESS_RIGHTS, hasAccessRight } from "@/features/auth/utils/access-rights";
import type { AccessRightCode } from "@/features/auth/utils/access-rights";
import type { UserInstanceType } from "@/lib/auth-service";

/** Masters items that need a right beyond MASTERS_MENU; unlisted items are open to everyone. */
const MASTERS_ITEM_RIGHTS: Record<string, AccessRightCode> = {
	Branch: ACCESS_RIGHTS.MASTERS_ORGANIZATION,
	"Customer Type": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Document Type": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Financial Year": ACCESS_RIGHTS.MASTERS_ORGANIZATION,
	"Job Additional Charges": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Job Delivery Manner": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Job Receive Condition": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Job Receive Manner": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Job Status": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Job Type": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"State / Province": ACCESS_RIGHTS.MASTERS_ORGANIZATION,
};

/** Where Masters lands when the default (Branch) or a deep-linked item is off-limits. */
export const MASTERS_FALLBACK = { group: "Entities", item: "Customer" };

export function canAccessMastersItem(
	user: Pick<UserInstanceType, "accessRights" | "userType"> | null,
	label: string,
): boolean {
	const right = MASTERS_ITEM_RIGHTS[label];
	return !right || hasAccessRight(user, right);
}
