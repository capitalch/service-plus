import { Building2 } from "lucide-react";

import { testimonials } from "@/content/testimonials";

// A thin band directly under the hero that puts the strongest social proof — the authorised
// service centres already running Service+ — above every product claim, rather than leaving it
// for the testimonials near the foot of the page. Derived from the testimonials content so the
// names can never drift from the quotes themselves, and rendered only for customers who are
// named as an authorised centre.
const centres = testimonials.filter((testimonial) => testimonial.serviceCentre);

export const TrustStrip = () => {
	if (centres.length === 0) return null;

	return (
		<section aria-label="Customers" className="border-y border-border/60 bg-muted/30">
			<div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-x-8 gap-y-3 px-page py-5 text-center sm:flex-row sm:justify-center lg:px-page-lg">
				<p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
					Trusted by authorised service centres
				</p>
				<ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
					{centres.map((centre) => (
						<li className="flex items-center gap-2 text-sm font-semibold" key={centre.serviceCentre}>
							<Building2 aria-hidden className="text-primary size-4 shrink-0" />
							<span>{centre.serviceCentre}</span>
							<span className="text-muted-foreground font-normal">&middot; {centre.city}</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
};
