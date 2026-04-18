import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PartFinderStockByLocationType } from "@/features/client/types/part-finder";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    data: PartFinderStockByLocationType[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function barColor(qty: number): string {
    if (qty <= 0) return "#f43f5e";  // rose-500
    if (qty <= 5) return "#f59e0b";  // amber-500
    return "#10b981";                // emerald-500
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartFinderStockChart = ({ data }: Props) => {
    // Table above already shows location + qty for single-location case
    if (data.length < 2) return null;

    const chartData = data.map(d => ({
        location: d.location_name,
        qty:      Number(d.qty),
    }));

    const maxLabelLen  = Math.max(...chartData.map(d => d.location.length));
    const yAxisWidth   = Math.min(Math.max(maxLabelLen * 6, 60), 120);
    const maxQty       = Math.max(...chartData.map(d => d.qty));
    const xDomainMax   = Math.max(maxQty, 1);

    return (
        <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">
                Stock by Location
            </p>
            <ResponsiveContainer height={data.length * 44} width="100%">
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ bottom: 0, left: 0, right: 36, top: 0 }}
                >
                    <XAxis
                        allowDecimals={false}
                        axisLine={false}
                        domain={[0, xDomainMax]}
                        style={{ fontSize: "10px" }}
                        tickLine={false}
                        type="number"
                    />
                    <YAxis
                        axisLine={false}
                        dataKey="location"
                        style={{ fontSize: "10px" }}
                        tickLine={false}
                        type="category"
                        width={yAxisWidth}
                    />
                    <Tooltip
                        contentStyle={{
                            background:   "var(--cl-surface-2)",
                            border:       "1px solid var(--cl-border)",
                            borderRadius: "6px",
                            fontSize:     "12px",
                        }}
                        cursor={{ fill: "var(--cl-hover)" }}
                        formatter={(value) => [value, "Qty"]}
                    />
                    <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                        <LabelList
                            dataKey="qty"
                            position="right"
                            style={{ fontSize: "10px", fill: "var(--cl-text-muted)" }}
                        />
                        {chartData.map((entry, idx) => (
                            <Cell key={idx} fill={barColor(entry.qty)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
