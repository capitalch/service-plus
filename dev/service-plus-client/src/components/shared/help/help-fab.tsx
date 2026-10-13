import { AskAiRoundButton, HelpRoundButton } from "./help-round-button";
import { useHelp } from "@/features/client/components/layout/client-layout";

export function HelpFab() {
	const { aiHelpEnabled, openAiHelp, openHelp } = useHelp();

	return (
		<>
			{aiHelpEnabled && <AskAiRoundButton onClick={() => openAiHelp()} />}
			<HelpRoundButton onClick={() => openHelp()} title="Open Help Center" />
		</>
	);
}
