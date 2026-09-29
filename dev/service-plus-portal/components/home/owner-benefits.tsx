import { Reveal } from "@/components/layout/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { TileCard } from "@/components/layout/tile-card";
import { MESSAGES } from "@/constants/messages";
import { ownerBenefits } from "@/content/features";

export const OwnerBenefits = () => {
	return (
		<section className="bg-muted/40 py-section lg:py-section-lg">
			<div className="mx-auto w-full max-w-6xl px-page lg:px-page-lg">
				<SectionHeading
					eyebrow="Why owners choose Service+"
					intro={MESSAGES.ownerBenefitsIntro}
					title={MESSAGES.ownerBenefitsTitle}
				/>
				<div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
					{ownerBenefits.map((benefit, index) => (
						<Reveal delay={(index % 4) * 0.06} key={benefit.title}>
							<TileCard {...benefit} />
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
};
