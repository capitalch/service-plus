import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useClientSearch } from '@/hooks/useClientSearch';
import { MESSAGES } from '@/constants/messages';

/**
 * ClientCombobox Props
 */
interface ClientComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
}

/**
 * ClientCombobox Component
 * Type-ahead dropdown for client selection with debounced API search
 * Arrow function as per CLAUDE.md conventions
 *
 * Features:
 * - Debounced search (300ms delay)
 * - Minimum 2 characters to trigger search
 * - Loading state with spinner
 * - Error handling with red text
 * - Framer Motion animations
 * - shadcn Command component for search UI
 */
export const ClientCombobox = ({ value, onValueChange, error }: ClientComboboxProps) => {
  const [open, setOpen] = useState(false);
  const { searchTerm, setSearchTerm, clients, isLoading, hasMinimumChars } = useClientSearch();

  // Find selected client for display
  const selectedClient = clients.find((client) => client.id === value);

  return (
    <div className="space-y-2">
      <Command className="rounded-lg border shadow-md">
        <div className="flex items-center gap-2 px-3">
          <CommandInput
            placeholder={MESSAGES.CLIENT_SEARCH_PLACEHOLDER}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="h-11"
          />
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CommandList>
              {!hasMinimumChars && (
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  {MESSAGES.CLIENTS_MIN_CHARS}
                </CommandEmpty>
              )}

              {hasMinimumChars && !isLoading && clients.length === 0 && (
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  {MESSAGES.CLIENTS_NO_RESULTS}
                </CommandEmpty>
              )}

              {hasMinimumChars && clients.length > 0 && (
                <CommandGroup>
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={client.id}
                      onSelect={() => {
                        onValueChange(client.id);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === client.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{client.name}</span>
                        {client.code && (
                          <span className="text-xs text-muted-foreground">{client.code}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </motion.div>
        </AnimatePresence>
      </Command>

      {/* Selected Client Display */}
      {selectedClient && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-muted-foreground"
        >
          Selected: <span className="font-medium text-foreground">{selectedClient.name}</span>
        </motion.div>
      )}

      {/* Error Message - Red color only for errors */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-destructive"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
};
