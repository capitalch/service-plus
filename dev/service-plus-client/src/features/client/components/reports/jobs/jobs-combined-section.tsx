import { useState } from "react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { cn } from "@/lib/utils";

import { CategoryRangeCellDialog } from "../common/category-range-cell-dialog";
import type { CategoryRangeCellType } from "../common/category-range-cell-dialog";
import { ChartCard } from "../common/chart-card";
import { formatInr, formatWarrantySplit } from "../common/formatters";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { ReportToolbar } from "../common/report-toolbar";
import { TogglePill } from "../common/toggle-pill";
import { exportReportPdf } from "../common/pdf-export";
import { exportReportXlsx } from "../common/xlsx-export";
import { CATEGORY_BUCKET_COLUMNS } from "../common/use-category-range-matrix";
import type { CategorySplitType } from "../common/use-category-range-matrix";
import { WarrantySplitCell } from "../common/warranty-split-cell";
import { JOB_STAGES, stageCells, stageTotals, useJobsCombinedMatrix } from "./use-jobs-combined-matrix";
import type { JobStageKeyType } from "./use-jobs-combined-matrix";

// reportTitle matches each stage's standalone tab title exactly (Jobs Received,
// Jobs Repaired (OK), Jobs Delivered (OK)) — see JOB_STAGES label above.
const STAGE_DETAIL: Record<JobStageKeyType, { reportTitle: string; showFinancials: boolean; sqlId: string }> = {
    delivered: { reportTitle: "Jobs Delivered (OK)", showFinancials: true,  sqlId: SQL_MAP.GET_JOBS_DELIVERED_OK_DETAIL },
    received:  { reportTitle: "Jobs Received",        showFinancials: false, sqlId: SQL_MAP.GET_JOBS_RECEIVED_DETAIL },
    repaired:  { reportTitle: "Jobs Repaired (OK)",    showFinancials: false, sqlId: SQL_MAP.GET_JOBS_REPAIRED_OK_DETAIL },
};

type CombinedRowType = {
    category:       string;
    cells:          Record<string, CategorySplitType>;
    isFirstOfGroup: boolean;
    isTotal:        boolean;
    stage:          JobStageKeyType;
    stageLabel:     string;
};

const MATRIX_DESCRIPTION = "All three job stages in one grid — product category vs. standard date buckets, three rows per category. Ranges overlap (e.g. Today is included in This Week, Q1, and YTD), so the TOTAL rows sum each bucket down its column (across categories), not across buckets. A category with no jobs in any bucket is not listed. Revenue and profit are shown on the Jobs Delivered (OK) row only.";

