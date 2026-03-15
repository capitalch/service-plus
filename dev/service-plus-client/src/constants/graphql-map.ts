import { gql } from "@apollo/client";

export const GRAPHQL_MAP = {
    adminDashboardStats: gql`
        query AdminDashboardStats($db_name: String!) {
            adminDashboardStats(db_name: $db_name)
        }
    `,
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
    createAdminUser: gql`
        mutation CreateAdminUser($db_name: String!, $schema: String, $value: String!) {
            createAdminUser(db_name: $db_name, schema: $schema, value: $value)
        }
    `,
    createBusinessUser: gql`
        mutation CreateBusinessUser($db_name: String!, $schema: String, $value: String!) {
            createBusinessUser(db_name: $db_name, schema: $schema, value: $value)
        }
    `,
    createServiceDb: gql`
        mutation CreateServiceDb($db_name: String!, $schema: String, $value: String!) {
            createServiceDb(db_name: $db_name, schema: $schema, value: $value)
        }
    `,
    deleteClient: gql`
        mutation DeleteClient($db_name: String!, $schema: String, $value: String!) {
            deleteClient(db_name: $db_name, schema: $schema, value: $value)
        }
    `,
    dropDatabase: gql`
        mutation DropDatabase($db_name: String!, $schema: String, $value: String!) {
            dropDatabase(db_name: $db_name, schema: $schema, value: $value)
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
        mutation MailAdminCredentials($db_name: String!, $schema: String, $value: String!) {
            mailAdminCredentials(db_name: $db_name, schema: $schema, value: $value)
        }
    `,
    mailBusinessUserCredentials: gql`
        mutation MailBusinessUserCredentials($db_name: String!, $schema: String, $value: String!) {
            mailBusinessUserCredentials(db_name: $db_name, schema: $schema, value: $value)
        }
    `,
    setUserBuRole: gql`
        mutation SetUserBuRole($db_name: String!, $schema: String, $value: String!) {
            setUserBuRole(db_name: $db_name, schema: $schema, value: $value)
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
};
