import { useMemo, useState } from "react";
import { Activity, Truck, Wrench } from "lucide-react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatNumber } from "../common/formatters";
import { formatIsoDate, getRange } from "../common/fiscal";
import type { DateRangeType } from "../common/fiscal";
import { KpiCard } from "../common/kpi-card";
import { KpiGrid } from "../common/kpi-grid";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportToolbar } from "../common/report-toolbar";
import { exportReportPdf } from "../common/pdf-export";
import { exportReportXlsx } from "../common/xlsx-export";
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";

type RowType = {
    delivered_count: number;
    received_count: number;
    repaired_count: number;
};

export const RepairDeliverFunnelSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const initialRange = useMemo<DateRangeType>(() => getRange("thisMonth", new Date(), fyStartMonth), [fyStartMonth]);
    const [range, setRange] = useState<DateRangeType>(initialRange);

    const rangeArgs = useMemo(() => ({
        from: formatIsoDate(range.from),
        to:   formatIsoDate(range.to),
    }), [range]);

    const q = useGenericQuery<RowType>({
        enabled: isReady,
        sqlArgs: rangeArgs,
        sqlId:   SQL_MAP.GET_REPAIR_DELIVER_FUNNEL_RANGE,
    });

    const row = q.data?.[0];
    const received  = Number(row?.received_count ?? 0);
    const repaired  = Number(row?.repaired_count ?? 0);
    const delivered = Number(row?.delivered_count ?? 0);
    const maxV      = Math.max(1, received, repaired, delivered);

    function bar(v: number, color: string) {
        return (
            <div className="h-9 w-full overflow-hidden rounded-md bg-(--cl-surface-3)">
                <div
                    className={`flex h-9 items-center justify-end px-3 text-xs font-bold text-white ${color}`}
                    style={{ width: `${Math.max(8, (v / maxV) * 100)}%` }}
                >
                    {formatNumber(v)}
                </div>
            </div>
        );
    }

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "stage", header: "Stage", width: 60 },
                    { align: "right", dataKey: "count", header: "Count", width: 30 },
                ],
                fileName: `repair-deliver-funnel_${rangeArgs.from}_${rangeArgs.to}`,
                rows: [
                    { count: formatNumber(received),  stage: "Received" },
                    { count: formatNumber(repaired),  stage: "Repaired" },
                    { count: formatNumber(delivered), stage: "Delivered" },
                ],
                title: "Repair vs Deliver Funnel",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `repair-deliver-funnel_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [{
                    name: "Funnel",
                    rows: [
                        { Count: received,  Stage: "Received" },
                        { Count: repaired,  Stage: "Repaired" },
                        { Count: delivered, Stage: "Delivered" },
                    ],
                }],
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    return (
        <ReportSection>
            <ReportToolbar
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={q.refetch}
                onSetRange={(key, custom) => setRange(getRange(key, new Date(), fyStartMonth, custom))}
                range={range}
                subtitle="Received → Repaired → Delivered conversion"
                title="Repair vs Deliver Funnel"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <KpiGrid columns={4}>
                <KpiCard accentClassName="text-(--cl-accent-text)" icon={Activity} label="Received"  loading={q.loading} value={formatNumber(received)} />
                <KpiCard accentClassName="text-amber-500"         icon={Wrench}    label="Repaired"  loading={q.loading} value={formatNumber(repaired)}  subValue={received ? `${((repaired/received)*100).toFixed(0)}%` : undefined} />
                <KpiCard accentClassName="text-emerald-500"       icon={Truck}     label="Delivered" loading={q.loading} value={formatNumber(delivered)} subValue={received ? `${((delivered/received)*100).toFixed(0)}%` : undefined} />
                <KpiCard label="Conversion" loading={q.loading} value={received ? `${((delivered/received)*100).toFixed(1)}%` : "0%"} />
            </KpiGrid>

            <ChartCard description="Funnel bars proportional to received total" title="Funnel">
                {q.loading
                    ? <ReportLoading lines={3} />
                    : !row
                        ? <ReportEmpty />
                        : (
                            <div className="flex flex-col gap-3">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">Received</p>
                                    {bar(received, "bg-(--cl-accent)")}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">Repaired</p>
                                    {bar(repaired, "bg-amber-500")}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">Delivered</p>
                                    {bar(delivered, "bg-emerald-500")}
                                </div>
                            </div>
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
