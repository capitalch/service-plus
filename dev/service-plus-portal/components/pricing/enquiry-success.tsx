import { ArrowRight, Check, CheckCircle2, ClipboardCopy, Landmark } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { formatInr, type PlanType } from "@/content/pricing";
import { siteConfig } from "@/content/site-config";

type EnquirySuccessPropsType = {
	onReset: () => void;
	plan: PlanType;
	/** The server's random reference; empty only for the honeypot's fake success. */
	reference: string;
	// Echoed back so the visitor can confirm what was actually sent before they close the tab.
	values: {
		branches: number;
		businessName: string;
		city: string;
		email: string;
		gstin: string;
		mobile: string;
		name: string;
	};
};

function nextStep(plan: PlanType): string {
	if (plan.monthlyPrice === 0) return MESSAGES.successNextLite;
	return plan.provisioning === "database" ? MESSAGES.successNextEnterprise : MESSAGES.successNextBu;
}

// The payment block is the one place to swap for a Razorpay checkout later.
const PaymentDetails = ({ plan }: { plan: PlanType }) => {
	const { bank } = siteConfig;

	return (
		<div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
			<p className="flex items-center gap-2 font-semibold">
				<Landmark className="size-4" />
				Payment
			</p>
			<p className="mt-2 text-muted-foreground">{MESSAGES.successPayment}</p>
			<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
				<dt className="text-muted-foreground">Setup fee</dt>
				<dd className="font-medium">{formatInr(plan.setupFee)}</dd>
				<dt className="text-muted-foreground">Monthly</dt>
				<dd className="font-medium">{formatInr(plan.monthlyPrice)}</dd>
				{bank && (
					<>
						<dt className="text-muted-foreground">Account name</dt>
						<dd className="font-medium">{bank.accountName}</dd>
						<dt className="text-muted-foreground">Account no.</dt>
						<dd className="font-medium">{bank.accountNumber}</dd>
						<dt className="text-muted-foreground">IFSC</dt>
						<dd className="font-medium">{bank.ifsc}</dd>
						<dt className="text-muted-foreground">Bank</dt>
						<dd className="font-medium">
							{bank.bankName}, {bank.branch}
						</dd>
						{bank.upiId && (
							<>
								<dt className="text-muted-foreground">UPI</dt>
								<dd className="font-medium">{bank.upiId}</dd>
							</>
						)}
					</>
				)}
			</dl>
			{!bank && <p className="mt-3 text-muted-foreground">{MESSAGES.paymentPending}</p>}
		</div>
	);
};

const CopyMobile = ({ mobile }: { mobile: string }) => {
	const [copied, setCopied] = useState(false);

	// A static export, so this is a copy button rather than a link that depends on a handler.
	const onCopy = async () => {
		try {
			await navigator.clipboard.writeText(mobile);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard blocked (insecure origin or denied permission) — the number stays selectable.
		}
	};

	return (
		<button
			className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 inline-flex items-center gap-1 rounded-md p-0.5 align-middle transition-colors focus-visible:ring-3 focus-visible:outline-none"
			onClick={onCopy}
			title={`Copy ${mobile}`}
			type="button"
		>
			{copied ? (
				<Check aria-hidden className="text-success size-3.5" />
			) : (
				<ClipboardCopy aria-hidden className="size-3.5" />
			)}
			<span aria-live="polite" className="sr-only">
				{copied ? "Mobile number copied" : "Copy mobile number"}
			</span>
		</button>
	);
};

export const EnquirySuccess = ({ onReset, plan, reference, values }: EnquirySuccessPropsType) => {
	const isLite = plan.code === "lite";
	const recap: { label: string; value: string }[] = [
		{ label: "Name", value: values.name },
		{ label: "Business", value: values.businessName },
		{ label: "Mobile", value: values.mobile },
		{ label: "Email", value: values.email },
		{ label: "City / State", value: values.city },
		{ label: "Branches", value: String(values.branches) },
		{ label: "Plan", value: plan.name },
	];
	if (values.gstin) recap.push({ label: "GSTIN", value: values.gstin });

	// Lite waits for approval; every other plan hears from the sales team first.
	const steps = [
		isLite ? MESSAGES.successLitePending : MESSAGES.successSales,
		nextStep(plan),
		MESSAGES.successSignIn,
	];

	return (
		<div className="space-y-6 text-left" role="status">
			<div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
				<CheckCircle2 aria-hidden className="size-10 shrink-0 text-success" />
				<div>
					<h3 className="text-xl font-semibold">{MESSAGES.successTitle}</h3>
					<p className="text-sm text-muted-foreground">Keep this page — you can check what you sent below.</p>
				</div>
			</div>

			{reference && (
				<div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
					<p className="text-muted-foreground">{MESSAGES.successReference}</p>
					<p className="mt-1 font-mono text-lg font-semibold tracking-wide">{reference}</p>
					{isLite && (
						<Link
							className="mt-2 inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"
							href="/signup-status"
						>
							{MESSAGES.statusLinkText}
							<ArrowRight aria-hidden className="size-3.5" />
						</Link>
					)}
				</div>
			)}

			<div>
				<p className="text-sm font-semibold">{MESSAGES.whatNext}</p>
				<ol className="mt-3 space-y-3">
					{steps.map((step, index) => (
						<li className="flex items-start gap-3 text-sm" key={step}>
							<span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
								{index + 1}
							</span>
							<span className="text-muted-foreground pt-0.5">{step}</span>
						</li>
					))}
				</ol>
			</div>

			{plan.monthlyPrice > 0 && <PaymentDetails plan={plan} />}

			<div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
				<p className="font-semibold">What you sent</p>
				<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
					{recap.map((row) => (
						<div className="contents" key={row.label}>
							<dt className="text-muted-foreground">{row.label}</dt>
							<dd className="flex min-w-0 items-center gap-1 font-medium break-words">
								{row.label === "Mobile" && <CopyMobile mobile={row.value} />}
								{row.value}
							</dd>
						</div>
					))}
				</dl>
			</div>

			<p className="text-muted-foreground text-sm">
				In a hurry? Call us on{" "}
				<a
					className="text-foreground font-medium underline underline-offset-4"
					href={`tel:${siteConfig.phoneE164}`}
				>
					{siteConfig.phone}
				</a>{" "}
				during {siteConfig.businessHours}.
			</p>

			<Button onClick={onReset} type="button" variant="outline">
				Send another enquiry
			</Button>
		</div>
	);
};
