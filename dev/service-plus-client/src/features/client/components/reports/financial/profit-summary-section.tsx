import { useMemo } from "react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatInr } from "../common/formatters";
import { formatIsoDate, getRange } from "../common/fiscal";
import type { RangeKeyType } from "../common/fiscal";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { ReportToolbar } from "../common/report-toolbar";
import { exportReportPdf } from "../common/pdf-export";
import { exportReportXlsx } from "../common/xlsx-export";
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";

type ProfitRowType = {
    oow_profit: number;
    oow_revenue: number;
    total_cost: number;
    total_profit: number;
    total_revenue: number;
    warranty_profit: number;
    warranty_revenue: number;
};

type DisplayRowType = {
    bucket: string;
    key: string;
    oow_profit: number;
    total_profit: number;
    warranty_profit: number;
};

const BUCKETS: { key: RangeKeyType; label: string }[] = [
    { key: "today",     label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "thisWeek",  label: "This Week" },
    { key: "prevWeek",  label: "Previous Week" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
    { key: "q1",        label: "Q1" },
    { key: "q2",        label: "Q2" },
    { key: "q3",        label: "Q3" },
    { key: "q4",        label: "Q4" },
    { key: "ytd",       label: "Year-to-Date" },
    { key: "lastYear",  label: "Last Year" },
];

export const ProfitSummarySection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const ranges = useMemo(
        () => BUCKETS.map(b => ({ ...b, range: getRange(b.key, new Date(), fyStartMonth) })),
        [fyStartMonth],
    );

    const queries = [
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[0].range.from),  to: formatIsoDate(ranges[0].range.to)  }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[1].range.from),  to: formatIsoDate(ranges[1].range.to)  }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[2].range.from),  to: formatIsoDate(ranges[2].range.to)  }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[3].range.from),  to: formatIsoDate(ranges[3].range.to)  }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[4].range.from),  to: formatIsoDate(ranges[4].range.to)  }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[5].range.from),  to: formatIsoDate(ranges[5].range.to)  }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[6].range.from),  to: formatIsoDate(ranges[6].range.to)  }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[7].range.from),  to: formatIsoDate(ranges[7].range.to)  }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[8].range.from),  to: formatIsoDate(ranges[8].range.to)  }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[9].range.from),  to: formatIsoDate(ranges[9].range.to)  }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[10].range.from), to: formatIsoDate(ranges[10].range.to) }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
        useGenericQuery<ProfitRowType>({ enabled: isReady, sqlArgs: { from: formatIsoDate(ranges[11].range.from), to: formatIsoDate(ranges[11].range.to) }, sqlId: SQL_MAP.GET_PROFIT_RANGE }),
    ];

    const rows: DisplayRowType[] = ranges.map((b, idx) => {
        const r = queries[idx].data?.[0];
        return {
            bucket:          b.label,
            key:             b.key,
            oow_profit:      Number(r?.oow_profit ?? 0),
            total_profit:    Number(r?.total_profit ?? 0),
            warranty_profit: Number(r?.warranty_profit ?? 0),
        };
    });

    const loading = queries.some(q => q.loading);
    const error   = queries.find(q => q.error)?.error;

    function refetch() { queries.forEach(q => q.refetch()); }

    const COLUMNS: ReportColumnType<DisplayRowType>[] = [
        { header: "Range", id: "bucket", value: r => r.bucket, width: "180px" },
        {
            align:  "right",
            cell:   r => formatInr(r.warranty_profit),
            footer: rs => formatInr(rs.reduce((s, r) => s + r.warranty_profit, 0)),
            header: "Warranty Profit",
            id:     "wp",
            value:  r => r.warranty_profit,
        },
        {
            align:  "right",
            cell:   r => formatInr(r.oow_profit),
            footer: rs => formatInr(rs.reduce((s, r) => s + r.oow_profit, 0)),
            header: "OOW Profit",
            id:     "op",
            value:  r => r.oow_profit,
        },
        {
            align:  "right",
            cell:   r => <span className="font-bold text-emerald-600">{formatInr(r.total_profit)}</span>,
            footer: rs => formatInr(rs.reduce((s, r) => s + r.total_profit, 0)),
            header: "Total Profit",
            id:     "tp",
            value:  r => r.total_profit,
        },
    ];

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "bucket", header: "Range",     width: 50 },
                    { align: "right", dataKey: "wp",    header: "Warranty ₹",   width: 36 },
                    { align: "right", dataKey: "op",    header: "OOW ₹",        width: 36 },
                    { align: "right", dataKey: "total", header: "Total ₹",      width: 36 },
                ],
                fileName:    "profit-summary",
                orientation: "portrait",
                rows: rows.map(r => ({
                    bucket: r.bucket,
                    op:     formatInr(r.oow_profit),
                    total:  formatInr(r.total_profit),
                    wp:     formatInr(r.warranty_profit),
                })),
                subtitle: "Profit across standard date buckets — warranty vs OOW split",
                title:    "Profit Summary",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: "profit-summary",
                sheets: [{
                    name: "Profit Summary",
                    rows: rows.map(r => ({
                        "OOW Profit":      r.oow_profit,
                        "Range":           r.bucket,
                        "Total Profit":    r.total_profit,
                        "Warranty Profit": r.warranty_profit,
                    })),
                }],
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    return (
        <ReportSection>
            <ReportToolbar
                hideRange
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={refetch}
                subtitle="Profit per bucket — warranty vs out-of-warranty"
                title="Profit Summary"
            />

            {error && <ReportError onRetry={refetch} />}

            <ChartCard description="Profit = invoice amount − parts cost − charges cost" title="Profit by Range">
                {loading
                    ? <ReportLoading lines={4} />
                    : rows.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={COLUMNS}
                                rowKey={r => r.key}
                                rows={rows}
                                showFooter
                                stickyHeader={false}
                            />
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
