import { useState, useCallback, useRef, useEffect } from "react";
import { X, Search, ChevronRight, AlertTriangle, Info, ArrowLeft, Lightbulb, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    type HelpArticle,
    type ContentBlock,
    type HelpFaq,
    HELP_ARTICLES,
    HELP_CATEGORIES,
    searchArticles,
} from "./help-content";

// ─── Per-category colour palette ─────────────────────────────────────────────

type CategoryStyle = {
    emoji:      string;
    gradient:   string;   // card gradient
    pill:       string;   // badge in search / breadcrumb
    pillText:   string;
    stepBg:     string;   // numbered step bubble
    stepText:   string;
    border:     string;
};

const CAT_STYLE: Record<string, CategoryStyle> = {
    "Getting Started": {
        emoji:    "🚀",
        gradient: "from-violet-500 to-purple-600",
        pill:     "bg-violet-100 dark:bg-violet-900/40",
        pillText: "text-violet-700 dark:text-violet-300",
        stepBg:   "bg-violet-500",
        stepText: "text-white",
        border:   "border-violet-300 dark:border-violet-700",
    },
    "Jobs": {
        emoji:    "🔧",
        gradient: "from-blue-500 to-sky-600",
        pill:     "bg-blue-100 dark:bg-blue-900/40",
        pillText: "text-blue-700 dark:text-blue-300",
        stepBg:   "bg-blue-500",
        stepText: "text-white",
        border:   "border-blue-300 dark:border-blue-700",
    },
    "Inventory": {
        emoji:    "📦",
        gradient: "from-emerald-500 to-teal-600",
        pill:     "bg-emerald-100 dark:bg-emerald-900/40",
        pillText: "text-emerald-700 dark:text-emerald-300",
        stepBg:   "bg-emerald-500",
        stepText: "text-white",
        border:   "border-emerald-300 dark:border-emerald-700",
    },
    "Masters": {
        emoji:    "📋",
        gradient: "from-amber-500 to-yellow-500",
        pill:     "bg-amber-100 dark:bg-amber-900/40",
        pillText: "text-amber-700 dark:text-amber-300",
        stepBg:   "bg-amber-500",
        stepText: "text-white",
        border:   "border-amber-300 dark:border-amber-700",
    },
    "Configurations": {
        emoji:    "⚙️",
        gradient: "from-orange-500 to-amber-600",
        pill:     "bg-orange-100 dark:bg-orange-900/40",
        pillText: "text-orange-700 dark:text-orange-300",
        stepBg:   "bg-orange-500",
        stepText: "text-white",
        border:   "border-orange-300 dark:border-orange-700",
    },
    "Reports": {
        emoji:    "📊",
        gradient: "from-cyan-500 to-blue-500",
        pill:     "bg-cyan-100 dark:bg-cyan-900/40",
        pillText: "text-cyan-700 dark:text-cyan-300",
        stepBg:   "bg-cyan-500",
        stepText: "text-white",
        border:   "border-cyan-300 dark:border-cyan-700",
    },
    "GST & Invoicing": {
        emoji:    "🧾",
        gradient: "from-teal-500 to-cyan-600",
        pill:     "bg-teal-100 dark:bg-teal-900/40",
        pillText: "text-teal-700 dark:text-teal-300",
        stepBg:   "bg-teal-500",
        stepText: "text-white",
        border:   "border-teal-300 dark:border-teal-700",
    },
    "Admin & Users": {
        emoji:    "👤",
        gradient: "from-indigo-500 to-violet-600",
        pill:     "bg-indigo-100 dark:bg-indigo-900/40",
        pillText: "text-indigo-700 dark:text-indigo-300",
        stepBg:   "bg-indigo-500",
        stepText: "text-white",
        border:   "border-indigo-300 dark:border-indigo-700",
    },
    "Troubleshooting": {
        emoji:    "🆘",
        gradient: "from-fuchsia-500 to-purple-600",
        pill:     "bg-fuchsia-100 dark:bg-fuchsia-900/40",
        pillText: "text-fuchsia-700 dark:text-fuchsia-300",
        stepBg:   "bg-fuchsia-500",
        stepText: "text-white",
        border:   "border-fuchsia-300 dark:border-fuchsia-700",
    },
};

