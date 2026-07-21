import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatDateShort, formatInr, formatNumber } from "../common/formatters";
import { formatIsoDate, getRange } from "../common/fiscal";
import type { DateRangeType } from "../common/fiscal";
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
    brand_name: string | null;
    charges_cost: number;
    customer_name: string;
    delivery_date: string;
    gst: number;
    id: number;
    is_warranty: boolean;
    job_no: string;
    model_name: string | null;
    parts_cost: number;
    product_name: string | null;
    profit: number;
    selling_total: number;
    technician_name: string | null;
};

const COLUMNS: ReportColumnType<RowType>[] = [
    {
        cell:   r => <span className="font-mono text-(--cl-accent-text)">{r.job_no}</span>,
        header: "Job No",
        id:     "job_no",
        value:  r => r.job_no,
        width:  "100px",
    },
    {
        cell:   r => formatDateShort(r.delivery_date),
        header: "Delivered",
        id:     "delivery_date",
        value:  r => r.delivery_date,
        width:  "110px",
    },
    {
        header: "Customer",
        id:     "customer",
        value:  r => r.customer_name,
    },
    {
        cell:   r => (
            <div className="flex flex-col">
                <span>{r.product_name ?? "—"}</span>
                <span className="text-[10px] text-(--cl-text-muted)">
                    {[r.brand_name, r.model_name].filter(Boolean).join(" • ")}
                </span>
            </div>
        ),
        header: "Device",
        id:     "device",
        value:  r => `${r.product_name ?? ""} ${r.brand_name ?? ""} ${r.model_name ?? ""}`,
    },
    {
        cell:   r => r.technician_name ?? "—",
        header: "Technician",
        id:     "tech",
        value:  r => r.technician_name ?? "",
        width:  "120px",
    },
    {
        align:    "center",
        cell:     r => r.is_warranty ? <ShieldCheck className="mx-auto h-4 w-4 text-emerald-500" /> : "—",
        header:   "W?",
        id:       "warranty",
        sortable: false,
        width:    "50px",
    },
    {
        align:  "right",
        cell:   r => formatInr(r.parts_cost),
        footer: rows => formatInr(rows.reduce((s, r) => s + Number(r.parts_cost), 0)),
        header: "Parts Cost",
        id:     "parts_cost",
        value:  r => Number(r.parts_cost),
        width:  "100px",
    },
    {
        align:  "right",
        cell:   r => formatInr(r.charges_cost),
        footer: rows => formatInr(rows.reduce((s, r) => s + Number(r.charges_cost), 0)),
        header: "Charges Cost",
        id:     "charges_cost",
        value:  r => Number(r.charges_cost),
        width:  "110px",
    },
    {
        align:  "right",
        cell:   r => formatInr(r.selling_total),
        footer: rows => formatInr(rows.reduce((s, r) => s + Number(r.selling_total), 0)),
        header: "Selling Total",
        id:     "selling",
        value:  r => Number(r.selling_total),
        width:  "120px",
    },
    {
        align:  "right",
        cell:   r => <span className="font-bold text-emerald-600">{formatInr(r.profit)}</span>,
        footer: rows => formatInr(rows.reduce((s, r) => s + Number(r.profit), 0)),
        header: "Profit",
        id:     "profit",
        value:  r => Number(r.profit),
        width:  "110px",
    },
    {
        align:  "right",
        cell:   r => formatInr(r.gst),
        footer: rows => formatInr(rows.reduce((s, r) => s + Number(r.gst), 0)),
        header: "GST",
        id:     "gst",
        value:  r => Number(r.gst),
        width:  "100px",
    },
];

export const JobsDeliveredDetailedSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const initialRange = useMemo<DateRangeType>(
        () => getRange("thisMonth", new Date(), fyStartMonth),
        [fyStartMonth],
    );
    const [range, setRange] = useState<DateRangeType>(initialRange);

    const rangeArgs = useMemo(() => ({
        from: formatIsoDate(range.from),
        to:   formatIsoDate(range.to),
    }), [range]);

    const q = useGenericQuery<RowType>({
        enabled: isReady,
        sqlArgs: rangeArgs,
        sqlId:   SQL_MAP.GET_DELIVERED_JOBS_DETAILED_RANGE,
    });

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "job_no",     header: "Job No",     width: 22 },
                    { dataKey: "delivered",  header: "Delivered",  width: 22 },
                    { dataKey: "customer",   header: "Customer" },
                    { dataKey: "device",     header: "Device" },
                    { dataKey: "tech",       header: "Technician", width: 28 },
                    { align: "right", dataKey: "parts",   header: "Parts ₹",   width: 22 },
                    { align: "right", dataKey: "charges", header: "Charges ₹", width: 24 },
                    { align: "right", dataKey: "selling", header: "Selling ₹", width: 24 },
                    { align: "right", dataKey: "profit",  header: "Profit ₹",  width: 22 },
                ],
                fileName:    `delivered-jobs-detailed_${rangeArgs.from}_${rangeArgs.to}`,
                meta:        [{ label: "Range", value: `${rangeArgs.from} → ${rangeArgs.to}` }],
                orientation: "landscape",
                rows: q.data.map(r => ({
                    charges:    formatInr(Number(r.charges_cost)),
                    customer:   r.customer_name,
                    delivered:  formatDateShort(r.delivery_date),
                    device:     [r.product_name, r.brand_name, r.model_name].filter(Boolean).join(" • "),
                    job_no:     r.job_no,
                    parts:      formatInr(Number(r.parts_cost)),
                    profit:     formatInr(Number(r.profit)),
                    selling:    formatInr(Number(r.selling_total)),
                    tech:       r.technician_name ?? "",
                })),
                subtitle:    "Line-level delivered job report with parts, charges, selling total and profit",
                title:       "Delivered Jobs — Detailed",
                totalsRow:   {
                    charges:   formatInr(q.data.reduce((s, r) => s + Number(r.charges_cost), 0)),
                    customer:  "",
                    delivered: "",
                    device:    "",
                    job_no:    "TOTAL",
                    parts:     formatInr(q.data.reduce((s, r) => s + Number(r.parts_cost), 0)),
                    profit:    formatInr(q.data.reduce((s, r) => s + Number(r.profit), 0)),
                    selling:   formatInr(q.data.reduce((s, r) => s + Number(r.selling_total), 0)),
                    tech:      "",
                },
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `delivered-jobs-detailed_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [{
                    name: "Delivered Jobs",
                    rows: q.data.map(r => ({
                        "Brand":       r.brand_name ?? "",
                        "Charges":     Number(r.charges_cost),
                        "Customer":    r.customer_name,
                        "Delivered":   formatDateShort(r.delivery_date),
                        "GST":         Number(r.gst),
                        "Job No":      r.job_no,
                        "Model":       r.model_name ?? "",
                        "Parts":       Number(r.parts_cost),
                        "Product":     r.product_name ?? "",
                        "Profit":      Number(r.profit),
                        "Selling":     Number(r.selling_total),
                        "Technician":  r.technician_name ?? "",
                        "Warranty":    r.is_warranty ? "Yes" : "No",
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
                subtitle="Per-job revenue, cost, profit, GST — sorted by delivery date desc"
                title="Delivered Jobs — Detailed"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted)">Jobs</p>
                    <p className="mt-1 text-xl font-light text-(--cl-text)">{formatNumber(q.data.length)}</p>
                </div>
                <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted)">Revenue</p>
                    <p className="mt-1 text-xl font-light text-(--cl-text)">{formatInr(q.data.reduce((s, r) => s + Number(r.selling_total), 0))}</p>
                </div>
                <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted)">Profit</p>
                    <p className="mt-1 text-xl font-light text-emerald-600">{formatInr(q.data.reduce((s, r) => s + Number(r.profit), 0))}</p>
                </div>
                <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted)">GST</p>
                    <p className="mt-1 text-xl font-light text-(--cl-text)">{formatInr(q.data.reduce((s, r) => s + Number(r.gst), 0))}</p>
                </div>
            </div>

            <ChartCard description="Click a column header to sort" title="Delivered Jobs">
                {q.loading
                    ? <ReportLoading lines={4} />
                    : q.data.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={COLUMNS}
                                rowKey={r => r.id}
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
