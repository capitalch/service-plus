import { useEffect, useState } from "react";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

const DEFAULT_FY_START_MONTH = 4;

type AppSettingRowType = {
    setting_key: string;
    setting_value: unknown;
};

type GenericQueryDataType = { genericQuery: AppSettingRowType[] | null };

type UseFiscalSettingResultType = {
    fyStartMonth: number;
    isReady: boolean;
};

function parseSettingValue(raw: unknown): unknown {
    if (typeof raw === "string") {
        try { return JSON.parse(raw); }
        catch { return raw; }
    }
    return raw;
}

export const useFiscalSetting = (): UseFiscalSettingResultType => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [fyStartMonth, setFyStartMonth] = useState<number>(DEFAULT_FY_START_MONTH);
    const [isReady, setIsReady]           = useState<boolean>(false);

    useEffect(() => {
        if (!dbName || !schema) return;
        let cancelled = false;

        void apolloClient.query<GenericQueryDataType>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   {
                db_name: dbName,
                schema,
                value:   graphQlUtils.buildGenericQueryValue({
                    sqlArgs: { setting_key: "fiscal_year_start_month_num" },
                    sqlId:   SQL_MAP.GET_APP_SETTING_BY_KEY,
                }),
            },
        }).then(res => {
            if (cancelled) return;
            const row = res.data?.genericQuery?.[0];
            const parsed = parseSettingValue(row?.setting_value);
            const num = Number(parsed);
            setFyStartMonth(Number.isFinite(num) && num >= 1 && num <= 12 ? num : DEFAULT_FY_START_MONTH);
            setIsReady(true);
        }).catch(() => {
            if (cancelled) return;
            setIsReady(true);
        });

        return () => { cancelled = true; };
    }, [dbName, schema]);

    return { fyStartMonth, isReady };
};
