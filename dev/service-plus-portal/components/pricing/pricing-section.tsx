"use client";

import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Reveal } from "@/components/layout/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { PlanCard } from "@/components/pricing/plan-card";
import { PlanRecommender } from "@/components/pricing/plan-recommender";
import { SalesEnquiryForm } from "@/components/pricing/sales-enquiry-form";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { findPlan, type PlanCodeType } from "@/content/pricing";
import { usePlanPrices } from "@/lib/plan-prices";

// Owns the selected plan shared by the recommender, the cards and the enquiry form. Picking a
// plan anywhere preselects it and scrolls to the form; an incoming /pricing?plan=basic link does
// the same on load.
export const PricingSection = () => {
	const [selectedPlan, setSelectedPlan] = useState<PlanCodeType>("standard");
	const formRef = useRef<HTMLDivElement>(null);
	const { extraBuMonthlyFee, plans } = usePlanPrices();

	useEffect(() => {
		const fromUrl = findPlan(new URLSearchParams(window.location.search).get("plan"));
		if (fromUrl) {
			// Reading the query string after mount: static export has no request-time search params.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setSelectedPlan(fromUrl.code);
			formRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, []);

	function handleSelect(code: PlanCodeType) {
		setSelectedPlan(code);
		formRef.current?.scrollIntoView({ behavior: "smooth" });
	}

	// A recommender result is a plan choice like any other, so it takes the same path: preselect
	// it, then move the visitor to the form they now need to fill in.
	return (
		<>
			<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
				{plans.map((plan, index) => (
					<Reveal delay={index * 0.06} key={plan.code}>
						<PlanCard
							extraBuMonthlyFee={extraBuMonthlyFee}
							onSelect={handleSelect}
							plan={plan}
							selected={plan.code === selectedPlan}
						/>
					</Reveal>
				))}
			</div>

			<div className="mx-auto mt-12 max-w-3xl">
				<PlanRecommender onSelect={handleSelect} />
			</div>

			<div
				className="mx-auto mt-16 max-w-3xl scroll-mt-24 pb-section lg:pb-section-lg"
				id="enquire"
				ref={formRef}
			>
				<div className="relative">
					<SectionHeading intro={MESSAGES.enquiryIntro} title={MESSAGES.enquiryTitle} />
					{/* Beside the title from md up; under the intro on narrow screens. */}
					<Button
						asChild
						className="flex mx-auto mt-4 w-fit md:absolute md:mt-0 md:right-0 md:top-2"
						size="sm"
						variant="outline"
					>
						<Link href="/signup-status">
							<ClipboardCheck />
							Sign-up status
						</Link>
					</Button>
				</div>
				<div className="relative mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
					<SalesEnquiryForm selectedPlan={selectedPlan} />
				</div>
			</div>
		</>
	);
};
