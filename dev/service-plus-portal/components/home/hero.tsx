import { ArrowRight, LogIn } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/layout/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { siteConfig } from "@/content/site-config";

export const Hero = () => {
	return (
		<section className="bg-grid relative overflow-hidden">
			<div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-2 lg:px-6">
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
						<Button asChild size="lg" variant="outline">
							<a href={siteConfig.appUrl} rel="noopener">
								<LogIn />
								Login
							</a>
						</Button>
					</div>
				</Reveal>

				<Reveal delay={0.15}>
					<div className="relative">
						<div className="bg-gradient-brand absolute -inset-3 rounded-3xl opacity-20 blur-2xl" />
						{/* eslint-disable-next-line @next/next/no-img-element -- static export, images unoptimized */}
						<img
							alt="Service+ operations dashboard"
							className="relative w-full rounded-2xl border border-border shadow-2xl"
							height={664}
							src="/images/screens/dashboard.jpg"
							width={1568}
						/>
					</div>
				</Reveal>
			</div>
		</section>
	);
};
