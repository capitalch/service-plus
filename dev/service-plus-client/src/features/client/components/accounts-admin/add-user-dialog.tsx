import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { FIELD_VALIDATION_DEBOUNCE_MS } from "@/constants/timing";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { MOBILE_REGEX, normalizeMobile } from "@/lib/mobile";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import type { BranchType, RoleType } from "@/features/admin/types/index";
import { useAppSelector } from "@/store/hooks";

// This dialog exists only because the Manager themself holds USERS_MANAGE_OWN_BU
// (see client-explorer-panel.tsx's AdminExplorer) — the server enforces the same
// "own BU, never role Manager" rule independently either way (users_roles.py).

// ─── Types ────────────────────────────────────────────────────────────────────

type AddUserDialogPropsType = {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

type AddUserFormType = z.infer<typeof addUserSchema>;

type CheckQueryDataType = {
	genericQuery: { exists: boolean }[] | null;
};

type CreateBusinessUserMutationDataType = {
	createBusinessUser: { email_sent: boolean; id: number };
};

type GenericQueryDataType = {
	genericQuery: BranchType[] | RoleType[] | null;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const addUserSchema = z.object({
	email: z.string().email({ message: MESSAGES.ERROR_EMAIL_INVALID }),
	full_name: z.string().min(2, MESSAGES.ERROR_FULL_NAME_REQUIRED),
	mobile: z
		.string()
		.transform((val) => normalizeMobile(val))
		.refine((val) => val === "" || MOBILE_REGEX.test(val), { message: MESSAGES.ERROR_MOBILE_INVALID })
		.optional(),
	username: z
		.string()
		.min(1, MESSAGES.ERROR_ADMIN_USERNAME_REQUIRED)
		.min(5, MESSAGES.ERROR_USERNAME_MIN_LENGTH)
		.regex(/^[a-zA-Z0-9]+$/, MESSAGES.ERROR_USERNAME_INVALID_FORMAT),
});

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
	return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddUserDialog = ({ onOpenChange, onSuccess, open }: AddUserDialogPropsType) => {
	const currentUser = useAppSelector(selectCurrentUser);
	const dbName = useAppSelector(selectDbName);
	// availableBus already IS "every BU this user is listed against" — for a Manager
	// that's exactly their own managed BU(s), since role is applied uniformly across
	// every BU picked when the Manager themself was created/edited.
	const myBuIds = currentUser?.availableBus ?? [];

	const [roles, setRoles] = useState<RoleType[]>([]);
	const [branchesByBu, setBranchesByBu] = useState<Record<number, BranchType[]>>({});
	const [branchIdsByBu, setBranchIdsByBu] = useState<Record<number, number[]>>({});
	const [checkingEmail, setCheckingEmail] = useState(false);
	const [checkingUsername, setCheckingUsername] = useState(false);
	const [emailTaken, setEmailTaken] = useState<boolean | null>(null);
	const [loadingRoles, setLoadingRoles] = useState(false);
	const [roleError, setRoleError] = useState<string>("");
	const [selectedRoleId, setSelectedRoleId] = useState<string>("");
	const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);

	const form = useForm<AddUserFormType>({
		defaultValues: { email: "", full_name: "", mobile: "", username: "" },
		mode: "onChange",
		resolver: zodResolver(addUserSchema),
	});
	const {
		formState: { errors },
	} = form;

	const emailValue = useWatch({ control: form.control, name: "email" });
	const usernameValue = useWatch({ control: form.control, name: "username" });
	const debouncedEmail = useDebounce(emailValue, FIELD_VALIDATION_DEBOUNCE_MS);
	const debouncedUsername = useDebounce(usernameValue, FIELD_VALIDATION_DEBOUNCE_MS);

	// Roles, excluding Manager — a Manager can create anyone except another Manager.
	useEffect(() => {
		if (!open || !dbName) return;
		setLoadingRoles(true);
		apolloClient
			.query<GenericQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema: "security",
					value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_ROLES }),
				},
			})
			.then(({ data }) => {
				const all = (data?.genericQuery as RoleType[] | null) ?? [];
				setRoles(all.filter((role) => role.code !== "MANAGER"));
			})
			.catch(() => {})
			.finally(() => setLoadingRoles(false));
	}, [open, dbName]); // eslint-disable-line react-hooks/exhaustive-deps

	// Branches for each of my own BUs — the picker only shows for a BU with more
	// than one, same rule as the Admin-side dialogs.
	useEffect(() => {
		if (!open || !dbName) return;
		for (const bu of myBuIds) {
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
				.catch(() => {});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, dbName]);

	// Reset on close
	useEffect(() => {
		if (open) return;
		setBranchesByBu({});
		setBranchIdsByBu({});
		setCheckingEmail(false);
		setCheckingUsername(false);
		setEmailTaken(null);
		setRoleError("");
		setRoles([]);
		setSelectedRoleId("");
		setUsernameTaken(null);
		form.reset({ email: "", full_name: "", mobile: "", username: "" });
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		setEmailTaken(null);
	}, [emailValue]);

	useEffect(() => {
		if (!debouncedEmail || !dbName) {
			setEmailTaken(null);
			return;
		}
		if (form.getFieldState("email").invalid) {
			setEmailTaken(null);
			return;
		}
		setCheckingEmail(true);
		setEmailTaken(null);
		apolloClient
			.query<CheckQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema: "security",
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { email: debouncedEmail },
						sqlId: SQL_MAP.CHECK_BUSINESS_USER_EMAIL_EXISTS,
					}),
				},
			})
			.then((res) => {
				const exists = res.data?.genericQuery?.[0]?.exists ?? false;
				setEmailTaken(exists);
				if (exists) {
					form.setError("email", { message: MESSAGES.ERROR_BUSINESS_USER_EMAIL_EXISTS, type: "manual" });
				} else {
					form.clearErrors("email");
				}
			})
			.catch(() => setEmailTaken(null))
			.finally(() => setCheckingEmail(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [debouncedEmail]);

	useEffect(() => {
		if (!debouncedUsername || !dbName) {
			setUsernameTaken(null);
			return;
		}
		if (form.getFieldState("username").invalid) {
			setUsernameTaken(null);
			return;
		}
		setCheckingUsername(true);
		setUsernameTaken(null);
		apolloClient
			.query<CheckQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema: "security",
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { username: debouncedUsername },
						sqlId: SQL_MAP.CHECK_BUSINESS_USER_USERNAME_EXISTS,
					}),
				},
			})
			.then((res) => {
				const exists = res.data?.genericQuery?.[0]?.exists ?? false;
				setUsernameTaken(exists);
				if (exists) {
					form.setError("username", {
						message: MESSAGES.ERROR_BUSINESS_USER_USERNAME_EXISTS,
						type: "manual",
					});
				} else {
					form.clearErrors("username");
				}
			})
			.catch(() => setUsernameTaken(null))
			.finally(() => setCheckingUsername(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [debouncedUsername]);

	function handleBranchToggle(buId: number, branchId: number) {
		setBranchIdsByBu((prev) => {
			const current = prev[buId] ?? [];
			const next = current.includes(branchId) ? current.filter((id) => id !== branchId) : [...current, branchId];
			return { ...prev, [buId]: next };
		});
	}

	async function onSubmit(data: AddUserFormType) {
		if (!dbName || myBuIds.length === 0) return;
		if (!selectedRoleId) {
			setRoleError(MESSAGES.ERROR_BUSINESS_USER_ROLE_REQUIRED);
			return;
		}
		try {
			const result = await apolloClient.mutate<CreateBusinessUserMutationDataType>({
				mutation: GRAPHQL_MAP.createBusinessUser,
				variables: {
					db_name: dbName,
					schema: "security",
					value: encodeObj({
						branch_ids: Object.fromEntries(
							Object.entries(branchIdsByBu).filter(([, ids]) => ids.length > 0),
						),
						bu_ids: myBuIds.map((bu) => bu.id),
						email: data.email,
						full_name: data.full_name,
						mobile: data.mobile || null,
						role_id: Number(selectedRoleId),
						username: data.username,
					}),
				},
			});

			if (result.error || !result.data?.createBusinessUser?.id) {
				toast.error(MESSAGES.ERROR_BUSINESS_USER_CREATE_FAILED);
				return;
			}
			if (!result.data.createBusinessUser.email_sent) {
				toast.warning(MESSAGES.WARN_BUSINESS_USER_EMAIL_NOT_SENT);
			} else {
				toast.success(MESSAGES.SUCCESS_BUSINESS_USER_CREATED);
			}
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_BUSINESS_USER_CREATE_FAILED);
		}
	}

	const submitDisabled =
		form.formState.isSubmitting ||
		loadingRoles ||
		checkingEmail ||
		checkingUsername ||
		Object.keys(errors).length > 0 ||
		emailTaken !== false ||
		usernameTaken === true ||
		!selectedRoleId ||
		myBuIds.length === 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				className="sm:max-w-lg"
				onInteractOutside={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="text-base font-semibold text-foreground">Add User</DialogTitle>
				</DialogHeader>

				{myBuIds.length === 0 ? (
					<p className="text-sm text-(--cl-text-muted)">No business unit found for your account.</p>
				) : (
					<form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
						<div className="grid grid-cols-2 gap-4">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="us-full-name">
									Full Name <span className="text-red-500">*</span>
								</Label>
								<Input
									autoComplete="off"
									disabled={form.formState.isSubmitting}
									id="us-full-name"
									placeholder="e.g. John Smith"
									{...form.register("full_name")}
								/>
								<FieldError message={errors.full_name?.message} />
							</div>

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="us-username">
									Username <span className="text-red-500">*</span>
								</Label>
								<div className="relative">
									<Input
										autoComplete="off"
										className="pr-8"
										disabled={form.formState.isSubmitting}
										id="us-username"
										placeholder="e.g. johnsmith"
										{...form.register("username")}
									/>
									{checkingUsername && (
										<Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
									)}
									{!checkingUsername && usernameTaken === false && !errors.username && (
										<Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
									)}
								</div>
								<FieldError message={errors.username?.message} />
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="us-email">
									Email <span className="text-red-500">*</span>
								</Label>
								<div className="relative">
									<Input
										autoComplete="off"
										className="pr-8"
										disabled={form.formState.isSubmitting}
										id="us-email"
										placeholder="user@example.com"
										type="email"
										{...form.register("email")}
									/>
									{checkingEmail && (
										<Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
									)}
									{!checkingEmail && emailTaken === false && !errors.email && (
										<Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
									)}
								</div>
								<FieldError message={errors.email?.message} />
							</div>

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="us-mobile">Mobile</Label>
								<Input
									autoComplete="off"
									disabled={form.formState.isSubmitting}
									id="us-mobile"
									inputMode="numeric"
									maxLength={15}
									placeholder="+91 98765 43210"
									type="tel"
									{...form.register("mobile", {
										onChange: (e) => {
											const digits = normalizeMobile(e.target.value).slice(0, 10);
											form.setValue("mobile", digits, { shouldValidate: true });
										},
									})}
								/>
								<FieldError message={errors.mobile?.message} />
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label>Business Unit</Label>
							<p className="text-sm text-(--cl-text-muted)">{myBuIds.map((bu) => bu.name).join(", ")}</p>
						</div>

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="us-role">
								Role <span className="text-red-500">*</span>
							</Label>
							<Select
								disabled={form.formState.isSubmitting || loadingRoles}
								value={selectedRoleId}
								onValueChange={(v) => {
									setSelectedRoleId(v);
									setRoleError("");
								}}
							>
								<SelectTrigger id="us-role">
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
							<FieldError message={roleError} />
						</div>

						{myBuIds.map((bu) => {
							const branches = branchesByBu[bu.id];
							if (!branches || branches.length <= 1) return null;
							return (
								<div className="flex flex-col gap-2" key={bu.id}>
									<Label>Branches for {bu.name} (optional — leave blank for all)</Label>
									<div className="flex max-h-32 flex-col gap-2 overflow-y-auto rounded-md border border-(--cl-border) p-3">
										{branches.map((branch) => (
											<div className="flex items-center gap-2" key={branch.id}>
												<Checkbox
													checked={(branchIdsByBu[bu.id] ?? []).includes(branch.id)}
													disabled={form.formState.isSubmitting}
													id={`us-branch-${bu.id}-${branch.id}`}
													onCheckedChange={() => handleBranchToggle(bu.id, branch.id)}
												/>
												<label
													className="cursor-pointer select-none text-sm text-(--cl-text)"
													htmlFor={`us-branch-${bu.id}-${branch.id}`}
												>
													{branch.name}
												</label>
											</div>
										))}
									</div>
								</div>
							);
						})}

						<DialogFooter className="pt-2">
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
								disabled={submitDisabled}
								type="submit"
							>
								{form.formState.isSubmitting ? (
									<Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
								) : null}
								Add User
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
};
