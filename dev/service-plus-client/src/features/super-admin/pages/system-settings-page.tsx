import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { InfoIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apolloClient } from "@/lib/apollo-client";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { PageLoader } from "@/components/ui/page-loader";
import { SuperAdminLayout } from "../components/super-admin-layout";
import type { SystemSettingsType } from "@/features/super-admin/types";

const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.08, duration: 0.3, ease: "easeOut" as const },
        y: 0,
    }),
};

type RowType = { label: string; value: string };

function buildSections(s: SystemSettingsType): { rows: RowType[]; title: string }[] {
    return [
        {
            title: "Application",
            rows: [
                { label: "App Name",    value: s.application.app_name },
                { label: "Version",     value: s.application.app_version },
                { label: "Debug Mode",  value: s.application.debug ? "Enabled" : "Disabled" },
                { label: "Host",        value: s.application.host },
                { label: "Port",        value: String(s.application.port) },
            ],
        },
        {
            title: "SMTP / Email",
            rows: [
                { label: "SMTP Host",     value: s.smtp.smtp_host },
                { label: "SMTP Port",     value: String(s.smtp.smtp_port) },
                { label: "SMTP User",     value: s.smtp.smtp_user },
                { label: "From Address",  value: s.smtp.smtp_from },
                { label: "Password",      value: s.smtp.smtp_password },
            ],
        },
        {
            title: "Security / Tokens",
            rows: [
                { label: "JWT Algorithm",               value: s.security.algorithm },
                { label: "Access Token Expiry",         value: `${s.security.access_token_expire_minutes} minutes` },
                { label: "Refresh Token Expiry",        value: `${s.security.refresh_token_expire_days} days` },
            ],
        },
        {
            title: "Audit Log",
            rows: [
                { label: "Log Directory",       value: s.audit_log.audit_log_dir },
                { label: "Max Read Days",        value: String(s.audit_log.audit_log_max_read_days) },
                { label: "Retention Days",       value: String(s.audit_log.audit_log_retention_days) },
            ],
        },
        {
            title: "Super Admin",
            rows: [
                { label: "Username",       value: s.super_admin.super_admin_username },
                { label: "Email",          value: s.super_admin.super_admin_email },
                { label: "Mobile",         value: s.super_admin.super_admin_mobile },
                { label: "Password Hash",  value: s.super_admin.super_admin_password_hash },
            ],
        },
    ];
}

function SettingRow({ label, value }: RowType) {
    const isMasked   = value === "***";
    const isEnabled  = value === "Enabled";
    const isDisabled = value === "Disabled";

    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500">{label}</span>
            <span className="flex items-center gap-1.5 text-right">
                {isEnabled ? (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50" variant="outline">Enabled</Badge>
                ) : isDisabled ? (
                    <Badge className="border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100" variant="outline">Disabled</Badge>
                ) : isMasked ? (
                    <span className="font-mono text-xs tracking-widest text-slate-400">••••••••</span>
                ) : (
                    <span className="text-xs font-medium text-slate-700">{value}</span>
                )}
            </span>
        </div>
    );
}

export const SystemSettingsPage = () => {
    const [error,    setError]    = useState<string | null>(null);
    const [loading,  setLoading]  = useState(true);
    const [settings, setSettings] = useState<SystemSettingsType | null>(null);

    useEffect(() => {
        async function fetchSettings() {
            setLoading(true);
            setError(null);
            try {
                const result = await apolloClient.query<{ systemSettings: SystemSettingsType }>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.systemSettings,
                });
                setSettings(result.data?.systemSettings ?? null);
            } catch {
                setError(MESSAGES.ERROR_SETTINGS_LOAD_FAILED);
            } finally {
                setLoading(false);
            }
        }
        fetchSettings();
    }, []);

    return (
        <SuperAdminLayout>
            <motion.div animate={{ opacity: 1 }} className="flex flex-col gap-6" initial={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <div>
                    <h1 className="text-xl font-bold text-slate-900">System Settings</h1>
                    <p className="mt-1 text-sm text-slate-500">Current server configuration loaded from config.py.</p>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div className="text-sm text-amber-800">
                        <span className="font-semibold">Read-only view.</span>{" "}
                        To change these settings, modify{" "}
                        <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">config.py</code>{" "}
                        (or the <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">.env</code> file)
                        {" "}on the server and restart the server.
                    </div>
                </div>

                {loading && <PageLoader />}

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {settings && (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {buildSections(settings).map((section, i) => (
                            <motion.div animate="visible" custom={i} initial="hidden" key={section.title} variants={cardVariants}>
                                <Card className="h-full border border-slate-200/80 bg-white shadow-sm">
                                    <CardHeader className="pb-2 px-6">
                                        <CardTitle className="text-sm font-semibold text-slate-900">{section.title}</CardTitle>
                                    </CardHeader>
                                    <Separator />
                                    <CardContent className="pb-6 pt-4 px-6">
                                        <div className="flex flex-col gap-3">
                                            {section.rows.map((row) => (
                                                <SettingRow key={row.label} label={row.label} value={row.value} />
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </motion.div>
        </SuperAdminLayout>
    );
};
