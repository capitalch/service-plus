import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ChartCard } from "../_common/chart-card";
import { formatDateShort, formatInr, formatNumber } from "../_common/formatters";
import { formatIsoDate, getRange } from "../_common/fiscal";
import type { DateRangeType } from "../_common/fiscal";
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

type LedgerRowType = {
    cr_qty: number;
    dr_cr: string;
    dr_qty: number;
    id: number;
    qty: number;
    remarks: string | null;
    transaction_date: string;
    txn_type_code: string;
    txn_type_name: string;
    unit_cost: number | null;
};

type PartLookupType = {
    id: number;
    part_code: string;
    part_name: string;
};

type DisplayRowType = LedgerRowType & { balance: number };

export const StockLedgerSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const { fyStartMonth, isReady } = useFiscalSetting();
    const initialRange = useMemo<DateRangeType>(() => getRange("ytd", new Date(), fyStartMonth), [fyStartMonth]);
    const [range, setRange] = useState<DateRangeType>(initialRange);
    const [partCode, setPartCode] = useState<string>("");
    const [resolvedPart, setResolvedPart] = useState<PartLookupType | null>(null);
    const [lookupError, setLookupError]   = useState<string | null>(null);

    async function resolvePart() {
        if (!partCode.trim() || !dbName || !schema) return;
        try {
            const res = await apolloClient.query<{ genericQuery: PartLookupType[] | null }>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   {
                    db_name: dbName,
                    schema,
                    value:   graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { part_code: partCode.trim() },
                        sqlId:   SQL_MAP.GET_PART_BY_CODE,
                    }),
                },
            });
            const row = res.data?.genericQuery?.[0];
            if (row) {
                setResolvedPart(row);
                setLookupError(null);
            } else {
                setResolvedPart(null);
                setLookupError("Part code not found.");
            }
        } catch {
            setResolvedPart(null);
            setLookupError("Failed to look up part.");
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => { if (partCode.trim()) void resolvePart(); }, 600);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [partCode]);

    const sqlArgs = useMemo(() => resolvedPart ? {
        from:    formatIsoDate(range.from),
        part_id: resolvedPart.id,
        to:      formatIsoDate(range.to),
    } : null, [resolvedPart, range]);

    const q = useGenericQuery<LedgerRowType>({
        enabled: !!sqlArgs && isReady,
        sqlArgs: sqlArgs ?? undefined,
        sqlId:   SQL_MAP.GET_STOCK_LEDGER_RANGE,
    });

    const rows: DisplayRowType[] = useMemo(() => {
        return q.data.reduce<DisplayRowType[]>((acc, r) => {
            const prev = acc.length === 0 ? 0 : acc[acc.length - 1].balance;
            const balance = prev + Number(r.dr_qty) - Number(r.cr_qty);
            acc.push({ ...r, balance });
            return acc;
        }, []);
    }, [q.data]);

    const COLUMNS: ReportColumnType<DisplayRowType>[] = [
        { cell: r => formatDateShort(r.transaction_date), header: "Date", id: "date", sortValue: r => r.transaction_date, value: r => r.transaction_date, width: "110px" },
        { header: "Type", id: "type", value: r => r.txn_type_name, width: "130px" },
        { align: "right", cell: r => formatNumber(Number(r.dr_qty)), header: "Dr Qty", id: "dq", value: r => Number(r.dr_qty), width: "90px" },
        { align: "right", cell: r => formatNumber(Number(r.cr_qty)), header: "Cr Qty", id: "cq", value: r => Number(r.cr_qty), width: "90px" },
        { align: "right", cell: r => <span className="font-bold text-(--cl-accent-text)">{formatNumber(r.balance)}</span>, header: "Balance", id: "b", value: r => r.balance, width: "100px" },
        { align: "right", cell: r => r.unit_cost != null ? formatInr(Number(r.unit_cost)) : "—", header: "Unit Cost", id: "uc", value: r => Number(r.unit_cost ?? 0), width: "110px" },
        { header: "Remarks", id: "rem", value: r => r.remarks ?? "" },
    ];

    function handlePdfExport() {
        if (!resolvedPart) return;
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "date",   header: "Date",   width: 24 },
                    { dataKey: "type",   header: "Type",   width: 30 },
                    { align: "right", dataKey: "dq", header: "Dr", width: 18 },
                    { align: "right", dataKey: "cq", header: "Cr", width: 18 },
                    { align: "right", dataKey: "b",  header: "Bal", width: 18 },
                    { dataKey: "rem",  header: "Remarks" },
                ],
                fileName:    `stock-ledger_${resolvedPart.part_code}_${sqlArgs?.from}_${sqlArgs?.to}`,
                meta:        [{ label: "Part", value: `${resolvedPart.part_code} — ${resolvedPart.part_name}` }],
                orientation: "portrait",
                rows: rows.map(r => ({
                    b:    formatNumber(r.balance),
                    cq:   formatNumber(Number(r.cr_qty)),
                    date: formatDateShort(r.transaction_date),
                    dq:   formatNumber(Number(r.dr_qty)),
                    rem:  r.remarks ?? "",
                    type: r.txn_type_name,
                })),
                title: "Stock Ledger",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        if (!resolvedPart) return;
        try {
            exportReportXlsx({
                fileName: `stock-ledger_${resolvedPart.part_code}_${sqlArgs?.from}_${sqlArgs?.to}`,
                sheets: [{
                    name: "Ledger",
                    rows: rows.map(r => ({
                        "Balance":   r.balance,
                        "Cr Qty":    Number(r.cr_qty),
                        "Date":      formatDateShort(r.transaction_date),
                        "Dr Qty":    Number(r.dr_qty),
                        "Remarks":   r.remarks ?? "",
                        "Type":      r.txn_type_name,
                        "Unit Cost": Number(r.unit_cost ?? 0),
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
                subtitle="Per-part transaction ledger with running balance"
                title="Stock Ledger"
            >
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                        Part Code
                    </Label>
                    <Input
                        className="h-9 w-44"
                        onChange={e => setPartCode(e.target.value)}
                        placeholder="e.g. PCB-001"
                        value={partCode}
                    />
                </div>
            </ReportToolbar>

            {lookupError && <p className="text-xs font-medium text-red-600">{lookupError}</p>}
            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Running balance is computed client-side" title={resolvedPart ? `${resolvedPart.part_code} — ${resolvedPart.part_name}` : "Pick a part"}>
                {!resolvedPart
                    ? <ReportEmpty message="Enter a part code to view its ledger." />
                    : q.loading
                        ? <ReportLoading lines={4} />
                        : rows.length === 0
                            ? <ReportEmpty />
                            : (
                                <ReportTable
                                    columns={COLUMNS}
                                    rowKey={r => r.id}
                                    rows={rows}
                                    stickyHeader={false}
                                />
                            )
                }
            </ChartCard>
        </ReportSection>
    );
};
