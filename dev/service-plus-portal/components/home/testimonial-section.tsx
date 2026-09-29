import { Building2, MapPin, Quote } from "lucide-react";

import { Reveal } from "@/components/layout/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { Badge } from "@/components/ui/badge";
import { MESSAGES } from "@/constants/messages";
import { testimonials } from "@/content/testimonials";
import { cn } from "@/lib/utils";

function initials(name: string) {
	const words = name.split(" ").filter(Boolean);
	return `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
}

// Every quote is on screen at once. A carousel hid all but one behind a control, and a picker
// asked the visitor to click a card to find out what the other customers said — which is a lot to
// ask before they have read a single word. This is a plain grid: one scroll, all the proof.
export const TestimonialSection = () => {
	// A lone quote should use the whole row rather than sit in a half-width cell.
	const single = testimonials.length === 1;

	// Renders nothing if content/testimonials.ts is empty.
	if (testimonials.length === 0) return null;

	return (
		<section className="bg-muted/40 relative overflow-hidden py-section lg:py-section-lg" id="testimonials">
			{/* Brand wash bleeding off the top edge, so the band reads as its own section rather than
			    as more of the onboarding section above it. */}
			<div
				aria-hidden
				className="from-primary/15 via-primary/5 pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b to-transparent"
			/>

			<div className="relative mx-auto w-full max-w-6xl px-page lg:px-page-lg">
				<SectionHeading
					eyebrow="Customers"
					intro={MESSAGES.testimonialsIntro}
					title={MESSAGES.testimonialsTitle}
				/>

				{/* Cards stretch to match within a row, so quotes of different lengths still line up. */}
				<div className="mt-12 grid gap-5 md:grid-cols-2">
					{testimonials.map((testimonial, index) => (
						<Reveal
							className={cn("h-full", single && "md:col-span-2")}
							delay={(index % 2) * 0.08}
							key={`${testimonial.name}-${testimonial.business}`}
						>
							<figure className="card-lift bg-card relative flex h-full flex-col overflow-hidden rounded-3xl border border-border p-7 shadow-xs sm:p-8">
								{/* Brand hairline across the top edge — the one flourish that separates the
								    cards from the flat bordered boxes used elsewhere on the page. */}
								<span aria-hidden className="bg-gradient-brand absolute inset-x-0 top-0 h-1" />

								<div className="flex flex-wrap items-start justify-between gap-3">
									<Quote aria-hidden className="text-primary/25 size-8 shrink-0" />
									{/* Wraps below the quote mark on narrow screens rather than squeezing it. */}
									<div className="flex flex-wrap justify-end gap-2">
										{testimonial.serviceCentre && (
											<Badge variant="soft">
												<Building2 aria-hidden />
												{testimonial.serviceCentre}
											</Badge>
										)}
										<Badge variant="outline">
											<MapPin aria-hidden />
											{testimonial.city}
										</Badge>
									</div>
								</div>

								{/* Opening and closing marks sit on the first and last paragraph rather than
								    wrapping each one, so the quote still reads as a single statement. */}
								<blockquote className="mt-5 flex-1 text-lg leading-8 italic">
									{testimonial.quote.map((paragraph, position) => {
										const isFirst = position === 0;
										const isLast = position === testimonial.quote.length - 1;

										return (
											<p className={cn("text-pretty", !isFirst && "mt-4")} key={paragraph}>
												{isFirst ? "\u201C" : ""}
												{paragraph}
												{isLast ? "\u201D" : ""}
											</p>
										);
									})}
								</blockquote>

								<figcaption className="mt-7 flex items-center gap-4 border-t border-border pt-6">
									<span
										aria-hidden
										className="bg-gradient-brand flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-md"
									>
										{initials(testimonial.name)}
									</span>
									<div className="min-w-0">
										<p className="truncate font-semibold">{testimonial.name}</p>
										<p className="text-muted-foreground truncate text-sm">
											{testimonial.role} &middot; {testimonial.business}
										</p>
									</div>
								</figcaption>
							</figure>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
};
