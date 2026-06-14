import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../_common/chart-card";
import { formatDateShort, formatInr, formatNumber } from "../_common/formatters";
import { formatIsoDate, getRange } from "../_common/fiscal";
import type { DateRangeType } from "../_common/fiscal";
import { KpiCard } from "../_common/kpi-card";
import { KpiGrid } from "../_common/kpi-grid";
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
    amount: number;
    brand_name: string | null;
    customer_name: string;
    gst_amount: number;
    gst_rate: number;
    invoice_date: string;
    invoice_no: string;
    part_code: string;
    part_id: number;
    part_name: string;
    price: number;
    qty: number;
};

const COLUMNS: ReportColumnType<RowType>[] = [
    { cell: r => formatDateShort(r.invoice_date), header: "Date", id: "date", value: r => r.invoice_date, width: "110px" },
    { cell: r => <span className="font-mono text-(--cl-accent-text)">{r.invoice_no}</span>, header: "Invoice", id: "inv", value: r => r.invoice_no, width: "120px" },
    { header: "Customer", id: "cust", value: r => r.customer_name },
    { header: "Part Code", id: "code", value: r => r.part_code, width: "110px" },
    { header: "Part Name", id: "name", value: r => r.part_name },
    { header: "Brand", id: "brand", value: r => r.brand_name ?? "—", width: "100px" },
    { align: "right", footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.qty), 0)), header: "Qty", id: "qty", value: r => Number(r.qty), width: "70px" },
    { align: "right", cell: r => formatInr(Number(r.price)), header: "Price", id: "price", value: r => Number(r.price), width: "90px" },
    { align: "right", cell: r => formatInr(Number(r.amount)), footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.amount), 0)), header: "Amount", id: "amt", value: r => Number(r.amount), width: "110px" },
    { align: "right", cell: r => formatInr(Number(r.gst_amount)), footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.gst_amount), 0)), header: "GST", id: "gst", value: r => Number(r.gst_amount), width: "100px" },
];

export const SalesReportSection = () => {
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
        sqlId:   SQL_MAP.GET_SALES_REPORT_RANGE,
    });

    const totalAmount = q.data.reduce((s, r) => s + Number(r.amount), 0);
    const totalGst    = q.data.reduce((s, r) => s + Number(r.gst_amount), 0);
    const distinctInvoices = new Set(q.data.map(r => r.invoice_no)).size;

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "date",     header: "Date",     width: 22 },
                    { dataKey: "inv",      header: "Invoice",  width: 22 },
                    { dataKey: "customer", header: "Customer" },
                    { dataKey: "part",     header: "Part" },
                    { align: "right", dataKey: "qty",   header: "Qty",    width: 14 },
                    { align: "right", dataKey: "amt",   header: "Amount", width: 24 },
                    { align: "right", dataKey: "gst",   header: "GST",    width: 22 },
                ],
                fileName:    `sales-report_${rangeArgs.from}_${rangeArgs.to}`,
                meta:        [{ label: "Range", value: `${rangeArgs.from} → ${rangeArgs.to}` }],
                orientation: "landscape",
                rows: q.data.map(r => ({
                    amt:      formatInr(Number(r.amount)),
                    customer: r.customer_name,
                    date:     formatDateShort(r.invoice_date),
                    gst:      formatInr(Number(r.gst_amount)),
                    inv:      r.invoice_no,
                    part:     `${r.part_code} — ${r.part_name}`,
                    qty:      formatNumber(Number(r.qty)),
                })),
                title: "Sales Report",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `sales-report_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [{
                    name: "Sales Lines",
                    rows: q.data.map(r => ({
                        "Amount":    Number(r.amount),
                        "Brand":     r.brand_name ?? "",
                        "Customer":  r.customer_name,
                        "Date":      formatDateShort(r.invoice_date),
                        "GST":       Number(r.gst_amount),
                        "GST Rate":  Number(r.gst_rate),
                        "Invoice":   r.invoice_no,
                        "Part Code": r.part_code,
                        "Part Name": r.part_name,
                        "Price":     Number(r.price),
                        "Qty":       Number(r.qty),
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
                subtitle="Line-level sales invoice items"
                title="Sales Report"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <KpiGrid columns={4}>
                <KpiCard label="Invoices"   loading={q.loading} value={formatNumber(distinctInvoices)} />
                <KpiCard label="Lines"      loading={q.loading} value={formatNumber(q.data.length)} />
                <KpiCard label="Amount"     loading={q.loading} value={formatInr(totalAmount)} accentClassName="text-emerald-500" />
                <KpiCard label="GST"        loading={q.loading} value={formatInr(totalGst)} />
            </KpiGrid>

            <ChartCard description="Sorted by invoice date desc" title="Sales Lines">
                {q.loading
                    ? <ReportLoading lines={4} />
                    : q.data.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={COLUMNS}
                                rowKey={r => `${r.invoice_no}-${r.part_id}`}
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
