import { gql } from "@apollo/client";

export const GET_TICKETS = gql`
  query GetTickets($filter: TicketFilterInput, $pagination: PaginationInput) {
    tickets(filter: $filter, pagination: $pagination) {
      items {
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
        client {
          id
          name
        }
        technician {
          id
          name
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

export const GET_TICKET = gql`
  query GetTicket($id: ID!) {
    ticket(id: $id) {
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
      client {
        id
        name
        email
        phone
      }
      technician {
        id
        name
        email
      }
      comments {
        id
        content
        createdAt
        author {
          id
          name
        }
      }
    }
  }
`;
