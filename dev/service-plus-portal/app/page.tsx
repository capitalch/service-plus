import { BenefitStrip } from "@/components/home/benefit-strip";
import { CtaBand } from "@/components/home/cta-band";
import { FeatureGrid } from "@/components/home/feature-grid";
import { Hero } from "@/components/home/hero";
import { ScreenshotGallery } from "@/components/home/screenshot-gallery";
import { TestimonialCarousel } from "@/components/home/testimonial-carousel";

const HomePage = () => {
	return (
		<>
			<Hero />
			<BenefitStrip />
			<FeatureGrid />
			<ScreenshotGallery />
			<TestimonialCarousel />
			<CtaBand />
		</>
	);
};

export default HomePage;