export const JobsCombinedSection = () => {
    const matrix = useJobsCombinedMatrix();
    const [showSplit, setShowSplit]     = useState(false);
    const [showRevenue, setShowRevenue] = useState(false);
    const [showProfit, setShowProfit]   = useState(false);
    const [cell, setCell] = useState<CategoryRangeCellType | null>(null);

    const categoryRows: CombinedRowType[] = matrix.categories.flatMap(category =>
        JOB_STAGES.map((stage, idx) => ({
            category,
            cells:          stageCells(matrix.stages[stage.key], category),
            isFirstOfGroup: idx === 0,
            isTotal:        false,
            stage:          stage.key,
            stageLabel:     stage.label,
        })),
    );

    const totalRows: CombinedRowType[] = JOB_STAGES.map((stage, idx) => ({
        category:       "TOTAL",
        cells:          stageTotals(matrix.stages[stage.key]),
        isFirstOfGroup: idx === 0,
        isTotal:        true,
        stage:          stage.key,
        stageLabel:     stage.label,
    }));

    const rows = categoryRows.length > 0 ? [...categoryRows, ...totalRows] : [];

    const columns: ReportColumnType<CombinedRowType>[] = [
        {
            cell: r => (
                <span className={r.isTotal ? "font-extrabold text-(--cl-text)" : "font-bold text-(--cl-text)"}>
                    {r.isFirstOfGroup ? r.category : ""}
                </span>
            ),
            header:   "Category",
            id:       "category",
            sortable: false,
            width:    "150px",
        },
        {
            cell: r => (
                <span className={r.isTotal ? "font-bold text-(--cl-text)" : "text-(--cl-text-muted)"}>
                    {r.stageLabel}
                </span>
            ),
            header:   "Stage",
            id:       "stage",
            sortable: false,
            width:    "150px",
        },
        ...CATEGORY_BUCKET_COLUMNS.map<ReportColumnType<CombinedRowType>>(b => ({
            align: "right",
            cell:  r => {
                const split = r.cells[b.field];
                const total = split.warranty_count + split.oow_count;
                const range = matrix.bucketRanges[b.field];
                const clickable = !r.isTotal && total > 0 && !!range;
                return (
                    <button
                        className={cn("w-full", clickable && "cursor-pointer rounded hover:ring-2 hover:ring-(--cl-accent) hover:ring-inset")}
                        disabled={!clickable}
                        type="button"
                        onClick={clickable ? () => {
                            const detail = STAGE_DETAIL[r.stage];
                            setCell({
                                bucketLabel:   b.label,
                                categoryValue: r.category,
                                from:          range.from,
                                reportTitle:   detail.reportTitle,
                                rowLabel:      "Category",
                                showFinancials: detail.showFinancials,
                                sqlId:         detail.sqlId,
                                to:            range.to,
                            });
                        } : undefined}
                    >
                        <WarrantySplitCell
                            bold={r.isTotal}
                            showProfit={showProfit && r.stage === "delivered"}
                            showRevenue={showRevenue && r.stage === "delivered"}
                            showSplit={showSplit}
                            split={split}
                        />
                    </button>
                );
            },
            header:   b.label,
            id:       b.field,
            sortable: false,
        })),
    ];

    // Export keeps one line per stage, and adds a Profit / Revenue line under the delivered
    // stage when those toggles are on — in-cell stacking does not survive a flat sheet.
    function buildExportRows(categoryKey: string, stageKey: string): Record<string, number | string>[] {
        return rows.flatMap(r => {
            const base: Record<string, number | string> = { [categoryKey]: r.isFirstOfGroup ? r.category : "", [stageKey]: r.stageLabel };
            CATEGORY_BUCKET_COLUMNS.forEach(b => { base[b.field] = formatWarrantySplit(r.cells[b.field]); });
            const extra: Record<string, number | string>[] = [];
            if (r.stage === "delivered" && showProfit) {
                const row: Record<string, number | string> = { [categoryKey]: "", [stageKey]: "  Profit" };
                CATEGORY_BUCKET_COLUMNS.forEach(b => { row[b.field] = formatInr(r.cells[b.field].profit_amount); });
                extra.push(row);
            }
            if (r.stage === "delivered" && showRevenue) {
                const row: Record<string, number | string> = { [categoryKey]: "", [stageKey]: "  Revenue" };
                CATEGORY_BUCKET_COLUMNS.forEach(b => { row[b.field] = formatInr(r.cells[b.field].revenue_amount); });
                extra.push(row);
            }
            return [base, ...extra];
        });
    }

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "category", header: "Category", width: 26 },
                    { dataKey: "stage", header: "Stage", width: 26 },
                    ...CATEGORY_BUCKET_COLUMNS.map(b => ({ align: "right" as const, dataKey: b.field, header: b.label, width: 24 })),
                ],
                fileName:    "jobs-combined-summary",
                meta:        [{ label: "Generated for", value: "Combined Jobs Summary" }],
                orientation: "landscape",
                rows:        buildExportRows("category", "stage"),
                title:       "Combined Jobs Summary",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: "jobs-combined-summary",
                sheets: [{
                    columns: [
                        { header: "Category", key: "category" },
                        { header: "Stage", key: "stage" },
                        ...CATEGORY_BUCKET_COLUMNS.map(b => ({ header: b.label, key: b.field })),
                    ],
                    name: "Combined Jobs Summary",
                    rows: buildExportRows("category", "stage"),
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
                    </div>
                }
                hideRange
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={matrix.refetch}
                subtitle="Jobs received, repaired (OK) and delivered (OK) side by side, with warranty split, revenue and profit. Click a cell to view its jobs."
                title="Combined Jobs Summary"
            />

            {matrix.error && <ReportError onRetry={matrix.refetch} />}

            <ChartCard description={MATRIX_DESCRIPTION}>
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
                                Profit (delivered jobs)
                            </span>
                        )}
                        {showRevenue && (
                            <span className="inline-flex items-center gap-1.5">
                                Revenue shown in (parentheses)
                            </span>
                        )}
                    </div>
                )}
                {matrix.loading
                    ? <ReportLoading lines={6} />
                    : (
                        <ReportTable
                            columns={columns}
                            rowClassName={r => (r.isTotal
                                ? "bg-(--cl-surface-3)"
                                : r.isFirstOfGroup ? "border-t border-(--cl-border)" : "")}
                            rowKey={r => `${r.category}|${r.stage}`}
                            rows={rows}
                            stickyHeader={false}
                        />
                    )
                }
            </ChartCard>

            <CategoryRangeCellDialog cell={cell} onClose={() => setCell(null)} />
        </ReportSection>
    );
};
