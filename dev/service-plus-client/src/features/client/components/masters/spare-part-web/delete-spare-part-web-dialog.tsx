import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { deleteSparePartWebPartImages } from "@/lib/image-service";
import { useAppSelector } from "@/store/hooks";
import { selectClientCode, selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBu, selectSchema } from "@/store/context-slice";
import type { SparePartWebType } from "@/features/client/types/spare-part-web";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteSparePartWebDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    part:         SparePartWebType;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteSparePartWebDialog = ({
    onOpenChange,
    onSuccess,
    open,
    part,
}: DeleteSparePartWebDialogPropsType) => {
    const dbName     = useAppSelector(selectDbName);
    const schema     = useAppSelector(selectSchema);
    const clientCode = useAppSelector(selectClientCode) ?? "";
    const buCode     = useAppSelector(selectCurrentBu)?.code ?? "";

    async function handleDelete() {
        if (!dbName || !schema) return;

        // Wipe the part's file-server folder *before* the row disappears (§4) — once
        // the row is gone there's no branch_id left to rebuild the folder path from,
        // so a failure here must block the delete rather than be swallowed.
        await deleteSparePartWebPartImages(dbName, schema, part.id, clientCode, buCode);

        await apolloClient.mutate({
            mutation: GRAPHQL_MAP.genericUpdate,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericUpdateValue({
                    deletedIds: [part.id],
                    tableName:  "spare_part_web",
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
            title="Delete Catalogue Part"
            entityName={part.part_name}
            confirmKey={part.part_name}
            onDelete={handleDelete}
            toastMessages={{
                success: MESSAGES.SUCCESS_SPARE_PART_WEB_DELETED,
                error:   MESSAGES.ERROR_SPARE_PART_WEB_DELETE_FAILED,
            }}
        />
    );
};
