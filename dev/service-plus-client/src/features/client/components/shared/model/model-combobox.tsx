import { useEffect, useRef, useState } from "react";
import { Layers, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import type { ModelRow } from "@/features/client/types/job";

// ─── Avatar palette ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
    "bg-blue-100 text-blue-700",
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-lime-100 text-lime-700",
    "bg-cyan-100 text-cyan-700",
    "bg-orange-100 text-orange-700",
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModelComboboxProps = {
    disabled?:  boolean;
    isError?:   boolean;
    models:     ModelRow[];
    value:      number | null;
    onSelect:   (model: ModelRow | null) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ModelCombobox({ disabled, isError, models, value, onSelect }: ModelComboboxProps) {
    const [inputText, setInputText]       = useState("");
    const [open, setOpen]                 = useState(false);
    const [dropdownWidth, setDropdownWidth] = useState(0);
    const anchorRef                       = useRef<HTMLDivElement>(null);
    const scrollbarMouseDownRef           = useRef(false);

    const selectedModel = models.find(m => m.id === value) ?? null;

    // Sync input when external value changes (form reset / load from server)
    useEffect(() => {
        setInputText(selectedModel?.model_name ?? "");
    }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    // Measure anchor width when popover opens so dropdown matches control width exactly
    useEffect(() => {
        if (open && inputText.trim().length > 0 && anchorRef.current) {
            setDropdownWidth(anchorRef.current.getBoundingClientRect().width);
        }
    }, [open, inputText]);

    const q        = inputText.trim().toLowerCase();
    const filtered = q
        ? models.filter(m =>
            m.model_name.toLowerCase().includes(q)   ||
            m.brand_name.toLowerCase().includes(q)   ||
            m.product_name.toLowerCase().includes(q)
          )
        : [];

    const popoverOpen = open && inputText.trim().length > 0;

    return (
        <Popover open={popoverOpen} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div ref={anchorRef} className="relative">
                    <Input
                        autoComplete="off"
                        className={[
                            "bg-(--cl-surface-2) pr-8 h-9 transition-all",
                            "focus:ring-2 focus:ring-(--cl-accent)/20",
                            isError
                                ? "border-red-500 focus:border-red-500 ring-red-500/10"
                                : selectedModel
                                    ? "border-(--cl-accent)/30 bg-(--cl-accent)/5 font-medium"
                                    : "border-transparent",
                        ].join(" ")}
                        disabled={disabled}
                        placeholder="Search by brand, product or model…"
                        value={inputText}
                        onChange={e => {
                            const text = e.target.value;
                            setInputText(text);
                            if (text.trim()) {
                                setOpen(true);
                            } else {
                                setOpen(false);
                                onSelect(null);
                            }
                        }}
                        onFocus={() => {
                            if (inputText.trim()) setOpen(true);
                        }}
                        onKeyDown={e => {
                            if (e.key === "Escape" && open) {
                                setOpen(false);
                                e.stopPropagation();
                            }
                        }}
                        onBlur={() => {
                            if (scrollbarMouseDownRef.current) return;
                            setTimeout(() => {
                                setOpen(false);
                                // Restore to selected model name, or clear if nothing selected
                                setInputText(selectedModel?.model_name ?? "");
                            }, 150);
                        }}
                    />

                    {(inputText || value) && !disabled && (
                        <button
                            type="button"
                            tabIndex={-1}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { onSelect(null); setInputText(""); setOpen(false); }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--cl-text-muted) hover:text-red-500 transition-colors cursor-pointer"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </PopoverAnchor>

            {/* Brand + product sub-label (mirrors CustomerSelect phone display) */}
            {selectedModel && (
                <div className="flex items-center gap-1.5 px-1 py-0.5 text-xs text-(--cl-text-muted)">
                    <Layers className="h-3 w-3 shrink-0" />
                    <span className="font-medium text-(--cl-accent)">{selectedModel.brand_name}</span>
                    <span className="opacity-40">·</span>
                    <span className="truncate">{selectedModel.product_name}</span>
                </div>
            )}

            <PopoverContent
                className="p-0 max-h-72 overflow-y-auto"
                style={{ width: dropdownWidth > 0 ? `${dropdownWidth}px` : "var(--radix-popover-anchor-width)" }}
                onOpenAutoFocus={e => e.preventDefault()}
                onMouseDown={e => {
                    const el = e.currentTarget as HTMLElement;
                    const isScrollbar = e.clientX > el.getBoundingClientRect().left + el.clientWidth;
                    if (isScrollbar) {
                        scrollbarMouseDownRef.current = true;
                        document.addEventListener("mouseup", () => { scrollbarMouseDownRef.current = false; }, { once: true });
                    } else {
                        e.preventDefault();
                    }
                }}
                onInteractOutside={e => {
                    if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
                }}
                onEscapeKeyDown={e => e.stopPropagation()}
            >
                {/* Count header */}
                <div className="sticky top-0 z-10 flex items-center border-b border-(--cl-border) bg-white/95 px-3 py-1 backdrop-blur-sm select-none">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-(--cl-text-muted)">
                        {filtered.length === 0
                            ? "No matches"
                            : `${filtered.length} model${filtered.length !== 1 ? "s" : ""} found`}
                    </span>
                </div>

                {filtered.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm italic text-(--cl-text-muted)">
                        No models match "{inputText.trim()}"
                    </div>
                ) : (
                    filtered.map(m => {
                        const initial    = m.brand_name.trim()[0]?.toUpperCase() ?? "?";
                        const colorIdx   = initial.charCodeAt(0) % AVATAR_COLORS.length;
                        const isSelected = m.id === value;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                className={[
                                    "flex w-full items-center gap-2.5",
                                    "px-3 py-1 text-left transition-colors cursor-pointer",
                                    isSelected ? "bg-blue-50/80" : "hover:bg-blue-50/50",
                                ].join(" ")}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    setInputText(m.model_name);
                                    onSelect(m);
                                    setOpen(false);
                                }}
                            >
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_COLORS[colorIdx]}`}>
                                    {initial}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className={`truncate text-sm ${isSelected ? "font-semibold text-blue-700" : "font-medium text-(--cl-text)"}`}>
                                            {m.model_name}
                                        </span>
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-(--cl-text-muted)">
                                        <span className="font-medium">{m.brand_name}</span>
                                        <span className="opacity-40">·</span>
                                        <span className="truncate">{m.product_name}</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </PopoverContent>
        </Popover>
    );
}
