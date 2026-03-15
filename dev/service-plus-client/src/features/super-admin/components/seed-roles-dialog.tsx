import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2Icon, Loader2, ShieldIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { SEED_BATCHES } from "@/features/super-admin/constants/seed-data";
import type { ClientType } from "@/features/super-admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckQueryDataType = {
	genericQuery: { exists: boolean }[] | null;
};

type SeedRolesDialogPropsType = {
	client: ClientType;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SeedRolesDialog = ({
	client,
	onOpenChange,
	onSuccess,
	open,
}: SeedRolesDialogPropsType) => {
	const [checking, setChecking] = useState(false);
	const [rolesExist, setRolesExist] = useState<boolean | null>(null);
	const [seeding, setSeeding] = useState(false);

	// Check if roles already exist when dialog opens
	useEffect(() => {
		if (!open || !client.db_name) return;
		setChecking(true);
		setRolesExist(null);
		apolloClient
			.query<CheckQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: client.db_name,
					schema: "security",
					value: graphQlUtils.buildGenericQueryValue({
						sqlId: SQL_MAP.CHECK_ROLE_SEED_EXISTS,
					}),
				},
			})
			.then((res) => {
				setRolesExist(res.data?.genericQuery?.[0]?.exists ?? false);
			})
			.catch(() => {
				setRolesExist(false);
			})
			.finally(() => {
				setChecking(false);
			});
	}, [open, client.db_name]); // eslint-disable-line react-hooks/exhaustive-deps

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setChecking(false);
			setRolesExist(null);
			setSeeding(false);
		}
	}, [open]);

	async function handleApply() {
		if (!client.db_name) return;
		setSeeding(true);
		try {
			for (const batch of SEED_BATCHES) {
				const result = await apolloClient.mutate({
					mutation: GRAPHQL_MAP.genericUpdate,
					variables: {
						db_name: client.db_name,
						schema: "security",
						value: graphQlUtils.buildGenericUpdateValue(batch.sqlObject),
					},
				});
				if (result.errors?.length) {
					toast.error(MESSAGES.ERROR_SEED_ROLES_FAILED);
					return;
				}
			}
			toast.success(MESSAGES.SUCCESS_SEED_ROLES);
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_SEED_ROLES_FAILED);
		} finally {
			setSeeding(false);
		}
	}

	const rolesBatch = SEED_BATCHES.find((b) => b.label === "Roles");
	const roleItems = rolesBatch
		? Array.isArray(rolesBatch.sqlObject.xData)
			? rolesBatch.sqlObject.xData
			: [rolesBatch.sqlObject.xData]
		: [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-[440px]">
				<DialogTitle className="sr-only">Seed Roles: {client.name}</DialogTitle>
				<DialogDescription className="sr-only">
					Seed default roles into the database for {client.name}.
				</DialogDescription>

				{/* Header */}
				<div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-5 sm:px-7">
					<div className="flex items-center gap-2">
						<ShieldIcon className="h-4 w-4 text-violet-400" />
						<p className="text-sm font-semibold text-slate-300">
							Seed Roles:{" "}
							<span className="text-violet-400">{client.name}</span>
						</p>
					</div>
					{client.db_name && (
						<p className="mt-1 text-xs text-slate-500">{client.db_name}</p>
					)}
				</div>

				{/* Body */}
				<div className="p-5 sm:p-7">
					{/* Checking state */}
					{checking && (
						<div className="flex flex-col items-center gap-3 py-8">
							<Loader2 className="h-7 w-7 animate-spin text-violet-500" />
							<p className="text-sm text-slate-500">Checking existing roles…</p>
						</div>
					)}

					{/* Roles already exist */}
					{!checking && rolesExist === true && (
						<div className="flex flex-col gap-4">
							<div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
								<CheckCircle2Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
								<p className="text-sm text-emerald-700">
									{MESSAGES.INFO_SEED_ROLES_ALREADY_EXISTS}
								</p>
							</div>
							<div className="flex justify-end">
								<Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
									Close
								</Button>
							</div>
						</div>
					)}

					{/* Roles do not exist — show list and apply button */}
					{!checking && rolesExist === false && (
						<div className="flex flex-col gap-4">
							<div>
								<p className="mb-1 text-sm font-semibold text-slate-800">Default Roles</p>
								<p className="mb-3 text-xs text-slate-500">
									The following roles will be seeded into the client's database.
								</p>
								<div className="overflow-hidden rounded-lg border border-slate-200">
									{roleItems.map((item, idx) => (
										<div
											key={idx}
											className={`flex items-center justify-between px-3 py-2 text-sm ${
												idx !== 0 ? "border-t border-slate-100" : ""
											}`}
										>
											<span className="font-mono text-xs font-medium text-slate-700">
												{String(item.code)}
											</span>
											<span className="text-xs text-slate-500">
												{String(item.name)}
											</span>
										</div>
									))}
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="ghost"
									onClick={() => onOpenChange(false)}
								>
									Cancel
								</Button>
								<Button
									className="bg-violet-600 text-white hover:bg-violet-700"
									disabled={seeding}
									onClick={handleApply}
									type="button"
								>
									{seeding ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Applying…
										</>
									) : (
										"Apply Seed Roles"
									)}
								</Button>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
