import { gql } from "@apollo/client";

export const TICKET_CREATED = gql`
  subscription OnTicketCreated {
    ticketCreated {
      id
      title
      description
      status
      priority
      clientId
      technicianId
      createdAt
      client {
        id
        name
      }
    }
  }
`;

export const TICKET_UPDATED = gql`
  subscription OnTicketUpdated($ticketId: ID) {
    ticketUpdated(ticketId: $ticketId) {
      id
      title
      description
      status
      priority
      technicianId
      updatedAt
    }
  }
`;

export const TICKET_STATUS_CHANGED = gql`
  subscription OnTicketStatusChanged {
    ticketStatusChanged {
      id
      status
      updatedAt
    }
  }
`;
