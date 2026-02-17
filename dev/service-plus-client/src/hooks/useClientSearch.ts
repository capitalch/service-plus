import { useState, useEffect } from 'react';
import { useLazySearchClientsQuery } from '@/store/api/authApi';
import { useDebounce } from './useDebounce';
import type { Client } from '@/store/api/authApi';

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
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [trigger, { data, isLoading, error }] = useLazySearchClientsQuery();

  useEffect(() => {
    // Only trigger search if user has typed at least 2 characters
    if (debouncedSearch.length >= 2) {
      trigger(debouncedSearch);
    }
  }, [debouncedSearch, trigger]);

  return {
    searchTerm,
    setSearchTerm,
    clients: (data?.clients || []) as Client[],
    isLoading,
    error,
    hasMinimumChars: searchTerm.length >= 2,
  };
};
