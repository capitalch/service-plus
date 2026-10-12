import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { useCallback, useRef, useState } from "react";

import { rankHelpArticles } from "@/components/shared/help/help-search";
import type { AiHelpTurnType, AiHelpType } from "@/components/shared/help/help-types";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { HELP_ARTICLES } from "./help-content";

// Ask AI conversation for the client Help panel. The browser picks the articles with the same
// ranking as Help search and sends only their ids; the server owns the article text and the
// prompt (service-plus-server/app/ai_help/). Nothing is kept after the panel closes.

const HISTORY_TURNS = 6;
const MAX_ARTICLE_IDS = 6;
const RANKED_ARTICLES = 5;

type AskHelpAiResultType = { answer: string; articleIds: string[]; notCovered: boolean };

const ERROR_MESSAGES: Record<string, string> = {
	AI_HELP_BUSY: MESSAGES.AI_HELP_BUSY,
	AI_HELP_INVALID_INPUT: MESSAGES.AI_HELP_INVALID_INPUT,
	AI_HELP_LIMIT_REACHED: MESSAGES.AI_HELP_LIMIT_REACHED,
	AI_HELP_UNAVAILABLE: MESSAGES.AI_HELP_UNAVAILABLE,
};

function errorMessage(error: unknown): string {
	if (CombinedGraphQLErrors.is(error)) {
		const code = error.errors.find((e) => ERROR_MESSAGES[e.extensions?.code as string])?.extensions?.code;
		if (code) return ERROR_MESSAGES[code as string];
	}
	return MESSAGES.AI_HELP_UNAVAILABLE;
}

// A follow-up ("and how do I print it?") matches badly alone, so rank it together with the
// previous question and keep the articles the previous answer used.
function pickArticleIds(question: string, turns: AiHelpTurnType[]): string[] {
	const answered = turns.filter((t) => !t.isNotice).reverse();
	const previousQuestion = answered.find((t) => t.role === "user")?.text ?? "";
	const previousIds = answered.find((t) => t.role === "assistant")?.articleIds ?? [];
	const ranked = rankHelpArticles(HELP_ARTICLES, `${question} ${previousQuestion}`, RANKED_ARTICLES).map((a) => a.id);
	return [...new Set([...ranked, ...previousIds])].slice(0, MAX_ARTICLE_IDS);
}

export const useAskHelpAi = (): AiHelpType => {
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);
	const [loading, setLoading] = useState(false);
	const [turns, setTurns] = useState<AiHelpTurnType[]>([]);
	const conversationRef = useRef(0);
	const nextIdRef = useRef(1);

	const clear = useCallback(() => {
		conversationRef.current += 1;
		setLoading(false);
		setTurns([]);
	}, []);

	const ask = useCallback(
		async (question: string) => {
			const text = question.trim();
			if (!text || loading || !dbName || !schema) return;
			const conversation = conversationRef.current;
			const history = turns
				.filter((t) => !t.isNotice)
				.slice(-HISTORY_TURNS)
				.map(({ role, text: turnText }) => ({ role, text: turnText }));
			const articleIds = pickArticleIds(text, turns);

			function addTurn(turn: Omit<AiHelpTurnType, "id">) {
				const id = nextIdRef.current++;
				setTurns((prev) => [...prev, { ...turn, id }]);
			}

			addTurn({ articleIds: [], isNotice: false, role: "user", text });
			setLoading(true);
			try {
				const res = await apolloClient.mutate<{ askHelpAi: AskHelpAiResultType | null }>({
					mutation: GRAPHQL_MAP.askHelpAi,
					variables: { db_name: dbName, schema, value: encodeObj({ articleIds, history, question: text }) },
				});
				if (conversation !== conversationRef.current) return;
				const result = res.data?.askHelpAi;
				if (!result || result.notCovered) {
					addTurn({ articleIds: [], isNotice: false, role: "assistant", text: MESSAGES.AI_HELP_NOT_COVERED });
				} else {
					addTurn({ articleIds: result.articleIds, isNotice: false, role: "assistant", text: result.answer });
				}
			} catch (error) {
				if (conversation !== conversationRef.current) return;
				addTurn({ articleIds: [], isNotice: true, role: "assistant", text: errorMessage(error) });
			} finally {
				if (conversation === conversationRef.current) setLoading(false);
			}
		},
		[dbName, loading, schema, turns],
	);

	return { ask, clear, loading, turns };
};
