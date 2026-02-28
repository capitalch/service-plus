import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';

const GQL_HTTP_URL = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:8000/graphql';
const GQL_WS_URL = import.meta.env.VITE_GRAPHQL_WS_URL || 'ws://localhost:8000/graphql';

function getAuthToken() {
    return localStorage.getItem('accessToken');
}

// Modern ApolloLink middleware pattern for auth headers
const authMiddleware = new ApolloLink((operation, forward) => {
    const token = getAuthToken();
    operation.setContext(({ headers = {} }) => ({
        headers: {
            ...headers,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    }));
    return forward(operation);
});

const httpLink = new HttpLink({ uri: GQL_HTTP_URL });

const wsLink = new GraphQLWsLink(
    createClient({
        url: GQL_WS_URL,
        connectionParams: () => {
            const token = getAuthToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
        },
    })
);

// ApolloLink.split replaces deprecated bare split() function (v4 migration)
// ApolloLink.from replaces deprecated concat() — idiomatic v4 link chain composition
const splitLink = ApolloLink.split(
    ({ operationType }) => operationType === OperationTypeNode.SUBSCRIPTION,
    wsLink,
    ApolloLink.from([authMiddleware, httpLink])
);

export const apolloClient = new ApolloClient({
    cache: new InMemoryCache(),
    link: splitLink,
    defaultOptions: {
        watchQuery: {
            fetchPolicy: 'no-cache',
        },
        query: {
            fetchPolicy: 'no-cache',
        },
        mutate: {},
    },
});
