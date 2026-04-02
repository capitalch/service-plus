import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    MoreHorizontalIcon,
    PencilIcon,
    RefreshCwIcon,
    SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { EditAppSettingDialog } from "./edit-app-setting-dialog";
import type { AppSettingRecord } from "@/features/client/types/app-setting";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType<T> = { genericQuery: T[] | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const rowVariants = {
    hidden:  { opacity: 0, y: 6 },
    visible: (i: number) => ({
        opacity:    1,
        transition: { delay: i * 0.04, duration: 0.22, ease: "easeOut" as const },
        y:          0,
    }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function displayValue(v: unknown): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AppSettingsSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [editRecord,   setEditRecord]   = useState<AppSettingRecord | null>(null);
    const [loading,      setLoading]      = useState(false);
    const [records,      setRecords]      = useState<AppSettingRecord[]>([]);
    const [search,       setSearch]       = useState("");

    const loadData = useCallback(async () => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryDataType<AppSettingRecord>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_APP_SETTINGS }),
                },
            });
            setRecords(res.data?.genericQuery ?? []);
        } catch {
            toast.error("Failed to load app settings.");
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const displayRecords = useMemo(() => {
        if (!search.trim()) return records;
        const q = search.toLowerCase();
        return records.filter(r =>
            r.setting_key.toLowerCase().includes(q) ||
            displayValue(r.setting_value).toLowerCase().includes(q) ||
            (r.description?.toLowerCase().includes(q) ?? false)
        );
    }, [records, search]);

    const thClass = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]";

    if (!schema) {
        return (
            <div className="flex items-center justify-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-20">
                <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--cl-text)]">No Business Unit</p>
                    <p className="mt-2 text-xs text-[var(--cl-text-muted)]">
                        No business unit is assigned. Please contact your administrator.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex min-h-0 flex-1 flex-col gap-4"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-[var(--cl-text)]">App Settings</h1>
                        <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                            System-wide configuration settings for this business unit.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            className="gap-1.5 border border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] shadow-sm hover:bg-[var(--cl-surface-3)]"
                            disabled={loading}
                            size="sm"
                            variant="outline"
                            onClick={loadData}
                        >
                            <RefreshCwIcon className="h-3.5 w-3.5" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Search + count */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                        <Input
                            className="h-8 pl-8 text-sm"
                            disabled={loading}
                            placeholder="Search settings…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    {!loading && records.length > 0 && (
                        <p className="shrink-0 text-xs text-[var(--cl-text-muted)]">
                            {displayRecords.length} of {records.length}
                        </p>
                    )}
                </div>

                {/* Table */}
                {loading && records.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--cl-surface-2)]" />
                        ))}
                    </div>
                ) : records.length === 0 ? (
                    <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-6 py-12 text-center text-sm text-[var(--cl-text-muted)]">
                        No settings found.
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-sm">
                        <div className="overflow-x-auto overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="sticky top-0 z-10 bg-[var(--cl-surface-3)] hover:bg-[var(--cl-surface-3)]">
                                        <TableHead className={`w-8 text-center ${thClass}`}>#</TableHead>
                                        <TableHead className={thClass}>Key</TableHead>
                                        <TableHead className={thClass}>Value</TableHead>
                                        <TableHead className={thClass}>Description</TableHead>
                                        <TableHead className={thClass}>Editable</TableHead>
                                        <TableHead className={thClass}>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayRecords.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-6 py-10 text-center text-sm text-[var(--cl-text-muted)]"
                                            >
                                                No results match &ldquo;{search}&rdquo;.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayRecords.map((record, idx) => (
                                            <motion.tr
                                                animate="visible"
                                                className="border-b border-[var(--cl-border)] transition-colors last:border-b-0 hover:bg-[var(--cl-surface-3)]"
                                                custom={idx}
                                                initial="hidden"
                                                key={record.id}
                                                variants={rowVariants}
                                            >
                                                <TableCell className="text-center text-xs text-[var(--cl-text-muted)]">{idx + 1}</TableCell>
                                                <TableCell className="font-mono text-sm font-medium text-[var(--cl-text)]">{record.setting_key}</TableCell>
                                                <TableCell className="font-mono text-sm text-[var(--cl-text-muted)]">{displayValue(record.setting_value)}</TableCell>
                                                <TableCell className="max-w-xs truncate text-sm text-[var(--cl-text-muted)]">{record.description ?? "—"}</TableCell>
                                                <TableCell>
                                                    {record.is_editable ? (
                                                        <Badge
                                                            className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                            variant="outline"
                                                        >
                                                            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                            Editable
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            className="border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100"
                                                            variant="outline"
                                                        >
                                                            Fixed
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                className="h-7 w-7 cursor-pointer text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]"
                                                                size="icon"
                                                                variant="ghost"
                                                            >
                                                                <MoreHorizontalIcon className="h-4 w-4" />
                                                                <span className="sr-only">Actions</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-44">
                                                            <DropdownMenuItem
                                                                className={record.is_editable
                                                                    ? "cursor-pointer text-sky-600 focus:text-sky-600"
                                                                    : "cursor-not-allowed opacity-40"}
                                                                disabled={!record.is_editable}
                                                                onClick={() => record.is_editable && setEditRecord(record)}
                                                            >
                                                                <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </motion.tr>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Dialogs */}
            {editRecord && (
                <EditAppSettingDialog
                    open={!!editRecord}
                    record={editRecord}
                    onOpenChange={(o) => { if (!o) setEditRecord(null); }}
                    onSuccess={loadData}
                />
            )}
        </>
    );
};
