export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  clientId: string;
  technicianId?: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
}

export type TicketStatus = "open" | "in_progress" | "pending" | "resolved" | "closed";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface CreateTicketInput {
  title: string;
  description: string;
  priority: TicketPriority;
  clientId: string;
  technicianId?: string;
  dueDate?: string;
}

export interface UpdateTicketInput {
  id: string;
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  technicianId?: string;
  dueDate?: string;
}

export interface TicketFilter {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  clientId?: string;
  technicianId?: string;
  search?: string;
}
