import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, Observable } from '@apollo/client';
import type { ServerError } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';
import { getApiBaseUrl } from './utils';
import { refreshAccessToken } from './auth-service';

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
    const isUnauthorized =
        !CombinedGraphQLErrors.is(error) &&
        (error as ServerError)?.statusCode === 401;

    if (isUnauthorized) {
        const storedRefreshToken = localStorage.getItem('refreshToken');
        if (!storedRefreshToken) return;

        return new Observable(observer => {
            refreshAccessToken(storedRefreshToken)
                .then(data => {
                    localStorage.setItem('accessToken', data.accessToken);
                    localStorage.setItem('refreshToken', data.refreshToken);
                    operation.setContext({
                        headers: {
                            ...operation.getContext().headers,
                            Authorization: `Bearer ${data.accessToken}`,
                        },
                    });
                    forward(operation).subscribe(observer);
                })
                .catch(err => observer.error(err));
        });
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
