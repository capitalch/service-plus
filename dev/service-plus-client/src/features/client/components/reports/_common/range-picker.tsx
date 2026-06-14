import { useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";

import { formatIsoDate, formatRangeLabel } from "./fiscal";
import type { DateRangeType, RangeKeyType } from "./fiscal";

type Props = {
    className?: string;
    onChange: (key: RangeKeyType, custom?: { from: Date; to: Date }) => void;
    range: DateRangeType;
};

type OptionType = { key: RangeKeyType; label: string };

const STANDARD_OPTIONS: OptionType[] = [
    { key: "today",     label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "thisWeek",  label: "This Week" },
    { key: "prevWeek",  label: "Previous Week" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
    { key: "q1",        label: "Q1" },
    { key: "q2",        label: "Q2" },
    { key: "q3",        label: "Q3" },
    { key: "q4",        label: "Q4" },
    { key: "ytd",       label: "Year-to-Date" },
    { key: "lastYear",  label: "Last Year" },
    { key: "custom",    label: "Custom…" },
];

export const RangePicker = ({ className, onChange, range }: Props) => {
    const [customOpen, setCustomOpen] = useState<boolean>(range.key === "custom");
    const [fromStr, setFromStr]       = useState<string>(formatIsoDate(range.from));
    const [toStr, setToStr]           = useState<string>(formatIsoDate(range.to));
    const [error, setError]           = useState<string | null>(null);

    function applyCustom() {
        const from = new Date(`${fromStr}T00:00:00`);
        const to   = new Date(`${toStr}T00:00:00`);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            setError(MESSAGES.ERROR_REPORTS_CUSTOM_RANGE_INVALID);
            return;
        }
        if (from > to) {
            setError(MESSAGES.ERROR_REPORTS_CUSTOM_RANGE_INVALID);
            return;
        }
        setError(null);
        onChange("custom", { from, to });
    }

    function handleSelect(value: string) {
        const key = value as RangeKeyType;
        if (key === "custom") {
            setCustomOpen(true);
            onChange("custom", { from: range.from, to: range.to });
            return;
        }
        setCustomOpen(false);
        setError(null);
        onChange(key);
    }

    return (
        <div className={cn("flex flex-wrap items-end gap-2", className)}>
            <div className="flex flex-col gap-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                    Range
                </Label>
                <Select onValueChange={handleSelect} value={range.key}>
                    <SelectTrigger className="h-9 w-44">
                        <SelectValue placeholder="Select range" />
                        <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                    </SelectTrigger>
                    <SelectContent>
                        {STANDARD_OPTIONS.map(opt => (
                            <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {customOpen && (
                <div className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="range-from" className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                            From
                        </Label>
                        <Input
                            id="range-from"
                            className="h-9 w-36"
                            onChange={e => setFromStr(e.target.value)}
                            type="date"
                            value={fromStr}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="range-to" className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                            To
                        </Label>
                        <Input
                            id="range-to"
                            className="h-9 w-36"
                            onChange={e => setToStr(e.target.value)}
                            type="date"
                            value={toStr}
                        />
                    </div>
                    <Button onClick={applyCustom} size="sm" variant="default" className="h-9">
                        Apply
                    </Button>
                </div>
            )}

            <div className="flex items-center gap-1.5 rounded-md border border-(--cl-border) bg-(--cl-surface-2) px-2.5 py-1.5 text-xs text-(--cl-text-muted)">
                <CalendarRange className="h-3.5 w-3.5 text-(--cl-accent-text)" />
                <span>{formatRangeLabel(range.from, range.to)}</span>
            </div>

            {error && (
                <p className="basis-full text-xs font-medium text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
};
