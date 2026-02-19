import { Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useClientSearch } from '@/hooks/use-client-search';

type ClientComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
};

export const ClientCombobox = ({ value, onValueChange, error }: ClientComboboxProps) => {
  const { criteria, setCriteria, clients, hasMinimumChars, isLoading } = useClientSearch();

  const selectedClient = clients.find((client) => client.id === value);

  return (
    <div className="space-y-1.5">
      <Command className="rounded-lg border border-slate-200 shadow-none">
        <div className="flex items-center gap-2 px-3">
          <CommandInput
            placeholder="Type to search clients..."
            value={criteria}
            onValueChange={setCriteria}
            className="h-10 text-sm"
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
        </div>

        <AnimatePresence>
          {(hasMinimumChars || (!hasMinimumChars && criteria.length === 0)) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <CommandList>
                {!hasMinimumChars && (
                  <CommandEmpty className="py-5 text-center text-xs text-slate-400">
                    Type at least 2 characters to search
                  </CommandEmpty>
                )}

                {hasMinimumChars && !isLoading && clients.length === 0 && (
                  <CommandEmpty className="py-5 text-center text-xs text-slate-400">
                    No clients found
                  </CommandEmpty>
                )}

                {hasMinimumChars && clients.length > 0 && (
                  <CommandGroup>
                    {clients.map((client) => (
                      <CommandItem
                        key={client.id}
                        value={client.id}
                        onSelect={() => onValueChange(client.id)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4 shrink-0 text-indigo-600',
                            value === client.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <span className="truncate text-sm font-medium text-slate-900">
                          {client.name}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </motion.div>
          )}
        </AnimatePresence>
      </Command>

      {/* Selected client badge */}
      {selectedClient && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-slate-500"
        >
          Selected:{' '}
          <span className="font-medium text-slate-700">{selectedClient.name}</span>
        </motion.p>
      )}

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-500"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
};
