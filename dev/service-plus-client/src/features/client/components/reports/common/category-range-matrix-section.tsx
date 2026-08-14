import { useState } from "react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";

import { ChartCard } from "./chart-card";
import { formatWarrantySplit } from "./formatters";
import { ReportError } from "./report-error";
import { ReportLoading } from "./report-loading";
import { ReportSection } from "./report-section";
import { ReportTable } from "./report-table";
import type { ReportColumnType } from "./report-table";
import { ReportToolbar } from "./report-toolbar";
import { TogglePill } from "./toggle-pill";
import { exportReportPdf } from "./pdf-export";
import { exportReportXlsx } from "./xlsx-export";
import type { CategoryRangeRowType, CategorySplitType } from "./use-category-range-matrix";
import { CATEGORY_BUCKET_COLUMNS, useCategoryRangeMatrix } from "./use-category-range-matrix";
import { useFiscalSetting } from "./use-fiscal-setting";
import { WarrantySplitCell } from "./warranty-split-cell";

type Props = {
    description: string;
    fileSlug: string;
    financialCaveat?: string;
    matrixDescription?: string;
    rowLabel?: string;
    rowOrder?: string[];
    showFinancialToggles?: boolean;
    sqlId: string;
    title: string;
};

const DEFAULT_MATRIX_DESCRIPTION = "Product category vs. standard date buckets. Ranges overlap (e.g. Today is included in This Week, Q1, and YTD), so the Total row sums each bucket down its column (across categories), not across buckets. A category with no jobs in any bucket is not listed.";

function sumSplit(rows: CategoryRangeRowType[], field: keyof CategoryRangeRowType): CategorySplitType {
    return rows.reduce(
        (acc, r) => {
            const split = r[field] as CategorySplitType;
            return {
                oow_count:      acc.oow_count + split.oow_count,
                profit_amount:  acc.profit_amount + split.profit_amount,
                revenue_amount: acc.revenue_amount + split.revenue_amount,
                warranty_count: acc.warranty_count + split.warranty_count,
            };
        },
        { oow_count: 0, profit_amount: 0, revenue_amount: 0, warranty_count: 0 },
    );
}

export const CategoryRangeMatrixSection = ({ description, fileSlug, financialCaveat, matrixDescription, rowLabel = "Category", rowOrder, showFinancialToggles = false, sqlId, title }: Props) => {
    const { fyStartMonth, isReady } = useFiscalSetting();
    const [showSplit, setShowSplit]     = useState(false);
    const [showRevenue, setShowRevenue] = useState(false);
    const [showProfit, setShowProfit]   = useState(false);

    const matrix = useCategoryRangeMatrix(sqlId, fyStartMonth, isReady, rowOrder);

    const columns: ReportColumnType<CategoryRangeRowType>[] = [
        {
            footer: () => <span className="font-extrabold text-(--cl-text)">Total</span>,
            header: rowLabel,
            id:     "category",
            value:  r => r.category,
            width:  "160px",
        },
        ...CATEGORY_BUCKET_COLUMNS.map<ReportColumnType<CategoryRangeRowType>>(b => ({
            align:  "right",
            cell:   r => <WarrantySplitCell showProfit={showProfit} showRevenue={showRevenue} showSplit={showSplit} split={r[b.field]} />,
            footer: rows => <WarrantySplitCell bold showProfit={showProfit} showRevenue={showRevenue} showSplit={showSplit} split={sumSplit(rows, b.field)} />,
            header: b.label,
            id:     b.field,
            value:  r => r[b.field].warranty_count + r[b.field].oow_count,
        })),
    ];

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "category", header: rowLabel, width: 32 },
                    ...CATEGORY_BUCKET_COLUMNS.map(b => ({ align: "right" as const, dataKey: b.field, header: b.label, width: 28 })),
                ],
                fileName:    fileSlug,
                meta:        [{ label: "Generated for", value: title }],
                orientation: "landscape",
                rows: matrix.rows.map(r => {
                    const row: Record<string, number | string> = { category: r.category };
                    CATEGORY_BUCKET_COLUMNS.forEach(b => { row[b.field] = formatWarrantySplit(r[b.field]); });
                    return row;
                }),
                title,
                totalsRow: (() => {
                    const row: Record<string, number | string> = { category: "TOTAL" };
                    CATEGORY_BUCKET_COLUMNS.forEach(b => { row[b.field] = formatWarrantySplit(sumSplit(matrix.rows, b.field)); });
                    return row;
                })(),
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: fileSlug,
                sheets: [{
                    name: title.slice(0, 28),
                    rows: [
                        ...matrix.rows.map(r => {
                            const row: Record<string, number | string> = { Category: r.category };
                            CATEGORY_BUCKET_COLUMNS.forEach(b => { row[b.label] = formatWarrantySplit(r[b.field]); });
                            return row;
                        }),
                        (() => {
                            const row: Record<string, number | string> = { Category: "TOTAL" };
                            CATEGORY_BUCKET_COLUMNS.forEach(b => { row[b.label] = formatWarrantySplit(sumSplit(matrix.rows, b.field)); });
                            return row;
                        })(),
                    ],
                }],
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
                            activeClass="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                            checked={showSplit}
                            label="Warranty / OOW split"
                            onChange={setShowSplit}
                            switchActiveClass="data-checked:bg-emerald-500 dark:data-checked:bg-emerald-500"
                        />
                        {showFinancialToggles && (
                            <>
                                <TogglePill
                                    activeClass="border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-300"
                                    checked={showRevenue}
                                    label="Revenue"
                                    onChange={setShowRevenue}
                                    switchActiveClass="data-checked:bg-blue-500 dark:data-checked:bg-blue-500"
                                />
                                <TogglePill
                                    activeClass="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                                    checked={showProfit}
                                    label="Profit"
                                    onChange={setShowProfit}
                                    switchActiveClass="data-checked:bg-emerald-500 dark:data-checked:bg-emerald-500"
                                />
                            </>
                        )}
                    </div>
                }
                hideRange
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={matrix.refetch}
                subtitle={description}
                title={title}
            />

            {matrix.error && <ReportError onRetry={matrix.refetch} />}

            <ChartCard description={matrixDescription ?? DEFAULT_MATRIX_DESCRIPTION}>
                {(showSplit || showRevenue || showProfit) && (
                    <div className="mb-2 flex flex-wrap items-center gap-4 text-[11px] font-semibold text-(--cl-text-muted)">
                        {showSplit && (
                            <>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                                    Warranty
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    Out of Warranty
                                </span>
                            </>
                        )}
                        {showProfit && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                Profit
                            </span>
                        )}
                        {showRevenue && (
                            <span className="inline-flex items-center gap-1.5">
                                Revenue shown in (parentheses)
                            </span>
                        )}
                    </div>
                )}
                {(showRevenue || showProfit) && financialCaveat && (
                    <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400">
                        {financialCaveat}
                    </p>
                )}
                {matrix.loading
                    ? <ReportLoading lines={4} />
                    : (
                        <ReportTable
                            columns={columns}
                            rowKey={r => r.category}
                            rows={matrix.rows}
                            showFooter
                            stickyHeader={false}
                        />
                    )
                }
            </ChartCard>
        </ReportSection>
    );
};
