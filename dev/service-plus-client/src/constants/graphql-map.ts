import { gql } from "@apollo/client";

export const GRAPHQL_MAP = {
    createAdminUser: gql`
        mutation CreateAdminUser(
            $db_name: String!
            $email: String!
            $full_name: String!
            $mobile: String
            $password: String!
            $username: String!
        ) {
            createAdminUser(
                db_name: $db_name
                email: $email
                full_name: $full_name
                mobile: $mobile
                password: $password
                username: $username
            )
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
};