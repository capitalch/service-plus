import { useMemo, useRef, useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
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
  items:            T[];
  label:            React.ReactNode;
  maxLength?:       number;
  onSelect:         (item: T | null) => void;
  placeholder:      string;
  renderItem:       (item: T) => React.ReactNode;
  selectedValue:    string;
};

export function SearchableCombobox<T>({
  className,
  getDisplayValue,
  getFilterKey,
  getIdentifier,
  isError,
  items,
  label,
  maxLength,
  onSelect,
  placeholder,
  renderItem,
  selectedValue,
}: SearchableComboboxProps<T>) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const containerRef        = useRef<HTMLDivElement>(null);

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
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(item => getFilterKey(item).toLowerCase().includes(s));
  }, [items, search, getFilterKey]);

  useClickOutside(containerRef, open, () => {
    setOpen(false);
    // Reset search to the previously selected value if user typed without selecting
    const found = items.find(i => getDisplayValue(i) === search);
    if (!found && selectedValue) {
      const original = items.find(i => getFilterKey(i).split(" ")[0] === selectedValue);
      if (original) setSearch(getDisplayValue(original));
    }
  });

  return (
    <div
      className={`space-y-2 relative ${className ?? ""} ${open ? "z-[110]" : "z-auto"}`}
      ref={containerRef}
    >
      <Label className="text-xs font-semibold text-[var(--cl-text-muted)] uppercase tracking-wider" onClick={() => { if (open) setOpen(false); }}>
        {label}
      </Label>

      <div className="relative group">
        <Input
          className={`bg-[var(--cl-surface-2)] pr-8 h-9 transition-all focus:ring-2 focus:ring-[var(--cl-accent)]/20 ${
            isError
              ? "border-red-500 focus:border-red-500 ring-red-500/10"
              : "border-transparent"
          }`}
          maxLength={maxLength}
          onChange={e => {
            setSearch(e.target.value);
            setOpen(true);
            if (!e.target.value) onSelect(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          value={search}
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--cl-text-muted)] opacity-50 group-hover:opacity-100 transition-opacity">
          {search ? (
            <X
              className="h-4 w-4 cursor-pointer hover:text-red-500"
              onClick={() => { setSearch(""); onSelect(null); }}
            />
          ) : (
            <Plus className="h-3 w-3 rotate-45" />
          )}
        </div>

        {open && (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute left-0 right-0 top-full z-[100] mt-1.5 max-h-[220px] overflow-y-auto rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface)] p-1.5 shadow-2xl backdrop-blur-md ring-1 ring-black/5"
            initial={{ opacity: 0, scale: 0.98, y: -4 }}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[var(--cl-text-muted)] italic text-pretty">
                No items found for "{search}"
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((item, idx) => (
                  <button
                    className="flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm transition-all hover:bg-[var(--cl-accent)]/10 hover:text-[var(--cl-accent)] focus:bg-[var(--cl-accent)]/10 focus:outline-none"
                    key={idx}
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
          </motion.div>
        )}
      </div>
    </div>
  );
}
