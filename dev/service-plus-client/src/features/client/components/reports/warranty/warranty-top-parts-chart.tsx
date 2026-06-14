import {
    Bar, BarChart, Cell, LabelList, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from "recharts";

import { formatInr } from "../_common/formatters";
import type { WarrantyPartRollupType } from "./warranty-types";

type Props = {
    data: WarrantyPartRollupType[];
    limit?: number;
};

const PALETTE = ["#10b981", "#059669", "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#22c55e", "#14b8a6", "#3b82f6"];

export const WarrantyTopPartsChart = ({ data, limit = 10 }: Props) => {
    const items = [...data]
        .sort((a, b) => Number(b.total_value) - Number(a.total_value))
        .slice(0, limit)
        .map(d => ({
            jobs:   Number(d.jobs_count),
            label:  `${d.part_code} • ${d.part_name}`,
            qty:    Number(d.total_qty),
            value:  Number(d.total_value),
        }));

    const maxLabelLen = items.length ? Math.max(...items.map(d => d.label.length)) : 10;
    const yAxisWidth  = Math.min(Math.max(maxLabelLen * 5, 80), 180);

    return (
        <ResponsiveContainer height={Math.max(items.length * 32, 160)} width="100%">
            <BarChart
                data={items}
                layout="vertical"
                margin={{ bottom: 0, left: 0, right: 70, top: 0 }}
            >
                <XAxis
                    axisLine={false}
                    style={{ fontSize: "10px" }}
                    tickFormatter={v => formatInr(Number(v))}
                    tickLine={false}
                    type="number"
                />
                <YAxis
                    axisLine={false}
                    dataKey="label"
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
                    formatter={(value, name) => {
                        const num = Number(value);
                        if (name === "value") return [formatInr(num), "Value"];
                        return [String(value), String(name)];
                    }}
                />
                <Bar dataKey="value" name="Value" radius={[0, 4, 4, 0]}>
                    <LabelList
                        dataKey="value"
                        formatter={(v) => formatInr(Number(v))}
                        position="right"
                        style={{ fill: "var(--cl-text-muted)", fontSize: "10px" }}
                    />
                    {items.map((_, idx) => (
                        <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};
