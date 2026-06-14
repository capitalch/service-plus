import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ChartCard } from "../_common/chart-card";
import { formatInr, formatNumber } from "../_common/formatters";
import { ReportEmpty } from "../_common/report-empty";
import { ReportError } from "../_common/report-error";
import { ReportLoading } from "../_common/report-loading";
import { ReportSection } from "../_common/report-section";
import { ReportTable } from "../_common/report-table";
import type { ReportColumnType } from "../_common/report-table";
import { ReportToolbar } from "../_common/report-toolbar";
import { exportReportPdf } from "../_common/pdf-export";
import { exportReportXlsx } from "../_common/xlsx-export";
import { useEffect } from "react";
import { useGenericQuery } from "../_common/use-generic-query";

type RowType = {
    brand_name: string | null;
    closing_qty: number;
    closing_value: number;
    cr_qty: number;
    cr_value: number;
    dr_qty: number;
    dr_value: number;
    opening_qty: number;
    opening_value: number;
    part_code: string;
    part_id: number;
    part_name: string;
};

type FinancialYearType = {
    end_date: string;
    id: number;
    start_date: string;
};

const COLUMNS: ReportColumnType<RowType>[] = [
    { header: "Part Code", id: "code", value: r => r.part_code, width: "110px" },
    { header: "Part Name", id: "name", value: r => r.part_name },
    { header: "Brand", id: "brand", value: r => r.brand_name ?? "—", width: "100px" },
    { align: "right", cell: r => formatNumber(Number(r.opening_qty)), header: "Op Qty", id: "oq", value: r => Number(r.opening_qty), width: "80px" },
    { align: "right", cell: r => formatInr(Number(r.opening_value)),  header: "Op ₹",   id: "ov", value: r => Number(r.opening_value), width: "100px" },
    { align: "right", cell: r => formatNumber(Number(r.dr_qty)), header: "Dr Qty", id: "dq", value: r => Number(r.dr_qty), width: "80px" },
    { align: "right", cell: r => formatInr(Number(r.dr_value)),  header: "Dr ₹",   id: "dv", value: r => Number(r.dr_value), width: "100px" },
    { align: "right", cell: r => formatNumber(Number(r.cr_qty)), header: "Cr Qty", id: "cq", value: r => Number(r.cr_qty), width: "80px" },
    { align: "right", cell: r => formatInr(Number(r.cr_value)),  header: "Cr ₹",   id: "cv", value: r => Number(r.cr_value), width: "100px" },
    { align: "right", cell: r => <span className="font-bold">{formatNumber(Number(r.closing_qty))}</span>, header: "Cl Qty", id: "clq", value: r => Number(r.closing_qty), width: "90px" },
    { align: "right", cell: r => <span className="font-bold text-emerald-600">{formatInr(Number(r.closing_value))}</span>, footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.closing_value), 0)), header: "Cl ₹", id: "clv", value: r => Number(r.closing_value), width: "120px" },
];

export const SparePartsLedgerSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [fyList, setFyList] = useState<FinancialYearType[]>([]);
    const [fyId, setFyId]     = useState<number | null>(null);

    useEffect(() => {
        if (!dbName || !schema) return;
        let cancelled = false;
        apolloClient.query<{ genericQuery: FinancialYearType[] | null }>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   {
                db_name: dbName,
                schema,
                value:   graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_FINANCIAL_YEARS }),
            },
        }).then(res => {
            if (cancelled) return;
            const list = res.data?.genericQuery ?? [];
            const sorted = [...list].sort((a, b) => b.start_date.localeCompare(a.start_date));
            setFyList(sorted);
            if (sorted.length) setFyId(sorted[0].id);
        }).catch(() => { /* noop */ });
        return () => { cancelled = true; };
    }, [dbName, schema]);

    const selectedFy = fyList.find(f => f.id === fyId) ?? null;

    const sqlArgs = useMemo(() => selectedFy ? {
        from: selectedFy.start_date,
        to:   selectedFy.end_date,
    } : null, [selectedFy]);

    const q = useGenericQuery<RowType>({
        enabled: !!sqlArgs,
        sqlArgs: sqlArgs ?? undefined,
        sqlId:   SQL_MAP.GET_PARTS_LEDGER_FY,
    });

    function handlePdfExport() {
        if (!selectedFy) return;
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "code",  header: "Code",   width: 20 },
                    { dataKey: "name",  header: "Part Name" },
                    { dataKey: "brand", header: "Brand",  width: 24 },
                    { align: "right", dataKey: "oq", header: "OpQ", width: 14 },
                    { align: "right", dataKey: "dq", header: "DrQ", width: 14 },
                    { align: "right", dataKey: "cq", header: "CrQ", width: 14 },
                    { align: "right", dataKey: "clq", header: "ClQ", width: 14 },
                    { align: "right", dataKey: "clv", header: "Cl ₹", width: 24 },
                ],
                fileName:    `parts-ledger_FY_${selectedFy.start_date}`,
                orientation: "landscape",
                rows: q.data.map(r => ({
                    brand: r.brand_name ?? "",
                    clq:   formatNumber(Number(r.closing_qty)),
                    clv:   formatInr(Number(r.closing_value)),
                    code:  r.part_code,
                    cq:    formatNumber(Number(r.cr_qty)),
                    dq:    formatNumber(Number(r.dr_qty)),
                    name:  r.part_name,
                    oq:    formatNumber(Number(r.opening_qty)),
                })),
                title: "Spare Parts Ledger",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        if (!selectedFy) return;
        try {
            exportReportXlsx({
                fileName: `parts-ledger_FY_${selectedFy.start_date}`,
                sheets: [{
                    name: "Ledger",
                    rows: q.data.map(r => ({
                        "Brand":         r.brand_name ?? "",
                        "Closing Qty":   Number(r.closing_qty),
                        "Closing Value": Number(r.closing_value),
                        "Cr Qty":        Number(r.cr_qty),
                        "Cr Value":      Number(r.cr_value),
                        "Dr Qty":        Number(r.dr_qty),
                        "Dr Value":      Number(r.dr_value),
                        "Opening Qty":   Number(r.opening_qty),
                        "Opening Value": Number(r.opening_value),
                        "Part Code":     r.part_code,
                        "Part Name":     r.part_name,
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
                subtitle="Opening, debits, credits, closing per part — fiscal year scope"
                title="Spare Parts Ledger"
            >
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                        Financial Year
                    </Label>
                    <Select
                        onValueChange={v => setFyId(Number(v))}
                        value={fyId != null ? String(fyId) : ""}
                    >
                        <SelectTrigger className="h-9 w-56">
                            <SelectValue placeholder="Choose financial year" />
                        </SelectTrigger>
                        <SelectContent>
                            {fyList.map(fy => (
                                <SelectItem key={fy.id} value={String(fy.id)}>
                                    {fy.start_date} → {fy.end_date}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </ReportToolbar>

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Per part Op + Dr − Cr = Closing" title="Ledger">
                {!sqlArgs
                    ? <ReportEmpty message="Pick a financial year." />
                    : q.loading
                        ? <ReportLoading lines={4} />
                        : q.data.length === 0
                            ? <ReportEmpty />
                            : (
                                <ReportTable
                                    columns={COLUMNS}
                                    rowKey={r => r.part_id}
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
