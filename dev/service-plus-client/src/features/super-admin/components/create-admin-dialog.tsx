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

type CheckEmailQueryDataType = {
	genericQuery: { exists: boolean }[] | null;
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
	const [emailTaken, setEmailTaken] = useState<boolean | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const form = useForm<CreateAdminFormType>({
		defaultValues: { email: "", full_name: "", mobile: "" },
		mode: "onChange",
		resolver: zodResolver(createAdminSchema),
	});

	const { formState: { errors } } = form;

	const emailValue = useWatch({ control: form.control, name: "email" });
	const debouncedEmail = useDebounce(emailValue, 1200);

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
			.query<CheckEmailQueryDataType>({
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
			setEmailTaken(null);
			setSubmitting(false);
			form.reset({ email: "", full_name: "", mobile: "" });
		}
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onSubmit(data: CreateAdminFormType) {
		setSubmitting(true);
		try {
			const result = await apolloClient.mutate({
				mutation: GRAPHQL_MAP.createAdminUser,
				variables: {
					db_name: client.db_name,
					email: data.email,
					full_name: data.full_name,
					mobile: data.mobile || null,
				},
			});
			if (result.errors?.length) {
				toast.error(MESSAGES.ERROR_CREATE_ADMIN_FAILED);
				return;
			}
			toast.success(MESSAGES.SUCCESS_ADMIN_CREATED);
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
		Object.keys(errors).length > 0 ||
		emailTaken === true;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold text-slate-800">
						Create Admin User
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
									Creating...
								</>
							) : (
								"Create Admin"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
