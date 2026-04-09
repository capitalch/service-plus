import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { DeleteConfirmDialog } from "@/features/client/components/delete-confirm-dialog";
import type { BranchType } from "./branch";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteBranchDialogPropsType = {
    branch:       BranchType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type InUseQueryDataType = {
    genericQuery: { in_use: boolean }[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteBranchDialog = ({
    branch,
    onOpenChange,
    onSuccess,
    open,
}: DeleteBranchDialogPropsType) => {
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
                    sqlArgs: { id: branch.id },
                    sqlId:   SQL_MAP.CHECK_BRANCH_IN_USE,
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
                    deletedIds: [branch.id],
                    tableName:  "branch",
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
            title="Delete Branch"
            entityName={branch.name}
            confirmKey={branch.name}
            blockedMessage={branch.is_head_office ? MESSAGES.ERROR_BRANCH_DELETE_HEAD_OFFICE : null}
            inUseMessage={MESSAGES.ERROR_BRANCH_DELETE_IN_USE}
            onCheckInUse={branch.is_head_office ? undefined : checkInUse}
            onDelete={handleDelete}
            toastMessages={{
                success: MESSAGES.SUCCESS_BRANCH_DELETED,
                error:   MESSAGES.ERROR_BRANCH_DELETE_FAILED,
            }}
        />
    );
};
