import { useState } from "react";
import { Activity, IndianRupee, Truck, Wrench } from "lucide-react";
import {
    Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MESSAGES } from "@/constants/messages";

import { ChartCard } from "../common/chart-card";
import { formatInr, formatNumber } from "../common/formatters";
import { KpiCard } from "../common/kpi-card";
import { KpiGrid } from "../common/kpi-grid";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportToolbar } from "../common/report-toolbar";
import { TogglePill } from "../common/toggle-pill";
import { exportReportPdf } from "../common/pdf-export";
import { exportReportXlsx } from "../common/xlsx-export";
import { CATEGORY_BUCKET_COLUMNS } from "../common/use-category-range-matrix";
import type { CategoryBucketFieldType } from "../common/use-category-range-matrix";
import { JOB_STAGES, splitTotal, stageCells, stageTotals, useJobsCombinedMatrix } from "./use-jobs-combined-matrix";

// Money series ride a second (right-hand) axis because they share the plot with job counts.
// Indigo / teal keep them clear of the three stage colours; red stays reserved for errors.
const PROFIT_COLOR  = "#14b8a6";
const REVENUE_COLOR = "#6366f1";

type ChartRowType = {
    delivered: number;
    label:     string;
    profit:    number;
    received:  number;
    repaired:  number;
    revenue:   number;
};

// Compact Indian notation — a full ₹ figure on a right-hand axis tick eats the plot width.
function formatCompactInr(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000)   return `₹${(value / 100000).toFixed(1)}L`;
    if (abs >= 1000)     return `₹${Math.round(value / 1000)}K`;
    return formatInr(value);
}

function isMoneySeries(name: string): boolean {
    return name === "Profit" || name === "Revenue";
}

type StageChartProps = {
    data:        ChartRowType[];
    showProfit:  boolean;
    showRevenue: boolean;
    xLabel:      string;
};

const StageChart = ({ data, showProfit, showRevenue, xLabel }: StageChartProps) => (
    <ResponsiveContainer height={360} width="100%">
        <ComposedChart data={data} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" vertical={false} />
            <XAxis
                angle={-30}
                axisLine={false}
                dataKey="label"
                height={64}
                interval={0}
                name={xLabel}
                style={{ fontSize: "10px" }}
                textAnchor="end"
                tickLine={false}
            />
            <YAxis allowDecimals={false} axisLine={false} style={{ fontSize: "10px" }} tickLine={false} width={36} yAxisId="count" />
            {(showProfit || showRevenue) && (
                <YAxis
                    axisLine={false}
                    orientation="right"
                    style={{ fontSize: "10px" }}
                    tickFormatter={formatCompactInr}
                    tickLine={false}
                    width={56}
                    yAxisId="money"
                />
            )}
            <Tooltip
                contentStyle={{
                    background:   "var(--cl-surface-2)",
                    border:       "1px solid var(--cl-border)",
                    borderRadius: "6px",
                    fontSize:     "12px",
                }}
                cursor={{ fill: "var(--cl-hover)" }}
                formatter={(value, name) => [
                    isMoneySeries(String(name)) ? formatInr(Number(value)) : formatNumber(Number(value)),
                    String(name),
                ]}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {JOB_STAGES.map(stage => (
                <Bar
                    dataKey={stage.key}
                    fill={stage.color}
                    key={stage.key}
                    name={stage.shortLabel}
                    radius={[3, 3, 0, 0]}
                    yAxisId="count"
                />
            ))}
            {showRevenue && (
                <Line dataKey="revenue" dot={false} name="Revenue" stroke={REVENUE_COLOR} strokeWidth={2} type="monotone" yAxisId="money" />
            )}
            {showProfit && (
                <Line dataKey="profit" dot={false} name="Profit" stroke={PROFIT_COLOR} strokeWidth={2} type="monotone" yAxisId="money" />
            )}
        </ComposedChart>
    </ResponsiveContainer>
);

