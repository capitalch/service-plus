import { useEffect, useState } from "react";

import { HelpPanel } from "@/components/shared/help/help-panel";
import { AskAiRoundButton, HelpRoundButton } from "@/components/shared/help/help-round-button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";

import { DEV_CAT_STYLE, DEV_HELP_ARTICLES, DEV_HELP_CATEGORIES, DEV_POPULAR_IDS } from "./dev-help-content";
import { useAskDevHelpAi } from "./use-ask-dev-help-ai";

// Developer Help with Ask AI: the round buttons at the bottom right plus the panel. Mounted by
// the Super Admin layout and the business Admin panel layout (admin-layout.tsx).
export const DeveloperHelp = () => {
	const [helpOpen, setHelpOpen] = useState(false);
	const [helpAiOpen, setHelpAiOpen] = useState(false);
	const [aiHelpEnabled, setAiHelpEnabled] = useState(false);
	const aiHelp = useAskDevHelpAi();

	// Ask AI shows only when the server has an AI key (devHelpAiEnabled, Super Admin and Admin).
	useEffect(() => {
		let cancelled = false;
		apolloClient
			.query<{ devHelpAiEnabled: boolean | null }>({ query: GRAPHQL_MAP.devHelpAiEnabled })
			.then((res) => {
				if (!cancelled) setAiHelpEnabled(Boolean(res.data?.devHelpAiEnabled));
			})
			.catch(() => {
				if (!cancelled) setAiHelpEnabled(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	function handleClose() {
		// Ask AI keeps nothing once Help closes.
		aiHelp.clear();
		setHelpAiOpen(false);
		setHelpOpen(false);
	}
	function handleOpen(ai: boolean) {
		setHelpAiOpen(ai);
		setHelpOpen(true);
	}

	return (
		<>
			<HelpPanel
				ai={aiHelpEnabled ? aiHelp : undefined}
				articles={DEV_HELP_ARTICLES}
				categories={DEV_HELP_CATEGORIES}
				categoryStyles={DEV_CAT_STYLE}
				initialAi={helpAiOpen}
				onClose={handleClose}
				open={helpOpen}
				popularIds={DEV_POPULAR_IDS}
				title="Developer Help Center"
			/>
			{/* These layouts have no status bar on the right edge, so the buttons sit a little in from it. */}
			{aiHelpEnabled && <AskAiRoundButton className="right-5 sm:right-7" onClick={() => handleOpen(true)} />}
			<HelpRoundButton
				className="right-4 sm:right-6"
				onClick={() => handleOpen(false)}
				title="Open Developer Help"
			/>
		</>
	);
};
