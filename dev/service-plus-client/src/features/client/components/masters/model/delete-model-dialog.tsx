import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { DeleteConfirmDialog } from "@/features/client/components/delete-confirm-dialog";
import type { ModelType } from "@/features/client/types/model";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteModelDialogPropsType = {
    model:        ModelType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type InUseQueryDataType = {
    genericQuery: { in_use: boolean }[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteModelDialog = ({
    model,
    onOpenChange,
    onSuccess,
    open,
}: DeleteModelDialogPropsType) => {
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
                    sqlArgs: { id: model.id },
                    sqlId:   SQL_MAP.CHECK_MODEL_IN_USE,
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
                    deletedIds: [model.id],
                    tableName:  "product_brand_model",
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
            title="Delete Model"
            entityName={model.model_name}
            confirmKey={model.model_name}
            inUseMessage="This model cannot be deleted as it is assigned to existing jobs."
            onCheckInUse={checkInUse}
            onDelete={handleDelete}
            toastMessages={{
                success: "Model deleted successfully.",
                error:   "Failed to delete model. Please try again.",
            }}
        />
    );
};
