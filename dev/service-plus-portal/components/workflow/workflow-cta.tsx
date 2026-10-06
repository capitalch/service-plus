import { ArrowRight, Phone } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { siteConfig } from "@/content/site-config";

/** A plain closing call to action. The site-wide gradient band is the loudest object on any page;
 *  on this reference-style page it fought the diagram, so the ask is made in the page's own
 *  colours instead. */
export const WorkflowCta = () => {
	return (
		<section className="border-t border-border">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-page py-12 lg:flex-row lg:items-center lg:justify-between lg:px-page-lg lg:py-16">
				<div className="max-w-2xl">
					<h2 className="text-2xl font-bold tracking-tight lg:text-3xl">{MESSAGES.ctaTitle}</h2>
					<p className="text-muted-foreground mt-2">{MESSAGES.ctaBody}</p>
				</div>
				<div className="flex shrink-0 flex-col gap-3 sm:flex-row">
					<Button asChild size="lg">
						<Link href="/pricing">
							Choose a plan
							<ArrowRight />
						</Link>
					</Button>
					<Button asChild size="lg" variant="outline">
						<a href={`tel:${siteConfig.phoneE164}`}>
							<Phone />
							{siteConfig.phone}
						</a>
					</Button>
				</div>
			</div>
		</section>
	);
};
