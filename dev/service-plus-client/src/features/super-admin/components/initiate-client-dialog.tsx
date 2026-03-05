import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@apollo/client/react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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

type CheckDbQueryDataType = {
	genericQuery: { exists: boolean }[] | null;
};

type InitiateClientDialogPropsType = {
	client: ClientType;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

type StepType = 1 | 2 | "success";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const step1Schema = z.object({
	db_name: z
		.string()
		.min(1, MESSAGES.ERROR_DB_NAME_REQUIRED)
		.regex(/^service_plus_[a-z0-9_]+$/, "Invalid format: must be service_plus_<code>"),
});

const step2Schema = z.object({
	email: z.email({ message: MESSAGES.ERROR_EMAIL_INVALID }),
	full_name: z.string().min(1, MESSAGES.ERROR_FULL_NAME_REQUIRED),
	mobile: z.string().optional(),
	password: z.string().min(6, "Password must be at least 6 characters"),
	username: z
		.string()
		.min(3, "Username must be at least 3 characters")
		.regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
});

type Step1FormType = z.infer<typeof step1Schema>;
type Step2FormType = z.infer<typeof step2Schema>;

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

export const InitiateClientDialog = ({
	client,
	onOpenChange,
	onSuccess,
	open,
}: InitiateClientDialogPropsType) => {
	const [checkingDb, setCheckingDb] = useState(false);
	const [createdDbName, setCreatedDbName] = useState("");
	const [dbNameAvailable, setDbNameAvailable] = useState<boolean | null>(null);
	const [step, setStep] = useState<StepType>(client?.db_name ? 2 : 1);

	const step1Form = useForm<Step1FormType>({
		defaultValues: { db_name: `service_plus_${client.code.toLowerCase()}` },
		mode: "onChange",
		resolver: zodResolver(step1Schema),
	});

	const step2Form = useForm<Step2FormType>({
		defaultValues: { email: "", full_name: "", mobile: "", password: "", username: "" },
		mode: "onChange",
		resolver: zodResolver(step2Schema),
	});

	const [createServiceDb, { loading: creatingDb }] = useMutation(GRAPHQL_MAP.createServiceDb);
	const [createAdminUser, { loading: creatingAdmin }] = useMutation(GRAPHQL_MAP.createAdminUser);

	const dbNameValue = useWatch({ control: step1Form.control, name: "db_name" });
	const emailValue = useWatch({ control: step2Form.control, name: "email" });
	const debouncedDbName = useDebounce(dbNameValue, 1200);

	const isUsernameDirty = !!step2Form.formState.dirtyFields.username;

	// Auto-derive username from email local part unless user has manually edited it
	useEffect(() => {
		if (!emailValue || isUsernameDirty) return;
		const localPart = emailValue.split("@")[0] ?? "";
		step2Form.setValue("username", localPart, { shouldDirty: false, shouldValidate: true });
	}, [emailValue]); // eslint-disable-line react-hooks/exhaustive-deps

	// Debounced DB name uniqueness check
	useEffect(() => {
		if (!debouncedDbName) return;
		const { invalid } = step1Form.getFieldState("db_name");
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
					step1Form.setError("db_name", {
						message: MESSAGES.ERROR_DB_NAME_EXISTS,
						type: "manual",
					});
				} else {
					step1Form.clearErrors("db_name");
				}
			})
			.finally(() => {
				setCheckingDb(false);
			});
	}, [debouncedDbName]); // eslint-disable-line react-hooks/exhaustive-deps

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setCheckingDb(false);
			setCreatedDbName("");
			setDbNameAvailable(null);
			setStep(client?.db_name ? 2 : 1);
			step1Form.reset({ db_name: `service_plus_${client.code.toLowerCase()}` });
			step2Form.reset({ email: "", full_name: "", mobile: "", password: "", username: "" });
		}
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onStep1Submit(data: Step1FormType) {
		try {
			const result = await createServiceDb({
				variables: { client_id: client.id, db_name: data.db_name },
			});
			if (result.errors?.length) {
				toast.error(MESSAGES.ERROR_INITIATE_DB_FAILED);
				return;
			}
			setCreatedDbName(data.db_name);
			setStep(2);
			toast.success(MESSAGES.SUCCESS_INITIATE_DB);
		} catch {
			toast.error(MESSAGES.ERROR_INITIATE_DB_FAILED);
		}
	}

	async function onStep2Submit(data: Step2FormType) {
		const activeDb = createdDbName || client.db_name || "";
		try {
			const result = await createAdminUser({
				variables: {
					db_name: activeDb,
					email: data.email,
					full_name: data.full_name,
					mobile: data.mobile || null,
					password: data.password,
					username: data.username,
				},
			});
			if (result.errors?.length) {
				toast.error(MESSAGES.ERROR_INITIATE_ADMIN_FAILED);
				return;
			}
			setStep("success");
			toast.success(MESSAGES.SUCCESS_INITIATE_ADMIN);
		} catch {
			toast.error(MESSAGES.ERROR_INITIATE_ADMIN_FAILED);
		}
	}

	const step1Errors = step1Form.formState.errors;
	const step2Errors = step2Form.formState.errors;

	const step1Busy = checkingDb || creatingDb;
	const step1SubmitDisabled =
		step1Busy || !dbNameAvailable || !!step1Errors.db_name;

	const step2Busy = creatingAdmin;
	const step2SubmitDisabled = step2Busy || Object.keys(step2Errors).length > 0;

	const dot1Done = step === 2 || step === "success";
	const dot2Active = step === 2;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-[480px]">
				<DialogTitle className="sr-only">Initiate Client: {client.name}</DialogTitle>
				<DialogDescription className="sr-only">
					Set up the database and admin user for {client.name}.
				</DialogDescription>
				{/* Stepper header – hidden on success screen */}
				{step !== "success" && (
					<div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-5 sm:px-7">
						<p className="mb-4 text-sm font-semibold text-slate-300">
							Initiate Client:{" "}
							<span className="text-emerald-400">{client.name}</span>
						</p>
						<div className="flex items-center gap-3">
							{/* Step 1 dot */}
							<div className="flex flex-col items-center gap-1">
								<div
									className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
										dot1Done
											? "bg-emerald-500 text-white"
											: "bg-slate-600 text-slate-300"
									}`}
								>
									{dot1Done ? <Check className="h-3.5 w-3.5" /> : "1"}
								</div>
								<span className="text-[10px] text-slate-400">Database</span>
							</div>
							{/* Connector */}
							<div
								className={`h-0.5 flex-1 rounded ${
									dot1Done ? "bg-emerald-500" : "bg-slate-600"
								}`}
							/>
							{/* Step 2 dot */}
							<div className="flex flex-col items-center gap-1">
								<div
									className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
										dot2Active
											? "bg-emerald-500 text-white"
											: "bg-slate-600 text-slate-300"
									}`}
								>
									2
								</div>
								<span className="text-[10px] text-slate-400">Admin User</span>
							</div>
						</div>
					</div>
				)}

				{/* Step panels */}
				<div className="p-5 sm:p-7">
					<AnimatePresence mode="wait">
						{/* ── Step 1: Create Database ── */}
						{step === 1 && (
							<motion.div
								key="step1"
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								initial={{ opacity: 0, y: 8 }}
								transition={{ duration: 0.2 }}
							>
								<p className="mb-1 text-sm font-semibold text-slate-800">
									Create Database
								</p>
								<p className="mb-4 text-xs text-slate-500">
									A new PostgreSQL database will be created for this client.
								</p>
								<form
									className="flex flex-col gap-4"
									onSubmit={step1Form.handleSubmit(onStep1Submit)}
								>
									<div className="flex flex-col gap-1.5">
										<Label htmlFor="db_name">
											Database Name{" "}
											<span className="text-red-500">*</span>
										</Label>
										<div className="relative">
											<Input
												id="db_name"
												placeholder="service_plus_..."
												{...step1Form.register("db_name")}
												className="w-full pr-8"
												disabled={step1Busy}
											/>
											{checkingDb && (
												<Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
											)}
											{!checkingDb && dbNameAvailable === true && (
												<Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
											)}
										</div>
										<FieldError message={step1Errors.db_name?.message} />
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
											className="bg-emerald-600 text-white hover:bg-emerald-700"
											disabled={step1SubmitDisabled}
											type="submit"
										>
											{creatingDb ? "Creating..." : "Create Database"}
										</Button>
									</div>
								</form>
							</motion.div>
						)}

						{/* ── Step 2: Create Admin User ── */}
						{step === 2 && (
							<motion.div
								key="step2"
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								initial={{ opacity: 0, y: 8 }}
								transition={{ duration: 0.2 }}
							>
								<p className="mb-1 text-sm font-semibold text-slate-800">
									Create Admin User
								</p>
								{createdDbName ? (
									<div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
										Database{" "}
										<span className="font-semibold">{createdDbName}</span>{" "}
										created successfully. Now create the admin user.
									</div>
								) : (
									<p className="mb-4 text-xs text-slate-500">
										Create the first admin user for database{" "}
										<span className="font-medium">{client.db_name}</span>.
									</p>
								)}
								<form
									className="flex flex-col gap-4"
									onSubmit={step2Form.handleSubmit(onStep2Submit)}
								>
									<div className="flex flex-col gap-1.5">
										<Label htmlFor="full_name">
											Full Name{" "}
											<span className="text-red-500">*</span>
										</Label>
										<Input
											id="full_name"
											placeholder="e.g. John Smith"
											{...step2Form.register("full_name")}
											className="w-full"
											disabled={step2Busy}
										/>
										<FieldError message={step2Errors.full_name?.message} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label htmlFor="email">
											Email{" "}
											<span className="text-red-500">*</span>
										</Label>
										<Input
											id="email"
											placeholder="admin@example.com"
											type="email"
											{...step2Form.register("email")}
											className="w-full"
											disabled={step2Busy}
										/>
										<FieldError message={step2Errors.email?.message} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label htmlFor="username">
											Username{" "}
											<span className="text-red-500">*</span>
										</Label>
										<Input
											id="username"
											placeholder="e.g. johnsmith"
											{...step2Form.register("username")}
											className="w-full"
											disabled={step2Busy}
										/>
										<FieldError message={step2Errors.username?.message} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label htmlFor="password">
											Temporary Password{" "}
											<span className="text-red-500">*</span>
										</Label>
										<Input
											id="password"
											placeholder="Min. 6 characters"
											type="password"
											{...step2Form.register("password")}
											className="w-full"
											disabled={step2Busy}
										/>
										<FieldError message={step2Errors.password?.message} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label htmlFor="mobile">Mobile</Label>
										<Input
											id="mobile"
											placeholder="+91 98765 43210"
											type="tel"
											{...step2Form.register("mobile")}
											className="w-full"
											disabled={step2Busy}
										/>
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
											className="bg-emerald-600 text-white hover:bg-emerald-700"
											disabled={step2SubmitDisabled}
											type="submit"
										>
											{creatingAdmin ? "Creating..." : "Create Admin"}
										</Button>
									</div>
								</form>
							</motion.div>
						)}

						{/* ── Success screen ── */}
						{step === "success" && (
							<motion.div
								key="success"
								animate={{ opacity: 1, scale: 1 }}
								className="flex flex-col items-center py-6 text-center"
								initial={{ opacity: 0, scale: 0.95 }}
								transition={{ duration: 0.25 }}
							>
								<div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600">
									<PartyPopper className="h-8 w-8 text-white" />
								</div>
								<h3 className="mb-2 text-lg font-bold text-slate-800">
									Client Initiated!
								</h3>
								<p className="mb-6 text-sm text-slate-500">
									Database and admin user have been set up successfully.
								</p>
								<Button
									className="bg-emerald-600 text-white hover:bg-emerald-700"
									onClick={() => {
										onSuccess();
										onOpenChange(false);
									}}
								>
									Close
								</Button>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</DialogContent>
		</Dialog>
	);
};
