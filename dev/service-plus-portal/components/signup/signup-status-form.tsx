"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Clock, Loader2, LogIn, Search, XCircle } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MESSAGES } from "@/constants/messages";
import { findPlan } from "@/content/pricing";
import { siteConfig } from "@/content/site-config";
import { ApiError, fetchSignupStatus, type SignupStatusType } from "@/lib/api";
import { MOBILE_REGEX, normalizeMobile } from "@/lib/validators";

const statusSchema = z.object({
	email: z.email(MESSAGES.errEmail).max(200, MESSAGES.errEmail),
	mobile: z.string().regex(MOBILE_REGEX, MESSAGES.errMobile),
});

type StatusFormType = z.infer<typeof statusSchema>;

const FieldError = ({ id, message }: { id: string; message?: string }) =>
	message ? (
		<p className="flex items-start gap-1.5 text-xs text-destructive" id={id}>
			<AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
			{message}
		</p>
	) : null;

const StatusResult = ({ result }: { result: SignupStatusType }) => {
	const planName = findPlan(result.plan_code)?.name ?? result.plan_code;

	if (result.status === "approved")
		return (
			<div className="space-y-3 rounded-xl border border-success/40 bg-success/5 p-4 text-sm">
				<p className="flex items-center gap-2 font-semibold">
					<CheckCircle2 aria-hidden className="size-4 text-success" />
					{planName} — {MESSAGES.statusApproved}
				</p>
				{result.login_email && (
					<p className="text-muted-foreground">
						{MESSAGES.statusLoginEmailHint}{" "}
						<span className="font-medium text-foreground">{result.login_email}</span>
					</p>
				)}
				{result.client_name && (
					<p className="text-muted-foreground">
						{MESSAGES.statusClientHint}{" "}
						<span className="font-medium text-foreground">{result.client_name}</span>
					</p>
				)}
				<Button asChild size="sm">
					<a href={siteConfig.appUrl} rel="noopener" target="_blank">
						<LogIn />
						Log in
					</a>
				</Button>
			</div>
		);

	if (result.status === "rejected")
		return (
			<div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
				<p className="flex items-center gap-2 font-semibold">
					<XCircle aria-hidden className="size-4 text-muted-foreground" />
					{planName} — {MESSAGES.statusRejected}
				</p>
				{result.rejection_reason && <p className="text-muted-foreground">{result.rejection_reason}</p>}
			</div>
		);

	return (
		<div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
			<p className="flex items-center gap-2 font-semibold">
				<Clock aria-hidden className="size-4 text-primary" />
				{planName} — {MESSAGES.statusPending}
			</p>
		</div>
	);
};

// Mobile and email must match the same request; anything else is "no request found", so the page
// never confirms who has applied.
export const SignupStatusForm = () => {
	const [lookupError, setLookupError] = useState<string | null>(null);
	const [result, setResult] = useState<SignupStatusType | null>(null);

	const {
		control,
		formState: { errors, isSubmitting, isValid },
		handleSubmit,
		register,
	} = useForm<StatusFormType>({
		defaultValues: { email: "", mobile: "" },
		mode: "onChange",
		resolver: zodResolver(statusSchema),
	});

	async function onSubmit(values: StatusFormType) {
		setLookupError(null);
		setResult(null);
		try {
			setResult(await fetchSignupStatus(values.mobile, values.email.trim()));
		} catch (error) {
			if (error instanceof ApiError && error.status === 404) setLookupError(MESSAGES.statusNotFound);
			else if (error instanceof ApiError && error.status === 429) setLookupError(MESSAGES.enquiryRateLimited);
			else if (error instanceof ApiError && error.code) setLookupError(error.message);
			else setLookupError(MESSAGES.statusFailed);
		}
	}

	return (
		<div className="space-y-6">
			<form className="grid gap-5 sm:grid-cols-2" noValidate onSubmit={handleSubmit(onSubmit)}>
				<div className="space-y-2">
					<Label htmlFor="status-mobile">
						Mobile{" "}
						<span aria-hidden className="text-destructive">
							*
						</span>
					</Label>
					<Controller
						control={control}
						name="mobile"
						render={({ field }) => (
							<Input
								aria-describedby={errors.mobile ? "status-mobile-error" : undefined}
								aria-invalid={errors.mobile ? true : undefined}
								autoComplete="tel-national"
								id="status-mobile"
								inputMode="numeric"
								name={field.name}
								onBlur={field.onBlur}
								onChange={(e) => field.onChange(normalizeMobile(e.target.value))}
								placeholder="10-digit mobile"
								ref={field.ref}
								type="tel"
								value={field.value}
							/>
						)}
					/>
					<FieldError id="status-mobile-error" message={errors.mobile?.message} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="status-email">
						Email{" "}
						<span aria-hidden className="text-destructive">
							*
						</span>
					</Label>
					<Input
						aria-describedby={errors.email ? "status-email-error" : undefined}
						aria-invalid={errors.email ? true : undefined}
						autoComplete="email"
						id="status-email"
						type="email"
						{...register("email")}
					/>
					<FieldError id="status-email-error" message={errors.email?.message} />
				</div>
				<div className="sm:col-span-2">
					<Button disabled={isSubmitting || !isValid} type="submit">
						{isSubmitting ? <Loader2 className="animate-spin" /> : <Search />}
						{isSubmitting ? "Checking…" : "Check status"}
					</Button>
				</div>
			</form>

			<div aria-live="polite">
				{lookupError && (
					<p className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
						<AlertCircle aria-hidden className="mt-px size-4 shrink-0 text-muted-foreground" />
						{lookupError}
					</p>
				)}
				{result && <StatusResult result={result} />}
			</div>
		</div>
	);
};
