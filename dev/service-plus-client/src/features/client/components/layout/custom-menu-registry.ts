import { ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ACCESS_RIGHTS, hasAccessRight } from "@/features/auth/utils/access-rights";
import type { AccessRightCode } from "@/features/auth/utils/access-rights";
import type { UserInstanceType } from "@/lib/auth-service";

/**
 * The "Custom" top-nav tab is a container for bought add-on features, not a screen of
 * its own. That is why its children live here rather than being hardcoded in the nav:
 * each one declares its own feature-flag predicate and required right, and the tab
 * itself appears only when at least one child is visible.
 *
 * Every other top-nav item gates on an access right alone. These gate on an access
 * right AND an app_setting, because a tenant who has not bought the add-on should not
 * see it at all — not see it disabled.
 */
export type CustomMenuContextType = {
	extendedWarrantyNotificationsEnabled: boolean;
};

export type CustomMenuItemType = {
	helpArticleId: string;
	icon: LucideIcon;
	iconColor: string;
	isEnabled: (ctx: CustomMenuContextType) => boolean;
	label: string;
	requiredRight?: AccessRightCode;
};

export const CUSTOM_MENU_ITEMS: CustomMenuItemType[] = [
	{
		helpArticleId: "extended-warranty",
		icon: ShieldCheck,
		iconColor: "text-violet-600",
		isEnabled: (ctx) => ctx.extendedWarrantyNotificationsEnabled,
		label: "Extended Warranty",
		requiredRight: ACCESS_RIGHTS.CUSTOM_EXTENDED_WARRANTY,
	},
];

/**
 * The single source of truth for what is in the Custom menu right now. The top nav
 * uses `.length > 0` to decide whether the tab exists at all, and the explorer panel
 * renders exactly this list — so the two can never disagree.
 */
export function getVisibleCustomMenuItems(
	user: Pick<UserInstanceType, "accessRights" | "userType"> | null,
	ctx: CustomMenuContextType,
): CustomMenuItemType[] {
	return CUSTOM_MENU_ITEMS.filter(
		(item) => item.isEnabled(ctx) && (!item.requiredRight || hasAccessRight(user, item.requiredRight)),
	);
}
