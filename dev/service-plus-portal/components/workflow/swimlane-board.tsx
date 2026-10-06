import { MESSAGES } from "@/constants/messages";
import { STAGE_ACCENT } from "@/components/workflow/stage-accents";
import { swimlanes, workflowPhases } from "@/content/workflow";
import { cn } from "@/lib/utils";

/** Actors down the side, stages across the top. A table rather than a div grid: a role-by-stage
 *  matrix is tabular data, and the header associations come for free instead of by hand. */
export const SwimlaneBoard = () => {
	return (
		<div className="bg-card overflow-hidden rounded-2xl border border-border shadow-xs">
			<div className="overflow-x-auto">
				<table className="w-full min-w-[880px] border-collapse text-sm">
					<caption className="sr-only">{MESSAGES.workflowLanesCaption}</caption>
					<thead>
						<tr>
							<th className="bg-card sticky left-0 z-10 w-36 border-b border-r border-border" scope="col">
								<span className="sr-only">{MESSAGES.workflowLanesActor}</span>
							</th>
							{/* Each column header is washed in its stage colour, so the same hue
							    identifies a stage in the header, in the timeline and on the map. */}
							{workflowPhases.map((phase, index) => {
								const tone = STAGE_ACCENT;

								return (
									<th
										className={cn(
											"border-b border-r border-border px-3 py-3 text-left align-bottom font-semibold last:border-r-0",
											tone.wash,
										)}
										key={phase.anchor}
										scope="col"
									>
										<span className="flex items-center gap-1.5">
											<span
												className={cn(
													"flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
													tone.dot,
												)}
											>
												{index + 1}
											</span>
											<span className="text-xs leading-tight">{phase.title}</span>
										</span>
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{swimlanes.map((lane, laneIndex) => {
							const Icon = lane.icon;
							// Alternating row ground: with six columns of short chips, banding is
							// what keeps the eye on one actor across the whole matrix.
							const band = laneIndex % 2 === 1;

							return (
								<tr key={lane.lane}>
									<th
										className={cn(
											"bg-card sticky left-0 z-10 border-b border-r border-border px-4 py-3 text-left align-top font-semibold",
											band && "bg-muted/30",
										)}
										scope="row"
									>
										<span className="flex items-center gap-2">
											<Icon aria-hidden className="text-primary/70 size-4 shrink-0" />
											{lane.lane}
										</span>
									</th>
									{lane.cells.map((items, cellIndex) => (
										<td
											className={cn(
												"border-b border-r border-border p-2 align-top last:border-r-0",
												band && "bg-muted/30",
											)}
											key={workflowPhases[cellIndex].anchor}
										>
											{/* A dash, not an sr-only sentence. Tailwind's `sr-only` is
								    position:absolute, so inside a sideways-scrolled table those spans land
								    far to the right of the viewport, escape the scroll box and widen the
								    whole page. The sr-only text above is safe only because the caption and
								    the corner cell sit in the leftmost column; the footer below explains
								    the dash instead. */}
											{items.length === 0 ? (
												<span
													aria-hidden
													className="text-muted-foreground/40 block px-1 text-xs"
												>
													—
												</span>
											) : (
												<ul className="space-y-1">
													{items.map((item) => (
														<li className="text-xs leading-snug" key={item}>
															{item}
														</li>
													))}
												</ul>
											)}
										</td>
									))}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			{/* One footer for both hints, so the frame keeps a single bottom edge. */}
			<div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-xs">
				<span>
					<span aria-hidden>—</span> {MESSAGES.workflowLaneIdle}
				</span>
				<span className="lg:hidden">{MESSAGES.workflowMapSwipe}</span>
			</div>
		</div>
	);
};
