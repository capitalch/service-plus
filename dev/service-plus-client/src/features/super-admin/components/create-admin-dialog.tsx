import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import type { ClientType } from "@/features/super-admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckQueryDataType = {
	genericQuery: { exists: boolean }[] | null;
};

type CreateAdminResultType = {
	createAdminUser: { email_sent: boolean; id: number };
};

type CreateAdminDialogPropsType = {
	client: ClientType;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

type CreateAdminFormType = z.infer<typeof createAdminSchema>;

// ─── Schema ───────────────────────────────────────────────────────────────────

const createAdminSchema = z.object({
	email: z.string().email({ message: MESSAGES.ERROR_EMAIL_INVALID }),
	full_name: z.string().min(1, MESSAGES.ERROR_FULL_NAME_REQUIRED),
	mobile: z.string().optional(),
	username: z
		.string()
		.min(1, MESSAGES.ERROR_ADMIN_USERNAME_REQUIRED)
		.min(5, MESSAGES.ERROR_USERNAME_MIN_LENGTH)
		.regex(/^[a-zA-Z0-9]+$/, MESSAGES.ERROR_USERNAME_INVALID_FORMAT),
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

export const CreateAdminDialog = ({
	client,
	onOpenChange,
	onSuccess,
	open,
}: CreateAdminDialogPropsType) => {
	const [checkingEmail, setCheckingEmail] = useState(false);
	const [checkingUsername, setCheckingUsername] = useState(false);
	const [emailTaken, setEmailTaken] = useState<boolean | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);

	const form = useForm<CreateAdminFormType>({
		defaultValues: { email: "", full_name: "", mobile: "", username: "" },
		mode: "onChange",
		resolver: zodResolver(createAdminSchema),
	});

	const { formState: { errors } } = form;

	const emailValue = useWatch({ control: form.control, name: "email" });
	const usernameValue = useWatch({ control: form.control, name: "username" });
	const debouncedEmail = useDebounce(emailValue, 1200);
	const debouncedUsername = useDebounce(usernameValue, 1200);

	// Debounced username uniqueness check
	useEffect(() => {
		if (!debouncedUsername) {
			setUsernameTaken(null);
			return;
		}
		const { invalid } = form.getFieldState("username");
		if (invalid) {
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
					db_name: client.db_name,
					schema: "security",
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { username: debouncedUsername },
						sqlId: SQL_MAP.CHECK_ADMIN_USERNAME_EXISTS,
					}),
				},
			})
			.then((res) => {
				const exists = res.data?.genericQuery?.[0]?.exists ?? false;
				setUsernameTaken(exists);
				if (exists) {
					form.setError("username", {
						message: MESSAGES.ERROR_ADMIN_USERNAME_EXISTS,
						type: "manual",
					});
				} else {
					form.clearErrors("username");
				}
			})
			.catch(() => {
				setUsernameTaken(null);
			})
			.finally(() => {
				setCheckingUsername(false);
			});
	}, [debouncedUsername]); // eslint-disable-line react-hooks/exhaustive-deps

	// Debounced email uniqueness check
	useEffect(() => {
		if (!debouncedEmail) {
			setEmailTaken(null);
			return;
		}
		const { invalid } = form.getFieldState("email");
		if (invalid) {
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
					db_name: client.db_name,
					schema: "security",
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { email: debouncedEmail },
						sqlId: SQL_MAP.CHECK_ADMIN_EMAIL_EXISTS,
					}),
				},
			})
			.then((res) => {
				const exists = res.data?.genericQuery?.[0]?.exists ?? false;
				setEmailTaken(exists);
				if (exists) {
					form.setError("email", {
						message: MESSAGES.ERROR_ADMIN_EMAIL_EXISTS,
						type: "manual",
					});
				} else {
					form.clearErrors("email");
				}
			})
			.catch(() => {
				setEmailTaken(null);
			})
			.finally(() => {
				setCheckingEmail(false);
			});
	}, [debouncedEmail]); // eslint-disable-line react-hooks/exhaustive-deps

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setCheckingEmail(false);
			setCheckingUsername(false);
			setEmailTaken(null);
			setSubmitting(false);
			setUsernameTaken(null);
			form.reset({ email: "", full_name: "", mobile: "", username: "" });
		}
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onSubmit(data: CreateAdminFormType) {
		setSubmitting(true);
		try {
			const result = await apolloClient.mutate<CreateAdminResultType>({
				mutation: GRAPHQL_MAP.createAdminUser,
				variables: {
					db_name: client.db_name,
					schema: "security",
					value: encodeURIComponent(JSON.stringify({
						client_id: client.id,
						email: data.email,
						full_name: data.full_name,
						mobile: data.mobile || null,
						username: data.username,
					})),
				},
			});
			if (result.error) {
				toast.error(MESSAGES.ERROR_CREATE_ADMIN_FAILED);
				return;
			}
			const emailSent = result.data?.createAdminUser?.email_sent ?? false;
			if (emailSent) {
				toast.success(MESSAGES.SUCCESS_ADMIN_CREATED);
			} else {
				toast.warning(MESSAGES.WARN_ADMIN_EMAIL_NOT_SENT);
			}
			onSuccess();
			onOpenChange(false);
		} catch {
			toast.error(MESSAGES.ERROR_CREATE_ADMIN_FAILED);
		} finally {
			setSubmitting(false);
		}
	}

	const submitDisabled =
		submitting ||
		checkingEmail ||
		checkingUsername ||
		Object.keys(errors).length > 0 ||
		emailTaken === true ||
		usernameTaken === true;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold text-foreground">
						Add Admin User
					</DialogTitle>
					<DialogDescription className="text-xs text-slate-500">
						New admin for{" "}
						<span className="font-medium text-slate-700">{client.name}</span>
						{" "}·{" "}
						<span className="font-mono text-slate-500">{client.db_name}</span>
					</DialogDescription>
				</DialogHeader>

				<form
					className="flex flex-col gap-4 pt-1"
					onSubmit={form.handleSubmit(onSubmit)}
				>
					{/* Full Name */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="full_name">
							Full Name <span className="text-red-500">*</span>
						</Label>
						<Input
							id="full_name"
							placeholder="e.g. John Smith"
							{...form.register("full_name")}
							disabled={submitting}
						/>
						<FieldError message={errors.full_name?.message} />
					</div>

					{/* Username */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="username">
							Username <span className="text-red-500">*</span>
						</Label>
						<div className="relative">
							<Input
								id="username"
								placeholder="e.g. johnsmith"
								{...form.register("username")}
								className="pr-8"
								disabled={submitting}
							/>
							{checkingUsername && (
								<Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
							)}
							{!checkingUsername && usernameTaken === false && !errors.username && (
								<Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
							)}
						</div>
						<FieldError message={errors.username?.message} />
					</div>

					{/* Email */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="email">
							Email <span className="text-red-500">*</span>
						</Label>
						<div className="relative">
							<Input
								id="email"
								placeholder="admin@example.com"
								type="email"
								{...form.register("email")}
								className="pr-8"
								disabled={submitting}
							/>
							{checkingEmail && (
								<Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
							)}
							{!checkingEmail && emailTaken === false && !errors.email && (
								<Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
							)}
						</div>
						<FieldError message={errors.email?.message} />
					</div>

					{/* Mobile */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="mobile">Mobile</Label>
						<Input
							id="mobile"
							placeholder="+91 98765 43210"
							type="tel"
							{...form.register("mobile")}
							disabled={submitting}
						/>
					</div>

					<DialogFooter className="pt-2">
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							className="bg-emerald-600 text-white hover:bg-emerald-700"
							disabled={submitDisabled}
							type="submit"
						>
							{submitting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Adding...
								</>
							) : (
								"Add Admin"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
