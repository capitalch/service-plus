import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCwIcon, ServerIcon, DatabaseIcon, MailIcon, FileTextIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apolloClient } from "@/lib/apollo-client";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { PageLoader } from "@/components/ui/page-loader";
import { SuperAdminLayout } from "../components/super-admin-layout";
import type {
    DbSizeType,
    HealthStatusType,
    ServiceCheckType,
    UsageHealthType,
} from "@/features/super-admin/types";

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes < 1024)                  return `${bytes} B`;
    if (bytes < 1024 * 1024)           return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const statusDot: Record<HealthStatusType, string> = {
    Degraded: "bg-amber-400",
    Down:     "bg-rose-500",
    Healthy:  "bg-emerald-400",
};

const statusBadge: Record<HealthStatusType, string> = {
    Degraded: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
    Down:     "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50",
    Healthy:  "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
};

const overallBadge: Record<HealthStatusType, string> = {
    Degraded: "border-amber-200 bg-amber-50 text-amber-700",
    Down:     "border-rose-200 bg-rose-50 text-rose-700",
    Healthy:  "border-emerald-200 bg-emerald-100 text-emerald-700",
};

const overallLabel: Record<HealthStatusType, string> = {
    Degraded: "Partial Degradation",
    Down:     "System Down",
    Healthy:  "All Systems Operational",
};

const serviceIcon: Record<string, React.ElementType> = {
    "API Server":        ServerIcon,
    "Audit Log":         FileTextIcon,
    "Platform Database": DatabaseIcon,
    "SMTP Server":       MailIcon,
};

// ─── Animation ────────────────────────────────────────────────────────────────

const cardVariants = {
    hidden:  { opacity: 0, y: 12 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.07, duration: 0.3, ease: "easeOut" as const },
        y: 0,
    }),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, sub, value }: { label: string; sub: string; value: string | number }) {
    return (
        <Card className="border border-slate-200/80 bg-white shadow-sm">
            <CardContent className="p-4">
                <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-emerald-600">{value}</p>
                <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
            </CardContent>
        </Card>
    );
}

