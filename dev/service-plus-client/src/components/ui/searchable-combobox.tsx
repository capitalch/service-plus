import { useMemo, useRef, useState, useEffect } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClickOutside } from "@/hooks/use-click-outside";

export type SearchableComboboxProps<T> = {
  className?:       string;
  getDisplayValue:  (item: T) => string;
  getFilterKey:     (item: T) => string;
  getIdentifier?:   (item: T) => string;
  isError?:         boolean;
  isLoading?:       boolean;
  items:            T[];
  label:            React.ReactNode;
  maxLength?:       number;
  onInputChange?:   (value: string) => void;
  onSelect:         (item: T | null) => void;
  placeholder:      string;
  renderItem:       (item: T) => React.ReactNode;
  selectedValue:    string;
  showOnFocus?:     boolean;
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
  selectedValue,
  showOnFocus = true,
}: SearchableComboboxProps<T>) {
  const [open, setOpen]         = useState(false);
  const [search, setSearch]     = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const containerRef            = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);
  const justFocusedRef          = useRef(false);

  const selectedItem = useMemo(() => {
    if (!selectedValue) return null;
    return items.find(i => {
      const id = getIdentifier ? getIdentifier(i) : getFilterKey(i).split(" ")[0];
      return id === selectedValue;
    }) ?? null;
  }, [selectedValue, items, getIdentifier, getFilterKey]);

  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If we have less than 250px below and more space above, flip to top
      if (spaceBelow < 250 && spaceAbove > spaceBelow) {
        setPlacement("top");
      } else {
        setPlacement("bottom");
      }
    }
  }, [open]);

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

  const filtered = useMemo(() => {
    if (onInputChange) return items;
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(item => getFilterKey(item).toLowerCase().includes(s));
  }, [items, search, getFilterKey, onInputChange]);

  useClickOutside(containerRef, open, () => {
    setOpen(false);
    if (selectedItem) {
      setIsEditing(false);
    } else {
      // Reset search to the previously selected value if user typed without selecting
      const found = items.find(i => getDisplayValue(i) === search);
      if (!found && selectedValue) {
        const original = items.find(i => getFilterKey(i).split(" ")[0] === selectedValue);
        if (original) setSearch(getDisplayValue(original));
      }
    }
  });

  return (
    <div
      className={`space-y-2 relative ${className ?? ""} ${open ? "z-[110]" : "z-auto"}`}
      ref={containerRef}
    >
      <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest" onClick={() => { if (open) setOpen(false); }}>
        {label}
      </Label>

      <div className="relative group">
        {selectedItem && !isEditing ? (
          <div
            className={`relative flex items-center min-h-9 w-full rounded-md border px-3 py-2 text-sm cursor-pointer bg-(--cl-surface-2) pr-8 ${
              isError ? "border-red-500" : "border-transparent"
            }`}
            onClick={() => {
              setIsEditing(true);
              setSearch("");
              setOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            <div className="flex-1">
              {renderItem(selectedItem)}
            </div>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--cl-text-muted) opacity-50 group-hover:opacity-100 transition-opacity">
              <X
                className="h-4 w-4 cursor-pointer hover:text-red-500"
                onClick={e => { e.stopPropagation(); setSearch(""); onSelect(null); setIsEditing(false); }}
              />
            </div>
          </div>
        ) : (
          <>
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
              onClick={() => {
                if (!showOnFocus) return;
                if (justFocusedRef.current) { justFocusedRef.current = false; return; }
                setOpen(prev => !prev);
              }}
              onFocus={() => {
                if (!showOnFocus) return;
                justFocusedRef.current = true;
                setOpen(true);
              }}
              placeholder={placeholder}
              ref={inputRef}
              value={search}
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--cl-text-muted) opacity-60 group-hover:opacity-100 transition-opacity">
              {search ? (
                <X
                  className="h-4 w-4 cursor-pointer hover:text-red-500"
                  onClick={() => { setSearch(""); onSelect(null); setIsEditing(false); }}
                />
              ) : open ? (
                <ChevronUp
                  className="h-4 w-4 cursor-pointer"
                  onClick={() => setOpen(false)}
                />
              ) : (
                <ChevronDown
                  className="h-4 w-4 cursor-pointer"
                  onClick={() => setOpen(true)}
                />
              )}
            </div>
          </>
        )}

        {open && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={`absolute left-0 right-0 z-[100] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg ${
              placement === "bottom" ? "top-full mt-1" : "bottom-full mb-1"
            }`}
            initial={{ opacity: 0, y: placement === "bottom" ? -4 : 4 }}
            transition={{ duration: 0.1 }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-3 text-center text-xs italic text-slate-400">
                No results{search ? ` for "${search}"` : ""}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Select</span>
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{filtered.length}</span>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {filtered.map((item, idx) => {
                    const isSelected = selectedValue
                      ? (getIdentifier ? getIdentifier(item) : getFilterKey(item).split(" ")[0]) === selectedValue
                      : false;
                    return (
                      <button
                        className={`flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-slate-50 focus:outline-none ${
                          isSelected
                            ? "border-l-(--cl-accent) bg-(--cl-accent)/5 font-medium text-(--cl-accent)"
                            : "border-l-transparent text-slate-700 hover:border-l-(--cl-accent) hover:text-slate-900"
                        }`}
                        key={idx}
                        onClick={() => {
                          onSelect(item);
                          setSearch(getDisplayValue(item));
                          setOpen(false);
                          setIsEditing(false);
                        }}
                        type="button"
                      >
                        <div className="min-w-0 flex-1">{renderItem(item)}</div>
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-(--cl-accent)" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
