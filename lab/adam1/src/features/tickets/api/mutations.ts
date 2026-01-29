import { gql } from "@apollo/client";

export const CREATE_TICKET = gql`
  mutation CreateTicket($input: CreateTicketInput!) {
    createTicket(input: $input) {
      id
      title
      description
      status
      priority
      clientId
      technicianId
      createdAt
      updatedAt
      dueDate
    }
  }
`;

export const UPDATE_TICKET = gql`
  mutation UpdateTicket($input: UpdateTicketInput!) {
    updateTicket(input: $input) {
      id
      title
      description
      status
      priority
      clientId
      technicianId
      createdAt
      updatedAt
      dueDate
    }
  }
`;

export const DELETE_TICKET = gql`
  mutation DeleteTicket($id: ID!) {
    deleteTicket(id: $id) {
      success
      message
    }
  }
`;

export const ASSIGN_TECHNICIAN = gql`
  mutation AssignTechnician($ticketId: ID!, $technicianId: ID!) {
    assignTechnician(ticketId: $ticketId, technicianId: $technicianId) {
      id
      technicianId
      technician {
        id
        name
      }
    }
  }
`;