function ServiceCard({ check, index }: { check: ServiceCheckType; index: number }) {
    const Icon = serviceIcon[check.name] ?? ServerIcon;
    return (
        <motion.div animate="visible" custom={index} initial="hidden" variants={cardVariants}>
            <Card className="border border-slate-200/80 bg-white shadow-sm">
                <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${statusDot[check.status]}`} />
                            <Icon className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm font-semibold text-slate-800">{check.name}</span>
                        </div>
                        <Badge className={statusBadge[check.status]} variant="outline">
                            {check.status}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">{check.detail ?? "—"}</p>
                        {check.latency_ms !== null && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                                {check.latency_ms}ms
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

function DbSizeRow({ row }: { row: DbSizeType }) {
    const isPlatform = row.db_name === "service_plus_client";
    return (
        <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
                <DatabaseIcon className="h-3.5 w-3.5 text-slate-300" />
                <span className="font-mono text-xs text-slate-700">{row.db_name}</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{formatBytes(row.size_bytes)}</span>
                <Badge
                    className={isPlatform
                        ? "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-50"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50"}
                    variant="outline"
                >
                    {isPlatform ? "Platform DB" : "Client DB"}
                </Badge>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const UsageHealthPage = () => {
    const [data,       setData]       = useState<UsageHealthType | null>(null);
    const [error,      setError]      = useState<string | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
                const result = await apolloClient.query<{ usageHealth: UsageHealthType }>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.usageHealth,
                });
                setData(result.data?.usageHealth ?? null);
            } catch {
                setError(MESSAGES.ERROR_USAGE_HEALTH_LOAD_FAILED);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [refreshKey]);

    function handleRefresh() {
        setRefreshKey(k => k + 1);
    }

    const overall = data?.overall_status ?? "Healthy";

    return (
        <SuperAdminLayout>
            <motion.div animate={{ opacity: 1 }} className="flex flex-col gap-6" initial={{ opacity: 0 }} transition={{ duration: 0.25 }}>

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Usage & Health</h1>
                        <p className="mt-1 text-sm text-slate-500">Live platform health checks and usage statistics.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {data && (
                            <Badge className={overallBadge[overall]} variant="outline">
                                <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${statusDot[overall]}`} />
                                {overallLabel[overall]}
                            </Badge>
                        )}
                        <Button
                            className="h-8 gap-1.5 border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50"
                            disabled={loading}
                            onClick={handleRefresh}
                            size="sm"
                            variant="outline"
                        >
                            <RefreshCwIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {loading && <PageLoader />}

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {data && (
                    <>
                        {/* Section 1 — Service Health */}
                        <div>
                            <h2 className="mb-3 text-sm font-semibold text-slate-700">Service Health</h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {data.services.map((check, i) => (
                                    <ServiceCard check={check} index={i} key={check.name} />
                                ))}
                            </div>
                        </div>

                        {/* Section 2 — Platform Stats + Audit Log */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <div>
                                <h2 className="mb-3 text-sm font-semibold text-slate-700">Platform Statistics</h2>
                                <div className="grid grid-cols-3 gap-4">
                                    <StatCard
                                        label="Total Clients"
                                        sub={`${data.platform_stats.active_clients} active · ${data.platform_stats.inactive_clients} inactive`}
                                        value={data.platform_stats.total_clients}
                                    />
                                    <StatCard
                                        label="Admin Users"
                                        sub="Across all client databases"
                                        value={data.platform_stats.total_admins}
                                    />
                                    <StatCard
                                        label="Databases"
                                        sub="Provisioned client databases"
                                        value={data.platform_stats.total_dbs}
                                    />
                                </div>
                            </div>

                            <div>
                                <h2 className="mb-3 text-sm font-semibold text-slate-700">Audit Log Summary</h2>
                                <div className="grid grid-cols-3 gap-4">
                                    <StatCard
                                        label="Events Today"
                                        sub="audit log entries"
                                        value={data.audit_log.today_count}
                                    />
                                    <StatCard
                                        label="Events This Week"
                                        sub="last 7 days"
                                        value={data.audit_log.week_count}
                                    />
                                    <StatCard
                                        label="Log Storage"
                                        sub={`${data.audit_log.file_count} file(s)`}
                                        value={formatBytes(data.audit_log.size_bytes)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3 — Database Storage */}
                        <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 12 }} transition={{ delay: 0.2, duration: 0.3 }}>
                            <Card className="border border-slate-200/80 shadow-sm">
                                <CardContent className="p-6">
                                    <h2 className="mb-1 text-sm font-semibold text-slate-900">Database Storage</h2>
                                    <p className="mb-4 text-xs text-slate-400">Size of all service_plus_* databases on the server</p>
                                    <Separator className="mb-3" />
                                    {data.db_sizes.length === 0 ? (
                                        <p className="py-4 text-center text-xs text-slate-400">No databases found</p>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {data.db_sizes.map(row => (
                                                <DbSizeRow key={row.db_name} row={row} />
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Section 4 — Server Information */}
                        <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 12 }} transition={{ delay: 0.25, duration: 0.3 }}>
                            <Card className="border border-slate-200/80 shadow-sm">
                                <CardContent className="p-6">
                                    <h2 className="mb-4 text-sm font-semibold text-slate-900">Server Information</h2>
                                    <Separator className="mb-4" />
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {[
                                            { label: "App Name",            value: data.server_info.app_name },
                                            { label: "Version",             value: data.server_info.app_version },
                                            { label: "Uptime",              value: data.server_info.uptime },
                                            { label: "Host",                value: data.server_info.host },
                                            { label: "Port",                value: String(data.server_info.port) },
                                            { label: "JWT Algorithm",       value: data.server_info.algorithm },
                                            { label: "Debug Mode",          value: data.server_info.debug ? "Enabled" : "Disabled" },
                                        ].map(({ label, value }) => (
                                            <div className="flex items-center justify-between gap-2" key={label}>
                                                <span className="text-xs text-slate-500">{label}</span>
                                                <span className={`text-xs font-medium ${value === "Enabled" ? "text-emerald-600" : value === "Disabled" ? "text-slate-400" : "text-slate-700"}`}>
                                                    {value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </>
                )}
            </motion.div>
        </SuperAdminLayout>
    );
};
