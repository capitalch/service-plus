import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { cn } from "@/lib/utils";

import { ChartCard } from "../_common/chart-card";
import { formatDateShort, formatNumber } from "../_common/formatters";
import { formatIsoDate, getRange } from "../_common/fiscal";
import type { DateRangeType, RangeKeyType } from "../_common/fiscal";
import { ReportEmpty } from "../_common/report-empty";
import { ReportError } from "../_common/report-error";
import { ReportLoading } from "../_common/report-loading";
import { ReportSection } from "../_common/report-section";
import { ReportTable } from "../_common/report-table";
import type { ReportColumnType } from "../_common/report-table";
import { ReportToolbar } from "../_common/report-toolbar";
import { exportReportPdf } from "../_common/pdf-export";
import { exportReportXlsx } from "../_common/xlsx-export";
import { useFiscalSetting } from "../_common/use-fiscal-setting";
import { useGenericQuery } from "../_common/use-generic-query";

type RowType = {
    brand_name: string | null;
    consumed_date: string;
    part_code: string;
    part_name: string;
    qty: number;
    ref_no: string | null;
    remarks: string | null;
    source: string;
};

type ScopeType = "all" | "monthly" | "weekly" | "yearly";

const SCOPE_BUCKETS: Record<ScopeType, RangeKeyType> = {
    all:     "ytd",
    monthly: "thisMonth",
    weekly:  "thisWeek",
    yearly:  "ytd",
};

const COLUMNS: ReportColumnType<RowType>[] = [
    { cell: r => formatDateShort(r.consumed_date), header: "Consumed", id: "date", sortValue: r => r.consumed_date, value: r => r.consumed_date, width: "120px" },
    { header: "Part Code", id: "code", value: r => r.part_code, width: "110px" },
    { header: "Part Name", id: "name", value: r => r.part_name },
    { header: "Brand", id: "brand", value: r => r.brand_name ?? "—", width: "100px" },
    { align: "right", footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.qty), 0)), header: "Qty", id: "qty", value: r => Number(r.qty), width: "70px" },
    { header: "Source", id: "source", value: r => r.source, width: "80px" },
    { header: "Ref No", id: "ref", value: r => r.ref_no ?? "", width: "110px" },
    { header: "Remarks", id: "rem", value: r => r.remarks ?? "" },
];

export const PartsConsumptionDetailedSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const [scope, setScope] = useState<ScopeType>("monthly");

    const range = useMemo<DateRangeType>(
        () => getRange(SCOPE_BUCKETS[scope], new Date(), fyStartMonth),
        [scope, fyStartMonth],
    );

    const sqlArgs = useMemo(() => ({
        from: formatIsoDate(range.from),
        to:   formatIsoDate(range.to),
    }), [range]);

    const q = useGenericQuery<RowType>({
        enabled: isReady,
        sqlArgs,
        sqlId:   SQL_MAP.GET_PARTS_CONSUMPTION_RANGE,
    });

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "date",  header: "Date",   width: 24 },
                    { dataKey: "code",  header: "Part Code", width: 22 },
                    { dataKey: "name",  header: "Part Name" },
                    { dataKey: "brand", header: "Brand",  width: 22 },
                    { align: "right", dataKey: "qty", header: "Qty", width: 14 },
                    { dataKey: "source", header: "Source", width: 18 },
                    { dataKey: "ref",    header: "Ref",    width: 22 },
                ],
                fileName:    `parts-consumption_${scope}_${sqlArgs.from}_${sqlArgs.to}`,
                meta:        [{ label: "Scope", value: scope }, { label: "Range", value: `${sqlArgs.from} → ${sqlArgs.to}` }],
                orientation: "landscape",
                rows: q.data.map(r => ({
                    brand:  r.brand_name ?? "",
                    code:   r.part_code,
                    date:   formatDateShort(r.consumed_date),
                    name:   r.part_name,
                    qty:    formatNumber(Number(r.qty)),
                    ref:    r.ref_no ?? "",
                    source: r.source,
                })),
                title: "Parts Consumption — Detailed",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `parts-consumption_${scope}_${sqlArgs.from}_${sqlArgs.to}`,
                sheets: [{
                    name: "Consumption",
                    rows: q.data.map(r => ({
                        "Brand":     r.brand_name ?? "",
                        "Date":      formatDateShort(r.consumed_date),
                        "Part Code": r.part_code,
                        "Part Name": r.part_name,
                        "Qty":       Number(r.qty),
                        "Ref":       r.ref_no ?? "",
                        "Remarks":   r.remarks ?? "",
                        "Source":    r.source,
                    })),
                }],
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    const SCOPE_TABS: { key: ScopeType; label: string }[] = [
        { key: "weekly",  label: "Weekly" },
        { key: "monthly", label: "Monthly" },
        { key: "yearly",  label: "Yearly" },
        { key: "all",     label: "All" },
    ];

    return (
        <ReportSection>
            <ReportToolbar
                hideRange
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={q.refetch}
                subtitle="Line-level parts consumed across jobs + sales — sorted by date desc"
                title="Parts Consumption — Detailed"
            >
                <div className="inline-flex rounded-md border border-(--cl-border) bg-(--cl-surface-2) p-0.5">
                    {SCOPE_TABS.map(t => (
                        <button
                            key={t.key}
                            className={cn(
                                "rounded px-3 py-1.5 text-xs font-semibold transition-colors",
                                scope === t.key
                                    ? "bg-(--cl-accent) text-white"
                                    : "text-(--cl-text-muted) hover:text-(--cl-text)",
                            )}
                            onClick={() => setScope(t.key)}
                            type="button"
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </ReportToolbar>

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Sorted by consumed date desc" title={`Consumption (${scope})`}>
                {q.loading
                    ? <ReportLoading lines={4} />
                    : q.data.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={COLUMNS}
                                rowKey={r => `${r.consumed_date}-${r.part_code}-${r.ref_no ?? ""}-${r.qty}`}
                                rows={q.data}
                                showFooter
                                stickyHeader={false}
                            />
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
