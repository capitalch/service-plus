import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';
import { getApiBaseUrl } from './utils';

function getGqlHttpUrl(): string {
    return `${getApiBaseUrl()}/graphql/`;
}

function getGqlWsUrl(): string {
    return getApiBaseUrl().replace(/^http/, 'ws') + '/graphql/';
}

function getAuthToken() {
    return localStorage.getItem('accessToken');
}

// Auth link: attach token to every request
const authLink = setContext((_, { headers }) => {
    const token = getAuthToken();
    return {
        headers: {
            ...headers,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    };
});

// Error link: handle 401 by refreshing token and retrying
const errorLink = new ErrorLink(({ error, operation, forward }) => {
    const isNetworkError = !CombinedGraphQLErrors.is(error);

    if (isNetworkError) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return;

        // Synchronously attempt refresh
        let newToken: string | null = null;
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${getApiBaseUrl()}/api/auth/refresh`, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({ refreshToken }));

        if (xhr.status === 200) {
            try {
                const data = JSON.parse(xhr.responseText);
                newToken = data.accessToken;
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
            } catch {
                // ignore
            }
        }

        if (newToken) {
            operation.setContext({
                headers: {
                    ...operation.getContext().headers,
                    Authorization: `Bearer ${newToken}`,
                },
            });
            return forward(operation);
        }
    }

    if (CombinedGraphQLErrors.is(error)) {
        for (const err of error.errors) {
            console.error(`[GraphQL error]: message: ${err.message}`);
        }
    } else {
        console.error(`[Network error]: ${error}`);
    }
});

const httpLink = new HttpLink({ uri: getGqlHttpUrl() });

const wsLink = new GraphQLWsLink(
    createClient({
        url: getGqlWsUrl(),
        connectionParams: () => {
            const token = getAuthToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
        },
    })
);

const splitLink = ApolloLink.split(
    ({ operationType }) => operationType === OperationTypeNode.SUBSCRIPTION,
    wsLink,
    ApolloLink.from([errorLink, authLink, httpLink])
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
