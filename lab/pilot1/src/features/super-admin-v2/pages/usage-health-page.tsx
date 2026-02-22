import type { Variants } from "framer-motion";
import { motion } from "framer-motion";
import { ActivityIcon, ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { SuperAdminLayout } from "../components/super-admin-layout";
import {
    dummyPlatformMetrics,
    dummySystemServices,
    dummyUptimeData,
} from "@/features/super-admin/dummy-data";
import type { MetricTrendType, ServiceHealthStatusType } from "@/features/super-admin/types";

const statusDot: Record<ServiceHealthStatusType, string> = {
    Degraded: "bg-amber-400",
    Down: "bg-slate-400",
    Healthy: "bg-emerald-400",
};

const statusBadge: Record<ServiceHealthStatusType, string> = {
    Degraded: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
    Down: "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
    Healthy: "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
};

const trendIcon: Record<MetricTrendType, React.ElementType> = {
    down: ArrowDownIcon,
    neutral: MinusIcon,
    up: ArrowUpIcon,
};

const trendClass: Record<MetricTrendType, string> = {
    down: "text-emerald-500",
    neutral: "text-slate-400",
    up: "text-emerald-500",
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.07, duration: 0.3, ease: "easeOut" },
        y: 0,
    }),
};

const overallHealthy = dummySystemServices.every((s) => s.status === "Healthy");
const hasDegraded = dummySystemServices.some((s) => s.status === "Degraded");

export const UsageHealthPage = () => {
    return (
        <SuperAdminLayout>
            <motion.div animate={{ opacity: 1 }} className="flex flex-col gap-6" initial={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Usage & Health</h1>
                        <p className="mt-1 text-sm text-slate-500">Monitor platform metrics and service health in real time.</p>
                    </div>
                    <Badge
                        className={overallHealthy
                            ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                            : hasDegraded
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-slate-200 bg-slate-100 text-slate-600"}
                        variant="outline"
                    >
                        <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${overallHealthy ? "bg-emerald-500" : hasDegraded ? "bg-amber-400" : "bg-slate-400"}`} />
                        {overallHealthy ? "All Systems Operational" : hasDegraded ? "Partial Degradation" : "System Down"}
                    </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {dummyPlatformMetrics.map((metric, i) => {
                        const TrendIcon = trendIcon[metric.trend];
                        return (
                            <motion.div animate="visible" custom={i} initial="hidden" key={metric.id} variants={cardVariants}>
                                <Card className="border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                                    <CardContent className="p-4">
                                        <div className="mb-1 flex items-center justify-between">
                                            <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                                            <ActivityIcon className="h-3.5 w-3.5 text-teal-300" />
                                        </div>
                                        <p className="text-2xl font-bold text-emerald-600">
                                            {metric.value}
                                            {metric.unit && <span className="ml-0.5 text-sm font-medium text-slate-500">{metric.unit}</span>}
                                        </p>
                                        <div className={`mt-1 flex items-center gap-1 text-xs ${trendClass[metric.trend]}`}>
                                            <TrendIcon className="h-3 w-3" />
                                            <span>{Math.abs(metric.change)}% vs yesterday</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                    <motion.div animate={{ opacity: 1, y: 0 }} className="lg:col-span-3" initial={{ opacity: 0, y: 12 }} transition={{ delay: 0.2, duration: 0.3, ease: "easeOut" }}>
                        <Card className="border border-slate-200/80 shadow-sm">
                            <CardContent className="p-6">
                                <div className="mb-4">
                                    <h2 className="text-sm font-semibold text-slate-900">Platform Uptime (Last 7 Days)</h2>
                                    <p className="text-xs text-slate-500">Percentage uptime across all services</p>
                                </div>
                                <ResponsiveContainer height={200} width="100%">
                                    <AreaChart data={dummyUptimeData} margin={{ bottom: 0, left: 0, right: 8, top: 4 }}>
                                        <defs>
                                            <linearGradient id="uptimeGradV2" x1="0" x2="0" y1="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                                        <YAxis domain={[96, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                                            formatter={(value: number) => [`${value}%`, "Uptime"]}
                                        />
                                        <Area dataKey="uptime" fill="url(#uptimeGradV2)" stroke="#10b981" strokeWidth={2} type="monotone" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div animate={{ opacity: 1, y: 0 }} className="lg:col-span-2" initial={{ opacity: 0, y: 12 }} transition={{ delay: 0.25, duration: 0.3, ease: "easeOut" }}>
                        <Card className="h-full border border-slate-200/80 shadow-sm">
                            <CardContent className="p-6">
                                <div className="mb-4">
                                    <h2 className="text-sm font-semibold text-slate-900">Service Health</h2>
                                    <p className="text-xs text-slate-500">Current status of platform services</p>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {dummySystemServices.map((svc) => (
                                        <div className="flex items-center justify-between" key={svc.id}>
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2 w-2 rounded-full ${statusDot[svc.status]}`} />
                                                <span className="text-sm font-medium text-slate-700">{svc.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-slate-400">{svc.responseTime}ms</span>
                                                <span className="text-xs text-slate-400">{svc.uptime}%</span>
                                                <Badge className={statusBadge[svc.status]} variant="outline">{svc.status}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </motion.div>
        </SuperAdminLayout>
    );
};
