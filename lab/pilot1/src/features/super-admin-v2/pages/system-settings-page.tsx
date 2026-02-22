import { motion } from "framer-motion";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { SuperAdminLayout } from "../components/super-admin-layout";
import { dummySettingSections } from "@/features/super-admin/dummy-data";
import type { SettingSectionType } from "@/features/super-admin/types";

const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.08, duration: 0.3, ease: "easeOut" as const },
        y: 0,
    }),
};

const handleEditSection = (section: SettingSectionType) =>
    toast.info(`Editing ${section.title} settings`);

const isConfigured = (value: string) => !["Not configured", "Disabled"].includes(value);

export const SystemSettingsPage = () => {
    return (
        <SuperAdminLayout>
            <motion.div animate={{ opacity: 1 }} className="flex flex-col gap-6" initial={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <div>
                    <h1 className="text-xl font-bold text-slate-900">System Settings</h1>
                    <p className="mt-1 text-sm text-slate-500">Configure global platform preferences, security, and integrations.</p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {dummySettingSections.map((section, i) => (
                        <motion.div animate="visible" custom={i} initial="hidden" key={section.id} variants={cardVariants}>
                            <Card className="h-full border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md">
                                <CardContent className="p-6">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
                                        <Button
                                            className="h-7 border-emerald-200 px-2 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                            onClick={() => handleEditSection(section)}
                                            size="sm"
                                            variant="outline"
                                        >
                                            <PencilIcon className="mr-1 h-3 w-3" />
                                            Edit
                                        </Button>
                                    </div>
                                    <Separator className="mb-4" />
                                    <div className="flex flex-col gap-3">
                                        {section.items.map((item) => (
                                            <div className="flex items-center justify-between gap-4" key={item.key}>
                                                <span className="text-xs text-slate-500">{item.label}</span>
                                                <span className="flex items-center gap-1.5 text-right">
                                                    {item.value === "Enabled" ? (
                                                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50" variant="outline">Enabled</Badge>
                                                    ) : item.value === "Disabled" ? (
                                                        <Badge className="border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100" variant="outline">Disabled</Badge>
                                                    ) : item.value === "Configured" ? (
                                                        <Badge className="border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-50" variant="outline">Configured</Badge>
                                                    ) : item.value === "Not configured" ? (
                                                        <Badge className="border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-100" variant="outline">Not configured</Badge>
                                                    ) : (
                                                        <span className={`text-xs font-medium ${isConfigured(item.value) ? "text-slate-700" : "text-slate-400"}`}>
                                                            {item.value}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </SuperAdminLayout>
    );
};
