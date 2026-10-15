import { ArrowRight, Check, MessageCircle } from "lucide-react";
import Link from "next/link";

import { HeroVisual } from "@/components/home/hero-visual";
import { LiveDemoButton } from "@/components/layout/live-demo-button";
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
			<div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-page py-12 sm:py-16 lg:grid-cols-2 lg:gap-8 lg:px-page-lg lg:py-section-lg">
				<Reveal>
					<Badge variant="soft">Free plan available</Badge>
					<h1 className="mt-4 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
						<span className="text-gradient-brand">{MESSAGES.heroTitle}</span>
					</h1>
					<p className="mt-4 max-w-xl font-semibold text-pretty text-foreground sm:text-lg">
						{MESSAGES.heroTagline}
					</p>
					<p className="mt-4 max-w-xl text-lg text-pretty text-foreground/90">{MESSAGES.heroPromise}</p>

					{/* The demo and pricing are the two paths worth leading with. WhatsApp is the
					    fallback for someone not ready to do either, so it sits below as a quiet
					    text link rather than a third button competing for the same tap. */}
					<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
						<LiveDemoButton size="lg" />
						<Button asChild className="sheen" size="lg">
							<Link href="/pricing">
								See pricing
								<ArrowRight />
							</Link>
						</Button>
					</div>

					<a
						className="text-muted-foreground hover:text-foreground mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
						href={`https://wa.me/${siteConfig.whatsapp}`}
						rel="noopener noreferrer"
						target="_blank"
					>
						<MessageCircle aria-hidden className="size-4" />
						Prefer to talk? Message us on WhatsApp
					</a>

					<ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5">
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
