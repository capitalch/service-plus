import { useMemo, useRef, useState, useEffect } from "react";
import { Pencil, Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

export type SearchableComboboxProps<T> = {
  className?:             string;
  getDisplayValue:        (item: T) => string;
  getFilterKey:           (item: T) => string;
  getIdentifier?:         (item: T) => string;
  isError?:               boolean;
  isLoading?:             boolean;
  items:                  T[];
  label:                  React.ReactNode;
  maxLength?:             number;
  onInputChange?:         (value: string) => void;
  onSelect:               (item: T | null) => void;
  placeholder:            string;
  renderItem:             (item: T) => React.ReactNode;
  renderSelectedDisplay?: (item: T) => React.ReactNode;
  selectedValue:          string;
  showOnFocus?:           boolean;
};

export function SearchableCombobox<T>({
  className,
  getDisplayValue,
  getFilterKey,
  getIdentifier,
  isError,
  isLoading,
  items,
  label,
  maxLength,
  onInputChange,
  onSelect,
  placeholder,
  renderItem,
  renderSelectedDisplay,
  selectedValue,
  showOnFocus = true,
}: SearchableComboboxProps<T>) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const anchorRef           = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);
  const scrollbarMouseDownRef = useRef(false);

  // Prevent Escape from closing parent dialogs when open
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc, { capture: true });
    return () => window.removeEventListener("keydown", handleEsc, { capture: true });
  }, [open]);

  // Sync display text when selectedValue changes from outside (e.g. auto-fill)
  useEffect(() => {
    if (selectedValue) {
      const found = items.find(i => {
        const idVal  = getIdentifier ? getIdentifier(i) : getFilterKey(i).split(" ")[0];
        const display = getDisplayValue(i).split(" ")[0];
        return idVal === selectedValue || display === selectedValue;
      });
      if (found) setSearch(getDisplayValue(found));
      else setSearch(selectedValue);
    } else {
      setSearch("");
    }
  }, [selectedValue, items, getDisplayValue, getFilterKey, getIdentifier]);

  const selectedItem = useMemo(() => {
    if (!selectedValue || !renderSelectedDisplay) return null;
    return items.find(i =>
      getIdentifier ? getIdentifier(i) === selectedValue : getFilterKey(i).split(" ")[0] === selectedValue
    ) ?? null;
  }, [selectedValue, items, renderSelectedDisplay, getIdentifier, getFilterKey]);

  // Show the two-line display when an item is selected and not actively searching
  const showDisplay = !!renderSelectedDisplay && !!selectedItem && !open;

  const filtered = useMemo(() => {
    if (onInputChange) return items;
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(item => getFilterKey(item).toLowerCase().includes(s));
  }, [items, search, getFilterKey, onInputChange]);

  function handleCloseAndReset() {
    setOpen(false);
    // Restore search to the confirmed selection if user typed without picking
    const found = items.find(i => getDisplayValue(i) === search);
    if (!found && selectedValue) {
      const original = items.find(i =>
        getIdentifier ? getIdentifier(i) === selectedValue : getFilterKey(i).split(" ")[0] === selectedValue
      );
      if (original) setSearch(getDisplayValue(original));
    }
  }

  function enterSearchMode() {
    setSearch("");
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label
        className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest"
        onClick={() => { if (open) setOpen(false); }}
      >
        {label}
      </Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div ref={anchorRef}>
            {/* ── Two-line selected display ── */}
            {showDisplay ? (
              <div
                className={[
                  "flex h-9 items-center gap-2 rounded-md px-3 bg-(--cl-surface-2)",
                  "border overflow-hidden",
                  isError ? "border-red-500" : "border-transparent",
                ].join(" ")}
              >
                <div className="flex-1 min-w-0 cursor-pointer" onClick={enterSearchMode}>
                  {renderSelectedDisplay(selectedItem!)}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={e => e.preventDefault()}
                    onClick={enterSearchMode}
                    className="rounded p-1 text-(--cl-text-muted) hover:bg-(--cl-accent)/10 hover:text-(--cl-accent) transition-colors"
                    title="Change"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setSearch(""); onSelect(null); }}
                    className="rounded p-1 text-(--cl-text-muted) hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Clear"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* ── Search input ── */
              <div className="relative group">
                <Input
                  className={`bg-(--cl-surface-2) pr-8 h-9 transition-all focus:ring-2 focus:ring-(--cl-accent)/20 ${
                    isError
                      ? "border-red-500 focus:border-red-500 ring-red-500/10"
                      : "border-transparent"
                  }`}
                  maxLength={maxLength}
                  onChange={e => {
                    setSearch(e.target.value);
                    setOpen(true);
                    if (!e.target.value) onSelect(null);
                    onInputChange?.(e.target.value);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Escape" && open) {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpen(false);
                    } else if (e.key === "Escape") {
                      inputRef.current?.blur();
                    }
                  }}
                  onClick={() => { if (showOnFocus) setOpen(prev => !prev); }}
                  onFocus={() => { if (showOnFocus) setOpen(true); }}
                  onBlur={() => {
                    if (scrollbarMouseDownRef.current) return;
                    setTimeout(handleCloseAndReset, 150);
                  }}
                  placeholder={placeholder}
                  ref={inputRef}
                  value={search}
                />

                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--cl-text-muted) opacity-50 group-hover:opacity-100 transition-opacity">
                  {search ? (
                    <X
                      className="h-4 w-4 cursor-pointer hover:text-red-500"
                      onClick={() => { setSearch(""); onSelect(null); }}
                    />
                  ) : (
                    <Plus className="h-3 w-3 rotate-45" />
                  )}
                </div>
              </div>
            )}
          </div>
        </PopoverAnchor>

        <PopoverContent
          className="p-1.5 max-h-[220px] overflow-y-auto rounded-xl shadow-2xl ring-1 ring-black/5"
          style={{ width: "var(--radix-popover-anchor-width)" }}
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
            if (anchorRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            } else {
              handleCloseAndReset();
            }
          }}
          onEscapeKeyDown={e => e.stopPropagation()}
        >
          {isLoading ? (
            <div className="px-3 py-4 text-center text-xs text-(--cl-text-muted)">
              Searching…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-(--cl-text-muted) italic text-pretty">
              No items found for "{search}"
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="px-2 py-1.5 mb-1 text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted) border-b border-(--cl-border)/50 flex justify-between items-center opacity-70">
                <span>Results</span>
                <span>{filtered.length} Found</span>
              </div>
              {filtered.map((item, idx) => (
                <button
                  className="flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm transition-all hover:bg-(--cl-accent)/10 hover:text-(--cl-accent) focus:bg-(--cl-accent)/10 focus:outline-none"
                  key={idx}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    onSelect(item);
                    setSearch(getDisplayValue(item));
                    setOpen(false);
                  }}
                  type="button"
                >
                  {renderItem(item)}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
