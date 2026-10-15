import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import type { ClientAdminType } from "@/features/super-admin/types";

type DeleteAdminDialogPropsType = {
	admin: ClientAdminType;
	clientName: string;
	dbName: string;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

/** Super Admin → Clients → an admin's menu → Delete. Offered only for a deactivated admin; the
 *  username must be typed to confirm. Deletes the security.user row in the client's database
 *  (its user_bu_role rows cascade); a row that still refers to the user is reported by the server. */
export const DeleteAdminDialog = ({
	admin,
	clientName,
	dbName,
	onOpenChange,
	onSuccess,
	open,
}: DeleteAdminDialogPropsType) => {
	async function handleDelete() {
		await apolloClient.mutate({
			mutation: GRAPHQL_MAP.genericUpdate,
			variables: {
				db_name: dbName,
				schema: "security",
				value: graphQlUtils.buildGenericUpdateValue({ deletedIds: [admin.id], tableName: "user", xData: {} }),
			},
		});
	}

	return (
		<DeleteConfirmDialog
			confirmFieldLabel="username"
			confirmKey={admin.username}
			entityName={`${admin.full_name} (${clientName})`}
			open={open}
			title="Delete Admin"
			toastMessages={{ error: MESSAGES.ERROR_ADMIN_DELETE_FAILED, success: MESSAGES.SUCCESS_ADMIN_DELETED }}
			onDelete={handleDelete}
			onOpenChange={onOpenChange}
			onSuccess={onSuccess}
		/>
	);
};
