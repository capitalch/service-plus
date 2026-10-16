"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, MailCheck, RotateCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MESSAGES } from "@/constants/messages";
import { ApiError } from "@/lib/api";

// Keep in step with RESEND_SECONDS in the server's app/services/signup_otp.py.
const RESEND_SECONDS = 60;

const otpSchema = z.object({
	otp: z.string().regex(/^\d{6}$/, MESSAGES.errOtp),
});

type OtpFormType = z.infer<typeof otpSchema>;

type SignupOtpStepPropsType = {
	/** Where the code was sent. */
	email: string;
	/** Back to the filled form, e.g. to correct the email. */
	onBack: () => void;
	/** Ask the server for a new code for the same form. */
	onResend: () => Promise<void>;
	/** Send the code; resolves when the request is saved, throws ApiError when refused. */
	onVerify: (otp: string) => Promise<void>;
};

// Step two of a Lite / Basic / Standard sign-up or a Lite upgrade: the 6-digit code emailed to the
// applicant. The request is saved only when the code is right (plans/plan.md Step 5).
export const SignupOtpStep = ({ email, onBack, onResend, onVerify }: SignupOtpStepPropsType) => {
	const [errorCode, setErrorCode] = useState<string | null>(null);
	const [resending, setResending] = useState(false);
	const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
	const [serverError, setServerError] = useState<string | null>(null);

	const {
		control,
		formState: { errors, isSubmitting, isValid },
		handleSubmit,
	} = useForm<OtpFormType>({
		defaultValues: { otp: "" },
		mode: "onChange",
		resolver: zodResolver(otpSchema),
	});

	useEffect(() => {
		if (secondsLeft <= 0) return;
		const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
		return () => clearTimeout(timer);
	}, [secondsLeft]);

	function handleError(error: unknown) {
		// A refusal the applicant can act on: wrong or expired code, too many tries, a Lite to upgrade…
		if (error instanceof ApiError && error.code) {
			setErrorCode(error.code);
			setServerError(error.message);
		} else if (error instanceof ApiError && error.status === 429) toast.error(MESSAGES.enquiryRateLimited);
		else toast.error(MESSAGES.enquiryFailed);
	}

	async function onSubmit({ otp }: OtpFormType) {
		setErrorCode(null);
		setServerError(null);
		try {
			await onVerify(otp);
		} catch (error) {
			handleError(error);
		}
	}

	async function handleResend() {
		setErrorCode(null);
		setServerError(null);
		setResending(true);
		try {
			await onResend();
			toast.success(MESSAGES.otpResent);
			setSecondsLeft(RESEND_SECONDS);
		} catch (error) {
			handleError(error);
		} finally {
			setResending(false);
		}
	}

	const error = serverError ?? errors.otp?.message;

	return (
		<form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
			<div className="flex items-start gap-3">
				<MailCheck aria-hidden className="mt-0.5 size-8 shrink-0 text-primary" />
				<div>
					<h3 className="text-lg font-semibold">{MESSAGES.otpTitle}</h3>
					<p className="text-sm text-muted-foreground">
						{MESSAGES.otpIntro} <span className="font-medium break-all text-foreground">{email}</span>.{" "}
						{MESSAGES.otpValidity}
					</p>
				</div>
			</div>

			<div className="max-w-xs space-y-2">
				<Label htmlFor="otp">
					Verification code{" "}
					<span aria-hidden className="text-destructive">
						*
					</span>
				</Label>
				<Controller
					control={control}
					name="otp"
					render={({ field }) => (
						<Input
							aria-describedby={error ? "otp-error" : undefined}
							aria-invalid={error ? true : undefined}
							aria-required
							autoComplete="one-time-code"
							autoFocus
							className="font-mono text-lg tracking-[0.4em]"
							id="otp"
							inputMode="numeric"
							maxLength={6}
							name={field.name}
							onBlur={field.onBlur}
							onChange={(e) => {
								setServerError(null);
								field.onChange(e.target.value.replace(/\D/g, "").slice(0, 6));
							}}
							placeholder="••••••"
							ref={field.ref}
							value={field.value}
						/>
					)}
				/>
				{error && (
					<p className="flex items-start gap-1.5 text-xs text-destructive" id="otp-error" role="alert">
						<AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
						{error}
					</p>
				)}
				{errorCode === "SIGNUP_LITE_EXISTS" && (
					<Link
						className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4"
						href="/upgrade"
					>
						{MESSAGES.upgradeLinkText}
						<ArrowRight aria-hidden className="size-3.5" />
					</Link>
				)}
			</div>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<Button disabled={isSubmitting || !isValid} size="lg" type="submit">
					{isSubmitting ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
					{isSubmitting ? "Verifying…" : "Verify"}
				</Button>
				<Button disabled={resending || secondsLeft > 0} onClick={handleResend} type="button" variant="outline">
					{resending ? <Loader2 className="animate-spin" /> : <RotateCw />}
					Resend code
				</Button>
				<Button onClick={onBack} type="button" variant="ghost">
					<ArrowLeft />
					Change email
				</Button>
			</div>
			<p aria-live="polite" className="text-xs text-muted-foreground">
				{secondsLeft > 0
					? MESSAGES.otpResendIn.replace("{seconds}", String(secondsLeft))
					: MESSAGES.otpChangeEmailHint}
			</p>
		</form>
	);
};
