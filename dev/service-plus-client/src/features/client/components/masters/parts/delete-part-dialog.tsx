import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { DeleteConfirmDialog } from "@/features/client/components/delete-confirm-dialog";
import type { PartType } from "@/features/client/types/part";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeletePartDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    part:         PartType;
};

type InUseQueryDataType = {
    genericQuery: { in_use: boolean }[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeletePartDialog = ({
    onOpenChange,
    onSuccess,
    open,
    part,
}: DeletePartDialogPropsType) => {
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
                    sqlArgs: { id: part.id },
                    sqlId:   SQL_MAP.CHECK_PART_IN_USE,
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
                    deletedIds: [part.id],
                    tableName:  "spare_part_master",
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
            title="Delete Part"
            entityName={part.part_name}
            confirmKey={part.part_code}
            confirmKeyClass="font-mono"
            confirmInputClass="font-mono uppercase"
            inUseMessage="This part cannot be deleted as it is referenced by existing jobs, invoices, or stock records."
            onCheckInUse={checkInUse}
            onDelete={handleDelete}
            toastMessages={{
                success: "Part deleted successfully.",
                error:   "Failed to delete part. Please try again.",
            }}
        />
    );
};
