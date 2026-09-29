"use client";

import { useState } from "react";

import { ScreenshotLightbox } from "@/components/screenshots/screenshot-lightbox";
import type { ScreenshotType } from "@/content/screenshots";

type FeatureScreenshotsPropsType = {
	shots: ScreenshotType[];
};

export const FeatureScreenshots = ({ shots }: FeatureScreenshotsPropsType) => {
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

	if (shots.length === 0) {
		return (
			<div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
				Screenshot coming soon
			</div>
		);
	}

	return (
		<>
			<div className={shots.length > 1 ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
				{shots.map((shot, index) => (
					<button
						className="group cursor-pointer overflow-hidden rounded-2xl border border-border shadow-xs transition-shadow hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
						key={shot.src}
						onClick={() => setSelectedIndex(index)}
						type="button"
					>
						{/* eslint-disable-next-line @next/next/no-img-element -- static export, images unoptimized */}
						<img
							alt={shot.alt}
							className="aspect-[16/9] w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
							loading="lazy"
							src={shot.src}
						/>
						{/* The caption doubles as the accessible name now the button has no text. */}
						<span className="sr-only">View {shot.caption}</span>
					</button>
				))}
			</div>

			<ScreenshotLightbox onSelectedIndexChange={setSelectedIndex} selectedIndex={selectedIndex} shots={shots} />
		</>
	);
};
