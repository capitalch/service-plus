import { motion } from "framer-motion";
import { ActivityIcon, CpuIcon, ServerIcon, WifiIcon } from "lucide-react";
import { useSelector } from "react-redux";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { selectStats } from "@/features/super-admin/super-admin-slice";
import { SuperAdminLayoutV3 } from "../components/super-admin-layout";

const uptimeData = [
    { day: "Mon", uptime: 99.8 },
    { day: "Tue", uptime: 99.9 },
    { day: "Wed", uptime: 98.5 },
    { day: "Thu", uptime: 99.7 },
    { day: "Fri", uptime: 99.9 },
    { day: "Sat", uptime: 100 },
    { day: "Sun", uptime: 99.6 },
];

const metrics = [
    { icon: ServerIcon, label: "API Uptime", unit: "%", value: "99.9" },
    { icon: CpuIcon, label: "CPU Usage", unit: "%", value: "42" },
    { icon: WifiIcon, label: "Avg Latency", unit: "ms", value: "128" },
    { icon: ActivityIcon, label: "Error Rate", unit: "%", value: "0.1" },
];

export const UsageHealthPageV3 = () => {
    const stats = useSelector(selectStats);

    return (
        <SuperAdminLayoutV3>
            <motion.div animate={{ opacity: 1 }} className="flex flex-col gap-6" initial={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Usage &amp; Health</h1>
                    <p className="mt-1 text-sm text-slate-500">System performance metrics and uptime.</p>
                </div>

                {/* Metric cards */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {metrics.map((m) => {
                        const Icon = m.icon;
                        return (
                            <Card className="border border-slate-200 bg-white shadow-sm" key={m.label}>
                                <CardContent className="p-5">
                                    <div className="mb-2 flex items-center justify-between">
                                        <p className="text-xs font-medium text-slate-500">{m.label}</p>
                                        <Icon className="h-3.5 w-3.5 text-violet-300" />
                                    </div>
                                    <p className="text-3xl font-bold text-violet-600">
                                        {m.value}
                                        <span className="ml-0.5 text-sm font-medium text-slate-400">{m.unit}</span>
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Uptime chart */}
                <Card className="border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 pb-4">
                        <CardTitle className="text-sm font-semibold text-slate-900">Weekly Uptime</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5">
                        <ResponsiveContainer height={200} width="100%">
                            <AreaChart data={uptimeData}>
                                <defs>
                                    <linearGradient id="violetGrad" x1="0" x2="0" y1="0" y2="1">
                                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                                <YAxis domain={[98, 100]} tick={{ fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                                    formatter={(v: number) => [`${v}%`, "Uptime"]}
                                />
                                <Area dataKey="uptime" fill="url(#violetGrad)" stroke="#7c3aed" strokeWidth={2} type="monotone" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* BU Summary */}
                <Card className="border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 pb-4">
                        <CardTitle className="text-sm font-semibold text-slate-900">Platform Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                        {[
                            { label: "Total BUs", value: stats.totalBu },
                            { label: "Active BUs", value: stats.activeBu },
                            { label: "Total Admins", value: stats.totalAdminUsers },
                            { label: "Active Admins", value: stats.activeAdminUsers },
                        ].map((s) => (
                            <div className="text-center" key={s.label}>
                                <p className="text-2xl font-bold text-violet-600">{s.value}</p>
                                <p className="text-xs text-slate-400">{s.label}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </motion.div>
        </SuperAdminLayoutV3>
    );
};
