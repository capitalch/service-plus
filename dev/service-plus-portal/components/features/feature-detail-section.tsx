import { Check } from "lucide-react";

import { FeatureScreenshots } from "@/components/features/feature-screenshots";
import { Reveal } from "@/components/layout/reveal";
import type { FeatureType } from "@/content/features";
import { findScreenshot } from "@/content/screenshots";
import type { ScreenshotType } from "@/content/screenshots";
import { cn } from "@/lib/utils";

type FeatureDetailSectionPropsType = {
	feature: FeatureType;
	reversed: boolean;
};

function isScreenshot(shot: ScreenshotType | undefined): shot is ScreenshotType {
	return shot !== undefined;
}

export const FeatureDetailSection = ({ feature, reversed }: FeatureDetailSectionPropsType) => {
	const shots = feature.screenshotFiles.map((file) => findScreenshot(file)).filter(isScreenshot);

	// Anchored so the home page feature cards can deep-link straight to one feature.
	return (
		<Reveal className="scroll-mt-24 py-10 sm:py-14" id={feature.anchor}>
			<div
				className={cn(
					"grid items-center gap-8 lg:grid-cols-2 lg:gap-12",
					reversed && "lg:[&>*:first-child]:order-2",
				)}
			>
				<div>
					<span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<feature.icon className="size-6" />
					</span>
					<h3 className="mt-4 text-2xl font-bold tracking-tight">{feature.title}</h3>
					<p className="mt-3 text-muted-foreground">{feature.detail}</p>
					<ul className="mt-5 space-y-2">
						{feature.highlights.map((highlight) => (
							<li className="flex items-start gap-2 text-sm" key={highlight}>
								<Check className="mt-0.5 size-4 shrink-0 text-primary" />
								<span>{highlight}</span>
							</li>
						))}
					</ul>
				</div>

				<FeatureScreenshots shots={shots} />
			</div>
		</Reveal>
	);
};
