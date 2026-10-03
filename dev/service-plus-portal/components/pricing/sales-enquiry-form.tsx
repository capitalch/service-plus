"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Lock, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { EnquirySuccess } from "@/components/pricing/enquiry-success";
import { LiteConfirmDialog } from "@/components/pricing/lite-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGES } from "@/constants/messages";
import { findPlan, formatInr, planCodes, type PlanCodeType } from "@/content/pricing";
import { ApiError, submitSalesEnquiry, submitSignup } from "@/lib/api";
import { findLivePlan, usePlanPrices } from "@/lib/plan-prices";
import { cn } from "@/lib/utils";
import { BU_NAME_REGEX, GSTIN_REGEX, MOBILE_REGEX, normalizeGstin, normalizeMobile } from "@/lib/validators";

const MESSAGE_LIMIT = 2000;

const enquirySchema = z
	.object({
		branches: z
			.number({ error: MESSAGES.errBranches })
			.int(MESSAGES.errBranches)
			.min(1, MESSAGES.errBranches)
			.max(50, MESSAGES.errBranches),
		// The business name becomes the business unit's name, so it follows the BU name rule.
		businessName: z.string().trim().regex(BU_NAME_REGEX, MESSAGES.errBusinessName),
		city: z.string().trim().min(2, MESSAGES.errCity).max(100, MESSAGES.errCity),
		email: z.email(MESSAGES.errEmail).max(200, MESSAGES.errEmail),
		gstin: z.string().refine((v) => v === "" || GSTIN_REGEX.test(v), MESSAGES.errGstin),
		message: z.string().max(MESSAGE_LIMIT, MESSAGES.errMessage),
		mobile: z.string().regex(MOBILE_REGEX, MESSAGES.errMobile),
		name: z.string().trim().min(2, MESSAGES.errName).max(100, MESSAGES.errName),
		plan: z.enum(planCodes, { error: MESSAGES.errPlan }),
		// Honeypot: hidden from people, filled in by bots.
		website: z.string(),
	})
	// Lite and Basic are limited to the head office, so more than one branch needs a bigger plan.
	.refine((v) => v.branches === 1 || findPlan(v.plan)?.branches === null, {
		message: MESSAGES.errBranchesPlan,
		path: ["branches"],
	});

type EnquiryFormType = z.infer<typeof enquirySchema>;

type SalesEnquiryFormPropsType = {
	selectedPlan: PlanCodeType;
};

type FieldMetaType = { id: keyof EnquiryFormType; label: string };

// Order here is the order the error summary reads in, so it matches the form top to bottom.
const fieldOrder: FieldMetaType[] = [
	{ id: "plan", label: "Plan" },
	{ id: "name", label: "Your name" },
	{ id: "businessName", label: "Business name" },
	{ id: "mobile", label: "Mobile" },
	{ id: "email", label: "Email" },
	{ id: "city", label: "City / State" },
	{ id: "gstin", label: "GSTIN" },
	{ id: "branches", label: "Branches needed" },
	{ id: "message", label: "Message" },
];

const Required = () => (
	<span aria-hidden className="text-destructive">
		*
	</span>
);

const FieldError = ({ id, message }: { id: string; message?: string }) =>
	message ? (
		<p className="flex items-start gap-1.5 text-xs text-destructive" id={id}>
			<AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
			{message}
		</p>
	) : null;

type FieldRenderPropsType = {
	"aria-describedby"?: string;
	"aria-invalid"?: true;
	"aria-required"?: true;
	id: string;
};

type FieldPropsType = {
	children: (props: FieldRenderPropsType) => React.ReactNode;
	error?: string;
	htmlFor: string;
	label: string;
	required?: boolean;
};

// Owns the label, the error text and the aria wiring for one control. The render prop hands the
// control its id plus aria-describedby/aria-invalid/aria-required, so a field can't forget them.
const Field = ({ children, error, htmlFor, label, required }: FieldPropsType) => (
	<div className="space-y-2">
		<Label htmlFor={htmlFor}>
			{label} {required && <Required />}
		</Label>
		{children({
			...(error ? { "aria-describedby": `${htmlFor}-error` } : {}),
			...(error ? { "aria-invalid": true as const } : {}),
			...(required ? { "aria-required": true as const } : {}),
			id: htmlFor,
		})}
		<FieldError id={`${htmlFor}-error`} message={error} />
	</div>
);

type ErrorSummaryPropsType = {
	errors: { id: string; label: string; message: string }[];
	ref?: React.Ref<HTMLDivElement>;
	/** A refusal from the server (duplicate request, sign-ups not configured, …). */
	serverMessage?: string | null;
};

