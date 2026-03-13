import { motion } from "framer-motion";
import { BriefcaseIcon, ShieldCheckIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentUser, setSessionMode } from "@/features/auth/store/auth-slice";
import { ROUTES } from "@/router/routes";

export const ClientDashboardPage = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const user     = useAppSelector(selectCurrentUser);
    const isAdmin  = user?.userType === 'A';

    function handleSwitchToAdmin() {
        dispatch(setSessionMode('admin'));
        navigate(ROUTES.admin.root);
    }

    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
                        <span className="text-xs font-bold text-white">S+</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">Service+</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                        {user?.fullName ?? user?.username}
                    </span>
                    {isAdmin && (
                        <Button
                            className="h-7 gap-1.5 border-teal-200 px-2.5 text-xs text-teal-700 hover:bg-teal-50"
                            onClick={handleSwitchToAdmin}
                            size="sm"
                            variant="outline"
                        >
                            <ShieldCheckIcon className="h-3 w-3" />
                            Switch to Admin Mode
                        </Button>
                    )}
                </div>
            </header>

            {/* Content */}
            <main className="flex flex-1 items-center justify-center p-6">
                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-lg"
                    initial={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.3 }}
                >
                    <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100">
                                <BriefcaseIcon className="h-7 w-7 text-indigo-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    Welcome, {user?.fullName ?? user?.username}
                                </h2>
                                <p className="mt-1.5 text-sm text-slate-500">
                                    You are working in Client Mode. The service management features
                                    (customers, service orders, repairs) will be available here.
                                </p>
                            </div>
                            <div className="mt-2 w-full rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-600">
                                Client dashboard features are coming soon.
                            </div>
                            {isAdmin && (
                                <Button
                                    className="gap-2 border-teal-200 text-teal-700 hover:bg-teal-50"
                                    onClick={handleSwitchToAdmin}
                                    variant="outline"
                                >
                                    <ShieldCheckIcon className="h-4 w-4" />
                                    Switch to Admin Mode
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </main>
        </div>
    );
};
