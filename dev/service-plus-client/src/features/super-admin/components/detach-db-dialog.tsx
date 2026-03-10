import { useMutation } from "@apollo/client/react";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
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

type DetachDbDialogPropsType = {
	client: ClientType | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DetachDbDialog = ({ client, onOpenChange, onSuccess, open }: DetachDbDialogPropsType) => {
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
						xData: { db_name: null, id: client.id },
					}),
				},
			});
			if (result.error) {
				toast.error(MESSAGES.ERROR_CLIENT_DETACH_DB_FAILED);
				return;
			}
			toast.success(MESSAGES.SUCCESS_CLIENT_DB_DETACHED);
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_CLIENT_DETACH_DB_FAILED);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Detach Database</DialogTitle>
					<DialogDescription>
						Remove the database link from client{" "}
						<span className="font-semibold text-slate-800">{client.name}</span>.
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
					<InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
					<p className="text-sm text-blue-700">
						The database will not be physically deleted. It can be re-attached to the client again.
					</p>
				</div>

				<div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
					<TriangleAlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
					<div className="text-sm text-amber-700">
						<p>
							Database:{" "}
							<code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs font-semibold">
								{client.db_name}
							</code>
						</p>
						<p className="mt-1">All users of this client will lose access until the database is re-attached.</p>
					</div>
				</div>

				<div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
				<InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
				<p className="text-sm text-slate-600">
					{MESSAGES.INFO_CLIENT_DB_MANUAL_DELETE_ONLY}
				</p>
			</div>

			<DialogFooter>
					<Button
						disabled={mutating}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						className="border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
						disabled={mutating}
						variant="outline"
						onClick={handleConfirm}
					>
						{mutating ? "Detaching..." : "Detach"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
