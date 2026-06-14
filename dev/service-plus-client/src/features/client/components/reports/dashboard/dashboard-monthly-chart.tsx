import {
    Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from "recharts";

type RowType = {
    month: string;
    oow_count: number;
    total_count: number;
    warranty_count: number;
};

type Props = {
    data: RowType[];
};

export const DashboardMonthlyChart = ({ data }: Props) => {
    const chartData = data.map(d => ({
        month:    formatMonthLabel(d.month),
        oow:      Number(d.oow_count),
        warranty: Number(d.warranty_count),
    }));

    return (
        <ResponsiveContainer height={280} width="100%">
            <BarChart data={chartData} margin={{ bottom: 0, left: 0, right: 12, top: 8 }}>
                <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                    axisLine={false}
                    dataKey="month"
                    style={{ fontSize: "10px" }}
                    tickLine={false}
                />
                <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    style={{ fontSize: "10px" }}
                    tickLine={false}
                    width={32}
                />
                <Tooltip
                    contentStyle={{
                        background:   "var(--cl-surface-2)",
                        border:       "1px solid var(--cl-border)",
                        borderRadius: "6px",
                        fontSize:     "12px",
                    }}
                    cursor={{ fill: "var(--cl-hover)" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="warranty" fill="#10b981" name="Warranty" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="oow"      fill="#3b82f6" name="Out of Warranty" radius={[3, 3, 0, 0]} stackId="a" />
            </BarChart>
        </ResponsiveContainer>
    );
};

function formatMonthLabel(yyyyMm: string): string {
    const [y, m] = yyyyMm.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11) return yyyyMm;
    return `${months[idx]} '${y.slice(-2)}`;
}
