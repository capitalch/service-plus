import { CheckCircle2, Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { formatInr, type PlanType } from "@/content/pricing";
import { siteConfig } from "@/content/site-config";

type EnquirySuccessPropsType = {
	onReset: () => void;
	plan: PlanType;
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

export const EnquirySuccess = ({ onReset, plan }: EnquirySuccessPropsType) => {
	return (
		<div className="space-y-5 text-center sm:text-left" role="status">
			<div className="flex flex-col items-center gap-3 sm:flex-row">
				<CheckCircle2 className="size-10 shrink-0 text-success" />
				<div>
					<h3 className="text-xl font-semibold">{MESSAGES.successTitle}</h3>
					<p className="text-sm text-muted-foreground">{MESSAGES.successBody}</p>
				</div>
			</div>

			<div className="text-left text-sm">
				<p className="font-semibold">{MESSAGES.whatNext}</p>
				<p className="mt-1 text-muted-foreground">{nextStep(plan)}</p>
			</div>

			{plan.monthlyPrice > 0 && <PaymentDetails plan={plan} />}

			<Button onClick={onReset} type="button" variant="outline">
				Send another enquiry
			</Button>
		</div>
	);
};
