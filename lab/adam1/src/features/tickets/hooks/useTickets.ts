import { useQuery, useMutation, useSubscription } from "@apollo/client/react";
import { toast } from "sonner";
import { GET_TICKETS, GET_TICKET } from "../api/queries";
import { CREATE_TICKET, UPDATE_TICKET, DELETE_TICKET } from "../api/mutations";
import { TICKET_CREATED, TICKET_UPDATED } from "../api/subscriptions";
import type { Ticket, TicketFilter, CreateTicketInput, UpdateTicketInput } from "../types";

interface TicketsQueryResult {
  tickets: {
    items: Ticket[];
    totalCount: number;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}

interface TicketQueryResult {
  ticket: Ticket;
}

export function useTickets(filter?: TicketFilter, pagination?: { page: number; pageSize: number }) {
  const { data, loading, error, refetch } = useQuery<TicketsQueryResult>(GET_TICKETS, {
    variables: {
      filter,
      pagination: pagination
        ? { offset: (pagination.page - 1) * pagination.pageSize, limit: pagination.pageSize }
        : undefined,
    },
    fetchPolicy: "cache-and-network",
  });

  // Subscribe to new tickets
  useSubscription(TICKET_CREATED, {
    onData: (options) => {
      const ticketData = options.data.data as { ticketCreated?: unknown } | undefined;
      if (ticketData?.ticketCreated) {
        toast.info("New ticket created");
        refetch();
      }
    },
  });

  // Subscribe to ticket updates
  useSubscription(TICKET_UPDATED, {
    onData: (options) => {
      const ticketData = options.data.data as { ticketUpdated?: unknown } | undefined;
      if (ticketData?.ticketUpdated) {
        toast.info("Ticket updated");
      }
    },
  });

  return {
    tickets: data?.tickets.items ?? [],
    totalCount: data?.tickets.totalCount ?? 0,
    pageInfo: data?.tickets.pageInfo,
    loading,
    error,
    refetch,
  };
}

export function useTicket(id: string) {
  const { data, loading, error, refetch } = useQuery<TicketQueryResult>(GET_TICKET, {
    variables: { id },
    skip: !id,
  });

  return {
    ticket: data?.ticket,
    loading,
    error,
    refetch,
  };
}

interface CreateTicketResult {
  createTicket: Ticket;
}

export function useCreateTicket() {
  const [createTicket, { loading, error }] = useMutation<CreateTicketResult>(CREATE_TICKET, {
    refetchQueries: [{ query: GET_TICKETS }],
    onCompleted: () => {
      toast.success("Ticket created successfully");
    },
    onError: (err: Error) => {
      toast.error(`Failed to create ticket: ${err.message}`);
    },
  });

  const create = async (input: CreateTicketInput) => {
    const result = await createTicket({ variables: { input } });
    return result.data?.createTicket;
  };

  return { create, loading, error };
}

interface UpdateTicketResult {
  updateTicket: Ticket;
}

export function useUpdateTicket() {
  const [updateTicket, { loading, error }] = useMutation<UpdateTicketResult>(UPDATE_TICKET, {
    onCompleted: () => {
      toast.success("Ticket updated successfully");
    },
    onError: (err: Error) => {
      toast.error(`Failed to update ticket: ${err.message}`);
    },
  });

  const update = async (input: UpdateTicketInput) => {
    const result = await updateTicket({ variables: { input } });
    return result.data?.updateTicket;
  };

  return { update, loading, error };
}

interface DeleteTicketResult {
  deleteTicket: { success: boolean; message: string };
}

export function useDeleteTicket() {
  const [deleteTicket, { loading, error }] = useMutation<DeleteTicketResult>(DELETE_TICKET, {
    refetchQueries: [{ query: GET_TICKETS }],
    onCompleted: () => {
      toast.success("Ticket deleted successfully");
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete ticket: ${err.message}`);
    },
  });

  const remove = async (id: string) => {
    const result = await deleteTicket({ variables: { id } });
    return result.data?.deleteTicket;
  };

  return { remove, loading, error };
}
