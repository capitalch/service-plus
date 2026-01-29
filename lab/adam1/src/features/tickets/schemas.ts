import { z } from "zod";

export const ticketStatusSchema = z.enum([
  "open",
  "in_progress",
  "pending",
  "resolved",
  "closed",
]);

export const ticketPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const createTicketSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be less than 2000 characters"),
  priority: ticketPrioritySchema,
  clientId: z.string().min(1, "Client is required"),
  technicianId: z.string().optional(),
  dueDate: z.string().optional(),
});

export const updateTicketSchema = z.object({
  id: z.string(),
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters")
    .optional(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  technicianId: z.string().optional(),
  dueDate: z.string().optional(),
});

export const ticketFilterSchema = z.object({
  status: z.array(ticketStatusSchema).optional(),
  priority: z.array(ticketPrioritySchema).optional(),
  clientId: z.string().optional(),
  technicianId: z.string().optional(),
  search: z.string().optional(),
});

export type CreateTicketFormData = z.infer<typeof createTicketSchema>;
export type UpdateTicketFormData = z.infer<typeof updateTicketSchema>;
export type TicketFilterFormData = z.infer<typeof ticketFilterSchema>;
