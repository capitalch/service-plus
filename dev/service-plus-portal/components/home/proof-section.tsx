import { Reveal } from "@/components/layout/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { MESSAGES } from "@/constants/messages";
import { onboardingSteps, trustPoints } from "@/content/proof";

// How onboarding works and what the product guarantees. Sits alongside the customer testimonials;
// everything here is a fact about the product, not a claim about who uses it.
export const ProofSection = () => {
	return (
		<section className="mx-auto w-full max-w-6xl px-page py-section lg:px-page-lg lg:py-section-lg" id="onboarding">
			<SectionHeading
				eyebrow="Getting started"
				intro={MESSAGES.onboardingIntro}
				title={MESSAGES.onboardingTitle}
			/>

			{/* A div grid, not <ol>: Reveal renders a div, and a div between <ol> and <li> breaks
			    the list semantics. role="list"/"listitem" keeps the sequence announced instead. */}
			<div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" role="list">
				{onboardingSteps.map((step, index) => (
					<Reveal delay={index * 0.06} key={step.title}>
						<div
							className="bg-card relative h-full rounded-2xl border border-border p-5 shadow-xs"
							role="listitem"
						>
							{/* Numbered marker is the step number, read out with its position. */}
							<span
								aria-label={`Step ${index + 1} of ${onboardingSteps.length}`}
								className="bg-gradient-brand absolute -top-3 left-5 flex size-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-md"
							>
								{index + 1}
							</span>
							<span className="text-muted-foreground mt-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<step.icon aria-hidden className="size-5" />
							</span>
							<h3 className="mt-4 font-semibold">{step.title}</h3>
							<p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.description}</p>
						</div>
					</Reveal>
				))}
			</div>

			<Reveal>
				<ul className="bg-muted/40 mt-6 grid gap-5 rounded-2xl border border-border p-6 sm:grid-cols-2 lg:grid-cols-4">
					{trustPoints.map((point) => (
						<li className="flex gap-3" key={point.label}>
							<point.icon aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
							<div>
								<p className="text-sm font-semibold">{point.label}</p>
								<p className="text-muted-foreground mt-1 text-xs leading-relaxed">
									{point.description}
								</p>
							</div>
						</li>
					))}
				</ul>
			</Reveal>
		</section>
	);
};
