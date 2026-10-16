"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PaymentDetails } from "@/components/pricing/enquiry-success";
import { SignupOtpStep } from "@/components/signup/signup-otp-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MESSAGES } from "@/constants/messages";
import { formatInr } from "@/content/pricing";
import { ApiError, sendUpgradeOtp, submitUpgrade, type UpgradeResultType } from "@/lib/api";
import { findLivePlan, usePlanPrices } from "@/lib/plan-prices";

const UPGRADE_PLANS = ["basic", "standard"] as const;

const upgradeSchema = z.object({
	email: z.email(MESSAGES.errEmail).max(200, MESSAGES.errEmail),
	plan: z.enum(UPGRADE_PLANS, { error: MESSAGES.errPlan }),
});

type UpgradeFormType = z.infer<typeof upgradeSchema>;

const FieldError = ({ id, message }: { id: string; message?: string }) =>
	message ? (
		<p className="flex items-start gap-1.5 text-xs text-destructive" id={id}>
			<AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
			{message}
		</p>
	) : null;

// Lite → Basic / Standard: the owner's sign-in email gets a code, and the request lands in the
// approvers' queue with the plan's setup fee. Whether the email owns a Lite business unit is
// checked only after the code, so the page never confirms who has an account.
export const UpgradeForm = () => {
	const [otpFor, setOtpFor] = useState<UpgradeFormType | null>(null);
	const [result, setResult] = useState<UpgradeResultType | null>(null);
	const [serverError, setServerError] = useState<string | null>(null);
	const { plans } = usePlanPrices();

	const {
		control,
		formState: { errors, isSubmitting, isValid },
		handleSubmit,
		register,
		reset,
	} = useForm<UpgradeFormType>({
		defaultValues: { email: "", plan: "basic" },
		mode: "onChange",
		resolver: zodResolver(upgradeSchema),
	});

	async function onSubmit(values: UpgradeFormType) {
		setServerError(null);
		try {
			await sendUpgradeOtp(values.email.trim().toLowerCase(), values.plan);
			setOtpFor(values);
		} catch (error) {
			if (error instanceof ApiError && error.code) setServerError(error.message);
			else if (error instanceof ApiError && error.status === 429) toast.error(MESSAGES.enquiryRateLimited);
			else toast.error(MESSAGES.enquiryFailed);
		}
	}

	if (result) {
		const plan = findLivePlan(plans, result.plan_code);
		return (
			<div className="space-y-5" role="status">
				<div className="flex items-start gap-3">
					<CheckCircle2 aria-hidden className="mt-0.5 size-8 shrink-0 text-success" />
					<div>
						<h3 className="text-lg font-semibold">{MESSAGES.upgradeSuccessTitle}</h3>
						<p className="text-sm text-muted-foreground">
							{MESSAGES.upgradeSuccessBody
								.replace("{bu_name}", result.bu_name)
								.replace("{plan_name}", plan?.name ?? result.plan_code)}
						</p>
					</div>
				</div>
				<div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
					<p className="text-muted-foreground">{MESSAGES.successReference}</p>
					<p className="mt-1 font-mono text-lg font-semibold tracking-wide">{result.reference}</p>
					<Link
						className="mt-2 inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"
						href="/signup-status"
					>
						{MESSAGES.statusLinkText}
						<ArrowRight aria-hidden className="size-3.5" />
					</Link>
				</div>
				{plan && <PaymentDetails plan={plan} />}
			</div>
		);
	}

	if (otpFor)
		return (
			<SignupOtpStep
				email={otpFor.email}
				onBack={() => setOtpFor(null)}
				onResend={() => sendUpgradeOtp(otpFor.email.trim().toLowerCase(), otpFor.plan)}
				onVerify={async (otp) => {
					setResult(await submitUpgrade(otpFor.email.trim().toLowerCase(), otp));
					setOtpFor(null);
					reset();
				}}
			/>
		);

	return (
		<form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
			{serverError && (
				<p
					className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
					role="alert"
				>
					<AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
					{serverError}
				</p>
			)}
			<div className="space-y-2">
				<Label htmlFor="upgrade-email">
					Sign-in email{" "}
					<span aria-hidden className="text-destructive">
						*
					</span>
				</Label>
				<Input
					aria-describedby={errors.email ? "upgrade-email-error" : undefined}
					aria-invalid={errors.email ? true : undefined}
					aria-required
					autoComplete="email"
					id="upgrade-email"
					type="email"
					{...register("email")}
				/>
				<FieldError id="upgrade-email-error" message={errors.email?.message} />
			</div>
			<div className="space-y-2">
				<Label htmlFor="upgrade-plan">
					New plan{" "}
					<span aria-hidden className="text-destructive">
						*
					</span>
				</Label>
				<Controller
					control={control}
					name="plan"
					render={({ field }) => (
						<Select onValueChange={field.onChange} value={field.value}>
							<SelectTrigger className="w-full" id="upgrade-plan">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{UPGRADE_PLANS.map((code) => {
									const plan = findLivePlan(plans, code);
									return (
										<SelectItem key={code} value={code}>
											{plan
												? `${plan.name} — ${formatInr(plan.monthlyPrice)} / month + ${formatInr(plan.setupFee)} setup`
												: code}
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					)}
				/>
				<p className="text-xs text-muted-foreground">{MESSAGES.upgradeKeepData}</p>
			</div>
			<Button disabled={isSubmitting || !isValid} size="lg" type="submit">
				{isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
				{isSubmitting ? "Sending…" : "Send code"}
			</Button>
		</form>
	);
};
