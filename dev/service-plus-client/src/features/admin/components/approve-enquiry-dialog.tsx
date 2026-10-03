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
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApproveEnquiryDialogPropsType = {
	enquiry: LtEnquiryType | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

type ApproveResultType = { login_email_sent: boolean; plan_code: string };

type CheckFieldType = "bu_code" | "bu_name" | "username";

// ─── Schema ───────────────────────────────────────────────────────────────────

// Mirrors the server: BU code rule, reserved schema names, the BU name rule (Step 3) and the
// client's username rule (letters and digits, at least 5).
const RESERVED_CODES = ["demo1", "information_schema", "public", "security"];

const approveSchema = z.object({
	bu_code: z
		.string()
		.trim()
		.regex(/^[a-z0-9_]{3,30}$/, MESSAGES.ERROR_BU_CODE_FORMAT)
		.refine((v) => !RESERVED_CODES.includes(v) && !v.startsWith("pg_"), MESSAGES.ERROR_BU_CODE_FORMAT),
	bu_name: z.string().trim().regex(BU_NAME_REGEX, MESSAGES.ERROR_BU_NAME_FORMAT),
	username: z
		.string()
		.min(5, MESSAGES.ERROR_USERNAME_MIN_LENGTH)
		.regex(/^[a-zA-Z0-9]+$/, MESSAGES.ERROR_USERNAME_INVALID_FORMAT),
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

/** Default username: the email's local part as letters and digits, padded to 5. */
function baseUsername(email: string): string {
	const base = email
		.split("@")[0]
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
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

	const form = useForm<ApproveFormType>({
		defaultValues: { bu_code: "", bu_name: "", username: "" },
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

	// Prefill on open: the stored BU name and code, and the first free username.
	useEffect(() => {
		if (!enquiry) return;
		form.reset({ bu_code: enquiry.bu_code, bu_name: enquiry.bu_name, username: enquiry.username ?? "" });
		setTaken({ bu_code: null, bu_name: null, username: null });
		if (enquiry.user_id) return;
		let cancelled = false;
		(async () => {
			const base = baseUsername(enquiry.email);
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
		runCheck("bu_code", debouncedCode, buExists);
	}, [debouncedCode, buExists]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		runCheck("bu_name", debouncedName, buExists);
	}, [debouncedName, buExists]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		runCheck("username", debouncedUsername, userExists);
	}, [debouncedUsername, userExists]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onSubmit(data: ApproveFormType) {
		if (!dbName || !enquiry) return;
		try {
			const result = await runEnquiryMutation<ApproveResultType>(
				GRAPHQL_MAP.approveSalesEnquiry,
				"approveSalesEnquiry",
				dbName,
				{ bu_code: data.bu_code, bu_name: data.bu_name, id: enquiry.id, username: data.username },
			);
			if (result?.login_email_sent) toast.success(MESSAGES.ENQUIRY_APPROVED_LITE);
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
						Create BU &amp; Manager — {enquiry ? PLAN_NAMES[enquiry.plan_code] : ""}
					</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-slate-500">
					{enquiry?.business_name} · {enquiry?.reference}. {MESSAGES.ENQUIRY_APPROVE_INTRO}
				</p>
				<form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="ap_bu_name">
							Business unit name <span className="text-red-500">*</span>
						</Label>
						<div className="relative">
							<Input className="pr-8" disabled={buExists} id="ap_bu_name" {...form.register("bu_name")} />
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
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							className="bg-teal-600 text-white hover:bg-teal-700"
							disabled={isSubmitting || !isValid || busy}
							type="submit"
						>
							{isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
							Create BU &amp; Manager
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
