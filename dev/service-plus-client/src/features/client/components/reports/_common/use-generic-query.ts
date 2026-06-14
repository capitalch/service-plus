import { useCallback, useEffect, useState } from "react";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

type GenericQueryDataType<T> = { genericQuery: T[] | null };

type UseGenericQueryResultType<T> = {
    data: T[];
    error: Error | null;
    loading: boolean;
    refetch: () => void;
};

type Options = {
    enabled?: boolean;
    sqlArgs?: Record<string, unknown>;
    sqlId: string;
};

export function useGenericQuery<T>({ enabled = true, sqlArgs, sqlId }: Options): UseGenericQueryResultType<T> {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [data, setData]       = useState<T[]>([]);
    const [error, setError]     = useState<Error | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [tick, setTick]       = useState<number>(0);

    const argsKey = JSON.stringify(sqlArgs ?? {});

    useEffect(() => {
        if (!enabled || !dbName || !schema) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setData([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);

        apolloClient.query<GenericQueryDataType<T>>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   {
                db_name: dbName,
                schema,
                value:   graphQlUtils.buildGenericQueryValue({ sqlArgs, sqlId }),
            },
        }).then(res => {
            if (cancelled) return;
            setData(res.data?.genericQuery ?? []);
        }).catch(err => {
            if (cancelled) return;
            setError(err instanceof Error ? err : new Error(String(err)));
            setData([]);
        }).finally(() => {
            if (cancelled) return;
            setLoading(false);
        });

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbName, schema, sqlId, argsKey, enabled, tick]);

    const refetch = useCallback(() => setTick(t => t + 1), []);

    return { data, error, loading, refetch };
}
