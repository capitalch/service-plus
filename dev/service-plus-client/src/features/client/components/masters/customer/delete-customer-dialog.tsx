import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { DeleteConfirmDialog } from "@/features/client/components/delete-confirm-dialog";
import type { CustomerType } from "@/features/client/types/customer";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteCustomerDialogPropsType = {
    customer:     CustomerType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type InUseQueryDataType = {
    genericQuery: { in_use: boolean }[] | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteCustomerDialog = ({
    customer,
    onOpenChange,
    onSuccess,
    open,
}: DeleteCustomerDialogPropsType) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const displayName = customer.full_name || customer.mobile;

    async function checkInUse() {
        if (!dbName || !schema) return null;
        const res = await apolloClient.query<InUseQueryDataType>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlArgs: { id: customer.id },
                    sqlId:   SQL_MAP.CHECK_CUSTOMER_IN_USE,
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
                    deletedIds: [customer.id],
                    tableName:  "customer_contact",
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
            title="Delete Customer"
            entityName={displayName}
            confirmKey={customer.mobile}
            confirmMatch={(typed, key) => typed === key}
            inUseMessage={MESSAGES.ERROR_CUSTOMER_DELETE_IN_USE}
            onCheckInUse={checkInUse}
            onDelete={handleDelete}
            toastMessages={{
                success: MESSAGES.SUCCESS_CUSTOMER_DELETED,
                error:   MESSAGES.ERROR_CUSTOMER_DELETE_FAILED,
            }}
        />
    );
};
