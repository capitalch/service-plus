import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectBusinessUnits, selectRoles, setBusinessUnits, setRoles } from "@/features/admin/store/admin-slice";
import type { BranchType, BusinessUnitType, BusinessUserType, RoleType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type AssociateBuRoleDialogPropsType = {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
	user: BusinessUserType | null;
};

type GenericQueryDataType = {
	genericQuery: BranchType[] | BusinessUnitType[] | RoleType[] | null;
};

type BranchRestrictionRowType = { branch_id: number; bu_id: number };

const associateBuRoleSchema = z.object({
	role_id: z.string().min(1),
});
type AssociateBuRoleFormValues = z.infer<typeof associateBuRoleSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export const AssociateBuRoleDialog = ({ onOpenChange, onSuccess, open, user }: AssociateBuRoleDialogPropsType) => {
	const dispatch = useAppDispatch();
	const dbName = useAppSelector(selectDbName);
	const businessUnits = useAppSelector(selectBusinessUnits);
	const roles = useAppSelector(selectRoles);

	const form = useForm<AssociateBuRoleFormValues>({
		defaultValues: { role_id: "" },
		mode: "onChange",
		resolver: zodResolver(associateBuRoleSchema),
	});

	const [loadingData, setLoadingData] = useState(false);
	const [selectedBuIds, setSelectedBuIds] = useState<number[]>([]);
	const [branchesByBu, setBranchesByBu] = useState<Record<number, BranchType[]>>({});
	const [branchIdsByBu, setBranchIdsByBu] = useState<Record<number, number[]>>({});

	function loadBranchesForBu(bu: BusinessUnitType) {
		if (!dbName) return;
		apolloClient
			.query<GenericQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema: bu.code,
					value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_BU_BRANCHES }),
				},
			})
			.then(({ data }) => {
				setBranchesByBu((prev) => ({ ...prev, [bu.id]: (data?.genericQuery as BranchType[]) ?? [] }));
			})
			.catch(() => {
				setBranchesByBu((prev) => ({ ...prev, [bu.id]: [] }));
			});
	}

	// Load BUs and roles on open
	useEffect(() => {
		if (!open || !dbName || !user) return;

		const needsBus = businessUnits.length === 0;
		const needsRoles = roles.length === 0;

		function hydrateBranchRestrictions() {
			if (!user) return;
			apolloClient
				.query<{ genericQuery: BranchRestrictionRowType[] | null }>({
					fetchPolicy: "network-only",
					query: GRAPHQL_MAP.genericQuery,
					variables: {
						db_name: dbName,
						schema: "security",
						value: graphQlUtils.buildGenericQueryValue({
							sqlArgs: { user_id: user.id },
							sqlId: SQL_MAP.GET_USER_BRANCH_RESTRICTIONS,
						}),
					},
				})
				.then(({ data }) => {
					const rows = data?.genericQuery ?? [];
					const byBu: Record<number, number[]> = {};
					for (const row of rows) {
						byBu[row.bu_id] = [...(byBu[row.bu_id] ?? []), row.branch_id];
					}
					setBranchIdsByBu(byBu);
				})
				.catch(() => {});
		}

		if (!needsBus && !needsRoles) {
			// Pre-fill selections from user
			setSelectedBuIds(user.bu_ids ?? []);
			form.setValue("role_id", user.role_id ? String(user.role_id) : "", { shouldValidate: true });
			for (const bu of businessUnits) {
				if ((user.bu_ids ?? []).includes(bu.id)) loadBranchesForBu(bu);
			}
			hydrateBranchRestrictions();
			return;
		}

		setLoadingData(true);
		const promises: Promise<void>[] = [];
		let freshlyFetchedBus: BusinessUnitType[] | null = null;

		if (needsBus) {
			promises.push(
				apolloClient
					.query<GenericQueryDataType>({
						fetchPolicy: "network-only",
						query: GRAPHQL_MAP.genericQuery,
						variables: {
							db_name: dbName,
							schema: "security",
							value: graphQlUtils.buildGenericQueryValue({
								sqlId: SQL_MAP.GET_ALL_BUS,
							}),
						},
					})
					.then(({ data }) => {
						if (data?.genericQuery) {
							freshlyFetchedBus = data.genericQuery as BusinessUnitType[];
							dispatch(setBusinessUnits(freshlyFetchedBus));
						}
					})
					.catch(() => {}),
			);
		}

		if (needsRoles) {
			promises.push(
				apolloClient
					.query<GenericQueryDataType>({
						fetchPolicy: "network-only",
						query: GRAPHQL_MAP.genericQuery,
						variables: {
							db_name: dbName,
							schema: "security",
							value: graphQlUtils.buildGenericQueryValue({
								sqlId: SQL_MAP.GET_ALL_ROLES,
							}),
						},
					})
					.then(({ data }) => {
						if (data?.genericQuery) {
							dispatch(setRoles(data.genericQuery as RoleType[]));
						}
					})
					.catch(() => {}),
			);
		}

		Promise.all(promises).finally(() => {
			setLoadingData(false);
			setSelectedBuIds(user.bu_ids ?? []);
			form.setValue("role_id", user.role_id ? String(user.role_id) : "", { shouldValidate: true });
			// `businessUnits` from the store may still be the pre-dispatch closure
			// value here — use the rows this effect itself just fetched instead.
			for (const bu of freshlyFetchedBus ?? businessUnits) {
				if ((user.bu_ids ?? []).includes(bu.id)) loadBranchesForBu(bu);
			}
			hydrateBranchRestrictions();
		});
	}, [open, dbName]); // eslint-disable-line react-hooks/exhaustive-deps

	// Reset selections when dialog closes
	useEffect(() => {
		if (!open) {
			setSelectedBuIds([]);
			setBranchesByBu({});
			setBranchIdsByBu({});
			form.reset();
		}
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!user) return null;

	function handleBuToggle(bu: BusinessUnitType) {
		const nowSelected = !selectedBuIds.includes(bu.id);
		setSelectedBuIds((prev) => (prev.includes(bu.id) ? prev.filter((id) => id !== bu.id) : [...prev, bu.id]));
		if (!nowSelected) {
			setBranchIdsByBu((prev) => {
				const next = { ...prev };
				delete next[bu.id];
				return next;
			});
			return;
		}
		if (!branchesByBu[bu.id]) loadBranchesForBu(bu);
	}

	function handleBranchToggle(buId: number, branchId: number) {
		setBranchIdsByBu((prev) => {
			const current = prev[buId] ?? [];
			const next = current.includes(branchId) ? current.filter((id) => id !== branchId) : [...current, branchId];
			return { ...prev, [buId]: next };
		});
	}

	async function executeSave(values: AssociateBuRoleFormValues) {
		if (!user || !dbName) return;
		try {
			await apolloClient.mutate({
				mutation: GRAPHQL_MAP.setUserBuRole,
				variables: {
					db_name: dbName,
					schema: "security",
					value: encodeObj({
						branch_ids: Object.fromEntries(
							Object.entries(branchIdsByBu).filter(([, ids]) => ids.length > 0),
						),
						bu_ids: selectedBuIds,
						role_id: Number(values.role_id),
						user_id: user.id,
					}),
				},
			});
			toast.success(MESSAGES.SUCCESS_BU_ROLE_ASSOCIATED);
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_UNKNOWN);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Associate BU &amp; Role</DialogTitle>
					<DialogDescription>
						Assign business units and role for{" "}
						<span className="font-semibold text-slate-800">{user.full_name}</span>.
					</DialogDescription>
				</DialogHeader>

				{loadingData ? (
					<div className="flex items-center justify-center py-8">
						<Loader2Icon className="h-6 w-6 animate-spin text-slate-400" />
					</div>
				) : (
					<div className="flex flex-col gap-5">
						{/* Business Units */}
						<div className="flex flex-col gap-2">
							<Label className="text-sm font-medium text-slate-700">Business Units</Label>
							{businessUnits.length === 0 ? (
								<p className="text-xs text-slate-400">No business units available.</p>
							) : (
								<div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-slate-200 p-3">
									{businessUnits.map((bu) => (
										<div className="flex items-center gap-2" key={bu.id}>
											<Checkbox
												checked={selectedBuIds.includes(bu.id)}
												disabled={form.formState.isSubmitting || !bu.is_active}
												id={`bu-${bu.id}`}
												onCheckedChange={() => handleBuToggle(bu)}
											/>
											<label
												className={`cursor-pointer select-none text-sm ${!bu.is_active ? "text-slate-400 line-through" : "text-slate-700"}`}
												htmlFor={`bu-${bu.id}`}
											>
												{bu.name}
												<span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-500">
													{bu.code}
												</span>
											</label>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Branch restriction — only worth showing for a BU that actually has
						    more than one branch; a single-branch BU has nothing to restrict. */}
						{selectedBuIds.map((buId) => {
							const bu = businessUnits.find((b) => b.id === buId);
							const branches = branchesByBu[buId];
							if (!bu || !branches || branches.length <= 1) return null;
							return (
								<div className="flex flex-col gap-2" key={buId}>
									<Label className="text-sm font-medium text-slate-700">
										Branches for {bu.name} (optional — leave blank for all)
									</Label>
									<div className="flex max-h-32 flex-col gap-2 overflow-y-auto rounded-md border border-slate-200 p-3">
										{branches.map((branch) => (
											<div className="flex items-center gap-2" key={branch.id}>
												<Checkbox
													checked={(branchIdsByBu[buId] ?? []).includes(branch.id)}
													disabled={form.formState.isSubmitting}
													id={`assoc-branch-${buId}-${branch.id}`}
													onCheckedChange={() => handleBranchToggle(buId, branch.id)}
												/>
												<label
													className="cursor-pointer select-none text-sm text-slate-700"
													htmlFor={`assoc-branch-${buId}-${branch.id}`}
												>
													{branch.name}
												</label>
											</div>
										))}
									</div>
								</div>
							);
						})}

						{/* Role */}
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="role_select">
								Role{selectedBuIds.length > 0 && <span className="text-red-500"> *</span>}
							</Label>
							<Select
								disabled={form.formState.isSubmitting}
								value={form.watch("role_id")}
								onValueChange={(v) => form.setValue("role_id", v, { shouldValidate: true })}
							>
								<SelectTrigger id="role_select">
									<SelectValue placeholder="Select a role" />
								</SelectTrigger>
								<SelectContent>
									{roles.map((role) => (
										<SelectItem key={role.id} value={String(role.id)}>
											{role.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{selectedBuIds.length > 0 && !form.watch("role_id") && (
								<p className="text-xs text-red-500">Role is required when BUs are selected.</p>
							)}
						</div>
					</div>
				)}

				<DialogFooter>
					<Button
						disabled={form.formState.isSubmitting}
						type="button"
						variant="ghost"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
						disabled={
							!form.formState.isValid ||
							selectedBuIds.length === 0 ||
							form.formState.isSubmitting ||
							loadingData
						}
						type="button"
						onClick={() => void form.handleSubmit(executeSave)()}
					>
						{form.formState.isSubmitting ? (
							<>
								<Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
								Saving...
							</>
						) : (
							"Save"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
