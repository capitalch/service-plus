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
import type { EntEnquiryType } from "@/components/shared/enquiries/enquiry-types";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { FIELD_VALIDATION_DEBOUNCE_MS } from "@/constants/timing";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { BU_NAME_REGEX } from "@/lib/bu-name";
import { graphQlUtils } from "@/lib/graphql-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProvisionEnquiryDialogPropsType = {
	enquiry: EntEnquiryType | null;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

type CheckFieldType = "client_code" | "client_name" | "db_name";

type ProvisionResultType = { login_email_sent: boolean };

// ─── Schema ───────────────────────────────────────────────────────────────────

// Mirrors the server: the Add Client rules, the database name rule, the BU code and name
// rules (Step 3) and the username rule.
const RESERVED_CODES = ["demo1", "information_schema", "public", "security"];

const provisionSchema = z.object({
	bu_code: z
		.string()
		.trim()
		.regex(/^[a-z0-9_]{3,30}$/, MESSAGES.ERROR_BU_CODE_FORMAT)
		.refine((v) => !RESERVED_CODES.includes(v) && !v.startsWith("pg_"), MESSAGES.ERROR_BU_CODE_FORMAT),
	bu_name: z.string().trim().regex(BU_NAME_REGEX, MESSAGES.ERROR_BU_NAME_FORMAT),
	client_code: z
		.string()
		.trim()
		.regex(/^[A-Za-z0-9]{4,20}$/, MESSAGES.ERROR_CLIENT_CODE_FORMAT),
	client_name: z
		.string()
		.trim()
		.regex(/^[A-Za-z0-9\s\-_.,]{6,100}$/, MESSAGES.ERROR_CLIENT_NAME_FORMAT),
	db_name: z
		.string()
		.trim()
		.regex(/^service_plus_[a-z0-9_]+$/, MESSAGES.ERROR_DB_NAME_FORMAT),
	username: z
		.string()
		.min(5, MESSAGES.ERROR_USERNAME_MIN_LENGTH)
		.regex(/^[a-zA-Z0-9]+$/, MESSAGES.ERROR_USERNAME_INVALID_FORMAT),
});

type ProvisionFormType = z.infer<typeof provisionSchema>;

const CHECKS: Record<CheckFieldType, { arg: string; message: string; sqlId: string }> = {
	client_code: { arg: "code", message: MESSAGES.ERROR_CLIENT_CODE_EXISTS, sqlId: SQL_MAP.CHECK_CLIENT_CODE_EXISTS },
	client_name: { arg: "name", message: MESSAGES.ERROR_CLIENT_NAME_EXISTS, sqlId: SQL_MAP.CHECK_CLIENT_NAME_EXISTS },
	db_name: { arg: "db_name", message: MESSAGES.ERROR_DB_NAME_EXISTS, sqlId: SQL_MAP.CHECK_DB_NAME_EXISTS },
};

// ─── Prefill helpers ──────────────────────────────────────────────────────────

