import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { selectDemoPortalUrl, selectIsDemo } from "@/features/auth/store/auth-slice";
import { useAppSelector } from "@/store/hooks";

/** Under the top nav for a live-demo session: says New and Edit are off, and offers "Start free". */
export const DemoBanner = () => {
	const isDemo = useAppSelector(selectIsDemo);
	const portalUrl = useAppSelector(selectDemoPortalUrl);
	if (!isDemo) return null;

	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
			<SparklesIcon className="h-3.5 w-3.5 shrink-0" />
			<span className="flex-1">{MESSAGES.DEMO_BANNER_TEXT}</span>
			{portalUrl && (
				<Button asChild className="h-6 px-2.5 text-xs" size="sm">
					<a href={`${portalUrl}/pricing?plan=lite`} rel="noopener" target="_blank">
						Start free
					</a>
				</Button>
			)}
		</div>
	);
};
