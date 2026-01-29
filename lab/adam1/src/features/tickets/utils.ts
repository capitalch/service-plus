import type { Ticket, TicketStatus, TicketPriority } from "./types";

export function getStatusLabel(status: TicketStatus): string {
  const labels: Record<TicketStatus, string> = {
    open: "Open",
    in_progress: "In Progress",
    pending: "Pending",
    resolved: "Resolved",
    closed: "Closed",
  };
  return labels[status];
}

export function getPriorityLabel(priority: TicketPriority): string {
  const labels: Record<TicketPriority, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };
  return labels[priority];
}

export function isTicketOverdue(ticket: Ticket): boolean {
  if (!ticket.dueDate) return false;
  const dueDate = new Date(ticket.dueDate);
  const now = new Date();
  return dueDate < now && ticket.status !== "closed" && ticket.status !== "resolved";
}

export function sortTicketsByPriority(tickets: Ticket[]): Ticket[] {
  const priorityOrder: Record<TicketPriority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return [...tickets].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}

export function filterTicketsByStatus(tickets: Ticket[], statuses: TicketStatus[]): Ticket[] {
  if (statuses.length === 0) return tickets;
  return tickets.filter((ticket) => statuses.includes(ticket.status));
}

export function getTicketStats(tickets: Ticket[]) {
  return {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    pending: tickets.filter((t) => t.status === "pending").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
    overdue: tickets.filter(isTicketOverdue).length,
    highPriority: tickets.filter(
      (t) => (t.priority === "high" || t.priority === "urgent") && t.status !== "closed"
    ).length,
  };
}
