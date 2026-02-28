import _ from "lodash";

export const graphQlUtils = {

    buildGenericQueryValue: ({ buCode, sqlArgs, sqlId }: GenericQueryValueType): string => {
        return encodeObj({
            buCode,
            sqlArgs,
            sqlId,
        })
    }
}

export function encodeObj(obj: Record<string, unknown>): string {
    let ret = ''
    if (!_.isEmpty(obj)) {
        ret = encodeURIComponent(JSON.stringify(obj))
    }
    return ret
}

export type GenericQueryValueType = {
    buCode: string;
    sqlArgs?: Record<string, unknown>;
    sqlId: string;
}