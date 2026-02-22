import { motion } from "framer-motion";
import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SuperAdminLayoutV3 } from "../components/super-admin-layout";

const sections = [
    {
        items: [
            { label: "App Name", value: "ServicePlus" },
            { label: "Environment", value: "Production" },
            { label: "API Version", value: "v2.4.1" },
            { label: "Maintenance Mode", value: "Disabled" },
        ],
        title: "General",
    },
    {
        items: [
            { label: "SMTP Host", value: "Configured" },
            { label: "From Address", value: "no-reply@serviceplus.io" },
            { label: "Email Verification", value: "Enabled" },
        ],
        title: "Email",
    },
    {
        items: [
            { label: "2FA", value: "Enabled" },
            { label: "Session Timeout", value: "30 min" },
            { label: "Max Login Attempts", value: "5" },
            { label: "Password Policy", value: "Configured" },
        ],
        title: "Security",
    },
    {
        items: [
            { label: "Database", value: "Configured" },
            { label: "Redis Cache", value: "Configured" },
            { label: "File Storage", value: "S3 Bucket" },
        ],
        title: "Infrastructure",
    },
];

const badgeFor = (value: string) => {
    if (value === "Enabled" || value === "Configured")
        return <Badge className="border-violet-200 bg-violet-50 text-violet-700" variant="outline">{value}</Badge>;
    if (value === "Disabled")
        return <Badge className="border-slate-200 bg-slate-100 text-slate-400" variant="outline">{value}</Badge>;
    return <span className="text-sm font-medium text-slate-800">{value}</span>;
};

export const SystemSettingsPageV3 = () => {
    const [editing, setEditing] = useState<string | null>(null);

    const handleEdit = (title: string) => {
        setEditing(title);
        toast.info(`Editing ${title} settings…`, { description: "Changes saved automatically (demo)." });
        setTimeout(() => setEditing(null), 1500);
    };

    return (
        <SuperAdminLayoutV3>
            <motion.div animate={{ opacity: 1 }} className="flex flex-col gap-6" initial={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div>
                    <h1 className="text-xl font-bold text-slate-900">System Settings</h1>
                    <p className="mt-1 text-sm text-slate-500">Platform configuration and infrastructure settings.</p>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                    {sections.map((section) => (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" key={section.title}>
                            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                                <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
                                <Button
                                    className="h-7 border-violet-200 px-2 text-xs text-violet-700 hover:bg-violet-50"
                                    disabled={editing === section.title}
                                    onClick={() => handleEdit(section.title)}
                                    size="sm"
                                    variant="outline"
                                >
                                    <PencilIcon className="mr-1 h-3 w-3" />
                                    {editing === section.title ? "Saving…" : "Edit"}
                                </Button>
                            </div>
                            <div className="divide-y divide-slate-50 p-2">
                                {section.items.map((item, i) => (
                                    <div className="flex items-center justify-between px-3 py-3" key={i}>
                                        <span className="text-sm text-slate-500">{item.label}</span>
                                        {badgeFor(item.value)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </SuperAdminLayoutV3>
    );
};
