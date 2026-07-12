import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, Observable } from '@apollo/client';
import type { ServerError } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';
import { toast } from 'sonner';
import { getApiBaseUrl } from './utils';
import { refreshAccessToken } from './auth-service';
import { getAuthItem, setAuthItem } from './auth-storage';
import { refreshIfNeeded } from './token-refresh';
import { store } from '@/store';
import { logout } from '@/features/auth/store/auth-slice';
import { ROUTES } from '@/router/routes';
import { MESSAGES } from '@/constants/messages';

function getGqlHttpUrl(): string {
    return `${getApiBaseUrl()}/graphql/`;
}

function getGqlWsUrl(): string {
    return getApiBaseUrl().replace(/^http/, 'ws') + '/graphql/';
}

function getAuthToken() {
    return getAuthItem('accessToken');
}

// Auth link: attach a guaranteed-fresh token to every request. `refreshIfNeeded`
// proactively refreshes when the token is within 5 min of expiry, so an expired
// token is never sent — the primary defence against the confusing "Access
// forbidden" the server returns for a lapsed token.
const authLink = setContext(async (_, { headers }) => {
    const token = (await refreshIfNeeded()) ?? getAuthToken();
    return {
        headers: {
            ...headers,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    };
});

// Clear the session and bounce to login when the token cannot be recovered
// (no refresh token, or the refresh itself failed). Lives outside the React
// tree, so it dispatches to the store and navigates via window.location.
function hardLogout() {
    store.dispatch(logout());
    toast.error(MESSAGES.ERROR_SESSION_EXPIRED);
    window.location.assign(ROUTES.login);
}

// True when the server rejected the presented token (expired/invalid). GraphQL
// returns these inside an HTTP 200 body, so the network-401 check alone misses
// them — key off the distinct TOKEN_EXPIRED code the resolvers now emit.
function isTokenExpiredError(error: unknown): boolean {
    return (
        CombinedGraphQLErrors.is(error) &&
        error.errors.some(err => err.extensions?.code === 'TOKEN_EXPIRED')
    );
}

// Error link: on an expired/invalid token (network 401 or GraphQL TOKEN_EXPIRED),
// refresh once and retry the operation; if that can't be done, hard-logout.
const errorLink = new ErrorLink(({ error, operation, forward }) => {
    const isUnauthorized =
        (!CombinedGraphQLErrors.is(error) && (error as ServerError)?.statusCode === 401) ||
        isTokenExpiredError(error);

    if (isUnauthorized) {
        const storedRefreshToken = getAuthItem('refreshToken');
        if (!storedRefreshToken) {
            hardLogout();
            return;
        }

        return new Observable(observer => {
            refreshAccessToken(storedRefreshToken)
                .then(data => {
                    setAuthItem('accessToken', data.accessToken);
                    setAuthItem('refreshToken', data.refreshToken);
                    operation.setContext({
                        headers: {
                            ...operation.getContext().headers,
                            Authorization: `Bearer ${data.accessToken}`,
                        },
                    });
                    forward(operation).subscribe(observer);
                })
                .catch(err => {
                    hardLogout();
                    observer.error(err);
                });
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
