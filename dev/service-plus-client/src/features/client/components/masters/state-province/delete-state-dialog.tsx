import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { DeleteConfirmDialog } from "@/features/client/components/delete-confirm-dialog";
import type { StateType } from "@/features/client/types/state";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteStateDialogPropsType = {
    state:        StateType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type InUseQueryDataType = { genericQuery: { in_use: boolean }[] | null };

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteStateDialog = ({
    state,
    onOpenChange,
    onSuccess,
    open,
}: DeleteStateDialogPropsType) => {
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
                    sqlArgs: { id: state.id },
                    sqlId:   SQL_MAP.CHECK_STATE_IN_USE,
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
                    deletedIds: [state.id],
                    tableName:  "state",
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
            title="Delete State / Province"
            entityName={state.name}
            confirmKey={state.name}
            inUseMessage={MESSAGES.ERROR_STATE_DELETE_IN_USE}
            onCheckInUse={checkInUse}
            onDelete={handleDelete}
            toastMessages={{
                success: MESSAGES.SUCCESS_STATE_DELETED,
                error:   MESSAGES.ERROR_STATE_DELETE_FAILED,
            }}
        />
    );
};
