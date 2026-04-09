import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { DeleteConfirmDialog } from "@/features/client/components/delete-confirm-dialog";
import type { ProductType } from "@/features/client/types/product";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteProductDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    product:      ProductType;
};

type InUseQueryDataType = {
    genericQuery: { in_use: boolean }[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteProductDialog = ({
    onOpenChange,
    onSuccess,
    open,
    product,
}: DeleteProductDialogPropsType) => {
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
                    sqlArgs: { id: product.id },
                    sqlId:   SQL_MAP.CHECK_PRODUCT_IN_USE,
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
                    deletedIds: [product.id],
                    tableName:  "product",
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
            title="Delete Product"
            entityName={product.name}
            confirmKey={product.name}
            confirmInputClass="font-mono uppercase"
            confirmMatch={(typed, key) => typed.toUpperCase() === key}
            inUseMessage="This product cannot be deleted as it is used by existing models."
            onCheckInUse={checkInUse}
            onDelete={handleDelete}
            toastMessages={{
                success: "Product deleted successfully.",
                error:   "Failed to delete product. Please try again.",
            }}
        />
    );
};
