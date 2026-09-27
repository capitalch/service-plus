"use client";

import { useEffect, useRef, useState } from "react";

import { Reveal } from "@/components/layout/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { PlanCard } from "@/components/pricing/plan-card";
import { SalesEnquiryForm } from "@/components/pricing/sales-enquiry-form";
import { MESSAGES } from "@/constants/messages";
import { findPlan, plans, type PlanCodeType } from "@/content/pricing";

// Owns the selected plan shared by the cards and the enquiry form. A card click preselects the
// plan and scrolls to the form; an incoming /pricing/?plan=basic link does the same on load.
export const PricingSection = () => {
	const [selectedPlan, setSelectedPlan] = useState<PlanCodeType>("standard");
	const formRef = useRef<HTMLDivElement>(null);

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

	return (
		<>
			<div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
				{plans.map((plan, index) => (
					<Reveal delay={index * 0.06} key={plan.code}>
						<PlanCard onSelect={handleSelect} plan={plan} />
					</Reveal>
				))}
			</div>

			<div className="mx-auto mt-24 max-w-3xl scroll-mt-24" id="enquire" ref={formRef}>
				<SectionHeading intro={MESSAGES.enquiryIntro} title={MESSAGES.enquiryTitle} />
				<div className="relative mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
					<SalesEnquiryForm selectedPlan={selectedPlan} />
				</div>
			</div>
		</>
	);
};
