import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { FIELD_VALIDATION_DEBOUNCE_MS } from "@/constants/timing";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { MOBILE_REGEX, normalizeMobile } from "@/lib/mobile";
import { selectCurrentBu, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { StaffRoleType } from "./staff-user";
import { useIsReadOnly } from "@/components/shared/billing/use-is-read-only";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddStaffUserDialogPropsType = {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

type CheckQueryDataType = { genericQuery: { exists: boolean }[] | null };

type CreateMutationDataType = { createBusinessUser: { email_sent: boolean; id: number } };

type FormType = z.infer<typeof schema>;

type RolesQueryDataType = { genericQuery: StaffRoleType[] | null };

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
	return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// The server's own refusal text (plan too low, duplicate mobile, …) beats a generic failure line.
function serverMessage(err: unknown): string {
	const e = err as { graphQLErrors?: { message?: string }[]; message?: string };
	return e.graphQLErrors?.[0]?.message || MESSAGES.ERROR_BUSINESS_USER_CREATE_FAILED;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddStaffUserDialog = ({ onOpenChange, onSuccess, open }: AddStaffUserDialogPropsType) => {
	const isReadOnly = useIsReadOnly();
	const currentBu = useAppSelector(selectCurrentBu);
	const dbName = useAppSelector(selectDbName);
	const buSchema = useAppSelector(selectSchema);

	const [checkingEmail, setCheckingEmail] = useState(false);
	const [checkingUsername, setCheckingUsername] = useState(false);
	const [emailTaken, setEmailTaken] = useState<boolean | null>(null);
	const [roleId, setRoleId] = useState("");
	const [roles, setRoles] = useState<StaffRoleType[]>([]);
	const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);

	const form = useForm<FormType>({
		defaultValues: { email: "", full_name: "", mobile: "", username: "" },
		mode: "onChange",
		resolver: zodResolver(schema),
	});
	const {
		formState: { errors },
	} = form;

	const emailValue = useWatch({ control: form.control, name: "email" });
	const usernameValue = useWatch({ control: form.control, name: "username" });
	const debouncedEmail = useDebounce(emailValue, FIELD_VALIDATION_DEBOUNCE_MS);
	const debouncedUsername = useDebounce(usernameValue, FIELD_VALIDATION_DEBOUNCE_MS);

	// The two roles a Manager may assign.
	useEffect(() => {
		if (!open || !dbName || !buSchema) return;
		apolloClient
			.query<RolesQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema: buSchema,
					value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STAFF_ROLES }),
				},
			})
			.then((res) => setRoles(res.data?.genericQuery ?? []))
			.catch(() => toast.error(MESSAGES.ERROR_BUSINESS_USER_LOAD_FAILED));
	}, [buSchema, dbName, open]);

	useEffect(() => {
		setEmailTaken(null);
	}, [emailValue]);

	useEffect(() => {
		setUsernameTaken(null);
	}, [usernameValue]);

	// Debounced uniqueness checks. The server re-checks on save; these show the problem early.
	useEffect(() => {
		if (!debouncedEmail || !dbName || !buSchema || form.getFieldState("email").invalid) return;
		setCheckingEmail(true);
		apolloClient
			.query<CheckQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema: buSchema,
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { email: debouncedEmail },
						sqlId: SQL_MAP.CHECK_BUSINESS_USER_EMAIL_EXISTS,
					}),
				},
			})
			.then((res) => {
				const exists = res.data?.genericQuery?.[0]?.exists ?? false;
				setEmailTaken(exists);
				if (exists)
					form.setError("email", { message: MESSAGES.ERROR_BUSINESS_USER_EMAIL_EXISTS, type: "manual" });
				else form.clearErrors("email");
			})
			.catch(() => setEmailTaken(null))
			.finally(() => setCheckingEmail(false));
	}, [debouncedEmail]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!debouncedUsername || !dbName || !buSchema || form.getFieldState("username").invalid) return;
		setCheckingUsername(true);
		apolloClient
			.query<CheckQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema: buSchema,
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { username: debouncedUsername },
						sqlId: SQL_MAP.CHECK_BUSINESS_USER_USERNAME_EXISTS,
					}),
				},
			})
			.then((res) => {
				const exists = res.data?.genericQuery?.[0]?.exists ?? false;
				setUsernameTaken(exists);
				if (exists)
					form.setError("username", {
						message: MESSAGES.ERROR_BUSINESS_USER_USERNAME_EXISTS,
						type: "manual",
					});
				else form.clearErrors("username");
			})
			.catch(() => setUsernameTaken(null))
			.finally(() => setCheckingUsername(false));
	}, [debouncedUsername]); // eslint-disable-line react-hooks/exhaustive-deps

	// Reset on close
	useEffect(() => {
		if (open) return;
		setCheckingEmail(false);
		setCheckingUsername(false);
		setEmailTaken(null);
		setRoleId("");
		setUsernameTaken(null);
		form.reset({ email: "", full_name: "", mobile: "", username: "" });
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onSubmit(data: FormType) {
		if (!dbName || !currentBu || !roleId) return;
		try {
			const res = await apolloClient.mutate<CreateMutationDataType>({
				mutation: GRAPHQL_MAP.createBusinessUser,
				variables: {
					db_name: dbName,
					schema: "security",
					value: encodeObj({
						bu_ids: [currentBu.id],
						email: data.email,
						full_name: data.full_name,
						mobile: data.mobile || null,
						role_id: Number(roleId),
						username: data.username,
					}),
				},
			});
			if (!res.data?.createBusinessUser?.id) {
				toast.error(MESSAGES.ERROR_BUSINESS_USER_CREATE_FAILED);
				return;
			}
			if (res.data.createBusinessUser.email_sent) toast.success(MESSAGES.SUCCESS_BUSINESS_USER_CREATED);
			else toast.warning(MESSAGES.WARN_BUSINESS_USER_EMAIL_NOT_SENT);
			onSuccess();
			onOpenChange(false);
		} catch (err) {
			toast.error(serverMessage(err));
		}
	}

	const submitDisabled =
		form.formState.isSubmitting ||
		checkingEmail ||
		checkingUsername ||
		Object.keys(errors).length > 0 ||
		emailTaken !== false ||
		usernameTaken !== false ||
		!roleId;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold text-foreground">Add User</DialogTitle>
					<DialogDescription className="text-xs text-slate-500">
						{currentBu ? `For ${currentBu.name}.` : ""} A password setup link is emailed to the user.
					</DialogDescription>
				</DialogHeader>

				<form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="su_full_name">
							Full Name <span className="text-red-500">*</span>
						</Label>
						<Input
							autoComplete="off"
							id="su_full_name"
							placeholder="e.g. John Smith"
							{...form.register("full_name")}
						/>
						<FieldError message={errors.full_name?.message} />
					</div>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="su_username">
							Username <span className="text-red-500">*</span>
						</Label>
						<div className="relative">
							<Input
								autoComplete="off"
								className="pr-8"
								id="su_username"
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

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="su_email">
							Email <span className="text-red-500">*</span>
						</Label>
						<div className="relative">
							<Input
								autoComplete="off"
								className="pr-8"
								id="su_email"
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
						<Label htmlFor="su_mobile">Mobile</Label>
						<Input
							autoComplete="off"
							id="su_mobile"
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

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="su_role">
							Role <span className="text-red-500">*</span>
						</Label>
						<Select value={roleId} onValueChange={setRoleId}>
							<SelectTrigger id="su_role">
								<SelectValue placeholder="Select a role" />
							</SelectTrigger>
							<SelectContent>
								{roles.map((r) => (
									<SelectItem key={r.id} value={String(r.id)}>
										{r.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

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
							disabled={isReadOnly || submitDisabled}
							type="submit"
						>
							{form.formState.isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
							Add User
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