const DEFAULT_STYLE: CategoryStyle = {
    emoji:    "📄",
    gradient: "from-slate-500 to-slate-600",
    pill:     "bg-slate-100 dark:bg-slate-800",
    pillText: "text-slate-700 dark:text-slate-300",
    stepBg:   "bg-slate-500",
    stepText: "text-white",
    border:   "border-slate-300 dark:border-slate-700",
};

function catStyle(cat: string): CategoryStyle {
    return CAT_STYLE[cat] ?? DEFAULT_STYLE;
}

// ─── Category pill badge ──────────────────────────────────────────────────────

function CategoryPill({ category }: { category: string }) {
    const s = catStyle(category);
    return (
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide", s.pill, s.pillText)}>
            <span>{s.emoji}</span>
            {category}
        </span>
    );
}

// ─── Content block renderer ───────────────────────────────────────────────────

function RenderBlock({ block, category }: { block: ContentBlock; category: string }) {
    const s = catStyle(category);

    switch (block.type) {
        case "heading":
            return (
                <h3 className="mt-6 mb-2.5 flex items-center gap-2 text-[13px] font-bold text-(--cl-text) tracking-tight">
                    <span className={cn("h-0.5 w-3 rounded-full", s.stepBg)} />
                    {block.text}
                </h3>
            );

        case "para":
            return <p className="mb-3 text-[13px] leading-relaxed text-(--cl-text-muted)">{block.text}</p>;

        case "note":
            return (
                <div className="mb-3 flex gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-3 dark:border-blue-800/60 dark:bg-blue-950/30">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />
                    <p className="text-[12px] leading-relaxed text-blue-800 dark:text-blue-300">{block.text}</p>
                </div>
            );

        case "warning":
            return (
                <div className="mb-3 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
                    <p className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">{block.text}</p>
                </div>
            );

        case "steps":
            return (
                <ol className="mb-4 space-y-0">
                    {block.items.map((item, i) => (
                        <li key={i} className="flex gap-3">
                            {/* Left: number + connecting line */}
                            <div className="flex flex-col items-center">
                                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-sm", s.stepBg, s.stepText)}>
                                    {i + 1}
                                </span>
                                {i < block.items.length - 1 && (
                                    <span className={cn("mt-1 w-0.5 flex-1 min-h-[12px] rounded-full opacity-30", s.stepBg)} />
                                )}
                            </div>
                            <p className={cn("pb-4 pt-0.5 text-[13px] leading-relaxed text-(--cl-text-muted)", i === block.items.length - 1 && "pb-1")}>
                                {item}
                            </p>
                        </li>
                    ))}
                </ol>
            );

        case "bullets":
            return (
                <ul className="mb-3 space-y-2">
                    {block.items.map((item, i) => (
                        <li key={i} className="flex gap-2.5">
                            <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", s.stepBg)} />
                            <span className="text-[13px] leading-relaxed text-(--cl-text-muted)">{item}</span>
                        </li>
                    ))}
                </ul>
            );

        case "table":
            return (
                <div className="mb-4 overflow-x-auto rounded-xl border border-(--cl-border) shadow-sm">
                    <table className="w-full text-[12px]">
                        <thead>
                            <tr className={cn("border-b border-(--cl-border)")}>
                                {block.headers.map((h, i) => (
                                    <th key={i} className={cn("px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap", s.pillText, s.pill)}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, ri) => (
                                <tr key={ri} className={cn("border-b border-(--cl-border)/50 last:border-0 transition-colors hover:bg-(--cl-hover)", ri % 2 === 0 ? "bg-(--cl-bg)" : "bg-(--cl-surface)")}>
                                    {row.map((cell, ci) => (
                                        <td key={ci} className="px-3 py-2.5 text-(--cl-text-muted) align-top">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );

        default:
            return null;
    }
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

function FaqItem({ faq, category }: { faq: HelpFaq; category: string }) {
    const [open, setOpen] = useState(false);
    const s = catStyle(category);
    return (
        <div className="border-b border-(--cl-border)/70 last:border-0">
            <button
                onClick={() => setOpen(o => !o)}
                className="cursor-pointer flex w-full items-start gap-3 py-3.5 text-left hover:bg-(--cl-hover) px-1 rounded transition-colors"
            >
                <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition-transform", s.pill, s.pillText, open && "rotate-45")}>
                    +
                </span>
                <span className="text-[13px] font-medium text-(--cl-text) leading-snug">{faq.q}</span>
            </button>
            {open && (
                <div className={cn("mb-3 ml-8 rounded-lg border px-3 py-2.5", s.pill, s.border)}>
                    <p className={cn("text-[12px] leading-relaxed", s.pillText)}>{faq.a}</p>
                </div>
            )}
        </div>
    );
}

// ─── Article view ─────────────────────────────────────────────────────────────

function ArticleView({ article, onBack }: { article: HelpArticle; onBack: () => void }) {
    const s = catStyle(article.category);
    return (
        <div className="flex h-full flex-col">
            {/* Coloured article header */}
            <div className={cn("shrink-0 bg-gradient-to-br px-5 py-4", s.gradient)}>
                <h2 className="text-[16px] font-bold leading-snug text-white">{article.title}</h2>
                <p className="mt-1 text-[12px] text-white/80 leading-relaxed">{article.summary}</p>
            </div>

            {/* Article body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
                {article.content.map((block, i) => (
                    <RenderBlock key={i} block={block} category={article.category} />
                ))}

                {article.faqs.length > 0 && (
                    <div className="mt-6">
                        <div className="mb-3 flex items-center gap-2">
                            <Lightbulb className={cn("h-4 w-4", s.pillText)} />
                            <h3 className="text-[13px] font-bold text-(--cl-text)">Frequently Asked Questions</h3>
                        </div>
                        <div className="rounded-xl border border-(--cl-border) bg-(--cl-surface) px-3">
                            {article.faqs.map((faq, i) => (
                                <FaqItem key={i} faq={faq} category={article.category} />
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-8 mb-2 text-center">
                    <button
                        onClick={onBack}
                        className={cn("cursor-pointer inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors", s.pill, s.pillText, "hover:opacity-80")}
                    >
                        <ArrowLeft className="h-3 w-3" />
                        Back to {article.category}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Category article list ────────────────────────────────────────────────────

function CategoryView({ category, onSelectArticle }: {
    category: string;
    onSelectArticle: (a: HelpArticle) => void;
}) {
    const articles = HELP_ARTICLES.filter(a => a.category === category);
    const s = catStyle(category);
    return (
        <div className="flex h-full flex-col">
            {/* Category header */}
            <div className={cn("shrink-0 bg-gradient-to-br px-5 py-4", s.gradient)}>
                <div className="flex items-center gap-3">
                    <span className="text-3xl leading-none">{s.emoji}</span>
                    <div>
                        <h2 className="text-[16px] font-bold text-white">{category}</h2>
                        <p className="text-[12px] text-white/70">{articles.length} article{articles.length !== 1 ? "s" : ""}</p>
                    </div>
                </div>
            </div>

            {/* Article list */}
            <div className="flex-1 overflow-y-auto py-2">
                {articles.map((article, i) => (
                    <button
                        key={article.id}
                        onClick={() => onSelectArticle(article)}
                        className="cursor-pointer flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-(--cl-hover) transition-colors group"
                    >
                        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", s.pill, s.pillText)}>
                            {i + 1}
                        </span>
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-(--cl-text) group-hover:text-(--cl-accent) transition-colors">{article.title}</p>
                            <p className="mt-0.5 text-[11px] text-(--cl-text-muted) line-clamp-2 leading-relaxed">{article.summary}</p>
                        </div>
                        <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-(--cl-text-muted) opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Search results view ──────────────────────────────────────────────────────

const POPULAR_IDS = ["first-time-setup", "create-job", "finalize-job", "deliver-job", "customer-gstin", "gst-invoicing"];

function SearchResults({ query, results, onSelect }: {
    query:    string;
    results:  HelpArticle[];
    onSelect: (a: HelpArticle) => void;
}) {
    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--cl-surface)">
                    <Search className="h-7 w-7 text-(--cl-text-muted)/40" />
                </div>
                <p className="text-[14px] font-semibold text-(--cl-text)">No results for "{query}"</p>
                <p className="mt-1.5 text-[12px] text-(--cl-text-muted) leading-relaxed">
                    Try searching for a feature name, task, or error message.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {["job", "invoice", "GST", "delivery", "HSN"].map(s => (
                        <span key={s} className="rounded-full bg-(--cl-surface) px-3 py-1 text-[11px] font-medium text-(--cl-text-muted)">
                            {s}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-y-auto py-3">
            <p className="px-5 pb-2 text-[11px] font-bold uppercase tracking-wider text-(--cl-text-muted)/60">
                {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
            {results.map(a => {
                const s = catStyle(a.category);
                return (
                    <button
                        key={a.id}
                        onClick={() => onSelect(a)}
                        className="cursor-pointer flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-(--cl-hover) transition-colors group"
                    >
                        <span className="mt-1 text-xl leading-none">{s.emoji}</span>
                        <div className="min-w-0">
                            <CategoryPill category={a.category} />
                            <p className="mt-1 text-[13px] font-semibold text-(--cl-text) group-hover:text-(--cl-accent) transition-colors">{a.title}</p>
                            <p className="mt-0.5 text-[11px] text-(--cl-text-muted) line-clamp-2 leading-relaxed">{a.summary}</p>
                        </div>
                        <ChevronRight className="mt-3 h-3.5 w-3.5 shrink-0 text-(--cl-text-muted) opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                );
            })}
        </div>
    );
}

// ─── Home view ────────────────────────────────────────────────────────────────

function HomeView({ onSelectCategory, onSelectArticle }: {
    onSelectCategory: (cat: string) => void;
    onSelectArticle:  (a: HelpArticle) => void;
}) {
    const popular = POPULAR_IDS.map(id => HELP_ARTICLES.find(a => a.id === id)).filter(Boolean) as HelpArticle[];

    return (
        <div className="overflow-y-auto">
            {/* Category grid */}
            <div className="px-4 pt-4 pb-3">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-(--cl-text-muted)/70">Browse by topic</p>
                <div className="grid grid-cols-3 gap-2.5">
                    {HELP_CATEGORIES.map(cat => {
                        const s = catStyle(cat);
                        const count = HELP_ARTICLES.filter(a => a.category === cat).length;
                        return (
                            <button
                                key={cat}
                                onClick={() => onSelectCategory(cat)}
                                className="cursor-pointer group flex flex-col items-center gap-1.5 rounded-xl border border-(--cl-border) bg-(--cl-surface) p-3 text-center transition-all hover:scale-[1.03] hover:shadow-md hover:border-transparent hover:bg-gradient-to-br active:scale-100"
                                style={{ ["--tw-gradient-from" as string]: "transparent" }}
                            >
                                <span className={cn("flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-xl shadow-sm", s.gradient)}>
                                    {s.emoji}
                                </span>
                                <span className="text-[11px] font-semibold leading-tight text-(--cl-text)">{cat}</span>
                                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", s.pill, s.pillText)}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Popular articles */}
            {popular.length > 0 && (
                <div className="px-4 pb-4">
                    <div className="mb-3 flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5 text-(--cl-text-muted)" />
                        <p className="text-[11px] font-bold uppercase tracking-wider text-(--cl-text-muted)/70">Popular articles</p>
                    </div>
                    <div className="space-y-1.5">
                        {popular.map(article => {
                            const s = catStyle(article.category);
                            return (
                                <button
                                    key={article.id}
                                    onClick={() => onSelectArticle(article)}
                                    className="cursor-pointer flex w-full items-center gap-3 rounded-lg border border-(--cl-border) bg-(--cl-surface) px-3.5 py-3 text-left transition-all hover:border-(--cl-accent)/30 hover:bg-(--cl-hover) hover:shadow-sm group"
                                >
                                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-base shadow-sm", s.gradient)}>
                                        {s.emoji}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-semibold text-(--cl-text) group-hover:text-(--cl-accent) transition-colors truncate">{article.title}</p>
                                        <p className="text-[11px] text-(--cl-text-muted) truncate">{article.category}</p>
                                    </div>
                                    <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-(--cl-text-muted) opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Navigation state ─────────────────────────────────────────────────────────

type View =
    | { kind: "home" }
    | { kind: "category"; category: string }
    | { kind: "article";  article: HelpArticle }
    | { kind: "search";   query: string; results: HelpArticle[] };

// ─── Main panel ───────────────────────────────────────────────────────────────

type HelpPanelProps = {
    open:             boolean;
    onClose:          () => void;
    initialArticleId?: string;
};

export function HelpPanel({ open, onClose, initialArticleId }: HelpPanelProps) {
    const [query,    setQuery]    = useState("");
    const [view,     setView]     = useState<View>({ kind: "home" });
    const searchRef = useRef<HTMLInputElement>(null);

    // Reset on open
    useEffect(() => {
        if (!open) return;
        setTimeout(() => searchRef.current?.focus(), 120);
        if (initialArticleId) {
            const a = HELP_ARTICLES.find(x => x.id === initialArticleId);
            if (a) { setView({ kind: "article", article: a }); setQuery(""); return; }
        }
        setView({ kind: "home" });
        setQuery("");
    }, [open, initialArticleId]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onClose]);

    // Live search
    useEffect(() => {
        if (!open) return;
        const q = query.trim();
        if (q) {
            setView({ kind: "search", query: q, results: searchArticles(q) });
        } else if (view.kind === "search") {
            setView({ kind: "home" });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, open]);

    const handleSelectArticle = useCallback((a: HelpArticle) => {
        setQuery("");
        setView({ kind: "article", article: a });
    }, []);

    const handleSelectCategory = useCallback((cat: string) => {
        setView({ kind: "category", category: cat });
    }, []);

    const handleBack = useCallback(() => {
        setView(v => {
            if (v.kind === "article") {
                const cat = v.article.category;
                return { kind: "category", category: cat };
            }
            return { kind: "home" };
        });
    }, []);

    // Derive title for the header
    const headerTitle =
        view.kind === "home"     ? "Help Center"         :
        view.kind === "category" ? view.category          :
        view.kind === "article"  ? view.article.category  :
        "Search Results";

    const headerGradient =
        view.kind === "home"    ? null :
        view.kind === "search"  ? null :
        catStyle(view.kind === "category" ? view.category : view.article.category).gradient;

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

            {/* Drawer */}
            <div className="fixed right-0 top-0 z-[61] flex h-full w-full max-w-[520px] flex-col shadow-2xl animate-in slide-in-from-right duration-200">

                {/* ── Panel header ── */}
                <div className={cn(
                    "flex shrink-0 items-center gap-3 px-4 py-3",
                    headerGradient
                        ? `bg-gradient-to-r ${headerGradient}`
                        : "border-b border-(--cl-border) bg-(--cl-surface)"
                )}>
                    {view.kind !== "home" && (
                        <button
                            onClick={handleBack}
                            className={cn(
                                "cursor-pointer rounded-full p-1.5 transition-colors",
                                headerGradient ? "text-white/80 hover:bg-white/20 hover:text-white" : "text-(--cl-text-muted) hover:bg-(--cl-hover) hover:text-(--cl-text)"
                            )}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    )}

                    {view.kind === "home" && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-black text-white shadow-sm">
                            ?
                        </div>
                    )}

                    <span className={cn(
                        "flex-1 text-[14px] font-bold tracking-tight truncate",
                        headerGradient ? "text-white" : "text-(--cl-text)"
                    )}>
                        {headerTitle}
                    </span>

                    <button
                        onClick={onClose}
                        className={cn(
                            "cursor-pointer rounded-full p-1.5 transition-colors",
                            headerGradient ? "text-white/80 hover:bg-white/20 hover:text-white" : "text-(--cl-text-muted) hover:bg-(--cl-hover) hover:text-(--cl-text)"
                        )}
                        title="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* ── Search bar ── */}
                {(view.kind === "home" || view.kind === "search") && (
                    <div className="shrink-0 border-b border-(--cl-border) bg-(--cl-bg) px-4 py-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search articles, topics, questions…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="w-full rounded-full border border-(--cl-border) bg-(--cl-surface) py-2 pl-9 pr-8 text-[13px] text-(--cl-text) placeholder:text-(--cl-text-muted)/60 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 transition-all"
                            />
                            {query && (
                                <button
                                    onClick={() => setQuery("")}
                                    className="cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-(--cl-text-muted) hover:text-(--cl-text) hover:bg-(--cl-hover) transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Body ── */}
                <div className="flex-1 overflow-hidden bg-(--cl-bg)">
                    {view.kind === "home"     && <HomeView onSelectCategory={handleSelectCategory} onSelectArticle={handleSelectArticle} />}
                    {view.kind === "category" && <CategoryView category={view.category} onSelectArticle={handleSelectArticle} />}
                    {view.kind === "article"  && <ArticleView article={view.article} onBack={handleBack} />}
                    {view.kind === "search"   && <SearchResults query={view.query} results={view.results} onSelect={handleSelectArticle} />}
                </div>

                {/* ── Footer ── */}
                <div className="shrink-0 border-t border-(--cl-border) bg-(--cl-surface) px-5 py-2">
                    <p className="text-[10px] text-(--cl-text-muted)/50 text-center tracking-wide">
                        {HELP_ARTICLES.length} articles across {HELP_CATEGORIES.length} topics · Esc to close
                    </p>
                </div>
            </div>
        </>
    );
}
