"use client";

import { useState } from "react";

import { SectionHeading } from "@/components/layout/section-heading";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MESSAGES } from "@/constants/messages";
import { screenshotGroups } from "@/content/screenshots";
import type { ScreenshotType } from "@/content/screenshots";

export const ScreenshotGallery = () => {
	const [active, setActive] = useState<ScreenshotType | null>(null);

	return (
		<section className="bg-muted/40 py-16 sm:py-20" id="screens">
			<div className="mx-auto w-full max-w-6xl px-4 lg:px-6">
				<SectionHeading eyebrow="Product" intro={MESSAGES.galleryIntro} title={MESSAGES.galleryTitle} />

				<Tabs className="mt-10" defaultValue={screenshotGroups[0].id}>
					<div className="flex justify-center overflow-x-auto">
						<TabsList>
							{screenshotGroups.map((group) => (
								<TabsTrigger key={group.id} value={group.id}>
									{group.label}
								</TabsTrigger>
							))}
						</TabsList>
					</div>

					{screenshotGroups.map((group) => (
						<TabsContent className="mt-6" key={group.id} value={group.id}>
							<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
								{group.shots.map((shot) => (
									<button
										className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-xs transition-shadow hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
										key={shot.src}
										onClick={() => setActive(shot)}
										type="button"
									>
										{/* eslint-disable-next-line @next/next/no-img-element -- static export, images unoptimized */}
										<img
											alt={shot.alt}
											className="aspect-[16/9] w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
											loading="lazy"
											src={shot.src}
										/>
										<p className="border-t border-border px-4 py-3 text-sm font-medium">
											{shot.caption}
										</p>
									</button>
								))}
							</div>
						</TabsContent>
					))}
				</Tabs>
			</div>

			<Dialog onOpenChange={(open) => !open && setActive(null)} open={active !== null}>
				<DialogContent className="max-w-[min(96vw,80rem)] p-2 sm:max-w-[min(96vw,80rem)]">
					<DialogTitle className="px-2 pt-1">{active?.caption}</DialogTitle>
					<DialogDescription className="sr-only">{active?.alt}</DialogDescription>
					{active && (
						// eslint-disable-next-line @next/next/no-img-element -- static export, images unoptimized
						<img
							alt={active.alt}
							className="max-h-[80vh] w-full rounded-lg object-contain"
							src={active.src}
						/>
					)}
				</DialogContent>
			</Dialog>
		</section>
	);
};
