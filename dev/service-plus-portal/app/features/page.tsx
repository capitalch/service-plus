import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FeatureDetailSection } from "@/components/features/feature-detail-section";
import { LiveDemoButton } from "@/components/layout/live-demo-button";
import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { features } from "@/content/features";

export const metadata: Metadata = {
	alternates: { canonical: "/features/" },
	description:
		"A closer look at Service+: job management, spare-parts inventory, WhatsApp updates, GST invoicing, reports, multi-branch support, warranty jobs and role-based access.",
	title: "Features",
	openGraph: {
		description: "A closer look at each part of Service+ — job management, spare-parts inventory, WhatsApp updates, GST invoicing, reports, and more.",
		title: "Features | Service+",
		type: "website",
		url: "/features/",
	},
};

const FeaturesPage = () => {
	return (
		<>
			<PageHero eyebrow="Features" intro={MESSAGES.featuresPageIntro} title={MESSAGES.featuresPageTitle}>
				<div className="mt-8 flex justify-center">
					<LiveDemoButton size="lg" />
				</div>
			</PageHero>

			<div className="mx-auto w-full max-w-6xl px-page lg:px-page-lg">
				<div className="divide-y divide-border">
					{features.map((feature, index) => (
						<FeatureDetailSection feature={feature} key={feature.title} reversed={index % 2 === 1} />
					))}
				</div>

				<div className="flex flex-col items-center justify-center gap-3 py-section-lg sm:flex-row lg:py-section-lg">
					<LiveDemoButton size="lg" />
					<Button asChild size="lg">
						<Link href="/pricing">
							See pricing
							<ArrowRight />
						</Link>
					</Button>
				</div>
			</div>
		</>
	);
};

export default FeaturesPage;