export const JobsCombinedChartSection = () => {
    const matrix = useJobsCombinedMatrix();
    const [bucket, setBucket]           = useState<CategoryBucketFieldType>("ytd");
    const [showRevenue, setShowRevenue] = useState(true);
    const [showProfit, setShowProfit]   = useState(true);

    const totals = {
        delivered: stageTotals(matrix.stages.delivered),
        received:  stageTotals(matrix.stages.received),
        repaired:  stageTotals(matrix.stages.repaired),
    };

    // Chart 1 — every standard bucket, all categories folded together.
    const periodData: ChartRowType[] = CATEGORY_BUCKET_COLUMNS.map(b => ({
        delivered: splitTotal(totals.delivered[b.field]),
        label:     b.label,
        profit:    totals.delivered[b.field].profit_amount,
        received:  splitTotal(totals.received[b.field]),
        repaired:  splitTotal(totals.repaired[b.field]),
        revenue:   totals.delivered[b.field].revenue_amount,
    }));

    // Chart 2 — the selected bucket only, broken down by product category.
    const categoryData: ChartRowType[] = matrix.categories.map(category => {
        const delivered = stageCells(matrix.stages.delivered, category)[bucket];
        return {
            delivered: splitTotal(delivered),
            label:     category,
            profit:    delivered.profit_amount,
            received:  splitTotal(stageCells(matrix.stages.received, category)[bucket]),
            repaired:  splitTotal(stageCells(matrix.stages.repaired, category)[bucket]),
            revenue:   delivered.revenue_amount,
        };
    });

    const bucketLabel = CATEGORY_BUCKET_COLUMNS.find(b => b.field === bucket)?.label ?? "";
    const kpi         = periodData.find(d => d.label === bucketLabel);
    const received    = kpi?.received ?? 0;
    const delivered   = kpi?.delivered ?? 0;

    function buildExportRows(rows: ChartRowType[], labelKey: string): Record<string, number | string>[] {
        return rows.map(r => ({
            delivered:  r.delivered,
            [labelKey]: r.label,
            profit:     formatInr(r.profit),
            received:   r.received,
            repaired:   r.repaired,
            revenue:    formatInr(r.revenue),
        }));
    }

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "period", header: "Period", width: 40 },
                    { align: "right", dataKey: "received",  header: "Received",  width: 26 },
                    { align: "right", dataKey: "repaired",  header: "Repaired",  width: 26 },
                    { align: "right", dataKey: "delivered", header: "Delivered", width: 26 },
                    { align: "right", dataKey: "revenue",   header: "Revenue",   width: 32 },
                    { align: "right", dataKey: "profit",    header: "Profit",    width: 32 },
                ],
                fileName:    "jobs-combined-chart",
                meta:        [{ label: "Category breakdown period", value: bucketLabel }],
                orientation: "landscape",
                rows:        buildExportRows(periodData, "period"),
                title:       "Combined Jobs Summary — Chart Data",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            const columns = (labelHeader: string, labelKey: string) => [
                { header: labelHeader, key: labelKey },
                { header: "Received",  key: "received" },
                { header: "Repaired",  key: "repaired" },
                { header: "Delivered", key: "delivered" },
                { header: "Revenue",   key: "revenue" },
                { header: "Profit",    key: "profit" },
            ];
            exportReportXlsx({
                fileName: "jobs-combined-chart",
                sheets: [
                    { columns: columns("Period", "period"), name: "By Period", rows: buildExportRows(periodData, "period") },
                    { columns: columns("Category", "category"), name: `By Category - ${bucketLabel}`, rows: buildExportRows(categoryData, "category") },
                ],
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    return (
        <ReportSection>
            <ReportToolbar
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <TogglePill
                            activeClass="border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800/40 dark:bg-indigo-950/30 dark:text-indigo-300"
                            checked={showRevenue}
                            label="Revenue"
                            onChange={setShowRevenue}
                            switchActiveClass="data-checked:bg-indigo-500 dark:data-checked:bg-indigo-500"
                        />
                        <TogglePill
                            activeClass="border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-800/40 dark:bg-teal-950/30 dark:text-teal-300"
                            checked={showProfit}
                            label="Profit"
                            onChange={setShowProfit}
                            switchActiveClass="data-checked:bg-teal-500 dark:data-checked:bg-teal-500"
                        />
                    </div>
                }
                hideRange
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={matrix.refetch}
                subtitle="Received, repaired (OK) and delivered (OK) as grouped bars, with revenue and profit as lines"
                title="Combined Jobs Summary — Chart"
            >
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                        Category breakdown period
                    </Label>
                    <Select onValueChange={v => setBucket(v as CategoryBucketFieldType)} value={bucket}>
                        <SelectTrigger className="h-9 w-40">
                            <SelectValue placeholder="Year-to-Date" />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORY_BUCKET_COLUMNS.map(b => (
                                <SelectItem key={b.field} value={b.field}>{b.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </ReportToolbar>

            {matrix.error && <ReportError onRetry={matrix.refetch} />}

            <KpiGrid columns={4}>
                <KpiCard accentClassName="text-blue-500"    icon={Activity}    label={`Received — ${bucketLabel}`}  loading={matrix.loading} value={formatNumber(received)} />
                <KpiCard accentClassName="text-amber-500"   icon={Wrench}      label={`Repaired — ${bucketLabel}`}  loading={matrix.loading} subValue={received ? `${((( kpi?.repaired ?? 0) / received) * 100).toFixed(0)}% of received` : undefined} value={formatNumber(kpi?.repaired ?? 0)} />
                <KpiCard accentClassName="text-emerald-500" icon={Truck}       label={`Delivered — ${bucketLabel}`} loading={matrix.loading} subValue={received ? `${((delivered / received) * 100).toFixed(0)}% of received` : undefined} value={formatNumber(delivered)} />
                <KpiCard accentClassName="text-teal-500"    icon={IndianRupee} label={`Profit — ${bucketLabel}`}    loading={matrix.loading} subValue={`Revenue ${formatInr(kpi?.revenue ?? 0)}`} value={formatInr(kpi?.profit ?? 0)} />
            </KpiGrid>

            <ChartCard
                description="Grouped bars per standard date bucket, all categories combined. Buckets overlap (e.g. Today is inside This Week, Q1 and YTD), so read each bucket on its own — the series are not cumulative across the axis. Revenue and profit come from delivered jobs only."
                title="Stages by period"
            >
                {matrix.loading
                    ? <ReportLoading lines={4} />
                    : (
                        <StageChart
                            data={periodData}
                            showProfit={showProfit}
                            showRevenue={showRevenue}
                            xLabel="Period"
                        />
                    )
                }
            </ChartCard>

            <ChartCard
                description={`Grouped bars per product category for ${bucketLabel}. Revenue and profit come from delivered jobs only.`}
                title={`Stages by category — ${bucketLabel}`}
            >
                {matrix.loading
                    ? <ReportLoading lines={4} />
                    : categoryData.length === 0
                        ? <ReportEmpty />
                        : (
                            <StageChart
                                data={categoryData}
                                showProfit={showProfit}
                                showRevenue={showRevenue}
                                xLabel="Category"
                            />
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
