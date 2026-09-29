import { CtaBand } from "@/components/home/cta-band";
import { FeatureGrid } from "@/components/home/feature-grid";
import { Hero } from "@/components/home/hero";
import { OwnerBenefits } from "@/components/home/owner-benefits";
import { ProofSection } from "@/components/home/proof-section";
import { ScreenshotGallery } from "@/components/home/screenshot-gallery";
import { ServiceCentreHighlight } from "@/components/home/service-centre-highlight";
import { TestimonialSection } from "@/components/home/testimonial-section";

const HomePage = () => {
	return (
		<>
			<Hero />
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
