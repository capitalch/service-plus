import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@apollo/client/react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Check, InfoIcon, Loader2 } from "lucide-react";

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
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import type { ClientType } from "@/features/super-admin/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type AttachDbDialogPropsType = {
	client: ClientType | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

type AttachDbFormType = {
	db_name: string;
};

type CheckDbQueryDataType = {
	genericQuery: { exists: boolean }[] | null;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const attachDbSchema = z.object({
	db_name: z
		.string()
		.min(1, MESSAGES.ERROR_DB_NAME_REQUIRED)
		.regex(/^service_plus_[a-z0-9_]+$/, "Invalid format: must be service_plus_<code>"),
});

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

export const AttachDbDialog = ({ client, onOpenChange, onSuccess, open }: AttachDbDialogPropsType) => {
	const [checkingDb, setCheckingDb] = useState(false);
	const [dbNameAvailable, setDbNameAvailable] = useState<boolean | null>(null);
	const [executeGenericUpdate, { loading: mutating }] = useMutation(GRAPHQL_MAP.genericUpdate);

	const {
		clearErrors,
		control,
		formState: { errors },
		getFieldState,
		handleSubmit,
		register,
		reset,
		setError,
	} = useForm<AttachDbFormType>({
		defaultValues: { db_name: client ? `service_plus_${client.code.toLowerCase()}` : "" },
		mode: "onChange",
		resolver: zodResolver(attachDbSchema),
	});

	const dbNameValue = useWatch({ control, name: "db_name" });
	const debouncedDbName = useDebounce(dbNameValue, 1200);

	useEffect(() => {
		if (!debouncedDbName) return;
		const { invalid } = getFieldState("db_name");
		if (invalid) {
			setDbNameAvailable(null);
			return;
		}
		setCheckingDb(true);
		setDbNameAvailable(null);
		apolloClient
			.query<CheckDbQueryDataType>({
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: "",
					schema: "public",
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { db_name: debouncedDbName },
						sqlId: SQL_MAP.CHECK_DB_NAME_EXISTS,
					}),
				},
			})
			.then((res) => {
				const exists = res.data?.genericQuery?.[0]?.exists ?? false;
				setDbNameAvailable(!exists);
				if (exists) {
					setError("db_name", { message: MESSAGES.ERROR_DB_NAME_EXISTS, type: "manual" });
				} else {
					clearErrors("db_name");
				}
			})
			.finally(() => {
				setCheckingDb(false);
			});
	}, [debouncedDbName]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (open && client) {
			reset({ db_name: `service_plus_${client.code.toLowerCase()}` });
			setCheckingDb(false);
			setDbNameAvailable(null);
		} else if (!open) {
			setCheckingDb(false);
			setDbNameAvailable(null);
			reset({ db_name: "" });
		}
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!client) return null;

	const busy = checkingDb || mutating;
	const submitDisabled = busy || !dbNameAvailable || !!errors.db_name;

	async function onSubmit(data: AttachDbFormType) {
		if (!client) return;
		try {
			const result = await executeGenericUpdate({
				variables: {
					db_name: "",
					schema: "public",
					value: graphQlUtils.buildGenericUpdateValue({
						tableName: "client",
						xData: { db_name: data.db_name, id: client.id },
					}),
				},
			});
			if (result.error) {
				toast.error(MESSAGES.ERROR_CLIENT_ATTACH_DB_FAILED);
				return;
			}
			toast.success(MESSAGES.SUCCESS_CLIENT_DB_ATTACHED);
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_CLIENT_ATTACH_DB_FAILED);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Attach Database</DialogTitle>
					<DialogDescription>
						Link a database to client{" "}
						<span className="font-semibold text-slate-800">{client.name}</span>.
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
					<InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
					<p className="text-sm text-blue-700">
						Link an existing database to this client. The database must not be assigned to another client.
					</p>
				</div>

				<form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="db_name">
							Database Name <span className="text-red-500">*</span>
						</Label>
						<div className="relative">
							<Input
								className="w-full pr-8"
								disabled={busy}
								id="db_name"
								placeholder="service_plus_..."
								{...register("db_name")}
							/>
							{checkingDb && (
								<Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
							)}
							{!checkingDb && dbNameAvailable === true && (
								<Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
							)}
						</div>
						<FieldError message={errors.db_name?.message} />
					</div>

					<DialogFooter>
						<Button
							disabled={mutating}
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							className="bg-blue-600 text-white hover:bg-blue-700"
							disabled={submitDisabled}
							type="submit"
						>
							{mutating ? "Attaching..." : "Attach"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
