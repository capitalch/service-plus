import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { SEED_BATCHES } from "@/features/super-admin/constants/seed-data";
import type { ClientType } from "@/features/super-admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckDbQueryDataType = {
	genericQuery: { exists: boolean }[] | null;
};

type CreateAdminResultType = {
	createAdminUser: { email_sent: boolean; id: number };
};

type InitializeClientDialogPropsType = {
	client: ClientType;
	onOpenChange: (open: boolean) => void;
	onStep1Success?: () => void;
	onSuccess: () => void;
	open: boolean;
};

// Steps: 1=Create Database, 2=Seed Data, 3=Create Admin User
type StepType = 1 | 2 | 3 | "success";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const step1Schema = z.object({
	db_name: z
		.string()
		.min(1, MESSAGES.ERROR_DB_NAME_REQUIRED)
		.regex(/^service_plus_[a-z0-9_]+$/, "Invalid format: must be service_plus_<code>"),
});

const step3Schema = z.object({
	email: z.email({ message: MESSAGES.ERROR_EMAIL_INVALID }),
	full_name: z.string().min(1, MESSAGES.ERROR_FULL_NAME_REQUIRED),
	mobile: z
		.string()
		.optional()
		.refine(
			(val) => !val || /^\+?[\d\s\-().]{7,15}$/.test(val),
			{ message: MESSAGES.ERROR_MOBILE_INVALID },
		),
	username: z
		.string()
		.min(1, MESSAGES.ERROR_ADMIN_USERNAME_REQUIRED)
		.min(5, MESSAGES.ERROR_USERNAME_MIN_LENGTH)
		.regex(/^[a-zA-Z0-9]+$/, MESSAGES.ERROR_USERNAME_INVALID_FORMAT),
});

type Step1FormType = z.infer<typeof step1Schema>;
type Step3FormType = z.infer<typeof step3Schema>;

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

