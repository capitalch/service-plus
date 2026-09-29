import { ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/layout/reveal";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";

export const ServiceCentreHighlight = () => {
	return (
		<section className="mx-auto w-full max-w-6xl px-page lg:px-page-lg">
			<Reveal>
				<div className="flex flex-col items-center gap-5 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-8 text-center sm:flex-row sm:text-left">
					<span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<Building2 className="size-6" />
					</span>
					<div className="flex-1">
						<h2 className="text-lg font-bold sm:text-xl">{MESSAGES.serviceCentreHighlightTitle}</h2>
						<p className="mt-1 text-sm text-muted-foreground">{MESSAGES.serviceCentreHighlightBody}</p>
					</div>
					<Button asChild variant="outline">
						<Link href="/contact">
							Talk to us
							<ArrowRight />
						</Link>
					</Button>
				</div>
			</Reveal>
		</section>
	);
};
