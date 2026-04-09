import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { DeleteConfirmDialog } from "@/features/client/components/delete-confirm-dialog";
import type { VendorType } from "@/features/client/types/vendor";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteVendorDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    vendor:       VendorType;
};

type InUseQueryDataType = {
    genericQuery: { in_use: boolean }[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteVendorDialog = ({
    onOpenChange,
    onSuccess,
    open,
    vendor,
}: DeleteVendorDialogPropsType) => {
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
                    sqlArgs: { id: vendor.id },
                    sqlId:   SQL_MAP.CHECK_VENDOR_IN_USE,
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
                    deletedIds: [vendor.id],
                    tableName:  "supplier",
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
            title="Delete Vendor"
            entityName={vendor.name}
            confirmKey={vendor.name}
            inUseMessage={MESSAGES.ERROR_VENDOR_DELETE_IN_USE}
            onCheckInUse={checkInUse}
            onDelete={handleDelete}
            toastMessages={{
                success: MESSAGES.SUCCESS_VENDOR_DELETED,
                error:   MESSAGES.ERROR_VENDOR_DELETE_FAILED,
            }}
        />
    );
};
