import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ColumnAlignType = "center" | "left" | "right";

export type ReportColumnType<T> = {
    align?: ColumnAlignType;
    cell?: (row: T) => ReactNode;
    footer?: (rows: T[]) => ReactNode;
    header: string;
    id: string;
    sortable?: boolean;
    sortValue?: (row: T) => number | string;
    value?: (row: T) => number | string;
    width?: string;
};

type Props<T> = {
    className?: string;
    columns: ReportColumnType<T>[];
    emptyMessage?: string;
    onRowClick?: (row: T) => void;
    rowKey: (row: T) => string | number;
    rows: T[];
    showFooter?: boolean;
    stickyHeader?: boolean;
};

const ALIGN_CLASS: Record<ColumnAlignType, string> = {
    center: "text-center",
    left:   "text-left",
    right:  "text-right",
};

export function ReportTable<T>({
    className,
    columns,
    emptyMessage = "No data.",
    onRowClick,
    rowKey,
    rows,
    showFooter = false,
    stickyHeader = true,
}: Props<T>) {
    const [sortId, setSortId]     = useState<string | null>(null);
    const [sortAsc, setSortAsc]   = useState<boolean>(true);

    const sortedRows = useMemo<T[]>(() => {
        if (!sortId) return rows;
        const col = columns.find(c => c.id === sortId);
        if (!col) return rows;
        const acc = col.sortValue ?? col.value;
        if (!acc) return rows;
        const sorted = [...rows].sort((a, b) => {
            const va = acc(a);
            const vb = acc(b);
            if (typeof va === "number" && typeof vb === "number") {
                return sortAsc ? va - vb : vb - va;
            }
            const sa = String(va ?? "");
            const sb = String(vb ?? "");
            return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
        });
        return sorted;
    }, [rows, sortId, sortAsc, columns]);

    function toggleSort(id: string) {
        if (sortId === id) { setSortAsc(s => !s); return; }
        setSortId(id);
        setSortAsc(true);
    }

    return (
        <div className={cn("overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface-2)", className)}>
            <div className="overflow-x-auto">
                <Table className="text-xs">
                    <TableHeader className={cn(stickyHeader && "sticky top-0 z-10 bg-(--cl-surface-3)")}>
                        <TableRow className="border-b border-(--cl-border)">
                            {columns.map(col => {
                                const sortable = col.sortable !== false && (col.sortValue || col.value);
                                return (
                                    <TableHead
                                        key={col.id}
                                        className={cn(
                                            "px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)",
                                            ALIGN_CLASS[col.align ?? "left"],
                                            sortable && "cursor-pointer select-none hover:text-(--cl-text)",
                                        )}
                                        onClick={sortable ? () => toggleSort(col.id) : undefined}
                                        style={col.width ? { width: col.width } : undefined}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            {col.header}
                                            {sortable && sortId === col.id && (
                                                sortAsc
                                                    ? <ChevronUp className="h-3 w-3" />
                                                    : <ChevronDown className="h-3 w-3" />
                                            )}
                                        </span>
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-(--cl-divider)">
                        {sortedRows.length === 0 && (
                            <TableRow>
                                <TableCell
                                    className="px-3 py-8 text-center text-xs text-(--cl-text-muted)"
                                    colSpan={columns.length}
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        )}
                        {sortedRows.map(row => (
                            <TableRow
                                key={rowKey(row)}
                                className={cn(
                                    "border-b border-(--cl-divider)",
                                    onRowClick && "cursor-pointer transition-colors hover:bg-(--cl-hover)",
                                )}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                            >
                                {columns.map(col => (
                                    <TableCell
                                        key={col.id}
                                        className={cn("px-3 py-2 text-(--cl-text)", ALIGN_CLASS[col.align ?? "left"])}
                                    >
                                        {col.cell ? col.cell(row) : (col.value?.(row) ?? "")}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                    {showFooter && sortedRows.length > 0 && (
                        <TableFooter className="bg-(--cl-surface-3)">
                            <TableRow>
                                {columns.map(col => (
                                    <TableCell
                                        key={col.id}
                                        className={cn(
                                            "border-t border-(--cl-border) px-3 py-2 text-xs font-bold text-(--cl-text)",
                                            ALIGN_CLASS[col.align ?? "left"],
                                        )}
                                    >
                                        {col.footer ? col.footer(sortedRows) : ""}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </div>
        </div>
    );
}
