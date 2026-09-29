"use client";

import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Reveal } from "@/components/layout/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { testimonials } from "@/content/testimonials";
import { cn } from "@/lib/utils";

// Renders nothing until content/testimonials.ts has real entries.
export const TestimonialCarousel = () => {
	const railRef = useRef<HTMLDivElement>(null);
	const [page, setPage] = useState(0);

	// A scroll-snap rail with no arrows gives a desktop visitor no hint that it scrolls at all.
	const pageCount = testimonials.length;

	const syncPage = useCallback(() => {
		const rail = railRef.current;
		if (!rail) return;
		// Which card is closest to the rail's left edge decides the dot.
		const cards = Array.from(rail.children) as HTMLElement[];
		let closest = 0;
		let smallest = Number.POSITIVE_INFINITY;
		cards.forEach((card, index) => {
			const distance = Math.abs(card.offsetLeft - rail.scrollLeft);
			if (distance < smallest) {
				smallest = distance;
				closest = index;
			}
		});
		setPage(closest);
	}, []);

	useEffect(() => {
		const rail = railRef.current;
		if (!rail) return;
		rail.addEventListener("scroll", syncPage, { passive: true });
		return () => rail.removeEventListener("scroll", syncPage);
	}, [syncPage]);

	if (pageCount === 0) return null;

	function scrollToCard(index: number) {
		const rail = railRef.current;
		const card = rail?.children[index] as HTMLElement | undefined;
		card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
	}

	return (
		<section
			className="mx-auto w-full max-w-6xl px-page py-section lg:px-page-lg lg:py-section-lg"
			id="testimonials"
		>
			<SectionHeading eyebrow="Customers" title={MESSAGES.testimonialsTitle} />

			<div className="relative mt-10">
				<div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4" ref={railRef}>
					{testimonials.map((testimonial, index) => (
						<Reveal
							className="w-[85%] shrink-0 snap-start sm:w-[45%] lg:w-[32%]"
							delay={index * 0.06}
							key={`${testimonial.name}-${testimonial.business}`}
						>
							<figure className="bg-card flex h-full flex-col rounded-2xl border border-border p-6 shadow-xs">
								<Quote aria-hidden className="text-primary/60 size-6" />
								<blockquote className="mt-3 flex-1 text-sm leading-relaxed">
									{testimonial.quote}
								</blockquote>
								<figcaption className="mt-5 text-sm">
									<p className="font-semibold">{testimonial.name}</p>
									<p className="text-muted-foreground">
										{testimonial.role}, {testimonial.business}, {testimonial.city}
									</p>
								</figcaption>
							</figure>
						</Reveal>
					))}
				</div>

				{pageCount > 1 && (
					<div className="mt-2 flex items-center justify-center gap-4">
						<Button
							aria-label="Previous testimonial"
							onClick={() => scrollToCard(Math.max(0, page - 1))}
							size="icon-sm"
							type="button"
							variant="outline"
						>
							<ChevronLeft />
						</Button>
						<div className="flex items-center gap-1.5">
							{testimonials.map((testimonial, index) => (
								<button
									aria-label={`Go to testimonial ${index + 1}`}
									aria-pressed={index === page}
									className={cn(
										"h-2 rounded-full transition-all focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
										index === page
											? "bg-primary w-6"
											: "bg-border hover:bg-muted-foreground/40 w-2",
									)}
									key={`${testimonial.name}-dot`}
									onClick={() => scrollToCard(index)}
									type="button"
								/>
							))}
						</div>
						<Button
							aria-label="Next testimonial"
							onClick={() => scrollToCard(Math.min(pageCount - 1, page + 1))}
							size="icon-sm"
							type="button"
							variant="outline"
						>
							<ChevronRight />
						</Button>
					</div>
				)}
			</div>
		</section>
	);
};
