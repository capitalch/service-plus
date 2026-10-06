"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { workflowPhases } from "@/content/workflow";
import { cn } from "@/lib/utils";

/** The six stages as tabs with one stage open at a time. They used to be six full cards stacked
 *  down the page, which made the journey most of the scroll and buried everything after it. */
export const StageExplorer = () => {
	const reduceMotion = useReducedMotion();
	const [index, setIndex] = useState(0);
	const phase = workflowPhases[index];
	const Icon = phase.icon;
	const previous = workflowPhases[index - 1];
	const next = workflowPhases[index + 1];

	return (
		<div className="space-y-4">
			<div
				aria-label={MESSAGES.workflowStagesNav}
				className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6"
				role="tablist"
			>
				{workflowPhases.map((item, itemIndex) => {
					const selected = itemIndex === index;
					return (
						<button
							aria-controls={`stage-panel-${item.anchor}`}
							aria-selected={selected}
							className={cn(
								"flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
								"focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:outline-none",
								selected
									? "bg-primary border-primary text-primary-foreground shadow-sm"
									: "bg-card text-foreground hover:border-primary/40 border-border",
							)}
							id={`stage-tab-${item.anchor}`}
							key={item.anchor}
							onClick={() => setIndex(itemIndex)}
							role="tab"
							type="button"
						>
							<span
								className={cn(
									"flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
									selected ? "text-primary bg-white" : "bg-primary/10 text-primary",
								)}
							>
								{itemIndex + 1}
							</span>
							<span className="min-w-0 leading-tight">{item.title}</span>
						</button>
					);
				})}
			</div>

			<AnimatePresence initial={false} mode="wait">
				<motion.article
					animate={{ opacity: 1, y: 0 }}
					aria-labelledby={`stage-tab-${phase.anchor}`}
					className="bg-card rounded-2xl border border-border p-5 shadow-xs sm:p-7"
					exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
					id={`stage-panel-${phase.anchor}`}
					initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
					key={phase.anchor}
					role="tabpanel"
					transition={{ duration: 0.2 }}
				>
					<h3 className="flex items-center gap-3 text-xl font-bold tracking-tight sm:text-2xl">
						<span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
							<Icon aria-hidden className="size-5" />
						</span>
						{phase.title}
					</h3>
					<p className="text-muted-foreground mt-3 max-w-3xl">{phase.summary}</p>

					<div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
						<ol className="space-y-3">
							{phase.steps.map((step, stepIndex) => (
								<li className="flex gap-3 text-sm" key={step}>
									<span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
										{stepIndex + 1}
									</span>
									<span className="pt-0.5">{step}</span>
								</li>
							))}
						</ol>

						<dl className="bg-muted/60 h-fit space-y-4 rounded-xl p-4">
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

					<div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
						{previous ? (
							<Button
								aria-label={`${MESSAGES.workflowStagePrevious}: ${previous.title}`}
								onClick={() => setIndex(index - 1)}
								size="sm"
								type="button"
								variant="ghost"
							>
								<ArrowLeft />
								{previous.title}
							</Button>
						) : (
							<span />
						)}
						{next && (
							<Button
								aria-label={`${MESSAGES.workflowStageNext}: ${next.title}`}
								onClick={() => setIndex(index + 1)}
								size="sm"
								type="button"
								variant="outline"
							>
								{next.title}
								<ArrowRight />
							</Button>
						)}
					</div>
				</motion.article>
			</AnimatePresence>
		</div>
	);
};
