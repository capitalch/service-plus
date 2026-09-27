"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { EnquirySuccess } from "@/components/pricing/enquiry-success";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGES } from "@/constants/messages";
import { findPlan, formatInr, planCodes, plans, type PlanCodeType } from "@/content/pricing";
import { ApiError, submitSalesEnquiry } from "@/lib/api";
import { GSTIN_REGEX, MOBILE_REGEX, normalizeGstin, normalizeMobile } from "@/lib/validators";

const enquirySchema = z.object({
	branches: z
		.number({ error: MESSAGES.errBranches })
		.int(MESSAGES.errBranches)
		.min(1, MESSAGES.errBranches)
		.max(50, MESSAGES.errBranches),
	businessName: z.string().trim().min(2, MESSAGES.errBusinessName).max(200, MESSAGES.errBusinessName),
	city: z.string().trim().min(2, MESSAGES.errCity).max(100, MESSAGES.errCity),
	email: z.email(MESSAGES.errEmail).max(200, MESSAGES.errEmail),
	gstin: z.string().refine((v) => v === "" || GSTIN_REGEX.test(v), MESSAGES.errGstin),
	message: z.string().max(2000, MESSAGES.errMessage),
	mobile: z.string().regex(MOBILE_REGEX, MESSAGES.errMobile),
	name: z.string().trim().min(2, MESSAGES.errName).max(100, MESSAGES.errName),
	plan: z.enum(planCodes, { error: MESSAGES.errPlan }),
	// Honeypot: hidden from people, filled in by bots.
	website: z.string(),
});

type EnquiryFormType = z.infer<typeof enquirySchema>;

type SalesEnquiryFormPropsType = {
	selectedPlan: PlanCodeType;
};

const Required = () => (
	<span aria-hidden className="text-destructive">
		*
	</span>
);

const FieldError = ({ id, message }: { id: string; message?: string }) =>
	message ? (
		<p className="text-xs text-destructive" id={id}>
			{message}
		</p>
	) : null;

