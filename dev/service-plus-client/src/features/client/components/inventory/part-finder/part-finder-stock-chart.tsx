import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
    if (data.length === 0) return null;

    const chartData = data.map(d => ({
        location: d.location_name,
        qty:      d.qty,
    }));

    return (
        <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">
                Stock by Location
            </p>
            <ResponsiveContainer height={Math.max(60, data.length * 36)} width="100%">
                <BarChart data={chartData} layout="vertical" margin={{ bottom: 0, left: 0, right: 24, top: 0 }}>
                    <XAxis
                        allowDecimals={false}
                        axisLine={false}
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
                        width={80}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "var(--cl-surface-2)",
                            border:     "1px solid var(--cl-border)",
                            borderRadius: "6px",
                            fontSize:   "12px",
                        }}
                        cursor={{ fill: "var(--cl-hover)" }}
                        formatter={(value: number) => [value, "Qty"]}
                    />
                    <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, idx) => (
                            <Cell key={idx} fill={barColor(entry.qty)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
