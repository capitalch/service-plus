import { motion } from "framer-motion";
import { BriefcaseIcon, CheckIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MESSAGES } from "@/constants/messages";

type RoleSelectionDialogPropsType = {
    isOpen:   boolean;
    onSelect: (mode: 'admin' | 'client') => void;
};

const cardVariants = {
    hidden:  { opacity: 0, y: 12 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.1, duration: 0.3, ease: "easeOut" as const },
        y: 0,
    }),
};

const ADMIN_BULLETS = [
    "Manage users and business units",
    "View admin audit logs",
    "Configure client settings",
];

const CLIENT_BULLETS = [
    "Access all service features",
    "Manage customers and service orders",
    "Full operational access",
];

export const RoleSelectionDialog = ({ isOpen, onSelect }: RoleSelectionDialogPropsType) => {
    return (
        <Dialog open={isOpen} onOpenChange={() => {}}>
            <DialogContent
                className="sm:max-w-2xl"
                onEscapeKeyDown={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-slate-900">
                        {MESSAGES.INFO_CHOOSE_MODE_TITLE}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500">
                        {MESSAGES.INFO_CHOOSE_MODE_SUBTITLE}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                    {/* Admin Mode */}
                    <motion.div animate="visible" custom={0} initial="hidden" variants={cardVariants}>
                        <Card className="h-full border-2 border-teal-200 transition-colors hover:border-teal-400">
                            <CardContent className="flex flex-col gap-3 p-5">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-teal-200 bg-teal-50">
                                    <ShieldCheckIcon className="h-5 w-5 text-teal-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">{MESSAGES.INFO_ADMIN_MODE_TITLE}</h3>
                                    <p className="mt-1 text-sm text-slate-500">{MESSAGES.INFO_ADMIN_MODE_DESC}</p>
                                </div>
                                <ul className="flex flex-1 flex-col gap-1.5">
                                    {ADMIN_BULLETS.map((b) => (
                                        <li className="flex items-center gap-2 text-xs text-slate-600" key={b}>
                                            <CheckIcon className="h-3 w-3 shrink-0 text-teal-500" />
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                                <Button
                                    className="mt-2 w-full bg-teal-600 text-white hover:bg-teal-700"
                                    onClick={() => onSelect('admin')}
                                >
                                    Continue as Admin
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Client Mode */}
                    <motion.div animate="visible" custom={1} initial="hidden" variants={cardVariants}>
                        <Card className="h-full border-2 border-indigo-200 transition-colors hover:border-indigo-400">
                            <CardContent className="flex flex-col gap-3 p-5">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50">
                                    <BriefcaseIcon className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">{MESSAGES.INFO_CLIENT_MODE_TITLE}</h3>
                                    <p className="mt-1 text-sm text-slate-500">{MESSAGES.INFO_CLIENT_MODE_DESC}</p>
                                </div>
                                <ul className="flex flex-1 flex-col gap-1.5">
                                    {CLIENT_BULLETS.map((b) => (
                                        <li className="flex items-center gap-2 text-xs text-slate-600" key={b}>
                                            <CheckIcon className="h-3 w-3 shrink-0 text-indigo-500" />
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                                <Button
                                    className="mt-2 w-full bg-indigo-600 text-white hover:bg-indigo-700"
                                    onClick={() => onSelect('client')}
                                >
                                    Continue as Client
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
