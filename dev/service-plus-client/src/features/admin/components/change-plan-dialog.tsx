import { useState } from "react";
import { AlertTriangleIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { displayDate, inr } from "@/components/shared/billing/billing-dates";
import type { BuSubscriptionType, PlanPreviewType } from "@/components/shared/billing/billing-types";
import { enquiryErrorMessage, runEnquiryMutation } from "@/components/shared/enquiries/enquiry-mutation";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";

type ChangePlanDialogPropsType = {
	bu: BuSubscriptionType;
	dbName: string;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

const PLANS = [
	{ label: "Basic", value: "basic" },
	{ label: "Lite", value: "lite" },
	{ label: "Standard", value: "standard" },
];

/** Move a BU between Lite, Basic and Standard. The server previews the new fee, the rebased
 * paid-through and any branches blocking a downgrade before anything is saved. */
export const ChangePlanDialog = ({ bu, dbName, onOpenChange, onSuccess }: ChangePlanDialogPropsType) => {
	const [plan, setPlan] = useState("");
	const [preview, setPreview] = useState<PlanPreviewType | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	async function choose(value: string) {
		setPlan(value);
		setPreview(null);
		setLoading(true);
		try {
			setPreview(
				await runEnquiryMutation<PlanPreviewType>(GRAPHQL_MAP.changeBuPlan, "changeBuPlan", dbName, {
					bu_id: bu.id,
					plan_code: value,
					preview: true,
				}),
			);
		} catch (error) {
			toast.error(enquiryErrorMessage(error, MESSAGES.ENQUIRY_SAVE_FAILED));
		} finally {
			setLoading(false);
		}
	}

	async function save() {
		setSaving(true);
		try {
			await runEnquiryMutation(GRAPHQL_MAP.changeBuPlan, "changeBuPlan", dbName, {
				bu_id: bu.id,
				plan_code: plan,
			});
			toast.success(MESSAGES.BILLING_PLAN_CHANGED);
			onSuccess();
			onOpenChange(false);
		} catch (error) {
			toast.error(enquiryErrorMessage(error, MESSAGES.ENQUIRY_SAVE_FAILED));
		} finally {
			setSaving(false);
		}
	}

	const blocked = (preview?.blocking_branches.length ?? 0) > 0;
	const dateMoves = preview && preview.paid_through_after !== preview.paid_through_before;

	return (
		<Dialog open onOpenChange={onOpenChange}>
			<DialogContent aria-describedby={undefined} className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold">Change plan — {bu.name}</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-1.5">
					<Label>New plan</Label>
					<Select value={plan} onValueChange={choose}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Choose a plan" />
						</SelectTrigger>
						<SelectContent>
							{PLANS.filter((p) => p.value !== bu.plan_code).map((p) => (
								<SelectItem key={p.value} value={p.value}>
									{p.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
				{preview && !blocked && (
					<div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
						<p>New monthly fee: {preview.monthly_fee_paise ? inr(preview.monthly_fee_paise) : "free"}</p>
						{dateMoves && (
							<p className="mt-1 font-medium text-amber-700">
								Prepaid period now ends {displayDate(preview.paid_through_after)} (was{" "}
								{displayDate(preview.paid_through_before)}).
							</p>
						)}
					</div>
				)}
				{preview && blocked && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
						<p className="flex items-center gap-1.5 font-medium">
							<AlertTriangleIcon className="h-4 w-4" />
							{MESSAGES.BILLING_DOWNGRADE_BLOCKED}
						</p>
						<ul className="mt-2 space-y-1 pl-5 text-xs">
							{preview.blocking_branches.map((b) => (
								<li className="list-disc" key={b.code}>
									<span className="font-medium">
										{b.code} — {b.name}
									</span>
									{Object.keys(b.counts).length > 0 &&
										`: ${Object.entries(b.counts)
											.map(([table, n]) => `${table} ${n}`)
											.join(", ")}`}
								</li>
							))}
						</ul>
					</div>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						className="bg-teal-600 text-white hover:bg-teal-700"
						disabled={!preview || blocked || saving}
						type="button"
						onClick={save}
					>
						{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
						Change plan
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
