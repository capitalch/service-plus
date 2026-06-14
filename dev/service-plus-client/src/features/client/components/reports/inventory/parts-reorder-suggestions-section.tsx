import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { cn } from "@/lib/utils";

import { ChartCard } from "../_common/chart-card";
import { formatNumber } from "../_common/formatters";
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

type ConsumptionRowType = {
    brand_name: string | null;
    month_offset: number;
    part_code: string;
    part_id: number;
    part_name: string;
    qty: number;
};

type StockRowType = {
    brand_name: string | null;
    part_code: string;
    part_id: number;
    part_name: string;
    stock_qty: number;
};

type DisplayRowType = {
    brand_name: string | null;
    dead_stock: boolean;
    m1: number;
    m2: number;
    m3: number;
    m4: number;
    m5: number;
    m6: number;
    part_code: string;
    part_id: number;
    part_name: string;
    stock_qty: number;
    suggested_qty: number;
    weighted_demand: number;
};

const WEIGHTS = [6, 5, 4, 3, 2, 1];
const WEIGHT_SUM = WEIGHTS.reduce((a, b) => a + b, 0);

export const PartsReorderSuggestionsSection = () => {
    const [orderOnly, setOrderOnly] = useState<boolean>(false);

    const consQ  = useGenericQuery<ConsumptionRowType>({ sqlId: SQL_MAP.GET_PARTS_CONSUMPTION_MONTHLY_LAST_6 });
    const stockQ = useGenericQuery<StockRowType>({       sqlId: SQL_MAP.GET_PARTS_CURRENT_STOCK });

    const rows: DisplayRowType[] = useMemo(() => {
        const stockMap = new Map<number, StockRowType>();
        for (const s of stockQ.data) stockMap.set(s.part_id, s);

        const consMap = new Map<number, Record<number, number>>();
        const partInfo = new Map<number, { brand: string | null; code: string; name: string }>();
        for (const c of consQ.data) {
            const monthOffset = Number(c.month_offset);
            const m = consMap.get(c.part_id) ?? {};
            m[monthOffset] = (m[monthOffset] ?? 0) + Number(c.qty);
            consMap.set(c.part_id, m);
            partInfo.set(c.part_id, { brand: c.brand_name, code: c.part_code, name: c.part_name });
        }

        const allParts = new Set<number>([...stockMap.keys(), ...consMap.keys()]);
        const out: DisplayRowType[] = [];
        for (const partId of allParts) {
            const cons = consMap.get(partId) ?? {};
            const info = partInfo.get(partId) ?? {
                brand: stockMap.get(partId)?.brand_name ?? null,
                code:  stockMap.get(partId)?.part_code ?? "",
                name:  stockMap.get(partId)?.part_name ?? "",
            };
            const stock = Number(stockMap.get(partId)?.stock_qty ?? 0);
            const m1 = cons[1] ?? 0, m2 = cons[2] ?? 0, m3 = cons[3] ?? 0;
            const m4 = cons[4] ?? 0, m5 = cons[5] ?? 0, m6 = cons[6] ?? 0;
            const weightedSum = m1*WEIGHTS[0] + m2*WEIGHTS[1] + m3*WEIGHTS[2] + m4*WEIGHTS[3] + m5*WEIGHTS[4] + m6*WEIGHTS[5];
            const weightedDemand = weightedSum / WEIGHT_SUM;
            const suggestedQty = Math.max(0, Math.ceil(weightedDemand) - stock);
            const totalCons = m1 + m2 + m3 + m4 + m5 + m6;
            out.push({
                brand_name:      info.brand,
                dead_stock:      totalCons === 0 && stock > 0,
                m1, m2, m3, m4, m5, m6,
                part_code:       info.code,
                part_id:         partId,
                part_name:       info.name,
                stock_qty:       stock,
                suggested_qty:   suggestedQty,
                weighted_demand: weightedDemand,
            });
        }
        out.sort((a, b) => b.suggested_qty - a.suggested_qty);
        return out;
    }, [consQ.data, stockQ.data]);

    const filtered = orderOnly ? rows.filter(r => r.suggested_qty > 0) : rows;

    const COLUMNS: ReportColumnType<DisplayRowType>[] = [
        { header: "Part Code", id: "code", value: r => r.part_code, width: "100px" },
        { header: "Part Name", id: "name", value: r => r.part_name },
        { header: "Brand", id: "brand", value: r => r.brand_name ?? "—", width: "90px" },
        { align: "right", cell: r => formatNumber(r.stock_qty), header: "Stock", id: "stk", value: r => r.stock_qty, width: "80px" },
        { align: "right", cell: r => formatNumber(r.m1), header: "M-1", id: "m1", value: r => r.m1, width: "60px" },
        { align: "right", cell: r => formatNumber(r.m2), header: "M-2", id: "m2", value: r => r.m2, width: "60px" },
        { align: "right", cell: r => formatNumber(r.m3), header: "M-3", id: "m3", value: r => r.m3, width: "60px" },
        { align: "right", cell: r => formatNumber(r.m4), header: "M-4", id: "m4", value: r => r.m4, width: "60px" },
        { align: "right", cell: r => formatNumber(r.m5), header: "M-5", id: "m5", value: r => r.m5, width: "60px" },
        { align: "right", cell: r => formatNumber(r.m6), header: "M-6", id: "m6", value: r => r.m6, width: "60px" },
        { align: "right", cell: r => r.weighted_demand.toFixed(2), header: "Weighted", id: "wd", value: r => r.weighted_demand, width: "90px" },
        {
            align: "right",
            cell: r => (
                <span className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-bold",
                    r.suggested_qty > 0 ? "bg-emerald-500/15 text-emerald-700" : "text-(--cl-text-muted)",
                )}>
                    {formatNumber(r.suggested_qty)}
                </span>
            ),
            footer: rs => formatNumber(rs.reduce((s, r) => s + r.suggested_qty, 0)),
            header: "Order Qty",
            id:     "ord",
            value:  r => r.suggested_qty,
            width:  "100px",
        },
        {
            align: "center",
            cell:  r => r.dead_stock
                ? <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700">Dead stock</span>
                : "",
            header: "Action",
            id:     "act",
            sortable: false,
            width:  "120px",
        },
    ];

    const loading = consQ.loading || stockQ.loading;
    const error   = consQ.error || stockQ.error;
    function refetch() { consQ.refetch(); stockQ.refetch(); }

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "code", header: "Code", width: 22 },
                    { dataKey: "name", header: "Part Name" },
                    { align: "right", dataKey: "stk", header: "Stock", width: 16 },
                    { align: "right", dataKey: "m1",  header: "M-1",   width: 12 },
                    { align: "right", dataKey: "m2",  header: "M-2",   width: 12 },
                    { align: "right", dataKey: "m3",  header: "M-3",   width: 12 },
                    { align: "right", dataKey: "m4",  header: "M-4",   width: 12 },
                    { align: "right", dataKey: "m5",  header: "M-5",   width: 12 },
                    { align: "right", dataKey: "m6",  header: "M-6",   width: 12 },
                    { align: "right", dataKey: "wd",  header: "W.Avg", width: 18 },
                    { align: "right", dataKey: "ord", header: "Order", width: 18 },
                ],
                fileName:    "parts-reorder-suggestions",
                orientation: "landscape",
                rows: filtered.map(r => ({
                    code: r.part_code,
                    m1:   formatNumber(r.m1),
                    m2:   formatNumber(r.m2),
                    m3:   formatNumber(r.m3),
                    m4:   formatNumber(r.m4),
                    m5:   formatNumber(r.m5),
                    m6:   formatNumber(r.m6),
                    name: r.part_name,
                    ord:  formatNumber(r.suggested_qty),
                    stk:  formatNumber(r.stock_qty),
                    wd:   r.weighted_demand.toFixed(2),
                })),
                subtitle: "Suggested order qty = max(0, ceil(weighted 6-month demand) − stock on hand)",
                title:    "Parts Reorder Suggestions",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: "parts-reorder-suggestions",
                sheets: [{
                    name: "Reorder",
                    rows: filtered.map(r => ({
                        "Brand":      r.brand_name ?? "",
                        "Dead Stock": r.dead_stock ? "Yes" : "No",
                        "M-1":        r.m1,
                        "M-2":        r.m2,
                        "M-3":        r.m3,
                        "M-4":        r.m4,
                        "M-5":        r.m5,
                        "M-6":        r.m6,
                        "Order Qty":  r.suggested_qty,
                        "Part Code":  r.part_code,
                        "Part Name":  r.part_name,
                        "Stock":      r.stock_qty,
                        "Weighted":   r.weighted_demand,
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
                subtitle="Weighted 6-month consumption (recent months weight more) − stock = order qty"
                title="Parts Reorder Suggestions"
            >
                <Label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                    <Switch checked={orderOnly} onCheckedChange={setOrderOnly} />
                    Show Order &gt; 0 only
                </Label>
            </ReportToolbar>

            {error && <ReportError onRetry={refetch} />}

            <ChartCard description={`Weights [6,5,4,3,2,1] applied to months M-1…M-6`} title="Suggested Orders">
                {loading
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