export const InitializeClientDialog = ({
	client,
	onOpenChange,
	onStep1Success,
	onSuccess,
	open,
}: InitializeClientDialogPropsType) => {
	const [checkingDb, setCheckingDb] = useState(false);
	const [checkingSeed, setCheckingSeed] = useState(false);
	const [checkingUsername, setCheckingUsername] = useState(false);
	const [createdDbName, setCreatedDbName] = useState("");
	const [creatingAdmin, setCreatingAdmin] = useState(false);
	const [creatingDb, setCreatingDb] = useState(false);
	const [dbNameAvailable, setDbNameAvailable] = useState<boolean | null>(null);
	const [seedingData, setSeedingData] = useState(false);
	const [step, setStep] = useState<StepType>(client?.db_name ? 2 : 1);
	const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);

	const step1Form = useForm<Step1FormType>({
		defaultValues: { db_name: `service_plus_${client.code.toLowerCase()}` },
		mode: "onChange",
		resolver: zodResolver(step1Schema),
	});

	const step3Form = useForm<Step3FormType>({
		defaultValues: { email: "", full_name: "", mobile: "", username: "" },
		mode: "onChange",
		resolver: zodResolver(step3Schema),
	});

	const dbNameValue = useWatch({ control: step1Form.control, name: "db_name" });
	const usernameValue = useWatch({ control: step3Form.control, name: "username" });
	const debouncedDbName = useDebounce(dbNameValue, 1200);
	const debouncedUsername = useDebounce(usernameValue, 1200);

	// Check if role seed data exists in the client DB (only when db_name is already set)
	useEffect(() => {
		if (!open || !client.db_name) return;
		setCheckingSeed(true);
		apolloClient
			.query<CheckDbQueryDataType>({
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
				const exists = res.data?.genericQuery?.[0]?.exists ?? false;
				setStep(exists ? 3 : 2);
			})
			.catch(() => {
				setStep(2);
			})
			.finally(() => {
				setCheckingSeed(false);
			});
	}, [open, client.db_name]); // eslint-disable-line react-hooks/exhaustive-deps

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

	// Debounced username uniqueness check
	useEffect(() => {
		if (!debouncedUsername) {
			setUsernameTaken(null);
			return;
		}
		const { invalid } = step3Form.getFieldState("username");
		if (invalid) {
			setUsernameTaken(null);
			return;
		}
		const activeDb = createdDbName || client.db_name || "";
		if (!activeDb) return;
		setCheckingUsername(true);
		apolloClient
			.query<CheckDbQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: activeDb,
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
					step3Form.setError("username", {
						message: MESSAGES.ERROR_ADMIN_USERNAME_EXISTS,
						type: "manual",
					});
				} else {
					step3Form.clearErrors("username");
				}
			})
			.finally(() => {
				setCheckingUsername(false);
			});
	}, [debouncedUsername]); // eslint-disable-line react-hooks/exhaustive-deps

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setCheckingDb(false);
			setCheckingSeed(false);
			setCheckingUsername(false);
			setCreatedDbName("");
			setDbNameAvailable(null);
			setSeedingData(false);
			setStep(client?.db_name ? 2 : 1);
			setUsernameTaken(null);
			step1Form.reset({ db_name: `service_plus_${client.code.toLowerCase()}` });
			step3Form.reset({ email: "", full_name: "", mobile: "", username: "" });
		}
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onStep1Submit(data: Step1FormType) {
		setCreatingDb(true);
		try {
			const result = await apolloClient.mutate({
				mutation: GRAPHQL_MAP.createServiceDb,
				variables: {
					db_name: "",
					schema: "public",
					value: encodeURIComponent(JSON.stringify({ client_id: client.id, new_db_name: data.db_name })),
				},
			});
			if (result.error) {
				toast.error(MESSAGES.ERROR_INITIALIZE_DB_FAILED);
				return;
			}
			setCreatedDbName(data.db_name);
			setStep(2);
			toast.success(MESSAGES.SUCCESS_INITIALIZE_DB);
			onStep1Success?.();
		} catch {
			toast.error(MESSAGES.ERROR_INITIALIZE_DB_FAILED);
		} finally {
			setCreatingDb(false);
		}
	}

	async function onSeedSubmit() {
		const activeDb = createdDbName || client.db_name || "";
		setSeedingData(true);
		try {
			for (const batch of SEED_BATCHES) {
				const result = await apolloClient.mutate({
					mutation: GRAPHQL_MAP.genericUpdate,
					variables: {
						db_name: activeDb,
						schema: "security",
						value: graphQlUtils.buildGenericUpdateValue(batch.sqlObject),
					},
				});
				if (result.error) {
					toast.error(MESSAGES.ERROR_INITIALIZE_SEED_FAILED);
					return;
				}
			}
			toast.success(MESSAGES.SUCCESS_INITIALIZE_SEED);
			setStep(3);
		} catch {
			toast.error(MESSAGES.ERROR_INITIALIZE_SEED_FAILED);
		} finally {
			setSeedingData(false);
		}
	}

	async function onStep3Submit(data: Step3FormType) {
		const activeDb = createdDbName || client.db_name || "";
		setCreatingAdmin(true);
		try {
			const result = await apolloClient.mutate<CreateAdminResultType>({
				mutation: GRAPHQL_MAP.createAdminUser,
				variables: {
					db_name: activeDb,
					schema: "security",
					value: encodeURIComponent(JSON.stringify({
						email: data.email,
						full_name: data.full_name,
						mobile: data.mobile || null,
						username: data.username,
					})),
				},
			});
			if (result.error) {
				toast.error(MESSAGES.ERROR_INITIALIZE_ADMIN_FAILED);
				return;
			}
			const emailSent = result.data?.createAdminUser?.email_sent ?? false;
			if (emailSent) {
				toast.success(MESSAGES.SUCCESS_INITIALIZE_ADMIN);
			} else {
				toast.warning(MESSAGES.WARN_INITIALIZE_ADMIN_EMAIL_NOT_SENT);
			}
			setStep("success");
		} catch {
			toast.error(MESSAGES.ERROR_INITIALIZE_ADMIN_FAILED);
		} finally {
			setCreatingAdmin(false);
		}
	}

	const step1Errors = step1Form.formState.errors;
	const step3Errors = step3Form.formState.errors;

	const step1Busy = checkingDb || creatingDb;
	const step1SubmitDisabled = step1Busy || !dbNameAvailable || !!step1Errors.db_name;

	const step3Busy = creatingAdmin;
	const step3SubmitDisabled =
		step3Busy ||
		checkingUsername ||
		usernameTaken === true ||
		Object.keys(step3Errors).length > 0;

	const dot1Done = step === 2 || step === 3 || step === "success";
	const dot2Done = step === 3 || step === "success";
	const dot2Active = step === 2;
	const dot3Active = step === 3;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-[480px]">
				<DialogTitle className="sr-only">Initialize Client: {client.name}</DialogTitle>
				<DialogDescription className="sr-only">
					Set up the database and admin user for {client.name}.
				</DialogDescription>

				{/* Stepper header – hidden on success screen */}
				{step !== "success" && (
					<div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-5 sm:px-7">
						<p className="mb-4 text-sm font-semibold text-slate-300">
							Initialize Client:{" "}
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
							{/* Connector 1→2 */}
							<div
								className={`h-0.5 flex-1 rounded ${
									dot1Done ? "bg-emerald-500" : "bg-slate-600"
								}`}
							/>
							{/* Step 2 dot */}
							<div className="flex flex-col items-center gap-1">
								<div
									className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
										dot2Done
											? "bg-emerald-500 text-white"
											: dot2Active
											? "bg-emerald-500 text-white"
											: "bg-slate-600 text-slate-300"
									}`}
								>
									{dot2Done ? <Check className="h-3.5 w-3.5" /> : "2"}
								</div>
								<span className="text-[10px] text-slate-400">Seed Data</span>
							</div>
							{/* Connector 2→3 */}
							<div
								className={`h-0.5 flex-1 rounded ${
									dot2Done ? "bg-emerald-500" : "bg-slate-600"
								}`}
							/>
							{/* Step 3 dot */}
							<div className="flex flex-col items-center gap-1">
								<div
									className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
										dot3Active
											? "bg-emerald-500 text-white"
											: "bg-slate-600 text-slate-300"
									}`}
								>
									3
								</div>
								<span className="text-[10px] text-slate-400">Admin User</span>
							</div>
						</div>
					</div>
				)}

				{/* Step panels */}
				<div className="p-5 sm:p-7">
					{checkingSeed && (
						<div className="flex flex-col items-center gap-3 py-8">
							<Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
							<p className="text-sm text-slate-500">Checking seed data…</p>
						</div>
					)}
					{!checkingSeed && <AnimatePresence mode="wait">
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

						{/* ── Step 2: Seed Data ── */}
						{step === 2 && (
							<motion.div
								key="step2"
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								initial={{ opacity: 0, y: 8 }}
								transition={{ duration: 0.2 }}
							>
								<p className="mb-1 text-sm font-semibold text-slate-800">
									Seed Data
								</p>
								<p className="mb-4 text-xs text-slate-500">
									The following data will be inserted into the new database.
								</p>
								<div className="mb-5 flex flex-col gap-4">
									{SEED_BATCHES.map((batch) => (
										<div key={batch.label}>
											<p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
												{batch.label}
											</p>
											<div className="overflow-hidden rounded-lg border border-slate-200">
												{(Array.isArray(batch.sqlObject.xData)
													? batch.sqlObject.xData
													: [batch.sqlObject.xData]
												).map((item, idx) => (
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
									))}
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
										disabled={seedingData}
										onClick={onSeedSubmit}
										type="button"
									>
										{seedingData ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Applying...
											</>
										) : (
											"Apply Seed Data"
										)}
									</Button>
								</div>
							</motion.div>
						)}

						{/* ── Step 3: Create Admin User ── */}
						{step === 3 && (
							<motion.div
								key="step3"
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
									onSubmit={step3Form.handleSubmit(onStep3Submit)}
								>
									<div className="flex flex-col gap-1.5">
										<Label htmlFor="full_name">
											Full Name{" "}
											<span className="text-red-500">*</span>
										</Label>
										<Input
											id="full_name"
											placeholder="e.g. John Smith"
											{...step3Form.register("full_name")}
											className="w-full"
											disabled={step3Busy}
										/>
										<FieldError message={step3Errors.full_name?.message} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label htmlFor="username">
											Username{" "}
											<span className="text-red-500">*</span>
										</Label>
										<div className="relative">
											<Input
												id="username"
												placeholder="e.g. johnsmith"
												{...step3Form.register("username")}
												className="w-full pr-8"
												disabled={step3Busy}
											/>
											{checkingUsername && (
												<Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
											)}
											{!checkingUsername && usernameTaken === false && !step3Errors.username && (
												<Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
											)}
										</div>
										<FieldError message={step3Errors.username?.message} />
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
											{...step3Form.register("email")}
											className="w-full"
											disabled={step3Busy}
										/>
										<FieldError message={step3Errors.email?.message} />
									</div>
									<div className="flex flex-col gap-1.5">
										<Label htmlFor="mobile">Mobile</Label>
										<Input
											id="mobile"
											placeholder="+91 98765 43210"
											type="tel"
											{...step3Form.register("mobile")}
											className="w-full"
											disabled={step3Busy}
										/>
										<FieldError message={step3Errors.mobile?.message} />
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
											disabled={step3SubmitDisabled}
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
									Client Initialized!
								</h3>
								<p className="mb-6 text-sm text-slate-500">
									Database and admin user have been set up. Login credentials have been emailed to the admin.
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
					</AnimatePresence>}
				</div>
			</DialogContent>
		</Dialog>
	);
};
