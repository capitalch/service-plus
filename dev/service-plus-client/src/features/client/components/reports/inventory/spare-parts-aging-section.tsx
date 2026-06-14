import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../_common/chart-card";
import { formatDateShort, formatInr, formatNumber } from "../_common/formatters";
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
import { useGenericQuery } from "../_common/use-generic-query";

type RowType = {
    age_days: number;
    brand_name: string | null;
    cost_price: number;
    last_in_date: string | null;
    part_code: string;
    part_id: number;
    part_name: string;
    stock_qty: number;
    stock_value: number;
};

type Props = {
    initialFilterOnly1Yr?: boolean;
    title?: string;
};

function bucketOf(days: number): string {
    if (days <= 30)  return "0-30";
    if (days <= 90)  return "31-90";
    if (days <= 180) return "91-180";
    if (days <= 365) return "181-365";
    return ">365";
}

function bucketColor(b: string): string {
    if (b === ">365") return "bg-amber-500/15 text-amber-700";
    if (b === "181-365") return "bg-amber-300/20 text-amber-700";
    return "bg-(--cl-hover) text-(--cl-text-muted)";
}

export const SparePartsAgingSection = ({ initialFilterOnly1Yr = false, title = "Spare Parts Aging" }: Props = {}) => {
    const [agedOnly, setAgedOnly] = useState<boolean>(initialFilterOnly1Yr);

    const q = useGenericQuery<RowType>({
        sqlId: SQL_MAP.GET_PARTS_AGING,
    });

    const filtered = useMemo(
        () => agedOnly ? q.data.filter(r => Number(r.age_days) > 365) : q.data,
        [q.data, agedOnly],
    );

    const totals = useMemo(() => {
        let qty   = 0;
        let value = 0;
        let aged  = 0;
        let agedV = 0;
        for (const r of filtered) {
            qty   += Number(r.stock_qty);
            value += Number(r.stock_value);
            if (Number(r.age_days) > 365) { aged += Number(r.stock_qty); agedV += Number(r.stock_value); }
        }
        return { aged, agedV, qty, value };
    }, [filtered]);

    const COLUMNS: ReportColumnType<RowType>[] = [
        { header: "Part Code", id: "code", value: r => r.part_code, width: "110px" },
        { header: "Part Name", id: "name", value: r => r.part_name },
        { header: "Brand", id: "brand", value: r => r.brand_name ?? "—", width: "100px" },
        { align: "right", cell: r => formatNumber(Number(r.stock_qty)),   footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.stock_qty), 0)),   header: "Stock Qty", id: "q", value: r => Number(r.stock_qty), width: "100px" },
        { align: "right", cell: r => formatInr(Number(r.stock_value)),    footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.stock_value), 0)),    header: "Stock ₹",   id: "v", value: r => Number(r.stock_value), width: "120px" },
        { cell: r => r.last_in_date ? formatDateShort(r.last_in_date) : "—", header: "Last In", id: "in", value: r => r.last_in_date ?? "", width: "110px" },
        {
            align: "center",
            cell:  r => {
                const b = bucketOf(Number(r.age_days));
                return <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${bucketColor(b)}`}>{b}</span>;
            },
            header: "Bucket",
            id:     "b",
            sortValue: r => Number(r.age_days),
            value:  r => Number(r.age_days),
            width:  "120px",
        },
        { align: "right", cell: r => `${Number(r.age_days)} d`, header: "Age", id: "age", value: r => Number(r.age_days), width: "80px" },
    ];

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "code",  header: "Code", width: 22 },
                    { dataKey: "name",  header: "Part Name" },
                    { dataKey: "brand", header: "Brand", width: 28 },
                    { align: "right", dataKey: "qty",   header: "Qty",     width: 18 },
                    { align: "right", dataKey: "value", header: "Value",   width: 26 },
                    { dataKey: "lastIn", header: "Last In", width: 24 },
                    { dataKey: "bucket", header: "Bucket",  width: 22 },
                    { align: "right", dataKey: "age", header: "Age",    width: 16 },
                ],
                fileName:    agedOnly ? "slow-movers-over-1yr" : "spare-parts-aging",
                orientation: "landscape",
                rows: filtered.map(r => ({
                    age:    String(r.age_days),
                    brand:  r.brand_name ?? "",
                    bucket: bucketOf(Number(r.age_days)),
                    code:   r.part_code,
                    lastIn: r.last_in_date ? formatDateShort(r.last_in_date) : "",
                    name:   r.part_name,
                    qty:    formatNumber(Number(r.stock_qty)),
                    value:  formatInr(Number(r.stock_value)),
                })),
                title,
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: agedOnly ? "slow-movers-over-1yr" : "spare-parts-aging",
                sheets: [{
                    name: "Aging",
                    rows: filtered.map(r => ({
                        "Age Days":    Number(r.age_days),
                        "Brand":       r.brand_name ?? "",
                        "Bucket":      bucketOf(Number(r.age_days)),
                        "Last In":     r.last_in_date ?? "",
                        "Part Code":   r.part_code,
                        "Part Name":   r.part_name,
                        "Stock Qty":   Number(r.stock_qty),
                        "Stock Value": Number(r.stock_value),
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
                onRefresh={q.refetch}
                subtitle="Age = days since last debit (purchase/inflow)"
                title={title}
            >
                <div className="flex items-end gap-2">
                    <Label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                        <Switch checked={agedOnly} onCheckedChange={setAgedOnly} />
                        Aged &gt; 1 year only
                    </Label>
                </div>
            </ReportToolbar>

            {q.error && <ReportError onRetry={q.refetch} />}

            <KpiGrid columns={4}>
                <KpiCard label="Total Stock Qty" loading={q.loading} value={formatNumber(totals.qty)} />
                <KpiCard label="Total Stock Value" loading={q.loading} value={formatInr(totals.value)} accentClassName="text-emerald-500" />
                <KpiCard label="Aged > 1yr Qty"   loading={q.loading} value={formatNumber(totals.aged)} />
                <KpiCard label="Aged > 1yr Value" loading={q.loading} value={formatInr(totals.agedV)} accentClassName="text-amber-500" />
            </KpiGrid>

            <ChartCard description="Sorted by age desc" title="Parts on Hand">
                {q.loading
                    ? <ReportLoading lines={4} />
                    : filtered.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={COLUMNS}
                                rowKey={r => r.part_id}
                                rows={filtered}
                                showFooter
                                stickyHeader={false}
                            />
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
