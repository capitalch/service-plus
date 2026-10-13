import { useCallback } from "react";

import type { AiHelpTextsType, AiHelpType } from "@/components/shared/help/help-types";
import type { AskHelpAiPayloadType, AskHelpAiResultType } from "@/components/shared/help/use-help-ai-conversation";
import { useHelpAiConversation } from "@/components/shared/help/use-help-ai-conversation";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

import { DEV_HELP_ARTICLES } from "./dev-help-content";

// Ask AI for Super Admin's Developer Help: developer articles, askDevHelpAi (no tenant or BU).

const TEXTS: AiHelpTextsType = {
	disclaimer: MESSAGES.AI_DEV_HELP_DISCLAIMER,
	emptyState: MESSAGES.AI_DEV_HELP_EMPTY_STATE,
	notCovered: MESSAGES.AI_DEV_HELP_NOT_COVERED,
	placeholder: "Ask about the Service+ code…",
};

async function sendDevQuestion(payload: AskHelpAiPayloadType): Promise<AskHelpAiResultType | null> {
	const res = await apolloClient.mutate<{ askDevHelpAi: AskHelpAiResultType | null }>({
		mutation: GRAPHQL_MAP.askDevHelpAi,
		variables: { value: encodeObj(payload) },
	});
	return res.data?.askDevHelpAi ?? null;
}

export const useAskDevHelpAi = (): AiHelpType => {
	const send = useCallback(sendDevQuestion, []);
	return useHelpAiConversation({ articles: DEV_HELP_ARTICLES, send, texts: TEXTS });
};
