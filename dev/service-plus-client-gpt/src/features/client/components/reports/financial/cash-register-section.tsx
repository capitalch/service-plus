import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatDateShort, formatInr } from "../common/formatters";
import { formatIsoDate, getRange } from "../common/fiscal";
import type { DateRangeType } from "../common/fiscal";
import { KpiCard } from "../common/kpi-card";
import { KpiGrid } from "../common/kpi-grid";
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

type RowType = {
    amount: number;
    customer_name: string;
    job_no: string;
    payment_date: string;
    payment_mode: string;
    receipt_no: string;
    reference_no: string | null;
    remarks: string | null;
};

const COLUMNS: ReportColumnType<RowType>[] = [
    {
        cell:   r => formatDateShort(r.payment_date),
        header: "Date",
        id:     "date",
        sortValue: r => r.payment_date,
        value:  r => r.payment_date,
        width:  "110px",
    },
    {
        cell:   r => <span className="font-mono text-(--cl-accent-text)">{r.receipt_no}</span>,
        header: "Receipt",
        id:     "receipt",
        value:  r => r.receipt_no,
        width:  "110px",
    },
    {
        cell:   r => <span className="font-mono">{r.job_no}</span>,
        header: "Job",
        id:     "job",
        value:  r => r.job_no,
        width:  "100px",
    },
    {
        header: "Customer",
        id:     "customer",
        value:  r => r.customer_name,
    },
    {
        header: "Mode",
        id:     "mode",
        value:  r => r.payment_mode,
        width:  "100px",
    },
    {
        align:  "right",
        cell:   r => formatInr(Number(r.amount)),
        footer: rows => formatInr(rows.reduce((s, r) => s + Number(r.amount), 0)),
        header: "Amount",
        id:     "amount",
        value:  r => Number(r.amount),
        width:  "120px",
    },
    {
        header: "Reference",
        id:     "ref",
        value:  r => r.reference_no ?? "",
        width:  "120px",
    },
];

export const CashRegisterSection = () => {
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
        sqlId:   SQL_MAP.GET_CASH_REGISTER_RANGE,
    });

    const total = q.data.reduce((s, r) => s + Number(r.amount), 0);
    const byMode = useMemo(() => {
        const m = new Map<string, number>();
        for (const r of q.data) m.set(r.payment_mode, (m.get(r.payment_mode) ?? 0) + Number(r.amount));
        return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    }, [q.data]);

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "date",     header: "Date",     width: 22 },
                    { dataKey: "receipt",  header: "Receipt",  width: 22 },
                    { dataKey: "job",      header: "Job",      width: 22 },
                    { dataKey: "customer", header: "Customer" },
                    { dataKey: "mode",     header: "Mode",     width: 22 },
                    { align: "right", dataKey: "amount", header: "Amount", width: 24 },
                ],
                fileName:    `cash-register_${rangeArgs.from}_${rangeArgs.to}`,
                meta:        [{ label: "Range", value: `${rangeArgs.from} → ${rangeArgs.to}` }, { label: "Total", value: formatInr(total) }],
                orientation: "landscape",
                rows: q.data.map(r => ({
                    amount:   formatInr(Number(r.amount)),
                    customer: r.customer_name,
                    date:     formatDateShort(r.payment_date),
                    job:      r.job_no,
                    mode:     r.payment_mode,
                    receipt:  r.receipt_no,
                })),
                title:    "Cash Register",
                totalsRow: { amount: formatInr(total), customer: "", date: "TOTAL", job: "", mode: "", receipt: "" },
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `cash-register_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [{
                    name: "Receipts",
                    rows: q.data.map(r => ({
                        "Amount":    Number(r.amount),
                        "Customer":  r.customer_name,
                        "Date":      formatDateShort(r.payment_date),
                        "Job":       r.job_no,
                        "Mode":      r.payment_mode,
                        "Receipt":   r.receipt_no,
                        "Reference": r.reference_no ?? "",
                        "Remarks":   r.remarks ?? "",
                    })),
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
                subtitle="All receipts within range — grouped by payment mode"
                title="Cash Register"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <KpiGrid columns={4}>
                <KpiCard label="Total Receipts" value={formatInr(total)} accentClassName="text-emerald-500" loading={q.loading} />
                <KpiCard label="# Receipts"     value={String(q.data.length)} loading={q.loading} />
                {byMode.slice(0, 2).map(([mode, amount]) => (
                    <KpiCard key={mode} label={mode} value={formatInr(amount)} loading={q.loading} />
                ))}
            </KpiGrid>

            <ChartCard description="Daily receipt log" title="Receipts">
                {q.loading
                    ? <ReportLoading lines={4} />
                    : q.data.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={COLUMNS}
                                rowKey={r => r.receipt_no}
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
