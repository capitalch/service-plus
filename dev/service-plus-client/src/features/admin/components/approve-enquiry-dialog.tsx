import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EnquiryFieldError } from "@/components/shared/enquiries/enquiry-field-error";
import { enquiryErrorMessage, runEnquiryMutation } from "@/components/shared/enquiries/enquiry-mutation";
import { PLAN_NAMES } from "@/components/shared/enquiries/enquiry-types";
import type { LtEnquiryType } from "@/components/shared/enquiries/enquiry-types";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { FIELD_VALIDATION_DEBOUNCE_MS } from "@/constants/timing";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { BU_NAME_REGEX } from "@/lib/bu-name";
import { MOBILE_REGEX, normalizeMobile } from "@/lib/mobile";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApproveEnquiryDialogPropsType = {
	enquiry: LtEnquiryType | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

type ApproveResultType = {
	existing_user: boolean;
	kind?: "signup" | "upgrade";
	login_email_sent: boolean;
	plan_code: string;
	username: string | null;
};

type CheckFieldType = "bu_code" | "bu_name" | "username";

// ─── Schema ───────────────────────────────────────────────────────────────────

// Mirrors the server: BU code rule, reserved schema names, the BU name rule (Step 3) and the
// client's username rule (letters and digits, at least 5). A returning applicant (their email
// already has a login) gets the BU on that login, so mobile and username are not asked for.
const RESERVED_CODES = ["demo1", "information_schema", "public", "security"];

const approveSchema = z
	.object({
		bu_code: z.string().trim(),
		bu_name: z.string().trim(),
		mobile: z.string(),
		returning: z.boolean(),
		upgrade: z.boolean(),
		username: z.string(),
	})
	.superRefine((data, ctx) => {
		// An upgrade creates nothing: its BU name and code are the existing BU's, not checked again.
		if (data.upgrade) return;
		if (
			!/^[a-z0-9_]{3,30}$/.test(data.bu_code) ||
			RESERVED_CODES.includes(data.bu_code) ||
			data.bu_code.startsWith("pg_")
		)
			ctx.addIssue({ code: "custom", message: MESSAGES.ERROR_BU_CODE_FORMAT, path: ["bu_code"] });
		if (!BU_NAME_REGEX.test(data.bu_name))
			ctx.addIssue({ code: "custom", message: MESSAGES.ERROR_BU_NAME_FORMAT, path: ["bu_name"] });
		if (data.returning) return;
		if (!MOBILE_REGEX.test(data.mobile))
			ctx.addIssue({ code: "custom", message: MESSAGES.ERROR_MOBILE_INVALID, path: ["mobile"] });
		if (data.username.length < 5)
			ctx.addIssue({ code: "custom", message: MESSAGES.ERROR_USERNAME_MIN_LENGTH, path: ["username"] });
		else if (!/^[a-zA-Z0-9]+$/.test(data.username))
			ctx.addIssue({ code: "custom", message: MESSAGES.ERROR_USERNAME_INVALID_FORMAT, path: ["username"] });
	});

type ApproveFormType = z.infer<typeof approveSchema>;

const CHECKS: Record<CheckFieldType, { arg: string; message: string; sqlId: string }> = {
	bu_code: { arg: "code", message: MESSAGES.ERROR_BU_CODE_EXISTS, sqlId: SQL_MAP.CHECK_BU_CODE_EXISTS },
	bu_name: { arg: "name", message: MESSAGES.ERROR_BU_NAME_EXISTS, sqlId: SQL_MAP.CHECK_BU_NAME_EXISTS },
	username: {
		arg: "username",
		message: MESSAGES.ERROR_BUSINESS_USER_USERNAME_EXISTS,
		sqlId: SQL_MAP.CHECK_BUSINESS_USER_USERNAME_EXISTS,
	},
};

// Email local parts that name a mailbox, not a person; never offered as a username.
const GENERIC_EMAIL_NAMES = [
	"account",
	"accounts",
	"admin",
	"administrator",
	"billing",
	"contact",
	"enquiry",
	"hello",
	"help",
	"info",
	"mail",
	"office",
	"sales",
	"service",
	"support",
	"team",
];
const NAME_TITLES = ["dr", "mr", "mrs", "ms", "shri", "smt"];
const USERNAME_MAX_LENGTH = 20;

/** Default username: the applicant's name as letters and digits ("Asha Roy" -> asharoy), without a
 * leading title; under 5 characters, the email's local part if it names a person, else the short
 * name padded to 5. Keep in step with default_username in the server's bu_admin/signups.py. */
function baseUsername(name: string, email: string): string {
	const words = name
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
	while (words.length > 1 && NAME_TITLES.includes(words[0])) words.shift();
	const fromName = words.join("").slice(0, USERNAME_MAX_LENGTH);
	if (fromName.length >= 5) return fromName;
	const local = email
		.split("@")[0]
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "")
		.slice(0, USERNAME_MAX_LENGTH);
	if (local.length >= 5 && !GENERIC_EMAIL_NAMES.includes(local)) return local;
	const base = fromName || local;
	return base.length >= 5 ? base : `${base}user`.padEnd(5, "0");
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ApproveEnquiryDialog = ({ enquiry, onOpenChange, onSuccess }: ApproveEnquiryDialogPropsType) => {
	const dbName = useAppSelector(selectDbName);
	const [checking, setChecking] = useState<Record<CheckFieldType, boolean>>({
		bu_code: false,
		bu_name: false,
		username: false,
	});
	const [taken, setTaken] = useState<Record<CheckFieldType, boolean | null>>({
		bu_code: null,
		bu_name: null,
		username: null,
	});

	const buExists = !!enquiry?.bu_id;
	const userExists = !!enquiry?.user_id;
	// An upgrade moves an existing Lite BU to a paid plan: nothing to create or enter.
	const upgrade = enquiry?.kind === "upgrade";
	const returning = upgrade || (!!enquiry?.existing_username && !userExists);

	const form = useForm<ApproveFormType>({
		defaultValues: { bu_code: "", bu_name: "", mobile: "", returning: false, upgrade: false, username: "" },
		mode: "onChange",
		resolver: zodResolver(approveSchema),
	});
	const {
		formState: { errors, isSubmitting, isValid },
	} = form;

	const values = useWatch({ control: form.control });
	const debouncedCode = useDebounce(values.bu_code ?? "", FIELD_VALIDATION_DEBOUNCE_MS);
	const debouncedName = useDebounce(values.bu_name ?? "", FIELD_VALIDATION_DEBOUNCE_MS);
	const debouncedUsername = useDebounce(values.username ?? "", FIELD_VALIDATION_DEBOUNCE_MS);

	async function exists(field: CheckFieldType, value: string): Promise<boolean | null> {
		if (!dbName) return null;
		const check = CHECKS[field];
		try {
			const res = await apolloClient.query<{ genericQuery: { exists: boolean }[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema: "security",
					value: graphQlUtils.buildGenericQueryValue({ sqlArgs: { [check.arg]: value }, sqlId: check.sqlId }),
				},
			});
			return res.data?.genericQuery?.[0]?.exists ?? false;
		} catch {
			return null;
		}
	}

	// Prefill on open: the stored BU name and code, and the first free username (not for a
	// returning applicant, whose existing login is used).
	useEffect(() => {
		if (!enquiry) return;
		const isReturning = enquiry.kind === "upgrade" || (!!enquiry.existing_username && !enquiry.user_id);
		form.reset({
			bu_code: enquiry.bu_code,
			bu_name: enquiry.bu_name,
			mobile: normalizeMobile(enquiry.mobile),
			returning: isReturning,
			upgrade: enquiry.kind === "upgrade",
			username: enquiry.username ?? "",
		});
		setTaken({ bu_code: null, bu_name: null, username: null });
		if (enquiry.user_id || isReturning) return;
		let cancelled = false;
		(async () => {
			const base = baseUsername(enquiry.name, enquiry.email);
			for (let n = 1; n < 100; n++) {
				const candidate = n === 1 ? base : `${base}${n}`;
				if ((await exists("username", candidate)) !== true) {
					if (!cancelled) form.setValue("username", candidate, { shouldValidate: true });
					return;
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [enquiry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

	// Live uniqueness checks, debounced; skipped for parts that already exist.
	function runCheck(field: CheckFieldType, value: string, skip: boolean) {
		if (skip || !value || form.getFieldState(field).invalid) {
			setTaken((t) => ({ ...t, [field]: null }));
			return;
		}
		setChecking((c) => ({ ...c, [field]: true }));
		exists(field, value)
			.then((result) => {
				setTaken((t) => ({ ...t, [field]: result }));
				if (result) form.setError(field, { message: CHECKS[field].message, type: "manual" });
			})
			.finally(() => setChecking((c) => ({ ...c, [field]: false })));
	}

	useEffect(() => {
		runCheck("bu_code", debouncedCode, buExists || upgrade);
	}, [debouncedCode, buExists, upgrade]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		runCheck("bu_name", debouncedName, buExists || upgrade);
	}, [debouncedName, buExists, upgrade]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		runCheck("username", debouncedUsername, userExists || returning);
	}, [debouncedUsername, userExists, returning]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onSubmit(data: ApproveFormType) {
		if (!dbName || !enquiry) return;
		try {
			const result = await runEnquiryMutation<ApproveResultType>(
				GRAPHQL_MAP.approveSalesEnquiry,
				"approveSalesEnquiry",
				dbName,
				upgrade
					? { id: enquiry.id }
					: data.returning
						? { bu_code: data.bu_code, bu_name: data.bu_name, id: enquiry.id }
						: {
								bu_code: data.bu_code,
								bu_name: data.bu_name,
								id: enquiry.id,
								mobile: data.mobile,
								username: data.username,
							},
			);
			if (result?.kind === "upgrade") {
				if (result.login_email_sent) toast.success(MESSAGES.ENQUIRY_APPROVED_UPGRADE);
				else toast.warning(MESSAGES.ENQUIRY_APPROVED_UPGRADE_EMAIL_FAILED);
			} else if (result?.existing_user) {
				const username = result.username ?? enquiry.existing_username ?? "";
				if (result.login_email_sent)
					toast.success(MESSAGES.ENQUIRY_APPROVED_RETURNING.replace("{username}", username));
				else toast.warning(MESSAGES.ENQUIRY_APPROVED_RETURNING_EMAIL_FAILED.replace("{username}", username));
			} else if (result?.login_email_sent) toast.success(MESSAGES.ENQUIRY_APPROVED_LITE);
			else toast.warning(MESSAGES.ENQUIRY_APPROVED_LOGIN_EMAIL_FAILED);
			if (result?.plan_code && result.plan_code !== "lite")
				toast.info(MESSAGES.ENQUIRY_APPROVED_PAID, { duration: 10000 });
			onSuccess();
			onOpenChange(false);
		} catch (error) {
			toast.error(enquiryErrorMessage(error, MESSAGES.ENQUIRY_SAVE_FAILED));
		}
	}

	const busy = Object.values(checking).some(Boolean) || Object.values(taken).some((t) => t === true);
	// An upgrade renders no field, and react-hook-form recomputes isValid only when a field
	// registers or changes (form.reset does not), so it would stay false. Its values are the BU's
	// own name and code, which already pass the rules; handleSubmit still validates them.
	const canSubmit = upgrade || isValid;

	function StatusIcon({ field }: { field: CheckFieldType }) {
		if (checking[field])
			return (
				<Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
			);
		if (taken[field] === false && !errors[field])
			return <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />;
		return null;
	}

	return (
		<Dialog open={!!enquiry} onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				className="sm:max-w-md"
				onInteractOutside={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="text-base font-semibold">
						{upgrade ? "Upgrade plan" : returning ? "Add BU to existing login" : "Create BU & Manager"} —{" "}
						{enquiry ? PLAN_NAMES[enquiry.plan_code] : ""}
					</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-slate-500">
					{enquiry?.business_name} · {enquiry?.reference}.{" "}
					{upgrade
						? MESSAGES.ENQUIRY_APPROVE_UPGRADE_INTRO
						: returning
							? MESSAGES.ENQUIRY_APPROVE_RETURNING_INTRO
							: MESSAGES.ENQUIRY_APPROVE_INTRO}
				</p>
				{upgrade && enquiry && (
					<p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
						{MESSAGES.ENQUIRY_UPGRADE_TARGET.replace("{bu_name}", enquiry.bu_name)
							.replace("{bu_code}", enquiry.bu_code)
							.replace("{plan_name}", PLAN_NAMES[enquiry.plan_code])}
					</p>
				)}
				{returning && !upgrade && (
					<p className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
						{MESSAGES.ENQUIRY_RETURNING_LOGIN.replace("{username}", enquiry?.existing_username ?? "")}
					</p>
				)}
				<form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
					{!upgrade && (
						<>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="ap_bu_name">
									Business unit name <span className="text-red-500">*</span>
								</Label>
								<div className="relative">
									<Input
										className="pr-8"
										disabled={buExists}
										id="ap_bu_name"
										{...form.register("bu_name")}
									/>
									<StatusIcon field="bu_name" />
								</div>
								<EnquiryFieldError message={errors.bu_name?.message} />
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="ap_bu_code">
									Business unit code <span className="text-red-500">*</span>
								</Label>
								<div className="relative">
									<Input
										className="pr-8 font-mono"
										disabled={buExists}
										id="ap_bu_code"
										{...form.register("bu_code", { setValueAs: (v: string) => v.toLowerCase() })}
									/>
									<StatusIcon field="bu_code" />
								</div>
								<EnquiryFieldError message={errors.bu_code?.message} />
							</div>
						</>
					)}
					{!returning && (
						<>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="ap_mobile">
									Manager mobile <span className="text-red-500">*</span>
								</Label>
								<div className="relative">
									<Input
										className="pr-8"
										disabled={userExists}
										id="ap_mobile"
										inputMode="numeric"
										maxLength={10}
										{...form.register("mobile", { setValueAs: (v: string) => normalizeMobile(v) })}
									/>
								</div>
								<EnquiryFieldError message={errors.mobile?.message} />
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="ap_username">
									Manager username <span className="text-red-500">*</span>
								</Label>
								<div className="relative">
									<Input
										className="pr-8"
										disabled={userExists}
										id="ap_username"
										{...form.register("username")}
									/>
									<StatusIcon field="username" />
								</div>
								<EnquiryFieldError message={errors.username?.message} />
							</div>
						</>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							className="bg-teal-600 text-white hover:bg-teal-700"
							disabled={isSubmitting || !canSubmit || busy}
							type="submit"
						>
							{isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
							{upgrade ? "Upgrade plan" : returning ? "Add BU" : "Create BU & Manager"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
