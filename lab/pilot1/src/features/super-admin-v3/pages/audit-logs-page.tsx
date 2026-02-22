import { motion } from "framer-motion";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SuperAdminLayoutV3 } from "../components/super-admin-layout";

type LogActionType = "LOGIN" | "CREATE" | "UPDATE" | "DELETE" | "LOGOUT";

const actionColors: Record<LogActionType, string> = {
    CREATE: "border-emerald-200 bg-emerald-50 text-emerald-700",
    DELETE: "border-red-200 bg-red-50 text-red-700",
    LOGIN: "border-violet-200 bg-violet-50 text-violet-700",
    LOGOUT: "border-slate-200 bg-slate-100 text-slate-500",
    UPDATE: "border-blue-200 bg-blue-50 text-blue-700",
};

const logs = [
    { action: "LOGIN" as LogActionType, actor: "Super Admin", detail: "Logged into the system", id: 1, time: "2 min ago" },
    { action: "CREATE" as LogActionType, actor: "Super Admin", detail: "Created BU: Zeta Industries", id: 2, time: "14 min ago" },
    { action: "UPDATE" as LogActionType, actor: "Jane Smith", detail: "Updated admin role for user #42", id: 3, time: "32 min ago" },
    { action: "DELETE" as LogActionType, actor: "Super Admin", detail: "Deleted inactive BU: Old Corp", id: 4, time: "1 hr ago" },
    { action: "LOGOUT" as LogActionType, actor: "John Doe", detail: "Session ended", id: 5, time: "2 hr ago" },
    { action: "CREATE" as LogActionType, actor: "Super Admin", detail: "Created admin user: alice@corp.io", id: 6, time: "3 hr ago" },
    { action: "UPDATE" as LogActionType, actor: "Super Admin", detail: "Changed system settings: SMTP", id: 7, time: "5 hr ago" },
    { action: "LOGIN" as LogActionType, actor: "Alice Chen", detail: "Logged in from 192.168.1.12", id: 8, time: "6 hr ago" },
];

const FILTERS: (LogActionType | "ALL")[] = ["ALL", "LOGIN", "CREATE", "UPDATE", "DELETE", "LOGOUT"];

export const AuditLogsPageV3 = () => {
    const [filter, setFilter] = useState<LogActionType | "ALL">("ALL");

    const filtered = filter === "ALL" ? logs : logs.filter((l) => l.action === filter);

    return (
        <SuperAdminLayoutV3>
            <motion.div animate={{ opacity: 1 }} className="flex flex-col gap-6" initial={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Audit Logs</h1>
                    <p className="mt-1 text-sm text-slate-500">Track all system activity and changes.</p>
                </div>

                {/* Filter chips */}
                <div className="flex flex-wrap gap-2">
                    {FILTERS.map((f) => (
                        <Button
                            className={`h-7 rounded-full px-3 text-xs ${filter === f ? "bg-violet-500 text-white hover:bg-violet-600" : ""}`}
                            key={f}
                            onClick={() => setFilter(f)}
                            size="sm"
                            variant={filter === f ? "default" : "outline"}
                        >
                            {f}
                        </Button>
                    ))}
                </div>

                {/* Log list */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="divide-y divide-slate-100">
                        {filtered.map((log) => (
                            <motion.div
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors"
                                initial={{ opacity: 0, x: -8 }}
                                key={log.id}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-600">
                                    {log.actor.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold text-slate-900">{log.actor}</span>
                                        <Badge className={actionColors[log.action]} variant="outline">{log.action}</Badge>
                                    </div>
                                    <p className="mt-0.5 text-sm text-slate-500">{log.detail}</p>
                                </div>
                                <span className="flex-shrink-0 text-xs text-slate-400">{log.time}</span>
                            </motion.div>
                        ))}
                        {filtered.length === 0 && (
                            <p className="py-12 text-center text-sm text-slate-400">No log entries for this filter.</p>
                        )}
                    </div>
                </div>
            </motion.div>
        </SuperAdminLayoutV3>
    );
};
