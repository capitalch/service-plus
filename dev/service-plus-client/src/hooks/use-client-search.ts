import { useState, useEffect } from 'react';
import { searchClients } from '@/store/api/auth-api';
import { useDebounce } from './use-debounce';
import type { ClientType } from '@/store/api/auth-api';

/**
 * useClientSearch Hook
 * Encapsulates client search logic with debouncing and API integration
 * Automatically triggers search when user types 2+ characters
 *
 * Arrow function as per CLAUDE.md conventions
 *
 * @returns Object containing search state and functions
 */
export const useClientSearch = () => {
  const [criteria, setCriteria] = useState('');
  const [clients, setClients] = useState<ClientType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const debouncedSearch = useDebounce(criteria, 300);

  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setClients([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data:ClientType[] = await searchClients(debouncedSearch);
        if (!cancelled) setClients(data);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  return {
    criteria,
    setCriteria,
    clients,
    error,
    hasMinimumChars: criteria.length >= 2,
    isLoading,
  };
};
