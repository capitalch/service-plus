import { motion } from "framer-motion";
import { useTicketFilters } from "../hooks/useTicketFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search, Filter } from "lucide-react";
import type { TicketStatus, TicketPriority } from "../types";

const statusOptions: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function TicketFilters() {
  const {
    filters,
    setStatusFilter,
    setPriorityFilter,
    setSearchFilter,
    resetFilters,
    hasActiveFilters,
  } = useTicketFilters();

  const toggleStatus = (status: TicketStatus) => {
    const currentStatuses = filters.status || [];
    if (currentStatuses.includes(status)) {
      setStatusFilter(currentStatuses.filter((s) => s !== status));
    } else {
      setStatusFilter([...currentStatuses, status]);
    }
  };

  const togglePriority = (priority: TicketPriority) => {
    const currentPriorities = filters.priority || [];
    if (currentPriorities.includes(priority)) {
      setPriorityFilter(currentPriorities.filter((p) => p !== priority));
    } else {
      setPriorityFilter([...currentPriorities, priority]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 p-4 border rounded-lg bg-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <h3 className="font-medium">Filters</h3>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tickets..."
          value={filters.search || ""}
          onChange={(e) => setSearchFilter(e.target.value || undefined)}
          className="pl-9"
        />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Status</p>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => {
            const isSelected = filters.status?.includes(option.value);
            return (
              <Badge
                key={option.value}
                variant={isSelected ? "default" : "outline"}
                className="cursor-pointer transition-colors"
                onClick={() => toggleStatus(option.value)}
              >
                {option.label}
              </Badge>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Priority</p>
        <div className="flex flex-wrap gap-2">
          {priorityOptions.map((option) => {
            const isSelected = filters.priority?.includes(option.value);
            return (
              <Badge
                key={option.value}
                variant={isSelected ? "default" : "outline"}
                className="cursor-pointer transition-colors"
                onClick={() => togglePriority(option.value)}
              >
                {option.label}
              </Badge>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