export const SalesEnquiryForm = ({ selectedPlan }: SalesEnquiryFormPropsType) => {
	const [submittedPlan, setSubmittedPlan] = useState<PlanCodeType | null>(null);

	const {
		control,
		formState: { errors, isSubmitting, isValid },
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
		mode: "all",
		resolver: zodResolver(enquirySchema),
	});

	// A plan card was clicked above the form.
	useEffect(() => {
		setValue("plan", selectedPlan, { shouldValidate: true });
	}, [selectedPlan, setValue]);

	const plan = findPlan(watch("plan"));
	const branches = watch("branches");
	const showBranchesHint = plan !== undefined && plan.provisioning === "bu" && branches > 1;

	async function onSubmit(values: EnquiryFormType) {
		// A bot filled the honeypot: pretend it worked, send nothing.
		if (values.website) {
			setSubmittedPlan(values.plan);
			return;
		}
		try {
			await submitSalesEnquiry(values);
			setSubmittedPlan(values.plan);
		} catch (error) {
			toast.error(
				error instanceof ApiError && error.status === 429
					? MESSAGES.enquiryRateLimited
					: MESSAGES.enquiryFailed,
			);
		}
	}

	function handleReset() {
		reset({ ...watch(), businessName: "", city: "", email: "", gstin: "", message: "", mobile: "", name: "" });
		setSubmittedPlan(null);
	}

	const submittedPlanData = findPlan(submittedPlan);
	if (submittedPlanData) return <EnquirySuccess onReset={handleReset} plan={submittedPlanData} />;

	return (
		<form className="grid gap-5 sm:grid-cols-2" noValidate onSubmit={handleSubmit(onSubmit)}>
			<div className="space-y-2 sm:col-span-2">
				<Label htmlFor="plan">
					Plan <Required />
				</Label>
				<Controller
					control={control}
					name="plan"
					render={({ field }) => (
						<Select onValueChange={field.onChange} value={field.value}>
							<SelectTrigger aria-invalid={!!errors.plan} className="w-full" id="plan">
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
				<FieldError id="plan-error" message={errors.plan?.message} />
			</div>

			<div className="space-y-2">
				<Label htmlFor="name">
					Your name <Required />
				</Label>
				<Input aria-invalid={!!errors.name} autoComplete="name" id="name" {...register("name")} />
				<FieldError id="name-error" message={errors.name?.message} />
			</div>

			<div className="space-y-2">
				<Label htmlFor="businessName">
					Business name <Required />
				</Label>
				<Input
					aria-invalid={!!errors.businessName}
					autoComplete="organization"
					id="businessName"
					{...register("businessName")}
				/>
				<FieldError id="businessName-error" message={errors.businessName?.message} />
			</div>

			<div className="space-y-2">
				<Label htmlFor="mobile">
					Mobile <Required />
				</Label>
				<Controller
					control={control}
					name="mobile"
					render={({ field }) => (
						<Input
							aria-invalid={!!errors.mobile}
							autoComplete="tel-national"
							id="mobile"
							inputMode="numeric"
							name={field.name}
							onBlur={field.onBlur}
							onChange={(e) => field.onChange(normalizeMobile(e.target.value))}
							placeholder="10-digit mobile"
							ref={field.ref}
							value={field.value}
						/>
					)}
				/>
				<FieldError id="mobile-error" message={errors.mobile?.message} />
			</div>

			<div className="space-y-2">
				<Label htmlFor="email">
					Email <Required />
				</Label>
				<Input
					aria-invalid={!!errors.email}
					autoComplete="email"
					id="email"
					type="email"
					{...register("email")}
				/>
				<FieldError id="email-error" message={errors.email?.message} />
			</div>

			<div className="space-y-2">
				<Label htmlFor="city">
					City / State <Required />
				</Label>
				<Input aria-invalid={!!errors.city} autoComplete="address-level2" id="city" {...register("city")} />
				<FieldError id="city-error" message={errors.city?.message} />
			</div>

			<div className="space-y-2">
				<Label htmlFor="gstin">GSTIN</Label>
				<Controller
					control={control}
					name="gstin"
					render={({ field }) => (
						<Input
							aria-invalid={!!errors.gstin}
							id="gstin"
							maxLength={15}
							name={field.name}
							onBlur={field.onBlur}
							onChange={(e) => field.onChange(normalizeGstin(e.target.value))}
							placeholder="Optional"
							ref={field.ref}
							value={field.value}
						/>
					)}
				/>
				<FieldError id="gstin-error" message={errors.gstin?.message} />
			</div>

			<div className="space-y-2">
				<Label htmlFor="branches">Branches needed</Label>
				<Input
					aria-invalid={!!errors.branches}
					id="branches"
					inputMode="numeric"
					max={50}
					min={1}
					type="number"
					{...register("branches", { valueAsNumber: true })}
				/>
				<FieldError id="branches-error" message={errors.branches?.message} />
				{showBranchesHint && !errors.branches && (
					<p className="text-xs text-muted-foreground">{MESSAGES.branchesHint}</p>
				)}
			</div>

			<div className="space-y-2 sm:col-span-2">
				<Label htmlFor="message">Message</Label>
				<Textarea
					aria-invalid={!!errors.message}
					id="message"
					placeholder="Anything we should know: current software, number of technicians, brands you service…"
					rows={4}
					{...register("message")}
				/>
				<FieldError id="message-error" message={errors.message?.message} />
			</div>

			<div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
				<label htmlFor="website">Website</label>
				<input autoComplete="off" id="website" tabIndex={-1} type="text" {...register("website")} />
			</div>

			<div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
				{plan && (
					<p className="text-sm text-muted-foreground">
						{plan.name}: {plan.monthlyPrice === 0 ? "Free" : `${formatInr(plan.monthlyPrice)} / month`}
						{plan.setupFee > 0 && ` + ${formatInr(plan.setupFee)} setup`}
					</p>
				)}
				<Button disabled={!isValid || isSubmitting} size="lg" type="submit">
					{isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
					Send enquiry
				</Button>
			</div>
		</form>
	);
};
