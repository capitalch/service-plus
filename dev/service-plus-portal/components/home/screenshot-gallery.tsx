"use client";

import { Maximize2 } from "lucide-react";
import { useState } from "react";

import { AnimatedTabsList } from "@/components/layout/animated-tabs";
import { SectionHeading } from "@/components/layout/section-heading";
import { ScreenshotLightbox } from "@/components/screenshots/screenshot-lightbox";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { MESSAGES } from "@/constants/messages";
import { screenshotGroups } from "@/content/screenshots";

// The lightbox walks the tab you are on, so the open set has to follow the active tab.
export const ScreenshotGallery = () => {
	const [tab, setTab] = useState(screenshotGroups[0].id);
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

	const group = screenshotGroups.find((candidate) => candidate.id === tab) ?? screenshotGroups[0];

	return (
		<section className="bg-muted/40 py-section lg:py-section-lg" id="screens">
			<div className="mx-auto w-full max-w-6xl px-page lg:px-page-lg">
				<SectionHeading eyebrow="Product" intro={MESSAGES.galleryIntro} title={MESSAGES.galleryTitle} />

				<Tabs className="mt-10" onValueChange={setTab} value={tab}>
					{/* Scroll wrapper outside the list: the highlight is measured against the list's
					    own box, so the list itself must not be inside a transformed or scrolled
					    ancestor that would offset the measurements. */}
					<div className="-mx-4 flex justify-start overflow-x-auto px-4 sm:justify-center sm:px-0">
						<AnimatedTabsList
							items={screenshotGroups.map((candidate) => ({
								id: candidate.id,
								label: (
									<>
										{candidate.label}
										<span className="text-muted-foreground ml-1.5 text-xs tabular-nums">
											{candidate.shots.length}
										</span>
									</>
								),
							}))}
							value={tab}
						/>
					</div>

					{screenshotGroups.map((candidate) => (
						<TabsContent className="mt-6" key={candidate.id} value={candidate.id}>
							<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
								{candidate.shots.map((shot, index) => (
									<button
										className="group bg-card focus-visible:ring-ring/40 cursor-pointer overflow-hidden rounded-2xl border border-border text-left shadow-xs transition-shadow hover:shadow-lg focus-visible:ring-3 focus-visible:outline-none"
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
										<p className="text-muted-foreground group-hover:text-foreground flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm font-medium transition-colors">
											{shot.caption}
											<Maximize2
												aria-hidden
												className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
											/>
										</p>
									</button>
								))}
							</div>
						</TabsContent>
					))}
				</Tabs>
			</div>

			<ScreenshotLightbox
				onSelectedIndexChange={setSelectedIndex}
				selectedIndex={selectedIndex}
				shots={group.shots}
			/>
		</section>
	);
};
