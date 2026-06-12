import { useMemo, useRef, useState, useEffect } from "react";
import { Check, ChevronDown, Loader2, Pencil, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

export type SearchableComboboxProps<T> = {
  className?:             string;
  getDisplayValue:        (item: T) => string;
  getFilterKey:           (item: T) => string;
  getIdentifier?:         (item: T) => string;
  getItemDisabledReason?: (item: T) => string | null;
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
  getItemDisabledReason,
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
  const [open, setOpen]               = useState(false);
  const [search, setSearch]           = useState("");
  const [dropdownWidth, setDropdownWidth] = useState(0);

  const anchorRef             = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);
  const scrollbarMouseDownRef = useRef(false);
  const justFocusedRef        = useRef(false);

  const resolveId = (item: T) =>
    getIdentifier ? getIdentifier(item) : getFilterKey(item).split(" ")[0];

  const selectedItem = useMemo(() => {
    if (!selectedValue) return null;
    return items.find(i => resolveId(i) === selectedValue) ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue, items, getIdentifier, getFilterKey]);

  // Sync search text when value changes externally (e.g. form reset)
  useEffect(() => {
    if (selectedItem) setSearch(getDisplayValue(selectedItem));
    else if (!selectedValue) setSearch("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue, items]);

  // Measure anchor width when popover opens
  useEffect(() => {
    if (open && anchorRef.current) {
      setDropdownWidth(anchorRef.current.getBoundingClientRect().width);
    }
  }, [open]);

  const showDisplay = !!renderSelectedDisplay && !!selectedItem && !open;

  const filtered = useMemo(() => {
    if (onInputChange) return items;
    if (!search) return showOnFocus ? items : [];
    const s = search.toLowerCase();
    return items.filter(item => getFilterKey(item).toLowerCase().includes(s));
  }, [items, search, getFilterKey, onInputChange, showOnFocus]);

  function enterSearchMode() {
    setSearch("");
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleCloseAndReset() {
    setOpen(false);
    if (selectedItem) setSearch(getDisplayValue(selectedItem));
    else setSearch("");
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">
        {label}
      </Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="relative group">

            {showDisplay ? (
              /* ── Selected display panel ── */
              <div className={[
                "flex h-9 items-center gap-2 rounded-md border px-3",
                "bg-(--cl-surface-2) overflow-hidden",
                isError ? "border-red-500" : "border-transparent",
              ].join(" ")}>
                <div className="flex-1 min-w-0">
                  {renderSelectedDisplay!(selectedItem!)}
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={e => e.preventDefault()}
                  onClick={enterSearchMode}
                  className="shrink-0 text-(--cl-text-muted) hover:text-(--cl-accent) transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onSelect(null); setSearch(""); }}
                  className="shrink-0 text-(--cl-text-muted) hover:text-red-500 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              /* ── Search input ── */
              <>
                <Input
                  ref={inputRef}
                  className={[
                    "bg-(--cl-surface-2) pr-8 h-9 transition-all focus:ring-2 focus:ring-(--cl-accent)/20",
                    isError
                      ? "border-red-500 focus:border-red-500 ring-red-500/10"
                      : "border-transparent",
                  ].join(" ")}
                  maxLength={maxLength}
                  placeholder={placeholder}
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setOpen(true);
                    if (!e.target.value) onSelect(null);
                    onInputChange?.(e.target.value);
                  }}
                  onFocus={() => {
                    if (!showOnFocus) return;
                    justFocusedRef.current = true;
                    setOpen(true);
                  }}
                  onClick={() => {
                    if (!showOnFocus) return;
                    if (justFocusedRef.current) { justFocusedRef.current = false; return; }
                    setOpen(prev => !prev);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Escape" && open) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCloseAndReset();
                    }
                  }}
                  onBlur={() => {
                    if (scrollbarMouseDownRef.current) return;
                    setTimeout(() => handleCloseAndReset(), 150);
                  }}
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--cl-text-muted) opacity-60 group-hover:opacity-100 transition-opacity">
                  {search ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setSearch(""); onSelect(null); }}
                      className="cursor-pointer hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setOpen(prev => !prev)}
                      className="cursor-pointer"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </PopoverAnchor>

        <PopoverContent
          className="p-0 max-h-[220px] overflow-y-auto"
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
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-(--cl-text-muted)">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs italic text-(--cl-text-muted)">
              No results{search ? ` for "${search}"` : ""}
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-(--cl-border) bg-white/95 px-3 py-1 backdrop-blur-sm select-none">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-(--cl-text-muted)">Select</span>
                <span className="text-[10px] font-semibold text-(--cl-text-muted)">{filtered.length}</span>
              </div>
              {filtered.map((item, idx) => {
                const isSelected     = !!selectedValue && resolveId(item) === selectedValue;
                const disabledReason = getItemDisabledReason?.(item) ?? null;
                if (disabledReason) {
                  return (
                    <div
                      key={idx}
                      className="flex w-full flex-col px-3 py-1.5 text-left text-sm cursor-not-allowed opacity-60 bg-muted/20"
                    >
                      <div className="min-w-0 flex-1">{renderItem(item)}</div>
                      <span className="mt-0.5 text-[10px] font-semibold text-amber-600">{disabledReason}</span>
                    </div>
                  );
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    className={[
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors cursor-pointer",
                      isSelected
                        ? "bg-(--cl-accent)/10 text-(--cl-accent) font-medium"
                        : "hover:bg-blue-50/50",
                    ].join(" ")}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      onSelect(item);
                      setSearch(getDisplayValue(item));
                      setOpen(false);
                    }}
                  >
                    <div className="min-w-0 flex-1">{renderItem(item)}</div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-(--cl-accent)" />}
                  </button>
                );
              })}
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
