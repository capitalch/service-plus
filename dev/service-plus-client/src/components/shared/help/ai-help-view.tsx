import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, RotateCcw, SendHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";

import type { AiHelpTurnType, AiHelpType, HelpArticle } from "./help-types";

// ─── Ask AI view ──────────────────────────────────────────────────────────────
// Rendered by HelpPanel when it is given an `ai` prop (client Help only). The conversation
// lives in the caller's hook, so it survives opening an article and coming back.

const MAX_QUESTION = 500;

const questionSchema = z.object({
	question: z
		.string()
		.trim()
		.min(1, MESSAGES.AI_HELP_QUESTION_REQUIRED)
		.max(MAX_QUESTION, MESSAGES.AI_HELP_QUESTION_TOO_LONG),
});

type QuestionFormType = z.infer<typeof questionSchema>;

const STEP_RE = /^\d+[.)]\s+/;
// A later "2. " inside a line that starts as a step: the model sometimes runs the steps together.
const INLINE_STEP_RE = /\s+(?=\d{1,2}[.)]\s)/;

// Plain-text answer → paragraphs, with runs of "1. …" lines as a numbered list.
function AnswerText({ text }: { text: string }) {
	const blocks: { items: string[]; kind: "para" | "steps" }[] = [];
	const lines = text
		.split("\n")
		.flatMap((raw) => (STEP_RE.test(raw.trim()) ? raw.trim().split(INLINE_STEP_RE) : [raw]));
	for (const raw of lines) {
		const line = raw.trim();
		if (!line) continue;
		if (STEP_RE.test(line)) {
			const last = blocks.at(-1);
			const item = line.replace(STEP_RE, "");
			if (last?.kind === "steps") last.items.push(item);
			else blocks.push({ items: [item], kind: "steps" });
		} else {
			blocks.push({ items: [line], kind: "para" });
		}
	}
	return (
		<div className="space-y-2">
			{blocks.map((b, i) =>
				b.kind === "para" ? (
					<p key={i}>{b.items[0]}</p>
				) : (
					<ol key={i} className="list-decimal space-y-1 pl-5">
						{b.items.map((item, j) => (
							<li key={j}>{item}</li>
						))}
					</ol>
				),
			)}
		</div>
	);
}

function Turn({
	articles,
	onSelectArticle,
	turn,
}: {
	articles: HelpArticle[];
	onSelectArticle: (a: HelpArticle) => void;
	turn: AiHelpTurnType;
}) {
	if (turn.role === "user") {
		return (
			<div className="flex justify-end">
				<p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-violet-600 px-3.5 py-2 text-[13px] leading-relaxed text-white">
					{turn.text}
				</p>
			</div>
		);
	}
	if (turn.isNotice) {
		return (
			<div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
				<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
				<p className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">{turn.text}</p>
			</div>
		);
	}
	const linked = turn.articleIds
		.map((id) => articles.find((a) => a.id === id))
		.filter((a): a is HelpArticle => Boolean(a));
	return (
		<div className="flex gap-2.5">
			<span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
				<Sparkles className="h-3.5 w-3.5" />
			</span>
			<div className="min-w-0 max-w-[90%] rounded-2xl rounded-tl-sm border border-(--cl-border) bg-(--cl-surface) px-3.5 py-2.5 text-[13px] leading-relaxed text-(--cl-text)">
				<AnswerText text={turn.text} />
				{linked.length > 0 && (
					<div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-(--cl-border)/70 pt-2.5">
						{linked.map((a) => (
							<button
								key={a.id}
								className="cursor-pointer rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50"
								onClick={() => onSelectArticle(a)}
								type="button"
							>
								{a.title}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export const AiHelpView = ({
	ai,
	articles,
	draft,
	onSelectArticle,
}: {
	ai: AiHelpType;
	articles: HelpArticle[];
	draft: string;
	onSelectArticle: (a: HelpArticle) => void;
}) => {
	const bottomRef = useRef<HTMLDivElement>(null);
	const {
		formState: { errors, isDirty, isValid },
		handleSubmit,
		register,
		reset,
		setFocus,
	} = useForm<QuestionFormType>({
		defaultValues: { question: draft },
		mode: "onChange",
		resolver: zodResolver(questionSchema),
	});

	useEffect(() => {
		reset({ question: draft }, { keepDefaultValues: false });
		setTimeout(() => setFocus("question"), 120);
	}, [draft, reset, setFocus]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, [ai.loading, ai.turns.length]);

	function onSubmit(values: QuestionFormType) {
		reset({ question: "" });
		void ai.ask(values.question);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (isValid && !ai.loading) void handleSubmit(onSubmit)();
		}
	}

	return (
		<div className="flex h-full flex-col">
			{/* Conversation */}
			<div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
				{ai.turns.length === 0 ? (
					<div className="flex flex-col items-center py-8 text-center">
						<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md">
							<Sparkles className="h-7 w-7" />
						</div>
						<p className="max-w-[340px] text-[13px] leading-relaxed text-(--cl-text-muted)">
							{MESSAGES.AI_HELP_EMPTY_STATE}
						</p>
					</div>
				) : (
					ai.turns.map((turn) => (
						<Turn key={turn.id} articles={articles} onSelectArticle={onSelectArticle} turn={turn} />
					))
				)}
				{ai.loading && (
					<div className="flex items-center gap-2 pl-8 text-[12px] text-(--cl-text-muted)">
						<Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
						Thinking…
					</div>
				)}
				<div ref={bottomRef} />
			</div>

			{/* Question box, pinned to the bottom */}
			<form
				className="shrink-0 border-t border-(--cl-border) bg-(--cl-surface) px-4 pb-2 pt-3"
				onSubmit={handleSubmit(onSubmit)}
			>
				<textarea
					{...register("question")}
					className="max-h-32 min-h-[64px] w-full resize-none rounded-xl border border-(--cl-border) bg-(--cl-bg) px-3 py-2 text-[13px] text-(--cl-text) transition-all placeholder:text-(--cl-text-muted)/60 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
					maxLength={MAX_QUESTION + 50}
					onKeyDown={handleKeyDown}
					placeholder="Ask about using Service+…"
					rows={2}
				/>
				{isDirty && errors.question && (
					<p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{errors.question.message}</p>
				)}
				<div className="mt-2 flex items-center gap-2">
					<button
						className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-(--cl-text-muted) transition-colors hover:bg-(--cl-hover) hover:text-(--cl-text) disabled:cursor-not-allowed disabled:opacity-50"
						disabled={ai.turns.length === 0 && !ai.loading}
						onClick={ai.clear}
						type="button"
					>
						<RotateCcw className="h-3.5 w-3.5" />
						New chat
					</button>
					<button
						className={cn(
							"ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-all hover:shadow-md",
							"disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
						)}
						disabled={!isValid || ai.loading}
						type="submit"
					>
						<SendHorizontal className="h-3.5 w-3.5" />
						Ask
					</button>
				</div>
				<p className="mt-2 text-center text-[10px] leading-snug text-(--cl-text-muted)/70">
					{MESSAGES.AI_HELP_DISCLAIMER}
				</p>
			</form>
		</div>
	);
};
