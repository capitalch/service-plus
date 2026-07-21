import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";

import { formatIsoDate, getRange } from "../common/fiscal";
import type { DateRangeType, RangeKeyType } from "../common/fiscal";

type TabKeyType = "custom" | "lastMonth" | "thisMonth";

type Props = {
    children?: ReactNode;
    className?: string;
    fyStartMonth: number;
    onChange: (range: DateRangeType) => void;
    range: DateRangeType;
};

const TABS: { key: TabKeyType; label: string; rangeKey: RangeKeyType }[] = [
    { key: "thisMonth", label: "This Month",     rangeKey: "thisMonth" },
    { key: "lastMonth", label: "Previous Month", rangeKey: "lastMonth" },
    { key: "custom",    label: "Custom",         rangeKey: "custom" },
];

export const WarrantyRangeTabs = ({ children, className, fyStartMonth, onChange, range }: Props) => {
    const [fromStr, setFromStr] = useState<string>(formatIsoDate(range.from));
    const [toStr, setToStr]     = useState<string>(formatIsoDate(range.to));
    const [error, setError]     = useState<string | null>(null);

    const activeKey: TabKeyType =
        range.key === "thisMonth"
            ? "thisMonth"
            : range.key === "lastMonth"
                ? "lastMonth"
                : "custom";

    function applyCustom() {
        const from = new Date(`${fromStr}T00:00:00`);
        const to   = new Date(`${toStr}T00:00:00`);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
            setError(MESSAGES.ERROR_REPORTS_CUSTOM_RANGE_INVALID);
            return;
        }
        setError(null);
        onChange(getRange("custom", new Date(), fyStartMonth, { from, to }));
    }

    function selectTab(key: TabKeyType) {
        if (key === "custom") {
            onChange(getRange("custom", new Date(), fyStartMonth, { from: range.from, to: range.to }));
            return;
        }
        const next = getRange(key, new Date(), fyStartMonth);
        setFromStr(formatIsoDate(next.from));
        setToStr(formatIsoDate(next.to));
        setError(null);
        onChange(next);
    }

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <div className="inline-flex rounded-md border border-(--cl-border) bg-(--cl-surface-2) p-0.5">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        className={cn(
                            "rounded px-3 py-1.5 text-xs font-semibold transition-colors",
                            activeKey === t.key
                                ? "bg-(--cl-accent) text-white"
                                : "text-(--cl-text-muted) hover:text-(--cl-text)",
                        )}
                        onClick={() => selectTab(t.key)}
                        type="button"
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            {activeKey === "custom" && (
                <div className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="warranty-from" className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                            From
                        </Label>
                        <Input
                            id="warranty-from"
                            className="h-9 w-36"
                            onChange={e => setFromStr(e.target.value)}
                            type="date"
                            value={fromStr}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="warranty-to" className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                            To
                        </Label>
                        <Input
                            id="warranty-to"
                            className="h-9 w-36"
                            onChange={e => setToStr(e.target.value)}
                            type="date"
                            value={toStr}
                        />
                    </div>
                    <Button className="h-9" onClick={applyCustom} size="sm" variant="default">
                        Apply
                    </Button>
                </div>
            )}
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            {children}
        </div>
    );
};
