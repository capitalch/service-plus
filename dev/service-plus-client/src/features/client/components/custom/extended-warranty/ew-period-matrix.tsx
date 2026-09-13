import type { EwDashboardType, EwPeriodType } from "@/features/client/types/extended-warranty";
import { cn } from "@/lib/utils";

import { EW_COLOR_CLASSES, EW_PERIODS } from "./ew-state-machine";
import type { EwColorType } from "./ew-state-machine";

export type EwMatrixRowType = {
	color: EwColorType;
	indent?: boolean;
	key: string;
	label: string;
};

type Props = {
	caption?: string;
	data: EwDashboardType;
	footnote?: { key: string; label: string };
	rows: EwMatrixRowType[];
};

const PERIODS = (Object.keys(EW_PERIODS) as EwPeriodType[]).sort((a, b) => EW_PERIODS[a].order - EW_PERIODS[b].order);

function cellValue(data: EwDashboardType, key: string, period: EwPeriodType): number {
	return Number(data[`${key}_${period}` as keyof EwDashboardType] ?? 0);
}

/**
 * A metric × period grid of counters (§C7.5). Reads GET_EW_DASHBOARD's `<metric>_<period>`
 * columns; not clickable. Scrolls inside itself on narrow screens.
 */
export const EwPeriodMatrix = ({ caption, data, footnote, rows }: Props) => (
	<div className="overflow-x-auto">
		<table className="w-full min-w-[560px] border-separate border-spacing-2">
			<thead>
				<tr>
					<th className="w-40" />
					{PERIODS.map((period) => (
						<th
							key={period}
							className="text-left text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted)"
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
					return (
						<tr key={row.key}>
							<th
								className={cn(
									"text-left text-xs font-semibold text-(--cl-text)",
									row.indent && "pl-4 font-normal text-(--cl-text-muted)",
								)}
								scope="row"
							>
								{row.indent ? `↳ ${row.label}` : row.label}
							</th>
							{PERIODS.map((period) => (
								<td key={period}>
									<div
										className={cn(
											"rounded-lg border-2 px-3 py-1.5 text-2xl font-bold tabular-nums",
											colors.border,
											colors.text,
											colors.tint,
										)}
									>
										{cellValue(data, row.key, period)}
									</div>
								</td>
							))}
						</tr>
					);
				})}
				{footnote && (
					<tr>
						<th />
						{PERIODS.map((period) => (
							<td key={period} className="text-[11px] text-(--cl-text-muted)">
								{footnote.label}: {cellValue(data, footnote.key, period)}
							</td>
						))}
					</tr>
				)}
			</tbody>
		</table>
		{caption && <p className="px-2 text-[11px] text-(--cl-text-muted)">{caption}</p>}
	</div>
);
