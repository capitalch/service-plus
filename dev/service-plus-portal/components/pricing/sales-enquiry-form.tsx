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
import { SignupOtpStep } from "@/components/signup/signup-otp-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGES } from "@/constants/messages";
import { findPlan, formatInr, planCodes, type PlanCodeType } from "@/content/pricing";
import { ApiError, sendSignupOtp, submitSalesEnquiry, submitSignup, type SignupResultType } from "@/lib/api";
import { findLivePlan, usePlanPrices } from "@/lib/plan-prices";
import { cn } from "@/lib/utils";
import { indianStates } from "@/content/indian-states";
import { BU_NAME_REGEX, GSTIN_REGEX, MOBILE_REGEX, normalizeGstin, normalizeMobile } from "@/lib/validators";

const MESSAGE_LIMIT = 2000;

const enquirySchema = z.object({
	// The business name becomes the business unit's name, so it follows the BU name rule.
	businessName: z.string().trim().regex(BU_NAME_REGEX, MESSAGES.errBusinessName),
	// City and state reach the server as one "City, State" field of at most 100 characters.
	city: z.string().trim().min(2, MESSAGES.errCity).max(60, MESSAGES.errCity),
	email: z.email(MESSAGES.errEmail).max(200, MESSAGES.errEmail),
	gstin: z.string().refine((v) => v === "" || GSTIN_REGEX.test(v), MESSAGES.errGstin),
	message: z.string().max(MESSAGE_LIMIT, MESSAGES.errMessage),
	mobile: z.string().regex(MOBILE_REGEX, MESSAGES.errMobile),
	name: z.string().trim().min(2, MESSAGES.errName).max(100, MESSAGES.errName),
	plan: z.enum(planCodes, { error: MESSAGES.errPlan }),
	state: z.enum(indianStates, { error: MESSAGES.errState }),
	// Honeypot: hidden from people, filled in by bots.
	website: z.string(),
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
	{ id: "city", label: "City" },
	{ id: "state", label: "State" },
	{ id: "gstin", label: "GSTIN" },
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

type SubmittedType = {
	/** The login a returning applicant's email already has; the new BU is added to it. */
	existingUsername: string | null;
	reference: string;
	values: EnquiryFormType;
};

export const SalesEnquiryForm = ({ selectedPlan }: SalesEnquiryFormPropsType) => {
	const [confirmValues, setConfirmValues] = useState<EnquiryFormType | null>(null);
	const [confirming, setConfirming] = useState(false);
	/** The form a sign-up code was emailed for; while set, the code step replaces the form. */
	const [otpFor, setOtpFor] = useState<EnquiryFormType | null>(null);
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
			businessName: "",
			city: "",
			email: "",
			gstin: "",
			message: "",
			mobile: "",
			name: "",
			plan: selectedPlan,
			state: "" as EnquiryFormType["state"],
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

	// Enterprise is an enquiry for the sales team and is saved at once. Lite, Basic and Standard are
	// sign-ups: the server first emails a code to prove the email, and the request reaches the
	// approvers' queue once the code is entered (SignupOtpStep).
	async function send(values: EnquiryFormType) {
		setServerError(null);
		try {
			if (values.plan === "enterprise")
				setSubmitted({ existingUsername: null, reference: await submitSalesEnquiry(values), values });
			else {
				await sendSignupOtp(values);
				setOtpFor(values);
			}
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
			setSubmitted({ existingUsername: null, reference: "", values });
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
		reset({
			...watch(),
			businessName: "",
			city: "",
			email: "",
			gstin: "",
			message: "",
			mobile: "",
			name: "",
			state: "" as EnquiryFormType["state"],
		});
		setOtpFor(null);
		setServerError(null);
		setSubmitted(null);
	}

	function handleVerified(result: SignupResultType) {
		if (!otpFor) return;
		setSubmitted({
			existingUsername: result.existing_login ? result.username : null,
			reference: result.reference,
			values: otpFor,
		});
		setOtpFor(null);
	}

	const submittedPlan = findLivePlan(plans, submitted?.values.plan);
	if (submittedPlan && submitted)
		return (
			<EnquirySuccess
				existingUsername={submitted.existingUsername}
				onReset={handleReset}
				plan={submittedPlan}
				reference={submitted.reference}
				values={submitted.values}
			/>
		);

	if (otpFor)
		return (
			<SignupOtpStep
				email={otpFor.email}
				onBack={() => setOtpFor(null)}
				onResend={() => sendSignupOtp(otpFor)}
				onVerify={async (otp) => handleVerified(await submitSignup(otpFor.email.trim().toLowerCase(), otp))}
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

			<Field error={errors.city?.message} htmlFor="city" label="City" required>
				{(aria) => <Input autoComplete="address-level2" {...aria} {...register("city")} />}
			</Field>

			<Field error={errors.state?.message} htmlFor="state" label="State" required>
				{(aria) => (
					<Controller
						control={control}
						name="state"
						render={({ field }) => (
							<Select onValueChange={field.onChange} value={field.value}>
								<SelectTrigger className="w-full" onBlur={field.onBlur} {...aria}>
									<SelectValue placeholder="Choose your state" />
								</SelectTrigger>
								<SelectContent>
									{indianStates.map((state) => (
										<SelectItem key={state} value={state}>
											{state}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
				)}
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
							{plan.monthlyPrice > 0 && (plan.setupFee > 0 ? ", both + GST" : " + GST")}
						</p>
					) : (
						<span />
					)}
					<Button disabled={isSubmitting || !isValid} size="lg" type="submit">
						{isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
						{isSubmitting
							? "Sending…"
							: plan?.code === "enterprise"
								? "Send enquiry"
								: isLite
									? "Confirm Lite signup"
									: "Send code"}
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
