import type { ContentBlock, HelpArticle } from "./help-types";

// ─── Ranked help search ───────────────────────────────────────────────────────
// Shared across content sets — each content file (help-content.ts, dev-help-content.ts)
// hands its own `articles` array in. The query is split into words, so a whole question
// ("how do I print a job card") still finds articles. The same ranking picks the
// articles sent to Ask AI (use-ask-help-ai.ts), so keep it deterministic.

const STOP_WORDS = new Set([
	"a",
	"about",
	"after",
	"all",
	"am",
	"an",
	"and",
	"any",
	"are",
	"as",
	"at",
	"be",
	"been",
	"before",
	"but",
	"by",
	"can",
	"cannot",
	"could",
	"did",
	"do",
	"does",
	"doing",
	"dont",
	"for",
	"from",
	"get",
	"has",
	"have",
	"he",
	"her",
	"his",
	"how",
	"if",
	"in",
	"into",
	"is",
	"it",
	"its",
	"just",
	"me",
	"my",
	"no",
	"not",
	"of",
	"on",
	"or",
	"our",
	"please",
	"she",
	"should",
	"so",
	"some",
	"than",
	"that",
	"the",
	"their",
	"them",
	"then",
	"there",
	"these",
	"they",
	"this",
	"to",
	"up",
	"us",
	"use",
	"was",
	"we",
	"were",
	"what",
	"when",
	"where",
	"which",
	"who",
	"why",
	"will",
	"with",
	"would",
	"you",
	"your",
]);

const MIN_PREFIX_LENGTH = 4;

const WEIGHTS = {
	faqAnswer: 1,
	faqQuestion: 3,
	heading: 2,
	summary: 3,
	tag: 4,
	text: 1,
	title: 5,
} as const;

type FieldType = { text: string; weight: number };

function blockFields(block: ContentBlock): FieldType[] {
	switch (block.type) {
		case "heading":
			return [{ text: block.text, weight: WEIGHTS.heading }];
		case "bullets":
		case "steps":
			return [{ text: block.items.join(" "), weight: WEIGHTS.text }];
		case "table":
			return [{ text: [...block.headers, ...block.rows.flat()].join(" "), weight: WEIGHTS.text }];
		default:
			return [{ text: block.text, weight: WEIGHTS.text }];
	}
}

function articleFields(article: HelpArticle): FieldType[] {
	return [
		{ text: article.title, weight: WEIGHTS.title },
		...article.tags.map((t) => ({ text: t, weight: WEIGHTS.tag })),
		{ text: article.summary, weight: WEIGHTS.summary },
		...article.faqs.flatMap((f) => [
			{ text: f.q, weight: WEIGHTS.faqQuestion },
			{ text: f.a, weight: WEIGHTS.faqAnswer },
		]),
		...article.content.flatMap(blockFields),
	];
}

function splitWords(text: string): string[] {
	return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Index cache: tokenising ~60 articles on every keystroke is wasteful.
const indexCache = new WeakMap<HelpArticle, { words: string[]; weight: number }[]>();

function articleIndex(article: HelpArticle) {
	let index = indexCache.get(article);
	if (!index) {
		index = articleFields(article).map((f) => ({ weight: f.weight, words: splitWords(f.text) }));
		indexCache.set(article, index);
	}
	return index;
}

function wordMatches(queryWord: string, word: string): boolean {
	return (
		word === queryWord ||
		(queryWord.length >= MIN_PREFIX_LENGTH && word.startsWith(queryWord)) ||
		// Plural in the question, singular in the article ("jobs" → "job").
		(queryWord.length > 3 && queryWord.endsWith("s") && word === queryWord.slice(0, -1))
	);
}

export function queryWords(query: string): string[] {
	return [...new Set(splitWords(query).filter((w) => w.length >= 2 && !STOP_WORDS.has(w)))];
}

// Each query word's field weights are multiplied by its rarity, so a word found in few articles
// ("deliver") outweighs one found almost everywhere ("two", "together", "job").
export function rankHelpArticles(articles: HelpArticle[], query: string, limit?: number): HelpArticle[] {
	const words = queryWords(query);
	if (words.length === 0) return [];

	const perArticle = articles.map((article) => {
		const index = articleIndex(article);
		return words.map((qw) =>
			index.reduce((sum, field) => sum + (field.words.some((w) => wordMatches(qw, w)) ? field.weight : 0), 0),
		);
	});
	const rarity = words.map((_, i) => {
		const found = perArticle.filter((scores) => scores[i] > 0).length;
		return found === 0 ? 0 : Math.log(1 + articles.length / found);
	});

	const scored = articles
		.map((article, a) => ({
			article,
			score: perArticle[a].reduce((sum, wordScore, i) => sum + wordScore * rarity[i], 0),
		}))
		.filter((s) => s.score > 0)
		.sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
		.map((s) => s.article);

	return limit === undefined ? scored : scored.slice(0, limit);
}
