// security.bu rows as the subscription screens read them (BillingSql.GET_BU_SUBSCRIPTIONS).

export type BuSubscriptionType = {
	awaiting_first_payment: boolean;
	billing_hold: boolean;
	billing_required: boolean;
	branch_limit: number | null;
	code: string;
	id: number;
	is_active: boolean;
	monthly_fee_paise: number | null;
	name: string;
	paid_through: string | null;
	plan_code: string | null;
	status: "active" | "due_soon" | "not_billed" | "read_only";
};

export type PlanPreviewType = {
	blocking_branches: { code: string; counts: Record<string, number>; name: string }[];
	monthly_fee_paise: number;
	paid_through_after: string | null;
	paid_through_before: string | null;
	plan_code: string;
};
