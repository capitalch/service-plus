"use client";

import { useEffect, useState } from "react";

import { extraBuMonthlyFee, plans as fallbackPlans, type PlanCodeType, type PlanType } from "@/content/pricing";
import { fetchPlanPrices, type PlanPricesResponseType } from "@/lib/api";

export type LivePricesType = {
	extraBuMonthlyFee: number;
	plans: PlanType[];
};

const FALLBACK: LivePricesType = { extraBuMonthlyFee, plans: fallbackPlans };

// One request per page load, shared by every component that shows a price.
let request: Promise<LivePricesType> | null = null;
let loaded: LivePricesType | null = null;

function merge(response: PlanPricesResponseType): LivePricesType {
	const byCode = new Map(response.plans.map((p) => [p.plan_code, p]));
	return {
		extraBuMonthlyFee: response.extra_bu_monthly_fee,
		plans: fallbackPlans.map((plan) => {
			const live = byCode.get(plan.code);
			return live
				? {
						...plan,
						businessUnits:
							plan.code === "enterprise" ? response.enterprise_included_bus : plan.businessUnits,
						monthlyPrice: live.monthly_fee,
						setupFee: live.setup_fee,
					}
				: plan;
		}),
	};
}

function loadPrices(): Promise<LivePricesType> {
	request ??= fetchPlanPrices()
		.then((response) => {
			loaded = merge(response);
			return loaded;
		})
		// Keep showing the built-in prices; a later page load tries again.
		.catch(() => FALLBACK);
	return request;
}

/** The price list: the built-in fallback first, then the server's live prices once loaded. */
export const usePlanPrices = (): LivePricesType => {
	const [prices, setPrices] = useState<LivePricesType>(loaded ?? FALLBACK);

	useEffect(() => {
		let active = true;
		loadPrices().then((result) => {
			if (active) setPrices(result);
		});
		return () => {
			active = false;
		};
	}, []);

	return prices;
};

export function findLivePlan(plans: PlanType[], code: string | null | undefined): PlanType | undefined {
	return plans.find((plan) => plan.code === (code as PlanCodeType));
}
