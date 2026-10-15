import { CtaBand } from "@/components/home/cta-band";
import { FeatureGrid } from "@/components/home/feature-grid";
import { Hero } from "@/components/home/hero";
import { OwnerBenefits } from "@/components/home/owner-benefits";
import { ProofSection } from "@/components/home/proof-section";
import { ScreenshotGallery } from "@/components/home/screenshot-gallery";
import { ServiceCentreHighlight } from "@/components/home/service-centre-highlight";
import { TestimonialSection } from "@/components/home/testimonial-section";
import { TrustStrip } from "@/components/home/trust-strip";
import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/content/site-config";

export const metadata: Metadata = {
	alternates: { canonical: "/" },
	description:
		"Service+ is cloud repair workshop management software for Indian electronics and appliance service centres — job cards, spare parts, GST invoicing, WhatsApp updates and reports.",
	title: "Service+ — Repair workshop management software",
	openGraph: {
		description: "Cloud repair workshop software for Indian service centres — job cards, spare parts, GST invoicing, WhatsApp updates and reports.",
		title: "Service+ — Repair workshop management software",
		type: "website",
		url: "/",
	},
};

const HomePage = () => {
	const orgJsonLd = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: siteConfig.name,
		url: siteConfig.url,
		logo: `${siteConfig.url}/opengraph-image/`,
		contactPoint: [
			{
				"@type": "ContactPoint",
				telephone: siteConfig.phoneE164,
				contactType: "customer support",
				areaServed: "IN",
				availableLanguage: "English",
			},
		],
	};

	return (
		<>
			<script dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} type="application/ld+json" />
			<Hero />
			<TrustStrip />
			<OwnerBenefits />
			<FeatureGrid />
			<ServiceCentreHighlight />
			<ScreenshotGallery />
			<ProofSection />
			<TestimonialSection />
			<CtaBand />
		</>
	);
};

export default HomePage;
