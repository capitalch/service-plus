import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangleIcon, CheckCircle2Icon, Loader2, PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import type { ClientType } from "@/features/super-admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckQueryDataType = {
	genericQuery: { exists: boolean }[] | null;
};

type StepType = 1 | 2 | "success" | "error";

// Display-only previews — the actual seed SQL lives server-side in
// app/db/seed_security_data.py (SeedSecurityData.ROLE_SEED_SQL / ACCESS_RIGHT_SEED_SQL).
const ROLE_PREVIEW_ITEMS = [
	{ code: "MANAGER", name: "Manager" },
	{ code: "TECHNICIAN", name: "Technician" },
	{ code: "RECEPTIONIST", name: "Receptionist" },
];

const ACCESS_RIGHT_PREVIEW_ITEMS = [
	{ code: "JOBS_RECEIPTS", module: "Jobs", name: "Receipts" },
	{ code: "JOBS_OPENING_JOBS", module: "Jobs", name: "Opening Jobs" },
	{ code: "JOBS_ACCOUNTS_POSTING", module: "Jobs", name: "Accounts Posting" },
	{ code: "JOBS_DELIVER_JOB", module: "Jobs", name: "Deliver Job" },
	{ code: "MASTERS_MENU", module: "Masters", name: "Masters (whole tab)" },
	{ code: "CONFIG_MENU", module: "Configurations", name: "Configurations (whole tab)" },
	{ code: "ADMIN_MENU", module: "Admin", name: "Post / Unpost" },
	{ code: "INVENTORY_PURCHASE_ENTRY", module: "Inventory", name: "Purchase Entry" },
	{ code: "INVENTORY_SALES_ENTRY", module: "Inventory", name: "Sales Entry" },
	{ code: "INVENTORY_STOCK_ADJUSTMENT", module: "Inventory", name: "Stock Adjustment" },
	{ code: "INVENTORY_BRANCH_TRANSFER", module: "Inventory", name: "Branch Transfer" },
	{ code: "INVENTORY_OPENING_STOCK", module: "Inventory", name: "Opening Stock" },
	{ code: "INVENTORY_SET_PART_LOCATION", module: "Inventory", name: "Set Part Location" },
	{ code: "MASTERS_ORGANIZATION", module: "Masters", name: "Organization (Manager only)" },
	{ code: "MASTERS_SERVICE_CONFIG", module: "Masters", name: "Service Config (Manager only)" },
];

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
	const [seeding, setSeeding] = useState(false);
	const [seedingAccessRights, setSeedingAccessRights] = useState(false);
	const [step, setStep] = useState<StepType>(1);
	const [accessRightsAlreadyExisted, setAccessRightsAlreadyExisted] = useState(false);

	// Runs the access-rights seed automatically (no user click required) —
	// safe to call more than once (ON CONFLICT DO NOTHING), used both on
	// initial open (roles already present) and right after Step 1 completes.
	async function runAccessRightsSeed() {
		if (!client.db_name) return;
		setSeedingAccessRights(true);
		try {
			const result = await apolloClient.mutate({
				mutation: GRAPHQL_MAP.seedSecurityData,
				variables: {
					db_name: client.db_name,
					schema: "security",
					value: encodeURIComponent(JSON.stringify({ stage: "access_rights" })),
				},
			});
			if (result.error) {
				setStep("error");
				return;
			}
			toast.success(MESSAGES.SUCCESS_SEED_ACCESS_RIGHTS);
			onSuccess();
			setStep("success");
		} catch {
			setStep("error");
		} finally {
			setSeedingAccessRights(false);
		}
	}

	// Check if roles / access rights already exist when the dialog opens
	useEffect(() => {
		if (!open || !client.db_name) return;
		setChecking(true);

		const checkExists = (sqlId: string) =>
			apolloClient
				.query<CheckQueryDataType>({
					fetchPolicy: "network-only",
					query: GRAPHQL_MAP.genericQuery,
					variables: {
						db_name: client.db_name,
						schema: "security",
						value: graphQlUtils.buildGenericQueryValue({ sqlId }),
					},
				})
				.then((res) => res.data?.genericQuery?.[0]?.exists ?? false)
				.catch(() => false);

		Promise.all([
			checkExists(SQL_MAP.CHECK_ROLE_SEED_EXISTS),
			checkExists(SQL_MAP.CHECK_ACCESS_RIGHT_SEED_EXISTS),
		]).then(([rolesFound, accessRightsFound]) => {
			setAccessRightsAlreadyExisted(accessRightsFound);
			setChecking(false);
			if (!rolesFound) {
				setStep(1);
				return;
			}
			// Roles are in place — always (re-)run the access-rights seed
			// automatically, even if some rows already exist, so a client
			// seeded before newer codes were added gets upgraded rather
			// than being told there's "nothing to do".
			setStep(2);
			void runAccessRightsSeed();
		});
	}, [open, client.db_name]); // eslint-disable-line react-hooks/exhaustive-deps

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setChecking(false);
			setSeeding(false);
			setSeedingAccessRights(false);
			setStep(1);
			setAccessRightsAlreadyExisted(false);
		}
	}, [open]);

	async function handleApplyRoles() {
		if (!client.db_name) return;
		setSeeding(true);
		try {
			const result = await apolloClient.mutate({
				mutation: GRAPHQL_MAP.seedSecurityData,
				variables: {
					db_name: client.db_name,
					schema: "security",
					value: encodeURIComponent(JSON.stringify({ stage: "roles" })),
				},
			});
			if (result.error) {
				toast.error(MESSAGES.ERROR_SEED_ROLES_FAILED);
				return;
			}
			toast.success(MESSAGES.SUCCESS_SEED_ROLES);
			onSuccess();
			setStep(2);
			void runAccessRightsSeed();
		} catch {
			toast.error(MESSAGES.ERROR_SEED_ROLES_FAILED);
		} finally {
			setSeeding(false);
		}
	}

	const dot1Done = step === 2 || step === "success" || step === "error";
	const dot2Done = step === "success";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-[480px]">
				<DialogTitle className="sr-only">Seed Roles + Access Rights: {client.name}</DialogTitle>
				<DialogDescription className="sr-only">
					Seed default roles and access rights into the database for {client.name}.
				</DialogDescription>

				{/* Stepper header — hidden on success screen */}
				{step !== "success" && (
					<div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-5 sm:px-7">
						<p className="mb-4 text-sm font-semibold text-slate-300">
							Seed Roles + Access Rights:{" "}
							<span className="text-violet-400">{client.name}</span>
						</p>
						<div className="flex items-center gap-3">
							{/* Step 1 dot */}
							<div className="flex flex-col items-center gap-1">
								<div
									className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
										dot1Done ? "bg-emerald-500 text-white" : "bg-slate-600 text-slate-300"
									}`}
								>
									{dot1Done ? <CheckCircle2Icon className="h-3.5 w-3.5" /> : "1"}
								</div>
								<span className="text-[10px] text-slate-400">Roles</span>
							</div>
							{/* Connector 1→2 */}
							<div className={`h-0.5 flex-1 rounded ${dot1Done ? "bg-emerald-500" : "bg-slate-600"}`} />
							{/* Step 2 dot */}
							<div className="flex flex-col items-center gap-1">
								<div
									className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
										step === 2 || step === "error" || dot2Done
											? "bg-emerald-500 text-white"
											: "bg-slate-600 text-slate-300"
									}`}
								>
									{dot2Done ? <CheckCircle2Icon className="h-3.5 w-3.5" /> : "2"}
								</div>
								<span className="text-[10px] text-slate-400">Access Rights</span>
							</div>
						</div>
						{client.db_name && (
							<p className="mt-3 text-xs text-slate-500">{client.db_name}</p>
						)}
					</div>
				)}

				{/* Body */}
				<div className="p-5 sm:p-7">
					{checking && (
						<div className="flex flex-col items-center gap-3 py-8">
							<Loader2 className="h-7 w-7 animate-spin text-violet-500" />
							<p className="text-sm text-slate-500">Checking existing seed data…</p>
						</div>
					)}

					{/* ── Step 1: Roles ── */}
					{!checking && step === 1 && (
						<div className="flex flex-col gap-4">
							<div>
								<p className="mb-1 text-sm font-semibold text-slate-800">Default Roles</p>
								<p className="mb-3 text-xs text-slate-500">
									The following roles will be seeded into the client's database.
								</p>
								<div className="overflow-hidden rounded-lg border border-slate-200">
									{ROLE_PREVIEW_ITEMS.map((item, idx) => (
										<div
											key={item.code}
											className={`flex items-center justify-between px-3 py-2 text-sm ${
												idx !== 0 ? "border-t border-slate-100" : ""
											}`}
										>
											<span className="font-mono text-xs font-medium text-slate-700">{item.code}</span>
											<span className="text-xs text-slate-500">{item.name}</span>
										</div>
									))}
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
									Cancel
								</Button>
								<Button
									className="bg-violet-600 text-white hover:bg-violet-700"
									disabled={seeding}
									onClick={handleApplyRoles}
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

					{/* ── Step 2: Access Rights — automatic, non-interactive ── */}
					{!checking && step === 2 && (
						<div className="flex flex-col gap-4">
							<div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
								<Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-violet-600" />
								<p className="text-sm text-violet-700">
									{accessRightsAlreadyExisted
										? "Upgrading access rights…"
										: "Seeding access rights…"}
								</p>
							</div>
							<div>
								<p className="mb-1 text-sm font-semibold text-slate-800">Default Access Rights</p>
								<p className="mb-3 text-xs text-slate-500">
									The following access rights are being seeded, and granted to Manager and
									Receptionist (Technician gets none by default). The Masters Organization /
									Service Config rights go to Manager only. Existing rows are left
									untouched — only missing ones are added.
								</p>
								<div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
									{ACCESS_RIGHT_PREVIEW_ITEMS.map((item, idx) => (
										<div
											key={item.code}
											className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${
												idx !== 0 ? "border-t border-slate-100" : ""
											}`}
										>
											<span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
												{item.module}
											</span>
											<span className="text-right text-xs text-slate-500">{item.name}</span>
										</div>
									))}
								</div>
							</div>
						</div>
					)}

					{/* ── Error state — the one manual fallback, for a failed automatic seed ── */}
					{!checking && step === "error" && (
						<div className="flex flex-col gap-4">
							<div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
								<AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
								<p className="text-sm text-red-700">{MESSAGES.ERROR_SEED_ACCESS_RIGHTS_FAILED}</p>
							</div>
							<div className="flex justify-end gap-2">
								<Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
									Cancel
								</Button>
								<Button
									className="bg-violet-600 text-white hover:bg-violet-700"
									disabled={seedingAccessRights}
									onClick={() => void runAccessRightsSeed()}
									type="button"
								>
									{seedingAccessRights ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Retrying…
										</>
									) : (
										"Retry"
									)}
								</Button>
							</div>
						</div>
					)}

					{/* ── Success screen ── */}
					{!checking && step === "success" && (
						<div className="flex flex-col items-center py-6 text-center">
							<div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600">
								<PartyPopper className="h-8 w-8 text-white" />
							</div>
							<h3 className="mb-2 text-lg font-bold text-slate-800">
								{accessRightsAlreadyExisted ? "Access Rights Upgraded!" : "Access Rights Seeded!"}
							</h3>
							<p className="mb-6 text-sm text-slate-500">
								{accessRightsAlreadyExisted
									? "Access rights were already present and have been upgraded with any newly-added codes."
									: "Roles and access rights have both been seeded into this client's database."}
							</p>
							<Button
								className="bg-emerald-600 text-white hover:bg-emerald-700"
								onClick={() => onOpenChange(false)}
							>
								Close
							</Button>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
