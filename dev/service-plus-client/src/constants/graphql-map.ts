import { gql } from "@apollo/client";

export const GRAPHQL_MAP = {
    genericQuery: gql`
        query GenericQuery($db_name: String!, $value: String!) { 
            genericQuery(db_name: $db_name, value: $value) 
        }
    `
};