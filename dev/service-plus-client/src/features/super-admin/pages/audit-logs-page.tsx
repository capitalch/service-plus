import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    ActivityIcon,
    AlertTriangleIcon,
    DownloadIcon,
    RefreshCwIcon,
    SearchIcon,
    UsersIcon,
    ZapIcon,
} from "lucide-react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/page-loader";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SuperAdminLayout } from "@/features/super-admin/components/super-admin-layout";
import type {
    AuditEntryType,
    AuditLogPageType,
    AuditStatsType,
} from "@/features/super-admin/types";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIT_ACTIONS = [
    "ACTIVATE_ADMIN_USER",
    "CREATE_ADMIN_USER",
    "CREATE_SERVICE_DB",
    "DEACTIVATE_ADMIN_USER",
    "DELETE_CLIENT",
    "DROP_DATABASE",
    "LOGIN",
    "LOGIN_FAILED",
    "LOGOUT",
    "MAIL_ADMIN_CREDENTIALS",
    "UPDATE_ADMIN_USER",
];

const PAGE_SIZE = 20;

// ─── Local Types ──────────────────────────────────────────────────────────────

type OutcomeFilterType = "" | "failure" | "success";

// ─── Utility Functions ────────────────────────────────────────────────────────

function exportToCsv(items: AuditEntryType[], toDate: string): void {
    const headers = [
        "Timestamp", "Actor", "Actor Type", "Action",
        "Resource Type", "Resource Name", "Outcome", "Detail",
    ];
    function esc(v: string | null | undefined): string {
        return `"${(v ?? "").replace(/"/g, '""')}"`;
    }
    const rows = items.map((e) => [
        esc(formatTimestamp(e.timestamp)),
        esc(e.actor.username),
        esc(e.actor.type),
        esc(formatAction(e.action)),
        esc(e.resource.type),
        esc(e.resource.name),
        esc(e.outcome),
        esc(e.detail),
    ].join(","));
    const csv  = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `audit-log-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function formatAction(action: string): string {
    return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(ts: string): string {
    return new Date(ts).toISOString().replace("T", " ").slice(0, 19);
}

function getDateDaysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}

function getTodayStr(): string {
    return new Date().toISOString().slice(0, 10);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const EntryDetailDialog = ({
    entry,
    onClose,
}: {
    entry: AuditEntryType | null;
    onClose: () => void;
}) => (
    <Dialog open={!!entry} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Audit Entry Detail</DialogTitle>
            </DialogHeader>
            {entry && (
                <pre className="max-h-96 overflow-auto rounded-md bg-slate-50 p-4 text-xs text-slate-700">
                    {JSON.stringify(entry, null, 2)}
                </pre>
            )}
        </DialogContent>
    </Dialog>
);

const OutcomeBadge = ({ outcome }: { outcome: string }) =>
    outcome === "success" ? (
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
            Success
        </Badge>
    ) : (
        <Badge className="border-red-200 bg-red-50 text-red-700" variant="outline">
            Failure
        </Badge>
    );

const StatCard = ({
    icon: Icon,
    iconClass,
    label,
    value,
}: {
    icon: React.ElementType;
    iconClass: string;
    label: string;
    value: string | number;
}) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
            <Icon className={`h-4 w-4 ${iconClass}`} />
        </CardHeader>
        <CardContent className="pb-4">
            <div className="text-2xl font-bold text-slate-900">{value}</div>
        </CardContent>
    </Card>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const AuditLogsPage = () => {
    // Date range — default last 7 days
    const [fromDate, setFromDate]     = useState<string>(getDateDaysAgo(7));
    const [toDate, setToDate]         = useState<string>(getTodayStr());

    // Filters
    const [actionFilter, setActionFilter]   = useState<string>("");
    const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilterType>("");
    const [searchInput, setSearchInput]     = useState<string>("");
    const debouncedSearch                   = useDebounce(searchInput, 1200);

    // Pagination
    const [page, setPage] = useState<number>(1);

    // Stats data
    const [stats, setStats]           = useState<AuditStatsType | null>(null);
    const [statsLoading, setStatsLoading] = useState<boolean>(true);
    const [statsError, setStatsError]     = useState<boolean>(false);

    // Log entries data
    const [logPage, setLogPage]           = useState<AuditLogPageType | null>(null);
    const [logsLoading, setLogsLoading]   = useState<boolean>(true);
    const [logsError, setLogsError]       = useState<boolean>(false);

    // Detail dialog
    const [selectedEntry, setSelectedEntry] = useState<AuditEntryType | null>(null);

    // Refresh counter
    const [refreshKey, setRefreshKey] = useState<number>(0);

    // ── Effects ──────────────────────────────────────────────────────────────

    useEffect(() => {
        async function loadStats() {
            setStatsLoading(true);
            setStatsError(false);
            try {
                const result = await apolloClient.query<{ auditLogStats: AuditStatsType }>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.auditLogStats,
                    variables: { from_date: fromDate, to_date: toDate },
                });
                setStats(result.data?.auditLogStats ?? null);
            } catch {
                setStatsError(true);
                toast.error(MESSAGES.ERROR_AUDIT_STATS_FAILED);
            } finally {
                setStatsLoading(false);
            }
        }
        void loadStats();
    }, [fromDate, toDate, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset to page 1 when filters change
    useEffect(() => { setPage(1); }, [fromDate, toDate, debouncedSearch, actionFilter, outcomeFilter]);

    useEffect(() => {
        async function loadLogs() {
            setLogsLoading(true);
            setLogsError(false);
            try {
                const result = await apolloClient.query<{ auditLogs: AuditLogPageType }>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.auditLogs,
                    variables: {
                        action:    actionFilter  || undefined,
                        from_date: fromDate,
                        outcome:   outcomeFilter || undefined,
                        page,
                        page_size: PAGE_SIZE,
                        search:    debouncedSearch || undefined,
                        to_date:   toDate,
                    },
                });
                setLogPage(result.data?.auditLogs ?? null);
            } catch {
                setLogsError(true);
                toast.error(MESSAGES.ERROR_AUDIT_LOAD_FAILED);
            } finally {
                setLogsLoading(false);
            }
        }
        void loadLogs();
    }, [fromDate, toDate, debouncedSearch, actionFilter, outcomeFilter, page, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handlers ─────────────────────────────────────────────────────────────

    function handleExport() {
        if (!logPage?.items.length) {
            toast.error(MESSAGES.ERROR_AUDIT_EXPORT_FAILED);
            return;
        }
        exportToCsv(logPage.items, toDate);
    }

    function handleRefresh() {
        setPage(1);
        setRefreshKey((k) => k + 1);
    }

    // ── Derived ───────────────────────────────────────────────────────────────

    const topAction = stats?.actionCounts[0]
        ? formatAction(stats.actionCounts[0].action)
        : "—";

    const uniqueActors = stats?.actorCounts.length ?? 0;

    // ── Render ────────────────────────────────────────────────────────────────

    if (statsLoading && logsLoading && !stats && !logPage) {
        return (
            <SuperAdminLayout>
                <PageLoader />
            </SuperAdminLayout>
        );
    }

    return (
        <SuperAdminLayout>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex flex-col gap-6"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                {/* ── Header ── */}
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Audit Logs</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Track all system actions, user activity, and configuration changes.
                    </p>
                </div>

                {/* ── Stat Cards ── */}
                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 gap-4 sm:grid-cols-4"
                    initial={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.3 }}
                >
                    <StatCard
                        icon={ActivityIcon}
                        iconClass="text-blue-500"
                        label="Total Events"
                        value={statsLoading ? "…" : (stats?.totalEvents ?? 0)}
                    />
                    <StatCard
                        icon={AlertTriangleIcon}
                        iconClass="text-amber-500"
                        label="Failures"
                        value={statsLoading ? "…" : (stats?.outcomeCounts.failure ?? 0)}
                    />
                    <StatCard
                        icon={UsersIcon}
                        iconClass="text-emerald-500"
                        label="Unique Actors"
                        value={statsLoading ? "…" : uniqueActors}
                    />
                    <StatCard
                        icon={ZapIcon}
                        iconClass="text-violet-500"
                        label="Top Action"
                        value={statsLoading ? "…" : topAction}
                    />
                </motion.div>

                {/* ── Charts ── */}
                {stats && (
                    <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                        initial={{ opacity: 0, y: 8 }}
                        transition={{ delay: 0.05, duration: 0.3 }}
                    >
                        {/* Events Over Time */}
                        <Card>
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-sm font-medium text-slate-600">
                                    Events Over Time
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-4">
                                <ResponsiveContainer height={180} width="100%">
                                    <AreaChart data={stats.timeSeries}>
                                        <defs>
                                            <linearGradient id="colorCount" x1="0" x2="0" y1="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 10 }}
                                            tickFormatter={(v: string) => v.slice(5)}
                                        />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                                        <Tooltip
                                            contentStyle={{ fontSize: 12 }}
                                            formatter={(v: number) => [v, "Events"]}
                                        />
                                        <Area
                                            dataKey="count"
                                            fill="url(#colorCount)"
                                            stroke="#10b981"
                                            strokeWidth={2}
                                            type="monotone"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Actions Breakdown */}
                        <Card>
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-sm font-medium text-slate-600">
                                    Actions Breakdown
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-4">
                                <ResponsiveContainer height={180} width="100%">
                                    <BarChart
                                        data={stats.actionCounts.slice(0, 8)}
                                        layout="vertical"
                                        margin={{ left: 0, right: 8 }}
                                    >
                                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis allowDecimals={false} tick={{ fontSize: 10 }} type="number" />
                                        <YAxis
                                            dataKey="action"
                                            tick={{ fontSize: 9 }}
                                            tickFormatter={(v: string) => formatAction(v).slice(0, 16)}
                                            type="category"
                                            width={110}
                                        />
                                        <Tooltip
                                            contentStyle={{ fontSize: 12 }}
                                            formatter={(v: number) => [v, "Count"]}
                                        />
                                        <Bar dataKey="count" fill="#6366f1" radius={[0, 3, 3, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* ── Filter Bar ── */}
                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    initial={{ opacity: 0, y: 8 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                >
                    {/* Date range */}
                    <div className="flex items-center gap-2">
                        <Input
                            className="h-8 w-36 text-xs"
                            max={toDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            type="date"
                            value={fromDate}
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <Input
                            className="h-8 w-36 text-xs"
                            min={fromDate}
                            onChange={(e) => setToDate(e.target.value)}
                            type="date"
                            value={toDate}
                        />
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <SearchIcon className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                            className="h-8 w-48 pl-7 text-xs"
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search…"
                            value={searchInput}
                        />
                    </div>

                    {/* Action filter */}
                    <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-ring"
                        onChange={(e) => setActionFilter(e.target.value)}
                        value={actionFilter}
                    >
                        <option value="">All actions</option>
                        {AUDIT_ACTIONS.map((a) => (
                            <option key={a} value={a}>{formatAction(a)}</option>
                        ))}
                    </select>

                    {/* Outcome toggle */}
                    <div className="flex gap-1">
                        {(["", "success", "failure"] as OutcomeFilterType[]).map((o) => (
                            <Button
                                className={`h-8 px-3 text-xs ${outcomeFilter === o ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""}`}
                                key={o || "all"}
                                onClick={() => setOutcomeFilter(o)}
                                size="sm"
                                variant={outcomeFilter === o ? "default" : "outline"}
                            >
                                {o === "" ? "All" : o === "success" ? "Success" : "Failure"}
                            </Button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="ml-auto flex gap-2">
                        <Button
                            className="h-8 px-3 text-xs"
                            disabled={logsLoading}
                            onClick={handleRefresh}
                            size="sm"
                            variant="outline"
                        >
                            <RefreshCwIcon className={`mr-1.5 h-3.5 w-3.5 ${logsLoading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        <Button
                            className="h-8 px-3 text-xs"
                            disabled={!logPage?.items.length}
                            onClick={handleExport}
                            size="sm"
                            variant="outline"
                        >
                            <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                            Export CSV
                        </Button>
                    </div>
                </motion.div>

                {/* ── Table ── */}
                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm"
                    initial={{ opacity: 0, y: 8 }}
                    transition={{ delay: 0.15, duration: 0.3 }}
                >
                    {logsError && (
                        <div className="p-4">
                            <Alert variant="destructive">
                                <AlertDescription>{MESSAGES.ERROR_AUDIT_LOAD_FAILED}</AlertDescription>
                            </Alert>
                        </div>
                    )}

                    {logsLoading && !logPage ? (
                        <p className="py-12 text-center text-sm text-slate-400">Loading…</p>
                    ) : !logPage?.items.length ? (
                        <p className="py-12 text-center text-sm text-slate-400">No audit entries found.</p>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-40 text-xs">Timestamp</TableHead>
                                        <TableHead className="text-xs">Actor</TableHead>
                                        <TableHead className="text-xs">Action</TableHead>
                                        <TableHead className="text-xs">Resource</TableHead>
                                        <TableHead className="w-24 text-xs">Outcome</TableHead>
                                        <TableHead className="text-xs">Detail</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logPage.items.map((entry) => (
                                        <TableRow
                                            className="cursor-pointer hover:bg-slate-50"
                                            key={entry.id}
                                            onClick={() => setSelectedEntry(entry)}
                                        >
                                            <TableCell className="py-2 font-mono text-xs text-slate-500">
                                                {formatTimestamp(entry.timestamp)}
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <div className="text-xs font-medium text-slate-800">
                                                    {entry.actor.username}
                                                </div>
                                                <div className="text-[10px] text-slate-400">{entry.actor.type}</div>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Badge className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]" variant="outline">
                                                    {formatAction(entry.action)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <div className="text-xs text-slate-700">{entry.resource.type}</div>
                                                {entry.resource.name && (
                                                    <div className="text-[10px] text-slate-400">{entry.resource.name}</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <OutcomeBadge outcome={entry.outcome} />
                                            </TableCell>
                                            <TableCell className="max-w-xs py-2">
                                                <span
                                                    className="block truncate text-xs text-slate-500"
                                                    title={entry.detail ?? ""}
                                                >
                                                    {entry.detail ?? "—"}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                                <span className="text-xs text-slate-500">
                                    {logPage.totalItems} entries · Page {logPage.page} of {logPage.totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        className="h-7 px-3 text-xs"
                                        disabled={page <= 1 || logsLoading}
                                        onClick={() => setPage((p) => p - 1)}
                                        size="sm"
                                        variant="outline"
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        className="h-7 px-3 text-xs"
                                        disabled={page >= logPage.totalPages || logsLoading}
                                        onClick={() => setPage((p) => p + 1)}
                                        size="sm"
                                        variant="outline"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </motion.div>
            </motion.div>

            {/* ── Detail Dialog ── */}
            <EntryDetailDialog entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
        </SuperAdminLayout>
    );
};
