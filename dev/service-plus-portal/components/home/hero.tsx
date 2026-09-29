import { ArrowRight, Check, MessageCircle } from "lucide-react";
import Link from "next/link";

import { HeroVisual } from "@/components/home/hero-visual";
import { Reveal } from "@/components/layout/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { siteConfig } from "@/content/site-config";

// Claims we can already stand behind from the product and pricing content, so the hero carries
// real reassurance rather than decorative filler.
const trustPoints = ["Free Lite plan, no card", "GST & non-GST invoicing", "Nothing to install", "Set up by our team"];

export const Hero = () => {
	return (
		<section className="bg-grid relative overflow-hidden">
			<div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-page py-14 sm:py-18 lg:grid-cols-2 lg:gap-8 lg:px-page-lg lg:py-section-lg">
				<Reveal>
					<Badge variant="soft">Free plan available</Badge>
					<h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
						<span className="text-gradient-brand">{MESSAGES.heroTitle}</span>
					</h1>
					<p className="mt-5 max-w-xl text-lg text-muted-foreground">{MESSAGES.heroBody}</p>

					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<Button asChild size="lg">
							<Link href="/pricing">
								See pricing
								<ArrowRight />
							</Link>
						</Button>
						{/* Second path in: a single CTA left visitors who are not ready to buy with nothing. */}
						<Button asChild size="lg" variant="outline">
							<a href={`https://wa.me/${siteConfig.whatsapp}`} rel="noopener noreferrer" target="_blank">
								<MessageCircle />
								Talk to us on WhatsApp
							</a>
						</Button>
					</div>

					<ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
						{trustPoints.map((point) => (
							<li className="text-muted-foreground flex items-center gap-1.5 text-sm" key={point}>
								<Check aria-hidden className="text-success size-4 shrink-0" />
								{point}
							</li>
						))}
					</ul>
				</Reveal>

				<Reveal delay={0.15}>
					<HeroVisual />
				</Reveal>
			</div>
		</section>
	);
};
