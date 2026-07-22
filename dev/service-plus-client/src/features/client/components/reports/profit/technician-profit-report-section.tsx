import { useMemo, useState } from "react";

import { SQL_MAP } from "@/constants/sql-map";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ChartCard } from "../common/chart-card";
import { formatNumber } from "../common/formatters";
import { formatIsoDate, getCurrentFiscalYearBounds } from "../common/fiscal";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportToolbar } from "../common/report-toolbar";
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";

import { TechnicianProfitCellDialog } from "./technician-profit-cell-dialog";
import type { ProfitCellType } from "./technician-profit-cell-dialog";

type RowType = {
    technician_id: number;
    technician_name: string;
    month_idx: number;
    delivered_count: number;
    profit: number;
    total_charges: number;
};

type CellValueType = { count: number; profit: number; charges: number };

type MonthColumnType = {
    idx: number;
    label: string;
    from: string;
    to: string;
};

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FY_YEAR_OPTIONS_COUNT = 8;

function endOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

const EMPTY_CELL: CellValueType = { charges: 0, count: 0, profit: 0 };

export const TechnicianProfitReportSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const currentFyBounds = useMemo(() => getCurrentFiscalYearBounds(new Date(), fyStartMonth), [fyStartMonth]);

    const [fyStartYear, setFyStartYear] = useState<number>(() => currentFyBounds.from.getFullYear());

    const yearOptions = useMemo(() => {
        const current = currentFyBounds.from.getFullYear();
        return Array.from({ length: FY_YEAR_OPTIONS_COUNT }, (_, i) => current - i);
    }, [currentFyBounds]);

    const fyBounds = useMemo(() => {
        const from = new Date(fyStartYear, fyStartMonth - 1, 1);
        return { from, label: `FY ${fyStartYear}-${(fyStartYear + 1) % 100}` };
    }, [fyStartYear, fyStartMonth]);

    const months = useMemo<MonthColumnType[]>(() => {
        return Array.from({ length: 12 }, (_, i) => {
            const monthStart = new Date(fyBounds.from.getFullYear(), fyBounds.from.getMonth() + i, 1);
            const monthEnd   = endOfMonth(monthStart);
            return {
                from:  formatIsoDate(monthStart),
                idx:   i,
                label: `${MONTH_ABBR[monthStart.getMonth()]} '${String(monthStart.getFullYear()).slice(2)}`,
                to:    formatIsoDate(monthEnd),
            };
        });
    }, [fyBounds]);

    const sqlArgs = useMemo(() => ({ from: formatIsoDate(fyBounds.from) }), [fyBounds]);

    const q = useGenericQuery<RowType>({
        enabled: isReady,
        sqlArgs,
        sqlId:   SQL_MAP.GET_TECHNICIAN_PROFIT_MONTHLY_FY,
    });

    const [cell, setCell] = useState<ProfitCellType | null>(null);

    const { technicians, grid } = useMemo(() => {
        const grid = new Map<number, Map<number, CellValueType>>();
        const techNames = new Map<number, string>();
        for (const r of q.data) {
            techNames.set(r.technician_id, r.technician_name);
            if (!grid.has(r.technician_id)) grid.set(r.technician_id, new Map());
            grid.get(r.technician_id)?.set(r.month_idx, {
                charges: Number(r.total_charges),
                count:   Number(r.delivered_count),
                profit:  Number(r.profit),
            });
        }
        const technicians = Array.from(techNames.entries()).map(([id, name]) => ({ id, name }));
        return { grid, technicians };
    }, [q.data]);

    function cellFor(technicianId: number, monthIdx: number): CellValueType {
        return grid.get(technicianId)?.get(monthIdx) ?? EMPTY_CELL;
    }

    function rowTotal(technicianId: number): CellValueType {
        return months.reduce<CellValueType>((acc, m) => {
            const v = cellFor(technicianId, m.idx);
            return { charges: acc.charges + v.charges, count: acc.count + v.count, profit: acc.profit + v.profit };
        }, { charges: 0, count: 0, profit: 0 });
    }

    function monthTotal(monthIdx: number): CellValueType {
        return technicians.reduce<CellValueType>((acc, t) => {
            const v = cellFor(t.id, monthIdx);
            return { charges: acc.charges + v.charges, count: acc.count + v.count, profit: acc.profit + v.profit };
        }, { charges: 0, count: 0, profit: 0 });
    }

    const grandTotal = technicians.reduce<CellValueType>((acc, t) => {
        const v = rowTotal(t.id);
        return { charges: acc.charges + v.charges, count: acc.count + v.count, profit: acc.profit + v.profit };
    }, { charges: 0, count: 0, profit: 0 });

    return (
        <ReportSection>
            <ReportToolbar
                actions={
                    <Select value={String(fyStartYear)} onValueChange={v => setFyStartYear(Number(v))}>
                        <SelectTrigger aria-label="Fiscal Year" className="h-8 w-32 text-xs" id="tpr-fy">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {yearOptions.map(y => (
                                <SelectItem key={y} value={String(y)}>{`FY ${y}-${(y + 1) % 100}`}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                }
                hideRange
                onRefresh={q.refetch}
                subtitle={`Jobs delivered OK, profit and sale by technician × month — ${fyBounds.label}. Click a cell to view that technician's delivered jobs for the month.`}
                title="Technician Profit Report"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard title="">
                {q.loading
                    ? <ReportLoading lines={6} />
                    : technicians.length === 0
                        ? <ReportEmpty message="No active technicians with delivered jobs this fiscal year." />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-(--cl-accent)/30 bg-(--cl-accent)/10 text-xs font-bold text-(--cl-accent-text)">
                                            <th className="px-3 py-2 text-left">Technician</th>
                                            {months.map(m => (
                                                <th key={m.idx} className="px-2 py-2 text-center">{m.label}</th>
                                            ))}
                                            <th className="px-3 py-2 text-center">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-(--cl-divider)">
                                        {technicians.map((t, i) => {
                                            const total = rowTotal(t.id);
                                            return (
                                                <tr key={t.id} className={i % 2 === 1 ? "bg-(--cl-surface-2)/40" : undefined}>
                                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-(--cl-text)">{t.name}</td>
                                                    {months.map(m => {
                                                        const v = cellFor(t.id, m.idx);
                                                        const clickable = v.count > 0;
                                                        return (
                                                            <td
                                                                key={m.idx}
                                                                className={cn(
                                                                    "px-2 py-2 text-center align-top",
                                                                    clickable && "cursor-pointer hover:ring-2 hover:ring-(--cl-accent) hover:ring-inset",
                                                                )}
                                                                onClick={clickable
                                                                    ? () => setCell({
                                                                        from:           m.from,
                                                                        monthLabel:     m.label,
                                                                        technicianId:   t.id,
                                                                        technicianName: t.name,
                                                                        to:             m.to,
                                                                    })
                                                                    : undefined}
                                                            >
                                                                {v.count === 0 ? (
                                                                    <span className="text-(--cl-text-muted)">—</span>
                                                                ) : (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatNumber(v.count)}</span>
                                                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(v.profit)}</span>
                                                                        <span className="text-[11px] font-light text-amber-600 dark:text-amber-400">({formatNumber(v.charges)})</span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="bg-(--cl-accent)/5 px-3 py-2 text-center align-top">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatNumber(total.count)}</span>
                                                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(total.profit)}</span>
                                                            <span className="text-[11px] font-light text-amber-600 dark:text-amber-400">({formatNumber(total.charges)})</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="border-t border-(--cl-accent)/30 bg-(--cl-accent)/15 font-bold">
                                        <tr>
                                            <td className="px-3 py-2 text-xs font-bold text-(--cl-text)">Total</td>
                                            {months.map(m => {
                                                const v = monthTotal(m.idx);
                                                return (
                                                    <td key={m.idx} className="px-2 py-2 text-center align-top">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="text-xs text-blue-600 dark:text-blue-400">{formatNumber(v.count)}</span>
                                                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(v.profit)}</span>
                                                            <span className="text-[11px] font-light text-amber-600 dark:text-amber-400">({formatNumber(v.charges)})</span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="bg-(--cl-accent)/10 px-3 py-2 text-center align-top">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-xs text-blue-600 dark:text-blue-400">{formatNumber(grandTotal.count)}</span>
                                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(grandTotal.profit)}</span>
                                                    <span className="text-[11px] font-light text-amber-600 dark:text-amber-400">({formatNumber(grandTotal.charges)})</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )
                }
            </ChartCard>

            <TechnicianProfitCellDialog cell={cell} onClose={() => setCell(null)} />
        </ReportSection>
    );
};
