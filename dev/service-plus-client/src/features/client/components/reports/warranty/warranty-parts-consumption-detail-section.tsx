import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../_common/chart-card";
import { formatDateShort, formatInr, formatNumber } from "../_common/formatters";
import { ReportEmpty } from "../_common/report-empty";
import { ReportError } from "../_common/report-error";
import { ReportLoading } from "../_common/report-loading";
import { ReportSection } from "../_common/report-section";
import { ReportTable } from "../_common/report-table";
import type { ReportColumnType } from "../_common/report-table";
import { ReportToolbar } from "../_common/report-toolbar";
import { exportReportPdf } from "../_common/pdf-export";
import { exportReportXlsx } from "../_common/xlsx-export";
import { formatIsoDate, getRange } from "../_common/fiscal";
import type { DateRangeType } from "../_common/fiscal";
import { useFiscalSetting } from "../_common/use-fiscal-setting";
import { useGenericQuery } from "../_common/use-generic-query";
import { WarrantyJobDetailDialog } from "./warranty-job-detail-dialog";
import { WarrantyRangeTabs } from "./warranty-range-tabs";
import type { WarrantyPartLineType } from "./warranty-types";

const COLUMNS: ReportColumnType<WarrantyPartLineType>[] = [
    {
        cell:   r => formatDateShort(r.consumed_date),
        header: "Consumed Date",
        id:     "consumed_date",
        sortValue: r => r.consumed_date,
        value:  r => r.consumed_date,
        width:  "120px",
    },
    {
        cell:   r => <span className="font-mono text-(--cl-accent-text)">{r.job_no}</span>,
        header: "Job No",
        id:     "job_no",
        value:  r => r.job_no,
        width:  "120px",
    },
    {
        header: "Part Code",
        id:     "code",
        value:  r => r.part_code,
        width:  "110px",
    },
    {
        header: "Part Name",
        id:     "name",
        value:  r => r.part_name,
    },
    {
        header: "Brand",
        id:     "brand",
        value:  r => r.brand_name ?? "—",
        width:  "120px",
    },
    {
        align:  "right",
        footer: rows => formatNumber(rows.reduce((s, r) => s + Number(r.qty), 0)),
        header: "Qty",
        id:     "qty",
        value:  r => Number(r.qty),
        width:  "70px",
    },
    {
        align:  "right",
        cell:   r => formatInr(Number(r.cost_price)),
        header: "Cost ₹",
        id:     "cost",
        value:  r => Number(r.cost_price),
        width:  "100px",
    },
    {
        align:  "right",
        cell:   r => formatInr(Number(r.line_value)),
        footer: rows => formatInr(rows.reduce((s, r) => s + Number(r.line_value), 0)),
        header: "Value ₹",
        id:     "value",
        value:  r => Number(r.line_value),
        width:  "120px",
    },
    {
        cell:   r => r.technician_name ?? "—",
        header: "Technician",
        id:     "tech",
        value:  r => r.technician_name ?? "",
        width:  "130px",
    },
];

export const WarrantyPartsConsumptionDetailSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const initialRange = useMemo<DateRangeType>(
        () => getRange("thisMonth", new Date(), fyStartMonth),
        [fyStartMonth],
    );
    const [range, setRange]         = useState<DateRangeType>(initialRange);
    const [activeJob, setActiveJob] = useState<{ id: number; jobNo: string } | null>(null);

    const rangeArgs = useMemo(() => ({
        from: formatIsoDate(range.from),
        to:   formatIsoDate(range.to),
    }), [range]);

    const linesQ = useGenericQuery<WarrantyPartLineType>({
        enabled: isReady,
        sqlArgs: rangeArgs,
        sqlId:   SQL_MAP.GET_WARRANTY_PARTS_CONSUMPTION_RANGE,
    });

    function handlePdfExport() {
        try {
            const totalQty = linesQ.data.reduce((s, r) => s + Number(r.qty), 0);
            const totalVal = linesQ.data.reduce((s, r) => s + Number(r.line_value), 0);
            exportReportPdf({
                columns: [
                    { dataKey: "consumed_date", header: "Date",       width: 22 },
                    { dataKey: "job_no",        header: "Job No",     width: 22 },
                    { dataKey: "part_code",     header: "Part Code",  width: 22 },
                    { dataKey: "part_name",     header: "Part Name" },
                    { dataKey: "brand",         header: "Brand",      width: 26 },
                    { align: "right", dataKey: "qty",   header: "Qty",   width: 14 },
                    { align: "right", dataKey: "cost",  header: "Cost",  width: 22 },
                    { align: "right", dataKey: "value", header: "Value", width: 22 },
                    { dataKey: "technician",    header: "Technician", width: 28 },
                ],
                fileName:    `warranty-parts-consumption_${rangeArgs.from}_${rangeArgs.to}`,
                meta:        [
                    { label: "Range", value: `${rangeArgs.from} → ${rangeArgs.to}` },
                    { label: "Lines", value: formatNumber(linesQ.data.length) },
                    { label: "Qty",   value: formatNumber(totalQty) },
                    { label: "Value", value: formatInr(totalVal) },
                ],
                orientation: "landscape",
                rows: linesQ.data.map(r => ({
                    brand:         r.brand_name ?? "",
                    consumed_date: formatDateShort(r.consumed_date),
                    cost:          formatInr(Number(r.cost_price)),
                    job_no:        r.job_no,
                    part_code:     r.part_code,
                    part_name:     r.part_name,
                    qty:           formatNumber(Number(r.qty)),
                    technician:    r.technician_name ?? "",
                    value:         formatInr(Number(r.line_value)),
                })),
                subtitle:    "Line-level parts consumed against in-warranty jobs",
                title:       "Warranty Parts Consumption — Detail",
                totalsRow:   {
                    brand: "", consumed_date: "TOTAL", cost: "", job_no: "",
                    part_code: "", part_name: "",
                    qty: formatNumber(totalQty),
                    technician: "",
                    value: formatInr(totalVal),
                },
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch {
            toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED);
        }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `warranty-parts-consumption_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [{
                    name: "Parts Consumption",
                    rows: linesQ.data.map(r => ({
                        "Brand":         r.brand_name ?? "",
                        "Consumed Date": formatDateShort(r.consumed_date),
                        "Cost":          Number(r.cost_price),
                        "Job No":        r.job_no,
                        "Line Value":    Number(r.line_value),
                        "Part Code":     r.part_code,
                        "Part Name":     r.part_name,
                        "Qty":           Number(r.qty),
                        "Technician":    r.technician_name ?? "",
                    })),
                }],
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch {
            toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED);
        }
    }

    return (
        <ReportSection>
            <ReportToolbar
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={linesQ.refetch}
                subtitle="Every spare part consumed against an in-warranty job"
                title="Warranty Parts Consumption — Detail"
            >
                <WarrantyRangeTabs
                    fyStartMonth={fyStartMonth}
                    onChange={setRange}
                    range={range}
                />
            </ReportToolbar>

            {linesQ.error && <ReportError onRetry={linesQ.refetch} />}

            <ChartCard description="Sorted by consumed date — most recent first" title="Consumption Lines">
                {linesQ.loading
                    ? <ReportLoading lines={5} />
                    : linesQ.data.length === 0
                        ? <ReportEmpty message={MESSAGES.INFO_WARRANTY_NO_JOBS_IN_RANGE} />
                        : (
                            <ReportTable
                                columns={COLUMNS}
                                onRowClick={r => setActiveJob({ id: r.job_id, jobNo: r.job_no })}
                                rowKey={r => r.line_id}
                                rows={linesQ.data}
                                showFooter
                                stickyHeader={false}
                            />
                        )
                }
            </ChartCard>

            <WarrantyJobDetailDialog
                jobId={activeJob?.id ?? null}
                jobNo={activeJob?.jobNo ?? null}
                onClose={() => setActiveJob(null)}
            />
        </ReportSection>
    );
};
