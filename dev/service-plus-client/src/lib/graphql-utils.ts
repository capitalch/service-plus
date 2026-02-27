import _ from "lodash";

export const graphQlUtils = {

    buildGenericQueryValue: ({ buCode, sqlId, sqlArgs }: GenericQueryValueType): string => {
        return encodeObj(JSON.stringify({
            buCode,
            sqlId,
            sqlArgs
        }))
    }

}

export function encodeObj(obj: any) {
    let ret = ''
    if (!_.isEmpty(obj)) {
        ret = encodeURI(JSON.stringify(obj))
    }
    return ret
}

export type GenericQueryValueType = {
    buCode: string;
    sqlId: string;
    sqlArgs?: any;
    [key: string]: any;
}