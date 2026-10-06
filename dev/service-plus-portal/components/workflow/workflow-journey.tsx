import { Reveal } from "@/components/layout/reveal";
import { workflowPhases } from "@/content/workflow";
import { cn } from "@/lib/utils";

/** The six stages as a vertical timeline: a numbered rail on the left, one card per stage. */
export const WorkflowJourney = () => {
	return (
		<ol className="relative">
			{workflowPhases.map((phase, index) => {
				const Icon = phase.icon;
				const last = index === workflowPhases.length - 1;

				return (
					<li
						className="relative grid scroll-mt-24 grid-cols-[2.25rem_1fr] gap-x-4 sm:gap-x-5"
						id={phase.anchor}
						key={phase.anchor}
					>
						<div className="flex flex-col items-center">
							<span className="bg-primary text-primary-foreground ring-background relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4">
								{index + 1}
							</span>
							{!last && <span aria-hidden className="bg-border my-1 w-px flex-1" />}
						</div>

						<div className={cn("min-w-0", !last && "pb-8 sm:pb-10")}>
							<Reveal>
								<article className="bg-card relative overflow-hidden rounded-2xl border border-border p-5 shadow-xs sm:p-6">
									<span aria-hidden className="bg-primary/15 absolute inset-y-0 left-0 w-1" />
									<h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
										<span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
											<Icon aria-hidden className="size-4" />
										</span>
										{phase.title}
									</h3>
									<p className="text-muted-foreground mt-2 max-w-3xl">{phase.summary}</p>

									<div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
										<ol className="space-y-2.5">
											{phase.steps.map((step, stepIndex) => (
												<li className="flex gap-3 text-sm" key={step}>
													<span className="text-muted-foreground border-border mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-xs font-semibold">
														{stepIndex + 1}
													</span>
													<span className="text-muted-foreground">{step}</span>
												</li>
											))}
										</ol>

										<dl className="space-y-3">
											{phase.facets.map((facet) => (
												<div key={facet.label}>
													<dt className="text-primary text-xs font-semibold tracking-wider uppercase">
														{facet.label}
													</dt>
													<dd className="mt-0.5 text-sm">{facet.value}</dd>
												</div>
											))}
										</dl>
									</div>
								</article>
							</Reveal>
						</div>
					</li>
				);
			})}
		</ol>
	);
};
