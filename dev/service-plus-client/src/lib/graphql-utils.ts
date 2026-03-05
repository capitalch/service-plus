import _ from "lodash";

export const graphQlUtils = {

    buildGenericQueryValue: ({ sqlArgs, sqlId }: GenericQueryValueType): string => {
        return encodeObj({
            sqlArgs,
            sqlId,
        })
    },

    buildGenericUpdateValue: (sqlObject: SqlObjectType): string => {
        return encodeObj(sqlObject as Record<string, unknown>)
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
    sqlArgs?: Record<string, unknown>;
    sqlId: string;
}

export type GenericUpdateValueType = SqlObjectType;

export type SqlObjectType = {
    deletedIds?: number[];
    fkeyName?: string;
    tableName: string;
    xData: XDataItemType | XDataItemType[];
}

export type XDataItemType = {
    id?: number;
    isIdInsert?: boolean;
    xDetails?: SqlObjectType | SqlObjectType[];
    [key: string]: unknown;
}
