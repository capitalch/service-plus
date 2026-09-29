import { Reveal } from "@/components/layout/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { TileCard } from "@/components/layout/tile-card";
import { MESSAGES } from "@/constants/messages";
import { features } from "@/content/features";

export const FeatureGrid = () => {
	return (
		<section className="mx-auto w-full max-w-6xl px-page py-section lg:px-page-lg lg:py-section-lg" id="features">
			<SectionHeading eyebrow="Features" intro={MESSAGES.featuresIntro} title={MESSAGES.featuresTitle} />
			<div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
				{features.map((feature, index) => (
					<Reveal delay={(index % 4) * 0.06} key={feature.title}>
						{/* Each card links to the matching deep-dive section on the features page. */}
						<TileCard {...feature} href={`/features#${feature.anchor}`} />
					</Reveal>
				))}
			</div>
		</section>
	);
};
