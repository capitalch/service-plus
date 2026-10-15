import { useMemo } from "react";

import { selectBilling } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import type { HelpArticle } from "./help-content";
import { visibleHelpArticles } from "./help-content";

/** The client help articles for the current BU — the Help panel and Ask AI both read this, so
 *  an optional feature's article is hidden from both together. Recomputed only when the BU's
 *  features change, not on every billing refresh. */
export const useVisibleHelpArticles = (): HelpArticle[] => {
	const features = useAppSelector(selectBilling)?.features;
	const key = (features ?? []).join(",");
	// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the list's content
	return useMemo(() => visibleHelpArticles(features), [key]);
};
