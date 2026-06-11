import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

// ─── Avatar palette (same as CustomerSelect) ──────────────────────────────────

const AVATAR_COLORS = [
    "bg-blue-100 text-blue-700",
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
    "bg-orange-100 text-orange-700",
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocalComboboxProps<T extends { id: number }> = {
    disabled?:     boolean;
    getLabel:      (item: T) => string;
    getSubLabel?:  (item: T) => string | null;
    isError?:      boolean;
    items:         T[];
    placeholder?:  string;
    showOnEmpty?:  boolean;
    value:         number | null;
    onSelect:      (id: number | null) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LocalCombobox<T extends { id: number }>({
    disabled,
    getLabel,
    getSubLabel,
    isError,
    items,
    placeholder = "Select…",
    showOnEmpty = true,
    value,
    onSelect,
}: LocalComboboxProps<T>) {
    const [inputText, setInputText]         = useState("");
    const [open, setOpen]                   = useState(false);
    const [dropdownWidth, setDropdownWidth] = useState(0);
    const anchorRef                         = useRef<HTMLDivElement>(null);
    const scrollbarMouseDownRef             = useRef(false);

    const selectedItem = items.find(i => i.id === value) ?? null;

    // Sync display text when external value changes (e.g., form reset)
    useEffect(() => {
        setInputText(selectedItem ? getLabel(selectedItem) : "");
    }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    // Measure anchor width when popover opens so dropdown matches control width exactly
    useEffect(() => {
        if (open && anchorRef.current) {
            setDropdownWidth(anchorRef.current.getBoundingClientRect().width);
        }
    }, [open]);

    // Filter: show all when empty or when text matches selected label; filter otherwise
    const selectedLabel = selectedItem ? getLabel(selectedItem) : null;
    const isSearching   = inputText.trim() !== "" && inputText !== selectedLabel;
    const filtered      = isSearching
        ? items.filter(i => getLabel(i).toLowerCase().includes(inputText.toLowerCase()))
        : items;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div ref={anchorRef} className="relative">
                    <Input
                        className={[
                            "pr-14 transition-all",
                            isError  ? "border-red-400 focus:border-red-500" : "focus:border-(--cl-accent)",
                            selectedItem ? "font-medium" : "",
                        ].filter(Boolean).join(" ")}
                        disabled={disabled}
                        placeholder={placeholder}
                        value={inputText}
                        autoComplete="off"
                        onChange={e => {
                            const text = e.target.value;
                            setInputText(text);
                            if (text.trim()) setOpen(true);
                            else { setOpen(false); onSelect(null); }
                        }}
                        onFocus={() => { if (showOnEmpty || inputText.trim()) setOpen(true); }}
                        onClick={() => { if (showOnEmpty || inputText.trim()) setOpen(true); }}
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
                                // Restore to the confirmed selection (or empty if none)
                                const sel = items.find(i => i.id === value);
                                setInputText(sel ? getLabel(sel) : "");
                            }, 150);
                        }}
                    />

                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        {value != null && (
                            <button
                                type="button"
                                tabIndex={-1}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => { onSelect(null); setInputText(""); }}
                                className="rounded p-1 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                        <button
                            type="button"
                            tabIndex={-1}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => setOpen(prev => !prev)}
                            className="rounded p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        >
                            <ChevronDown
                                className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                            />
                        </button>
                    </div>
                </div>
            </PopoverAnchor>

            <PopoverContent
                className="p-0 max-h-60 overflow-y-auto"
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
                {/* Sticky header */}
                <div className="sticky top-0 z-10 flex items-center border-b border-(--cl-border) bg-white/95 px-3 py-1 backdrop-blur-sm select-none">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-(--cl-text-muted)">
                        {filtered.length} {filtered.length === 1 ? "item" : "items"}
                    </span>
                </div>

                {filtered.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-(--cl-text-muted)">No matches</div>
                ) : (
                    filtered.map(item => {
                        const label      = getLabel(item);
                        const subLabel   = getSubLabel?.(item) ?? null;
                        const isSelected = item.id === value;
                        const initial    = label.trim()[0]?.toUpperCase() ?? "?";
                        const colorIdx   = initial.charCodeAt(0) % AVATAR_COLORS.length;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                className={[
                                    "flex w-full items-center gap-2.5 px-3 py-1",
                                    "text-left transition-colors cursor-pointer",
                                    isSelected ? "bg-blue-50/80" : "hover:bg-blue-50/50",
                                ].join(" ")}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    setInputText(label);
                                    onSelect(item.id);
                                    setOpen(false);
                                }}
                            >
                                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${AVATAR_COLORS[colorIdx]}`}>
                                    {initial}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`truncate text-sm ${isSelected ? "font-semibold text-blue-700" : "font-medium text-(--cl-text)"}`}>
                                            {label}
                                        </span>
                                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                                    </div>
                                    {subLabel && (
                                        <span className="font-mono text-xs text-(--cl-text-muted)">{subLabel}</span>
                                    )}
                                </div>
                            </button>
                        );
                    })
                )}
            </PopoverContent>
        </Popover>
    );
}
