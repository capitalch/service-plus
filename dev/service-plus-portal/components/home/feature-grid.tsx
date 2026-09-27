import { Reveal } from "@/components/layout/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { MESSAGES } from "@/constants/messages";
import { features } from "@/content/features";

export const FeatureGrid = () => {
	return (
		<section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6" id="features">
			<SectionHeading eyebrow="Features" intro={MESSAGES.featuresIntro} title={MESSAGES.featuresTitle} />
			<div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
				{features.map((feature, index) => (
					<Reveal delay={(index % 4) * 0.06} key={feature.title}>
						<article className="h-full rounded-2xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-md">
							<span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<feature.icon className="size-5" />
							</span>
							<h3 className="mt-4 font-semibold">{feature.title}</h3>
							<p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
						</article>
					</Reveal>
				))}
			</div>
		</section>
	);
};
