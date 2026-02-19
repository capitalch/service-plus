import { useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useClientSearch } from '@/hooks/use-client-search';

type ClientComboboxProps = {
  error?: string;
  onValueChange: (value: string) => void;
  value: string;
};

export const ClientCombobox = ({ error, onValueChange, value }: ClientComboboxProps) => {
  const { clients, hasMinimumChars, isLoading, setCriteria } = useClientSearch();
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [prevValue, setPrevValue] = useState(value);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync inputValue when value is cleared externally (update during render, not in effect)
  if (prevValue !== value) {
    setPrevValue(value);
    if (!value) setInputValue('');
  }

  const closeDropdown = () => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(closeDropdown, 150);
  };

  const handleFocus = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setIsOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);
    setCriteria(text);
    if (!text) onValueChange('');
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      closeDropdown();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, clients.length - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'Enter' && highlightedIndex >= 0 && clients[highlightedIndex]) {
      e.preventDefault();
      selectClient(clients[highlightedIndex].id, clients[highlightedIndex].name);
    }
  };

  const selectClient = (id: string, name: string) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setInputValue(name);
    setCriteria(name);
    onValueChange(String(id));
    closeDropdown();
  };

  const showHint = isOpen && !hasMinimumChars && inputValue.length > 0;
  const showLoader = isOpen && hasMinimumChars && isLoading;
  const showEmpty = isOpen && hasMinimumChars && !isLoading && clients.length === 0;
  const showResults = isOpen && hasMinimumChars && clients.length > 0;
  const dropdownVisible = isOpen && (showHint || showLoader || showEmpty || showResults);

  return (
    <div className="relative space-y-1.5">
      {/* Input row */}
      <div className="relative">
        <Input
          aria-autocomplete="list"
          aria-expanded={dropdownVisible}
          aria-haspopup="listbox"
          autoComplete="off"
          className="pr-8 text-sm"
          onBlur={handleBlur}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Type to search clients..."
          role="combobox"
          value={inputValue}
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {dropdownVisible && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md"
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {showHint && (
              <p className="py-5 text-center text-xs text-slate-400">
                Type at least 2 characters to search
              </p>
            )}

            {showLoader && (
              <div className="flex items-center justify-center gap-2 py-5 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching…
              </div>
            )}

            {showEmpty && (
              <p className="py-5 text-center text-xs text-slate-400">No clients found</p>
            )}

            {showResults && (
              <ul ref={listRef} role="listbox">
                {clients.map((client, index) => (
                  <li
                    aria-selected={value === client.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
                      highlightedIndex === index
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                    key={client.id}
                    onMouseDown={() => selectClient(client.id, client.name)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    role="option"
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0 text-indigo-600',
                        value === client.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate font-medium">{client.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-red-500"
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: -4 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};
