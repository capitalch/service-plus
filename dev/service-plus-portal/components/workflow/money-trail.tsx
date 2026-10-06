import { Reveal } from "@/components/layout/reveal";
import { STAGE_ACCENT } from "@/components/workflow/stage-accents";
import { moneyTrail } from "@/content/workflow";
import { cn } from "@/lib/utils";

/** Where money and cost are recorded along the job. Three across reads properly where six forced
 *  every description into a ~180px column. Each card takes the colour of the stage it belongs to,
 *  so money can be traced back to the stage that caused it. */
export const MoneyTrail = () => {
	return (
		<ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{moneyTrail.map((step, index) => {
				const Icon = step.icon;
				const tone = STAGE_ACCENT;

				return (
					<li key={step.title}>
						<Reveal className="h-full" delay={(index % 3) * 0.06}>
							<article
								className={cn(
									"card-lift flex h-full gap-3 rounded-2xl border border-border p-4 shadow-xs",
									tone.wash,
									tone.hoverRing,
								)}
							>
								<span
									className={cn(
										"flex size-9 shrink-0 items-center justify-center rounded-lg",
										tone.icon,
									)}
								>
									<Icon aria-hidden className="size-4" />
								</span>
								<div className="min-w-0">
									<p className={cn("text-xs font-semibold tracking-wider uppercase", tone.label)}>
										{step.stage}
									</p>
									<h3 className="text-sm font-semibold">{step.title}</h3>
									<p className="text-muted-foreground mt-1 text-sm leading-relaxed">
										{step.description}
									</p>
								</div>
							</article>
						</Reveal>
					</li>
				);
			})}
		</ol>
	);
};
