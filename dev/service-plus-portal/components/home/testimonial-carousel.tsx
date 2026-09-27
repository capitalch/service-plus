import { Quote } from "lucide-react";

import { Reveal } from "@/components/layout/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { MESSAGES } from "@/constants/messages";
import { testimonials } from "@/content/testimonials";

// Renders nothing until content/testimonials.ts has real entries.
export const TestimonialCarousel = () => {
	if (testimonials.length === 0) return null;

	return (
		<section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6" id="testimonials">
			<SectionHeading eyebrow="Customers" title={MESSAGES.testimonialsTitle} />
			<div className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4">
				{testimonials.map((testimonial, index) => (
					<Reveal
						className="w-[85%] shrink-0 snap-start sm:w-[45%] lg:w-[32%]"
						delay={index * 0.06}
						key={`${testimonial.name}-${testimonial.business}`}
					>
						<figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-xs">
							<Quote className="size-6 text-primary/60" />
							<blockquote className="mt-3 flex-1 text-sm leading-relaxed">{testimonial.quote}</blockquote>
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
		</section>
	);
};
