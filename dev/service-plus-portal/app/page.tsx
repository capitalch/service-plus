import { BenefitStrip } from "@/components/home/benefit-strip";
import { CtaBand } from "@/components/home/cta-band";
import { FeatureGrid } from "@/components/home/feature-grid";
import { Hero } from "@/components/home/hero";
import { OwnerBenefits } from "@/components/home/owner-benefits";
import { ProofSection } from "@/components/home/proof-section";
import { ScreenshotGallery } from "@/components/home/screenshot-gallery";
import { ServiceCentreHighlight } from "@/components/home/service-centre-highlight";
import { TestimonialCarousel } from "@/components/home/testimonial-carousel";

const HomePage = () => {
	return (
		<>
			<Hero />
			<BenefitStrip />
			<OwnerBenefits />
			<FeatureGrid />
			<ServiceCentreHighlight />
			<ScreenshotGallery />
			{/* Stands in for the testimonials section while content/testimonials.ts is empty. */}
			<ProofSection />
			<TestimonialCarousel />
			<CtaBand />
		</>
	);
};

export default HomePage;
