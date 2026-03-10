import { gql } from "@apollo/client";

export const GRAPHQL_MAP = {
    deleteClient: gql`
        mutation DeleteClient($client_id: Int!) {
            deleteClient(client_id: $client_id)
        }
    `,
    createAdminUser: gql`
        mutation CreateAdminUser(
            $db_name: String!
            $email: String!
            $full_name: String!
            $mobile: String
        ) {
            createAdminUser(
                db_name: $db_name
                email: $email
                full_name: $full_name
                mobile: $mobile
            )
        }
    `,
    dropDatabase: gql`
        mutation DropDatabase($db_name: String!) {
            dropDatabase(db_name: $db_name)
        }
    `,
    createServiceDb: gql`
        mutation CreateServiceDb($client_id: Int!, $db_name: String!) {
            createServiceDb(client_id: $client_id, db_name: $db_name)
        }
    `,
    genericQuery: gql`
        query GenericQuery($db_name: String!, $schema: String, $value: String!) {
            genericQuery(db_name: $db_name, schema: $schema, value: $value)
        }
    `,
    genericUpdate: gql`
        mutation GenericUpdate($db_name: String!, $schema: String, $value: String!) {
            genericUpdate(db_name: $db_name, schema: $schema, value: $value)
        }
    `,
    setAdminUserActive: gql`
        mutation SetAdminUserActive($db_name: String!, $id: Int!, $is_active: Boolean!) {
            setAdminUserActive(db_name: $db_name, id: $id, is_active: $is_active)
        }
    `,
    superAdminClientsData: gql`
        query SuperAdminClientsData {
            superAdminClientsData
        }
    `,
    superAdminDashboardStats: gql`
        query SuperAdminDashboardStats {
            superAdminDashboardStats
        }
    `,
    updateAdminUser: gql`
        mutation UpdateAdminUser(
            $db_name: String!
            $email: String!
            $full_name: String!
            $id: Int!
            $mobile: String
        ) {
            updateAdminUser(
                db_name: $db_name
                email: $email
                full_name: $full_name
                id: $id
                mobile: $mobile
            )
        }
    `,
};