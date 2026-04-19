import { useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

// ─── Constants ────────────────────────────────────────────────────────────────

const now          = new Date();
const currentYear  = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const defaultMonth = currentMonth === 1 ? 12 : currentMonth - 1;
const defaultYear  = currentMonth === 1 ? currentYear - 1 : currentYear;
const MIN_YEAR     = 2020;

const MONTHS = [
    { label: "Jan", value: 1  },
    { label: "Feb", value: 2  },
    { label: "Mar", value: 3  },
    { label: "Apr", value: 4  },
    { label: "May", value: 5  },
    { label: "Jun", value: 6  },
    { label: "Jul", value: 7  },
    { label: "Aug", value: 8  },
    { label: "Sep", value: 9  },
    { label: "Oct", value: 10 },
    { label: "Nov", value: 11 },
    { label: "Dec", value: 12 },
] as const;

const MONTH_LABELS: Record<number, string> = {
    1: "January", 2: "February", 3: "March",    4: "April",
    5: "May",     6: "June",     7: "July",      8: "August",
    9: "September", 10: "October", 11: "November", 12: "December",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const StockSnapshotTrigger = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [month,       setMonth]       = useState(defaultMonth);
    const [year,        setYear]        = useState(defaultYear);
    const [loading,     setLoading]     = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    function handleDecrYear() { if (year > MIN_YEAR) setYear(y => y - 1); }
    function handleIncrYear() {
        if (year >= currentYear) return;
        const nextYear = year + 1;
        // If advancing to currentYear, clamp month to last valid month
        if (nextYear === currentYear && month >= currentMonth) {
            setMonth(currentMonth === 1 ? 12 : currentMonth - 1);
        }
        setYear(nextYear);
    }

    // A period is invalid when it is the current or a future month
    function isMonthDisabled(m: number) {
        return year === currentYear && m >= currentMonth;
    }
    const isFuturePeriod = year === currentYear && month >= currentMonth;

    function handleSubmitClick() {
        setConfirmOpen(true);
    }

    async function handleConfirm() {
        setLoading(true);
        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdateScript,
                variables: {
                    db_name: dbName,
                    schema,
                    value:   encodeObj({
                        sql_args: { month, year },
                        sql_id:   SQL_MAP.SQL_GENERATE_STOCK_SNAPSHOT,
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_STOCK_SNAPSHOT_GENERATED);
        } catch {
            toast.error(MESSAGES.ERROR_STOCK_SNAPSHOT_FAILED);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-1 items-start justify-start p-6">
            <Card className="w-full max-w-md border-[var(--cl-border)] bg-[var(--cl-surface)]">
                <CardHeader>
                    <CardTitle className="text-base text-[var(--cl-text)]">Generate Stock Snapshot</CardTitle>
                    <CardDescription className="text-xs text-[var(--cl-text-muted)]">
                        Regenerate the closing stock snapshot for a specific month.
                    </CardDescription>

                    {/* Info banner */}
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-950/30">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            Use this after entering back-dated transactions to keep your stock snapshot accurate.
                        </p>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Current period indicator */}
                    <p className="text-center text-xs text-[var(--cl-text-muted)]">
                        Pre-selected period:{" "}
                        <span className="font-semibold text-[var(--cl-text)]">
                            {MONTH_LABELS[defaultMonth]} {defaultYear}
                        </span>
                    </p>

                    {/* Year stepper */}
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-[var(--cl-text)]">Year</p>
                        <div className="flex items-center justify-between rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-2 py-1.5">
                            <button
                                className="rounded p-1 text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)] disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                                disabled={year <= MIN_YEAR}
                                type="button"
                                onClick={handleDecrYear}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-xl font-bold tabular-nums text-[var(--cl-text)]">{year}</span>
                            <button
                                className="rounded p-1 text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)] disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                                disabled={year >= currentYear}
                                type="button"
                                onClick={handleIncrYear}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Month grid */}
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-[var(--cl-text)]">Month</p>
                        <div className="grid grid-cols-4 gap-1.5">
                            {MONTHS.map(m => (
                                <button
                                    key={m.value}
                                    className={`cursor-pointer rounded-md px-0 py-2 text-xs font-medium transition-colors ${
                                        month === m.value
                                            ? "bg-[var(--cl-accent)] text-white shadow-sm"
                                            : isMonthDisabled(m.value)
                                                ? "cursor-not-allowed border border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] opacity-35"
                                                : "border border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]"
                                    }`}
                                    disabled={isMonthDisabled(m.value)}
                                    type="button"
                                    onClick={() => !isMonthDisabled(m.value) && setMonth(m.value)}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Selected period summary */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-3)] px-4 py-2.5 text-center">
                        <p className="text-xs text-[var(--cl-text-muted)]">Selected period</p>
                        <p className="mt-0.5 text-sm font-bold text-[var(--cl-text)]">
                            {MONTH_LABELS[month]} {year}
                        </p>
                    </div>

                    {isFuturePeriod && (
                        <p className="text-center text-xs text-amber-600 dark:text-amber-400">
                            Snapshots can only be generated up to last month.
                        </p>
                    )}

                    {/* Submit button */}
                    <Button
                        className="w-full cursor-pointer"
                        disabled={loading || isFuturePeriod}
                        type="button"
                        onClick={handleSubmitClick}
                    >
                        {loading ? "Generating…" : "Generate Snapshot"}
                    </Button>
                </CardContent>
            </Card>

            {/* Confirmation dialog */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Snapshot Generation</AlertDialogTitle>
                        <AlertDialogDescription>
                            Regenerate the stock snapshot for{" "}
                            <strong>{MONTH_LABELS[month]} {year}</strong>?
                            This will overwrite any existing snapshot for this period.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm} className="cursor-pointer">
                            Generate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
