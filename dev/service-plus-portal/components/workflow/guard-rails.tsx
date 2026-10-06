import { Check, Lock } from "lucide-react";

import { Reveal } from "@/components/layout/reveal";
import { STAGE_ACCENT } from "@/components/workflow/stage-accents";
import { MESSAGES } from "@/constants/messages";
import { guardRails } from "@/content/workflow";
import { cn } from "@/lib/utils";

/** What the app will and will not let you do. Each card is tinted by the palette rather than
 *  blue, and the two rules inside it stay green and amber — that pairing carries the meaning, so
 *  it must not be recoloured with the card. */
export const GuardRails = () => {
	return (
		<div className="grid gap-3 md:grid-cols-2">
			{guardRails.map((rail, index) => {
				const Icon = rail.icon;
				const tone = STAGE_ACCENT;

				return (
					<Reveal className="h-full" delay={(index % 2) * 0.06} key={rail.action}>
						<article
							className={cn(
								"card-lift flex h-full gap-3 rounded-2xl border border-border p-4 shadow-xs",
								tone.wash,
								tone.hoverRing,
							)}
						>
							<span
								className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone.icon)}
							>
								<Icon aria-hidden className="size-4" />
							</span>
							{/* A green tick and an amber padlock on their own said nothing about which
							    was which; each line now carries its own label. */}
							<dl className="min-w-0 space-y-1.5 text-sm">
								<dt className="font-semibold">{rail.action}</dt>
								<dd className="flex gap-2">
									<span className="bg-success/10 text-success flex w-20 shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold">
										<Check aria-hidden className="size-3.5" />
										{MESSAGES.workflowGuardAllowed}
									</span>
									<span className="text-muted-foreground">{rail.allowed}</span>
								</dd>
								<dd className="flex gap-2">
									<span className="flex w-20 shrink-0 items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
										<Lock aria-hidden className="size-3.5" />
										{MESSAGES.workflowGuardBlocked}
									</span>
									<span className="text-muted-foreground">{rail.blocked}</span>
								</dd>
							</dl>
						</article>
					</Reveal>
				);
			})}
		</div>
	);
};
