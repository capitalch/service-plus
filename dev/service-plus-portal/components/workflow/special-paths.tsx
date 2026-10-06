import { ChevronRight } from "lucide-react";

import { Reveal } from "@/components/layout/reveal";
import { STAGE_ACCENT } from "@/components/workflow/stage-accents";
import { specialPaths } from "@/content/workflow";
import { cn } from "@/lib/utils";

/** The detours. No stage of their own, so each card cycles through the six stage hues — the
 *  palette stays the page's rather than becoming eight identical blue cards. */
export const SpecialPaths = () => {
	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{specialPaths.map((path, index) => {
				const Icon = path.icon;
				const tone = STAGE_ACCENT;

				return (
					<Reveal className="h-full" delay={(index % 4) * 0.06} key={path.title}>
						<article
							className={cn(
								"card-lift flex h-full flex-col rounded-2xl border border-border p-5 shadow-xs",
								tone.wash,
								tone.hoverRing,
							)}
						>
							<span
								className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone.icon)}
							>
								<Icon aria-hidden className="size-4" />
							</span>
							<h3 className="mt-3.5 font-semibold">{path.title}</h3>
							<p className="text-muted-foreground mt-1.5 flex-1 text-sm">{path.description}</p>
							{/* The route as one run of text. Four bordered chips and three chevrons per
							    card made this the busiest corner of the page. */}
							<p className="border-border/70 text-muted-foreground mt-4 flex flex-wrap items-center gap-x-1 gap-y-1 border-t pt-3 text-xs">
								{path.flow.map((step, stepIndex) => (
									<span className="contents" key={step}>
										{stepIndex > 0 && (
											<ChevronRight
												aria-hidden
												className="text-muted-foreground/60 size-3 shrink-0"
											/>
										)}
										<span>{step}</span>
									</span>
								))}
							</p>
						</article>
					</Reveal>
				);
			})}
		</div>
	);
};