// Announced on submit failure and focusable, so a keyboard or screen-reader user lands on the
// list of problems first and can jump to any field from it. Collapses away once everything passes.
const ErrorSummary = ({ errors, ref, serverMessage }: ErrorSummaryPropsType) => (
	<div
		className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 sm:col-span-2"
		ref={ref}
		role="alert"
		tabIndex={-1}
	>
		<p className="flex items-center gap-2 text-sm font-semibold text-destructive">
			<AlertCircle aria-hidden className="size-4 shrink-0" />
			{serverMessage
				? MESSAGES.signupServerError
				: `${errors.length === 1 ? "Please fix this field" : `Please fix these ${errors.length} fields`} to send your enquiry`}
		</p>
		{serverMessage && <p className="mt-2 pl-6 text-sm">{serverMessage}</p>}
		<ul className="mt-2 space-y-1 pl-6 text-sm">
			{errors.map((error) => (
				<li className="list-disc" key={error.id}>
					<a className="underline underline-offset-2 hover:no-underline" href={`#${error.id}`}>
						{error.label}: {error.message}
					</a>
				</li>
			))}
		</ul>
	</div>
);

type SubmittedType = { reference: string; values: EnquiryFormType };

export const SalesEnquiryForm = ({ selectedPlan }: SalesEnquiryFormPropsType) => {
	const [confirmValues, setConfirmValues] = useState<EnquiryFormType | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState<SubmittedType | null>(null);
	const summaryRef = useRef<HTMLDivElement>(null);
	const { plans } = usePlanPrices();

	const {
		control,
		formState: { errors, isSubmitted, isSubmitting, isValid, submitCount },
		handleSubmit,
		register,
		reset,
		setValue,
		watch,
	} = useForm<EnquiryFormType>({
		defaultValues: {
			branches: 1,
			businessName: "",
			city: "",
			email: "",
			gstin: "",
			message: "",
			mobile: "",
			name: "",
			plan: selectedPlan,
			website: "",
		},
		// Validate as the visitor types: errors show at once and the submit button stays disabled
		// while anything is invalid.
		mode: "onChange",
		reValidateMode: "onChange",
		resolver: zodResolver(enquirySchema),
	});

	// A plan card was clicked above the form.
	useEffect(() => {
		setValue("plan", selectedPlan, { shouldValidate: true });
	}, [selectedPlan, setValue]);

	// Move focus to the summary after a failed submit so the problems are read out and reachable.
	// submitCount is a dep so a second failed attempt re-focuses it even though isSubmitted stays
	// true. On a valid submit no summary is rendered and summaryRef.current is null, so this no-ops.
	useEffect(() => {
		if (!isSubmitted && !serverError) return;
		summaryRef.current?.focus();
		summaryRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [isSubmitted, serverError, submitCount]);

	const errorList = useMemo(
		() =>
			fieldOrder.flatMap((field) => {
				const message = errors[field.id]?.message;
				return message ? [{ id: field.id, label: field.label, message: String(message) }] : [];
			}),
		[errors],
	);

	const plan = findLivePlan(plans, watch("plan"));
	const isLite = plan?.code === "lite";
	const messageLength = watch("message")?.length ?? 0;

	// Enterprise is an enquiry for the sales team; Lite, Basic and Standard are sign-ups that land
	// in the approvers' queue. Both answer with a reference for the success screen.
	async function send(values: EnquiryFormType) {
		setServerError(null);
		try {
			const reference =
				values.plan === "enterprise" ? await submitSalesEnquiry(values) : await submitSignup(values);
			setSubmitted({ reference, values });
		} catch (error) {
			if (error instanceof ApiError && error.status === 429) toast.error(MESSAGES.enquiryRateLimited);
			// A refusal the visitor can act on (duplicate request, sign-ups not configured, …).
			else if (error instanceof ApiError && error.code) setServerError(error.message);
			else toast.error(MESSAGES.enquiryFailed);
		}
	}

	async function onSubmit(values: EnquiryFormType) {
		// A bot filled the honeypot: pretend it worked, send nothing.
		if (values.website) {
			setSubmitted({ reference: "", values });
			return;
		}
		if (values.plan === "lite") {
			setConfirmValues(values);
			return;
		}
		await send(values);
	}

	async function handleConfirmLite() {
		if (!confirmValues) return;
		setConfirming(true);
		await send(confirmValues);
		setConfirming(false);
		setConfirmValues(null);
	}

	function handleReset() {
		reset({ ...watch(), businessName: "", city: "", email: "", gstin: "", message: "", mobile: "", name: "" });
		setServerError(null);
		setSubmitted(null);
	}

	const submittedPlan = findLivePlan(plans, submitted?.values.plan);
	if (submittedPlan && submitted)
		return (
			<EnquirySuccess
				onReset={handleReset}
				plan={submittedPlan}
				reference={submitted.reference}
				values={submitted.values}
			/>
		);

	return (
		<form className="grid gap-5 sm:grid-cols-2" noValidate onSubmit={handleSubmit(onSubmit)}>
			{(serverError || (isSubmitted && errorList.length > 0)) && (
				<ErrorSummary errors={errorList} ref={summaryRef} serverMessage={serverError} />
			)}

			<div className="sm:col-span-2">
				<Field error={errors.plan?.message} htmlFor="plan" label="Plan" required>
					{(aria) => (
						<Controller
							control={control}
							name="plan"
							render={({ field }) => (
								<Select onValueChange={field.onChange} value={field.value}>
									<SelectTrigger className="w-full" {...aria}>
										<SelectValue placeholder="Choose a plan" />
									</SelectTrigger>
									<SelectContent>
										{plans.map((p) => (
											<SelectItem key={p.code} value={p.code}>
												{p.name} —{" "}
												{p.monthlyPrice === 0 ? "Free" : `${formatInr(p.monthlyPrice)} / month`}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						/>
					)}
				</Field>
			</div>

			<Field error={errors.name?.message} htmlFor="name" label="Your name" required>
				{(aria) => <Input autoComplete="name" {...aria} {...register("name")} />}
			</Field>

			<Field error={errors.businessName?.message} htmlFor="businessName" label="Business name" required>
				{(aria) => <Input autoComplete="organization" {...aria} {...register("businessName")} />}
			</Field>

			<Field error={errors.mobile?.message} htmlFor="mobile" label="Mobile" required>
				{(aria) => (
					<Controller
						control={control}
						name="mobile"
						render={({ field }) => (
							<Input
								autoComplete="tel-national"
								enterKeyHint="next"
								inputMode="numeric"
								name={field.name}
								onBlur={field.onBlur}
								onChange={(e) => field.onChange(normalizeMobile(e.target.value))}
								placeholder="10-digit mobile"
								ref={field.ref}
								type="tel"
								value={field.value}
								{...aria}
							/>
						)}
					/>
				)}
			</Field>

			<Field error={errors.email?.message} htmlFor="email" label="Email" required>
				{(aria) => <Input autoComplete="email" type="email" {...aria} {...register("email")} />}
			</Field>

			<Field error={errors.city?.message} htmlFor="city" label="City / State" required>
				{(aria) => <Input autoComplete="address-level2" {...aria} {...register("city")} />}
			</Field>

			<Field error={errors.gstin?.message} htmlFor="gstin" label="GSTIN">
				{(aria) => (
					<Controller
						control={control}
						name="gstin"
						render={({ field }) => (
							<Input
								autoCapitalize="characters"
								maxLength={15}
								name={field.name}
								onBlur={field.onBlur}
								onChange={(e) => field.onChange(normalizeGstin(e.target.value))}
								placeholder="Optional"
								ref={field.ref}
								value={field.value}
								{...aria}
							/>
						)}
					/>
				)}
			</Field>

			<Field error={errors.branches?.message} htmlFor="branches" label="Branches needed">
				{(aria) => (
					<Input
						inputMode="numeric"
						max={50}
						min={1}
						type="number"
						{...aria}
						{...register("branches", { valueAsNumber: true })}
					/>
				)}
			</Field>

			<div className="sm:col-span-2">
				<Field error={errors.message?.message} htmlFor="message" label="Message">
					{(aria) => (
						<>
							<Textarea
								placeholder="Anything we should know: current software, number of technicians, brands you service…"
								rows={4}
								{...aria}
								{...register("message")}
							/>
							<p
								aria-live="polite"
								className={cn(
									"text-right text-xs tabular-nums",
									messageLength > MESSAGE_LIMIT * 0.9 ? "text-destructive" : "text-muted-foreground",
								)}
							>
								{messageLength} / {MESSAGE_LIMIT}
							</p>
						</>
					)}
				</Field>
			</div>

			<div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
				<label htmlFor="website">Website</label>
				<input autoComplete="off" id="website" tabIndex={-1} type="text" {...register("website")} />
			</div>

			<div className="flex flex-col gap-4 sm:col-span-2">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					{plan ? (
						<p className="text-sm text-muted-foreground">
							<span className="font-medium text-foreground">{plan.name}:</span>{" "}
							{plan.monthlyPrice === 0 ? "Free" : `${formatInr(plan.monthlyPrice)} / month`}
							{plan.setupFee > 0 && ` + ${formatInr(plan.setupFee)} setup`}
						</p>
					) : (
						<span />
					)}
					<Button disabled={isSubmitting || !isValid} size="lg" type="submit">
						{isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
						{isSubmitting ? "Sending…" : isLite ? "Confirm Lite signup" : "Send enquiry"}
					</Button>
				</div>
				<p className="flex items-start gap-1.5 text-xs text-muted-foreground">
					<Lock aria-hidden className="mt-px size-3.5 shrink-0" />
					<span>
						We reply within one business day. Your details stay with us — see our{" "}
						<Link className="underline underline-offset-2 hover:no-underline" href="/privacy">
							privacy notice
						</Link>
						.
					</span>
				</p>
			</div>
			<LiteConfirmDialog
				businessName={confirmValues?.businessName ?? ""}
				email={confirmValues?.email ?? ""}
				onCancel={() => setConfirmValues(null)}
				onConfirm={handleConfirmLite}
				open={confirmValues !== null}
				submitting={confirming}
			/>
		</form>
	);
};
