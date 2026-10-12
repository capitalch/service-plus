// ─── Shared Help Panel types ───────────────────────────────────────────────────
// Used by both the Client Mode help center (features/client/components/help/help-content.ts)
// and the Super Admin developer help center (features/super-admin/components/help/dev-help-content.ts).

import type { ComponentType } from "react";

export type ContentBlock =
	| { type: "para"; text: string }
	| { type: "steps"; items: string[] }
	| { type: "bullets"; items: string[] }
	| { type: "table"; headers: string[]; rows: string[][] }
	| { type: "note"; text: string }
	| { type: "warning"; text: string }
	| { type: "heading"; text: string }
	| { type: "code"; language: string; text: string };

export type HelpFaq = { q: string; a: string };
export type HelpArticle = {
	id: string;
	category: string;
	title: string;
	summary: string;
	tags: string[];
	content: ContentBlock[];
	faqs: HelpFaq[];
};

export type CategoryStyleType = {
	emoji: string;
	// Optional real icon, preferred over `emoji` wherever the category glyph is
	// rendered — emoji glyph rendering depends on the OS/browser having a color
	// emoji font installed, which isn't guaranteed (bare Linux in particular);
	// an SVG icon always renders. `emoji` stays required as the universal
	// fallback for every category that doesn't need a branded icon.
	icon?: ComponentType<{ className?: string }>;
	gradient: string; // card gradient
	pill: string; // badge in search / breadcrumb
	pillText: string;
	stepBg: string; // numbered step bubble
	stepText: string;
	border: string;
};

// ─── Ask AI (client Help only; Super Admin passes no `ai` prop) ────────────────

export type AiHelpTurnType = {
	articleIds: string[];
	id: number;
	/** An error or limit message for the user, shown in amber; never sent back as history. */
	isNotice: boolean;
	role: "assistant" | "user";
	text: string;
};

export type AiHelpType = {
	ask: (question: string) => Promise<void>;
	clear: () => void;
	loading: boolean;
	turns: AiHelpTurnType[];
};
