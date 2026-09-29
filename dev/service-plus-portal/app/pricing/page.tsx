import type { Metadata } from "next";

import { PageHero } from "@/components/layout/page-hero";
import { Faq } from "@/components/pricing/faq";
import { PlanComparisonTable } from "@/components/pricing/plan-comparison-table";
import { PricingSection } from "@/components/pricing/pricing-section";
import { MESSAGES } from "@/constants/messages";
import { plans } from "@/content/pricing";
import { siteConfig } from "@/content/site-config";

export const metadata: Metadata = {
	alternates: { canonical: "/pricing/" },
	description: "Service+ plans: Lite (free), Basic, Standard and Enterprise. Monthly pricing in INR.",
	title: "Pricing",
};

const jsonLd = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	applicationCategory: "BusinessApplication",
	description: siteConfig.description,
	name: siteConfig.name,
	offers: plans.map((plan) => ({
		"@type": "Offer",
		name: plan.name,
		price: plan.monthlyPrice,
		priceCurrency: "INR",
	})),
	operatingSystem: "Web",
	url: siteConfig.url,
};

const PricingPage = () => {
	return (
		<>
			<script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} type="application/ld+json" />
			<PageHero eyebrow="Pricing" intro={MESSAGES.pricingIntro} title={MESSAGES.pricingTitle} />

			<section className="mx-auto w-full max-w-6xl px-page lg:px-page-lg">
				<PricingSection />
			</section>

			<section className="mx-auto w-full max-w-6xl px-page pt-8 lg:px-page-lg">
				<h2 className="mb-4 text-2xl font-bold tracking-tight">Compare plans</h2>
				<PlanComparisonTable />
				<p className="mt-3 text-xs text-muted-foreground">{MESSAGES.limitsNote}</p>
				<p className="mt-1 text-xs text-muted-foreground">{MESSAGES.setupFeeNote}</p>
			</section>

			<Faq />
		</>
	);
};

export default PricingPage;
