import { gql } from "@apollo/client";

export const GRAPHQL_MAP = {
    auditLogs: gql`
        query AuditLogs(
            $action:    String
            $actor:     String
            $from_date: String
            $outcome:   String
            $page:      Int
            $page_size: Int
            $search:    String
            $to_date:   String
        ) {
            auditLogs(
                action:    $action
                actor:     $actor
                from_date: $from_date
                outcome:   $outcome
                page:      $page
                page_size: $page_size
                search:    $search
                to_date:   $to_date
            )
        }
    `,
    auditLogStats: gql`
        query AuditLogStats($from_date: String, $to_date: String) {
            auditLogStats(from_date: $from_date, to_date: $to_date)
        }
    `,
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
            $username: String!
        ) {
            createAdminUser(
                db_name: $db_name
                email: $email
                full_name: $full_name
                mobile: $mobile
                username: $username
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
    mailAdminCredentials: gql`
        mutation MailAdminCredentials($db_name: String!, $id: Int!) {
            mailAdminCredentials(db_name: $db_name, id: $id)
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
    systemSettings: gql`
        query SystemSettings {
            systemSettings
        }
    `,
    usageHealth: gql`
        query UsageHealth {
            usageHealth
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