function defaults(enquiry: EntEnquiryType): ProvisionFormType {
	const letters = enquiry.business_name.replace(/[^A-Za-z0-9]/g, "");
	const clientCode = (letters.slice(0, 20) || "client").padEnd(4, "0");
	const buCode = enquiry.business_name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 26);
	const user = enquiry.email
		.split("@")[0]
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
	return {
		bu_code: /^[a-z]/.test(buCode) && buCode.length >= 3 ? buCode : `bu_${buCode}`.slice(0, 26),
		bu_name: enquiry.business_name.trim(),
		client_code: clientCode,
		client_name: enquiry.business_name.replace(/[^A-Za-z0-9\s\-_.,]/g, "").trim(),
		db_name: `service_plus_${clientCode.toLowerCase()}`,
		username: user.length >= 5 ? user : `${user}admin`.padEnd(5, "0"),
	};
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ProvisionEnquiryDialog = ({ enquiry, onOpenChange, onSuccess }: ProvisionEnquiryDialogPropsType) => {
	const [checking, setChecking] = useState<Record<CheckFieldType, boolean>>({
		client_code: false,
		client_name: false,
		db_name: false,
	});
	const [taken, setTaken] = useState<Record<CheckFieldType, boolean | null>>({
		client_code: null,
		client_name: null,
		db_name: null,
	});

	const clientExists = !!enquiry?.client_id;
	const buExists = !!enquiry?.bu_id;
	const userExists = !!enquiry?.user_id;

	const form = useForm<ProvisionFormType>({
		defaultValues: {
			bu_code: "",
			bu_name: "",
			client_code: "",
			client_name: "",
			db_name: "",
			username: "",
		},
		mode: "onChange",
		resolver: zodResolver(provisionSchema),
	});
	const {
		formState: { errors, isSubmitting, isValid },
	} = form;

	const values = useWatch({ control: form.control });
	const debouncedCode = useDebounce(values.client_code ?? "", FIELD_VALIDATION_DEBOUNCE_MS);
	const debouncedName = useDebounce(values.client_name ?? "", FIELD_VALIDATION_DEBOUNCE_MS);
	const debouncedDb = useDebounce(values.db_name ?? "", FIELD_VALIDATION_DEBOUNCE_MS);

	useEffect(() => {
		if (!enquiry) return;
		const prefill = defaults(enquiry);
		form.reset({
			...prefill,
			client_code: enquiry.client_code ?? prefill.client_code,
			db_name: enquiry.db_name ?? prefill.db_name,
		});
		setTaken({ client_code: null, client_name: null, db_name: null });
	}, [enquiry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

	function runCheck(field: CheckFieldType, value: string, skip: boolean) {
		if (skip || !value || form.getFieldState(field).invalid) {
			setTaken((t) => ({ ...t, [field]: null }));
			return;
		}
		const check = CHECKS[field];
		setChecking((c) => ({ ...c, [field]: true }));
		apolloClient
			.query<{ genericQuery: { exists: boolean }[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: "",
					schema: "public",
					value: graphQlUtils.buildGenericQueryValue({ sqlArgs: { [check.arg]: value }, sqlId: check.sqlId }),
				},
			})
			.then((res) => {
				const exists = res.data?.genericQuery?.[0]?.exists ?? false;
				setTaken((t) => ({ ...t, [field]: exists }));
				if (exists) form.setError(field, { message: check.message, type: "manual" });
			})
			.catch(() => setTaken((t) => ({ ...t, [field]: null })))
			.finally(() => setChecking((c) => ({ ...c, [field]: false })));
	}

	useEffect(() => {
		runCheck("client_code", debouncedCode, clientExists);
	}, [debouncedCode, clientExists]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		runCheck("client_name", debouncedName, clientExists);
	}, [debouncedName, clientExists]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		runCheck("db_name", debouncedDb, clientExists);
	}, [debouncedDb, clientExists]); // eslint-disable-line react-hooks/exhaustive-deps

	async function onSubmit(data: ProvisionFormType) {
		if (!enquiry) return;
		try {
			const result = await runEnquiryMutation<ProvisionResultType>(
				GRAPHQL_MAP.provisionEnterpriseEnquiry,
				"provisionEnterpriseEnquiry",
				"",
				{ ...data, id: enquiry.id },
			);
			if (result?.login_email_sent) toast.success(MESSAGES.ENQUIRY_PROVISIONED);
			else toast.warning(MESSAGES.ENQUIRY_APPROVED_LOGIN_EMAIL_FAILED);
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

	type TextFieldPropsType = {
		check?: CheckFieldType;
		disabled: boolean;
		label: string;
		mono?: boolean;
		name: keyof ProvisionFormType;
	};

	// A render function, not a component: a component defined here would remount (and drop
	// focus) on every keystroke.
	function textField({ check, disabled, label, mono, name }: TextFieldPropsType) {
		return (
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`pv_${name}`}>
					{label} <span className="text-red-500">*</span>
				</Label>
				<div className="relative">
					<Input
						className={`pr-8 ${mono ? "font-mono" : ""}`}
						disabled={disabled}
						id={`pv_${name}`}
						{...form.register(name)}
					/>
					{check && <StatusIcon field={check} />}
				</div>
				<EnquiryFieldError message={errors[name]?.message} />
			</div>
		);
	}

	return (
		<Dialog open={!!enquiry} onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				className="sm:max-w-lg"
				onInteractOutside={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="text-base font-semibold">Create customer</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-slate-500">
					{enquiry?.business_name} · {enquiry?.reference}. {MESSAGES.ENQUIRY_PROVISION_INTRO}
				</p>
				<form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{textField({
							check: "client_code",
							disabled: clientExists,
							label: "Client code",
							name: "client_code",
						})}
						{textField({
							check: "client_name",
							disabled: clientExists,
							label: "Client name",
							name: "client_name",
						})}
						{textField({
							check: "db_name",
							disabled: clientExists,
							label: "Database name",
							mono: true,
							name: "db_name",
						})}
						{textField({ disabled: userExists, label: "Admin username", name: "username" })}
						{textField({ disabled: buExists, label: "First BU code", mono: true, name: "bu_code" })}
						{textField({ disabled: buExists, label: "First BU name", name: "bu_name" })}
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
							Create customer
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
