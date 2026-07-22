import type { ReactNode } from "react";
import { Download, FileText, Printer, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { RangePicker } from "./range-picker";
import type { DateRangeType, RangeKeyType } from "./fiscal";

type Props = {
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
    hideRange?: boolean;
    onExportExcel?: () => void;
    onExportPdf?: () => void;
    onPrint?: () => void;
    onRefresh?: () => void;
    onSetRange?: (key: RangeKeyType, custom?: { from: Date; to: Date }) => void;
    range?: DateRangeType;
    subtitle?: string;
    title: string;
};

export const ReportToolbar = ({
    actions,
    children,
    className,
    hideRange = false,
    onExportExcel,
    onExportPdf,
    onPrint,
    onRefresh,
    onSetRange,
    range,
    subtitle,
    title,
}: Props) => {
    return (
        <header
            className={cn(
                "flex flex-col gap-3 rounded-lg border border-(--cl-border) bg-(--cl-surface-2) px-4 py-3 shadow-sm",
                className,
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h1 className="text-sm font-bold tracking-tight text-(--cl-text)">{title}</h1>
                    {subtitle && <p className="mt-0.5 text-xs text-(--cl-text-muted)">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                    {actions}
                    {onRefresh && (
                        <Button
                            aria-label="Refresh"
                            className="h-8 px-2"
                            onClick={onRefresh}
                            size="sm"
                            variant="ghost"
                        >
                            <RefreshCcw className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    {(onExportPdf || onExportExcel || onPrint) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button aria-label="Export" className="h-8 gap-1" size="sm" variant="outline">
                                    <Download className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">Export</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {onExportPdf && (
                                    <DropdownMenuItem onClick={onExportPdf}>
                                        <FileText className="mr-2 h-3.5 w-3.5" /> PDF
                                    </DropdownMenuItem>
                                )}
                                {onExportExcel && (
                                    <DropdownMenuItem onClick={onExportExcel}>
                                        <Download className="mr-2 h-3.5 w-3.5" /> Excel
                                    </DropdownMenuItem>
                                )}
                                {onPrint && (
                                    <DropdownMenuItem onClick={onPrint}>
                                        <Printer className="mr-2 h-3.5 w-3.5" /> Print
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                {!hideRange && range && onSetRange && (
                    <RangePicker onChange={onSetRange} range={range} />
                )}
                {children}
            </div>
        </header>
    );
};
