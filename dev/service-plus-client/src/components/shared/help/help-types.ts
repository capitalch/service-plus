// ─── Shared Help Panel types ───────────────────────────────────────────────────
// Used by both the Client Mode help center (features/client/components/help/help-content.ts)
// and the Super Admin developer help center (features/super-admin/components/help/dev-help-content.ts).

export type ContentBlock =
    | { type: "para";    text: string }
    | { type: "steps";   items: string[] }
    | { type: "bullets"; items: string[] }
    | { type: "table";   headers: string[]; rows: string[][] }
    | { type: "note";    text: string }
    | { type: "warning"; text: string }
    | { type: "heading"; text: string };

export type HelpFaq     = { q: string; a: string };
export type HelpArticle = {
    id:       string;
    category: string;
    title:    string;
    summary:  string;
    tags:     string[];
    content:  ContentBlock[];
    faqs:     HelpFaq[];
};

export type CategoryStyleType = {
    emoji:      string;
    gradient:   string;   // card gradient
    pill:       string;   // badge in search / breadcrumb
    pillText:   string;
    stepBg:     string;   // numbered step bubble
    stepText:   string;
    border:     string;
};
