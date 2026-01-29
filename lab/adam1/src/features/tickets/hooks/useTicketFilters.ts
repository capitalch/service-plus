import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { setFilters, updateFilter, clearFilters } from "../ticket.slice";
import type { TicketFilter, TicketStatus, TicketPriority } from "../types";

export function useTicketFilters() {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.ticket.filters);

  const setAllFilters = useCallback(
    (newFilters: TicketFilter) => {
      dispatch(setFilters(newFilters));
    },
    [dispatch]
  );

  const setStatusFilter = useCallback(
    (status: TicketStatus[] | undefined) => {
      dispatch(updateFilter({ status }));
    },
    [dispatch]
  );

  const setPriorityFilter = useCallback(
    (priority: TicketPriority[] | undefined) => {
      dispatch(updateFilter({ priority }));
    },
    [dispatch]
  );

  const setClientFilter = useCallback(
    (clientId: string | undefined) => {
      dispatch(updateFilter({ clientId }));
    },
    [dispatch]
  );

  const setTechnicianFilter = useCallback(
    (technicianId: string | undefined) => {
      dispatch(updateFilter({ technicianId }));
    },
    [dispatch]
  );

  const setSearchFilter = useCallback(
    (search: string | undefined) => {
      dispatch(updateFilter({ search }));
    },
    [dispatch]
  );

  const resetFilters = useCallback(() => {
    dispatch(clearFilters());
  }, [dispatch]);

  const hasActiveFilters =
    (filters.status && filters.status.length > 0) ||
    (filters.priority && filters.priority.length > 0) ||
    !!filters.clientId ||
    !!filters.technicianId ||
    !!filters.search;

  return {
    filters,
    setAllFilters,
    setStatusFilter,
    setPriorityFilter,
    setClientFilter,
    setTechnicianFilter,
    setSearchFilter,
    resetFilters,
    hasActiveFilters,
  };
}
