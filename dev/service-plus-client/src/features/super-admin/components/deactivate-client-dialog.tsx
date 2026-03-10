import { useMutation } from "@apollo/client/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { graphQlUtils } from "@/lib/graphql-utils";
import type { ClientType } from "@/features/super-admin/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeactivateClientDialogPropsType = {
	client: ClientType | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DeactivateClientDialog = ({ client, onOpenChange, onSuccess, open }: DeactivateClientDialogPropsType) => {
	const [executeGenericUpdate, { loading: mutating }] = useMutation(GRAPHQL_MAP.genericUpdate);

	if (!client) return null;

	async function handleConfirm() {
		if (!client) return;
		try {
			const result = await executeGenericUpdate({
				variables: {
					db_name: "",
					schema: "public",
					value: graphQlUtils.buildGenericUpdateValue({
						tableName: "client",
						xData: { id: client.id, is_active: false },
					}),
				},
			});
			if (result.error) {
				toast.error(MESSAGES.ERROR_CLIENT_DEACTIVATE_FAILED);
				return;
			}
			toast.success(MESSAGES.SUCCESS_CLIENT_DEACTIVATED);
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_CLIENT_DEACTIVATE_FAILED);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Deactivate Client</DialogTitle>
					<DialogDescription>
						Are you sure you want to deactivate <span className="font-semibold text-slate-800">{client.name}</span>?
						This will prevent all users from logging in.
					</DialogDescription>
				</DialogHeader>

				<p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
					This action can be reversed by activating the client again.
				</p>

				<DialogFooter>
					<Button
						disabled={mutating}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						className="border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
						disabled={mutating}
						variant="outline"
						onClick={handleConfirm}
					>
						{mutating ? "Deactivating..." : "Deactivate"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
