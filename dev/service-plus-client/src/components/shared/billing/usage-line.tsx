import { Fragment } from "react";

import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";
import { selectBilling } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

type UsageLinePropsType = {
	className?: string;
	kind: "jobs" | "whatsapp";
};

// Amber from this share of the allowance on; never red (red is for errors only).
const NEAR_LIMIT_SHARE = 0.9;

/** "Jobs this month: 42 / 75" pill for the current BU (plans/plan.md Step 8), counts in bold.
 * Hidden when the plan is unlimited or the usage is not loaded yet; amber near and at the limit. */
export const UsageLine = ({ className, kind }: UsageLinePropsType) => {
	const billing = useAppSelector(selectBilling);
	const limit = kind === "jobs" ? billing?.jobLimit : billing?.whatsappLimit;
	const used = (kind === "jobs" ? billing?.jobsUsed : billing?.whatsappUsed) ?? 0;
	if (limit === null || limit === undefined) return null;

	const template = kind === "jobs" ? MESSAGES.BILLING_USAGE_JOBS : MESSAGES.BILLING_USAGE_WHATSAPP;
	const isNearLimit = used >= limit * NEAR_LIMIT_SHARE;
	const counts: Record<string, string> = { "{limit}": String(limit), "{used}": String(used) };

	return (
		<span
			className={cn(
				"items-center rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap",
				isNearLimit
					? "border-amber-300 bg-amber-50 text-amber-800"
					: "border-blue-200 bg-blue-50 text-blue-800",
				className,
			)}
		>
			{template.split(/(\{used\}|\{limit\})/).map((part, i) =>
				counts[part] ? (
					<strong className="font-bold tabular-nums" key={i}>
						{counts[part]}
					</strong>
				) : (
					<Fragment key={i}>{part}</Fragment>
				),
			)}
		</span>
	);
};
