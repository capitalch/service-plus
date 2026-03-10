import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangleIcon, DatabaseIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import type { ClientType } from "@/features/super-admin/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeleteClientDialogPropsType = {
	client: ClientType | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

type DeleteFormType = {
	confirmName: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
	return (
		<AnimatePresence>
			{message && (
				<motion.p
					animate={{ opacity: 1, y: 0 }}
					className="text-xs text-red-500"
					exit={{ opacity: 0, y: -4 }}
					initial={{ opacity: 0, y: -4 }}
				>
					{message}
				</motion.p>
			)}
		</AnimatePresence>
	);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteClientDialog = ({ client, onOpenChange, onSuccess, open }: DeleteClientDialogPropsType) => {
	const schema = useMemo(() =>
		z.object({
			confirmName: z.string(),
		}).refine((data) => data.confirmName === (client?.name ?? ""), {
			message: MESSAGES.ERROR_CLIENT_NAME_MISMATCH,
			path: ["confirmName"],
		}),
		[client?.name],
	);

	const {
		formState: { errors, isValid, isSubmitting },
		handleSubmit,
		register,
		reset,
	} = useForm<DeleteFormType>({
		defaultValues: { confirmName: "" },
		mode: "onChange",
		resolver: zodResolver(schema),
	});

	useEffect(() => {
		if (!open) reset({ confirmName: "" });
	}, [open, reset]);

	if (!client) return null;

	if (client.db_name) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete Client</DialogTitle>
						<DialogDescription>
							Cannot delete{" "}
							<span className="font-semibold text-slate-800">{client.name}</span>{" "}
							while a database is attached.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-2">
						<div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
							<DatabaseIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
							<p className="text-sm text-amber-800">
								{MESSAGES.ERROR_CLIENT_DELETE_HAS_DB}
							</p>
						</div>
						<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
							<p className="text-xs text-slate-500">
								Attached database:{" "}
								<span className="font-semibold text-slate-700">{client.db_name}</span>
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	async function handleConfirm() {
		if (!client) return;
		try {
			const result = await apolloClient.mutate({
				mutation: GRAPHQL_MAP.deleteClient,
				variables: { client_id: client.id },
			});
			if (result.errors?.length) {
				toast.error(MESSAGES.ERROR_CLIENT_DELETE_FAILED);
				return;
			}
			toast.success(MESSAGES.SUCCESS_CLIENT_DELETED);
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_CLIENT_DELETE_FAILED);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Delete Client</DialogTitle>
					<DialogDescription>
						You are about to permanently delete{" "}
						<span className="font-semibold text-slate-800">{client.name}</span>.
						This action cannot be undone.
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
					<AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
					<p className="text-sm text-amber-800">
						This action is permanent and cannot be undone.
					</p>
				</div>

				<div className="flex flex-col gap-1.5">
					<Label htmlFor="confirmName">
						Type <span className="font-semibold text-slate-800">{client.name}</span> to confirm
					</Label>
					<Input
						autoComplete="off"
						disabled={isSubmitting}
						id="confirmName"
						placeholder={client.name}
						{...register("confirmName")}
					/>
					<FieldError message={errors.confirmName?.message} />
				</div>

				<DialogFooter>
					<Button
						disabled={isSubmitting}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
						disabled={!isValid || isSubmitting}
						onClick={handleSubmit(handleConfirm)}
					>
						{isSubmitting ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
