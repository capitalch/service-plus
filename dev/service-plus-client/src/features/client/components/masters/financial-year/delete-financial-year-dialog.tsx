import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { DeleteConfirmDialog } from "@/features/client/components/delete-confirm-dialog";
import type { FinancialYearType } from "@/features/client/types/financial-year";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteFinancialYearDialogPropsType = {
    fy:           FinancialYearType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteFinancialYearDialog = ({
    fy,
    onOpenChange,
    onSuccess,
    open,
}: DeleteFinancialYearDialogPropsType) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    async function handleDelete() {
        await apolloClient.mutate({
            mutation: GRAPHQL_MAP.genericUpdate,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericUpdateValue({
                    deletedIds: [fy.id],
                    tableName:  "financial_year",
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
            title="Delete Financial Year"
            entityName={`FY ${fy.id}`}
            confirmKey={String(fy.id)}
            confirmMatch={(typed, key) => typed === key}
            onDelete={handleDelete}
            toastMessages={{
                success: MESSAGES.SUCCESS_FY_DELETED,
                error:   MESSAGES.ERROR_FY_DELETE_FAILED,
            }}
        />
    );
};
