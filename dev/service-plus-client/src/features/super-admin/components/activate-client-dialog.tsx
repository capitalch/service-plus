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

type ActivateClientDialogPropsType = {
	client: ClientType | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ActivateClientDialog = ({ client, onOpenChange, onSuccess, open }: ActivateClientDialogPropsType) => {
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
						xData: { id: client.id, is_active: true },
					}),
				},
			});
			if (result.errors?.length) {
				toast.error(MESSAGES.ERROR_CLIENT_ACTIVATE_FAILED);
				return;
			}
			toast.success(MESSAGES.SUCCESS_CLIENT_ACTIVATED);
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_CLIENT_ACTIVATE_FAILED);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Activate Client</DialogTitle>
					<DialogDescription>
						Are you sure you want to activate <span className="font-semibold text-slate-800">{client.name}</span>?
						This will restore access for all users.
					</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button
						disabled={mutating}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						className="bg-emerald-600 text-white hover:bg-emerald-700"
						disabled={mutating}
						onClick={handleConfirm}
					>
						{mutating ? "Activating..." : "Activate"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
