import { ArrowRight, Phone } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/layout/reveal";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { siteConfig } from "@/content/site-config";

export const CtaBand = () => {
	return (
		<section className="mx-auto w-full max-w-6xl px-page py-section lg:px-page-lg lg:py-section-lg">
			<Reveal>
				{/* sheen runs the highlight sweep across the gradient band itself, so the whole
				    surface breathes rather than just the button. */}
				<div className="sheen bg-gradient-brand rounded-3xl px-6 py-12 text-center text-white shadow-xl sm:px-12">
					<p className="text-sm font-semibold tracking-wide text-white/80 uppercase">{MESSAGES.ctaKicker}</p>
					<h2 className="mt-2 text-2xl font-bold sm:text-3xl">{MESSAGES.ctaTitle}</h2>
					<p className="mx-auto mt-3 max-w-xl text-white/85">{MESSAGES.ctaBody}</p>
					<div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
						<Button asChild className="bg-white text-primary hover:bg-white/90" size="lg">
							<Link href="/pricing">
								Choose a plan
								<ArrowRight />
							</Link>
						</Button>
						<Button
							asChild
							className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent"
							size="lg"
							variant="outline"
						>
							<a href={`tel:${siteConfig.phoneE164}`}>
								<Phone />
								{siteConfig.phone}
							</a>
						</Button>
					</div>
				</div>
			</Reveal>
		</section>
	);
};
