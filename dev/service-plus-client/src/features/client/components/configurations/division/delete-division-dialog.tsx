import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import type { DivisionType } from "@/features/client/types/division";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteDivisionDialogPropsType = {
    division:     DivisionType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type InUseQueryDataType = {
    genericQuery: { in_use: boolean }[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteDivisionDialog = ({
    division,
    onOpenChange,
    onSuccess,
    open,
}: DeleteDivisionDialogPropsType) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    async function checkInUse() {
        if (!dbName || !schema) return null;
        const res = await apolloClient.query<InUseQueryDataType>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlArgs: { id: division.id },
                    sqlId:   SQL_MAP.CHECK_DIVISION_IN_USE,
                }),
            },
        });
        return res.data?.genericQuery?.[0]?.in_use ?? false;
    }

    async function handleDelete() {
        await apolloClient.mutate({
            mutation: GRAPHQL_MAP.genericUpdate,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericUpdateValue({
                    deletedIds: [division.id],
                    tableName:  "division",
                    xData:      {},
                }),
            },
        });
    }

    return (
        <DeleteConfirmDialog
            open={open}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
            title="Delete Division"
            entityName={division.name}
            confirmKey={division.name}
            inUseMessage={MESSAGES.ERROR_DIVISION_DELETE_IN_USE}
            onCheckInUse={checkInUse}
            onDelete={handleDelete}
            toastMessages={{
                success: MESSAGES.SUCCESS_DIVISION_DELETED,
                error:   MESSAGES.ERROR_DIVISION_DELETE_FAILED,
            }}
        />
    );
};
