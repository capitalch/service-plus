import type { EwDashboardType, EwPeriodType } from "@/features/client/types/extended-warranty";
import { cn } from "@/lib/utils";

import { EW_COLOR_CLASSES, EW_PERIODS } from "./ew-state-machine";
import type { EwColorType } from "./ew-state-machine";

export type EwMatrixRowType = {
	color: EwColorType;
	/** Rule above the row — it opens a new group of metrics. */
	divider?: boolean;
	indent?: boolean;
	key: string;
	label: string;
};

type Props = {
	caption?: string;
	data: EwDashboardType;
	rows: EwMatrixRowType[];
};

const PERIODS = (Object.keys(EW_PERIODS) as EwPeriodType[]).sort((a, b) => EW_PERIODS[a].order - EW_PERIODS[b].order);

function cellValue(data: EwDashboardType, key: string, period: EwPeriodType): number {
	return Number(data[`${key}_${period}` as keyof EwDashboardType] ?? 0);
}

/**
 * A metric × period grid of counters (§C7.5). Reads GET_EW_DASHBOARD's `<metric>_<period>`
 * columns; not clickable. Scrolls inside itself on narrow screens.
 *
 * Quiet on purpose — this sits under the Lead Pipeline, which is the screen's actual subject,
 * so a counter is a number in its row's colour rather than a filled, bordered tile. What makes
 * it readable instead is the shape of the table: headline rows carry a dot and a larger number,
 * an indented breakdown sits under its parent behind a guide rule, figures are right-aligned
 * tabular numerals so the columns line up, a zero fades back so real counts carry the eye, and
 * the whole row lights on hover.
 */
export const EwPeriodMatrix = ({ caption, data, rows }: Props) => (
	<div className="overflow-x-auto">
		<table className="w-full min-w-[720px] border-separate border-spacing-0">
			<thead>
				<tr>
					<th className="w-44 border-b border-(--cl-border) pb-2" />
					{PERIODS.map((period) => (
						<th
							key={period}
							className="border-b border-(--cl-border) px-3 pb-2 text-right text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted)"
							scope="col"
						>
							{EW_PERIODS[period].label}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => {
					const colors = EW_COLOR_CLASSES[row.color];
					const rule = row.divider ? "border-t border-(--cl-border)" : "";
					return (
						<tr key={row.key} className="transition-colors hover:bg-(--cl-hover)">
							<th
								className={cn(
									"py-1.5 pr-3 text-left text-xs font-medium text-(--cl-text)",
									row.indent && "font-normal text-(--cl-text-muted)",
									rule,
								)}
								scope="row"
							>
								{row.indent ? (
									<span className="ml-[3px] flex items-center gap-2 border-l border-(--cl-border) pl-4">
										{row.label}
									</span>
								) : (
									<span className="flex items-center gap-2">
										<span
											className={cn("size-2 shrink-0 rounded-full bg-current", colors.text)}
											aria-hidden="true"
										/>
										{row.label}
									</span>
								)}
							</th>
							{PERIODS.map((period) => {
								const value = cellValue(data, row.key, period);
								return (
									<td key={period} className={cn("px-3 py-1.5 text-right", rule)}>
										<span
											className={cn(
												"tabular-nums",
												row.indent ? "text-sm font-medium" : "text-base font-semibold",
												value === 0 ? "text-(--cl-text-muted) opacity-50" : colors.text,
											)}
										>
											{value}
										</span>
									</td>
								);
							})}
						</tr>
					);
				})}
			</tbody>
		</table>
		{caption && <p className="mt-2 text-[11px] text-(--cl-text-muted)">{caption}</p>}
	</div>
);
