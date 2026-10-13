import { useCallback } from "react";

import type { AiHelpTextsType, AiHelpType } from "@/components/shared/help/help-types";
import type { AskHelpAiPayloadType, AskHelpAiResultType } from "@/components/shared/help/use-help-ai-conversation";
import { useHelpAiConversation } from "@/components/shared/help/use-help-ai-conversation";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { HELP_ARTICLES } from "./help-content";

// Ask AI for the client Help panel: staff articles, askHelpAi on the current BU.

const TEXTS: AiHelpTextsType = {
	disclaimer: MESSAGES.AI_HELP_DISCLAIMER,
	emptyState: MESSAGES.AI_HELP_EMPTY_STATE,
	notCovered: MESSAGES.AI_HELP_NOT_COVERED,
	placeholder: "Ask about using Service+…",
};

export const useAskHelpAi = (): AiHelpType => {
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const send = useCallback(
		async (payload: AskHelpAiPayloadType) => {
			const res = await apolloClient.mutate<{ askHelpAi: AskHelpAiResultType | null }>({
				mutation: GRAPHQL_MAP.askHelpAi,
				variables: { db_name: dbName, schema, value: encodeObj(payload) },
			});
			return res.data?.askHelpAi ?? null;
		},
		[dbName, schema],
	);

	return useHelpAiConversation({ articles: HELP_ARTICLES, send, texts: TEXTS });
};
