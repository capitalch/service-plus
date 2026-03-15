import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { InfoIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectRoles, setRoles } from "@/features/admin/store/admin-slice";
import { AdminLayout } from "@/features/admin/components/admin-layout";
import type { RoleType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType = {
    genericQuery: RoleType[] | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const rowVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.04, duration: 0.22, ease: "easeOut" as const },
        y: 0,
    }),
};

// ─── Component ────────────────────────────────────────────────────────────────

export const RolesPage = () => {
    const dispatch = useAppDispatch();
    const dbName   = useAppSelector(selectDbName);
    const roles    = useAppSelector(selectRoles);

    const [loading, setLoading] = useState(false);

    const loadRoles = useCallback(async () => {
        if (!dbName) return;
        setLoading(true);
        try {
            const result = await apolloClient.query<GenericQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_ALL_ROLES,
                    }),
                },
            });
            if (result.data?.genericQuery) {
                dispatch(setRoles(result.data.genericQuery));
            }
        } catch {
            toast.error(MESSAGES.ERROR_ROLES_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, dispatch]);

    useEffect(() => {
        loadRoles();
    }, [loadRoles]);

    return (
        <AdminLayout>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex flex-col gap-6"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                {/* Page header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Roles</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            System-defined roles available for assignment to business users.
                        </p>
                    </div>
                    <Button
                        className="gap-1.5 border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                        disabled={loading}
                        size="sm"
                        variant="outline"
                        onClick={loadRoles}
                    >
                        <RefreshCwIcon className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                </div>

                {/* Info banner */}
                <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 shadow-sm">
                    <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <span>
                        Roles are system-defined and cannot be added, edited, or deleted. Assign roles to
                        business users via the <strong>Business Users</strong> page.
                    </span>
                </div>

                {/* Table */}
                {loading && roles.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                        ))}
                    </div>
                ) : roles.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400 shadow-sm">
                        No roles found.
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                        <TableHead className="w-8 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            #
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Code
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Name
                                        </TableHead>
                                        <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">
                                            Description
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Type
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {roles.map((role, idx) => (
                                        <motion.tr
                                            animate="visible"
                                            className={`border-b transition-colors last:border-b-0 ${
                                                idx % 2 === 0
                                                    ? "bg-white hover:bg-slate-50/40"
                                                    : "bg-slate-50/30 hover:bg-slate-50/40"
                                            }`}
                                            custom={idx}
                                            initial="hidden"
                                            key={role.id}
                                            variants={rowVariants}
                                        >
                                            <TableCell className="text-center text-xs text-slate-400">
                                                {idx + 1}
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-xs font-semibold uppercase text-slate-700">
                                                    {role.code}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheckIcon className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                                                    {role.name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden text-sm text-slate-500 sm:table-cell">
                                                {role.description ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                                {role.is_system ? (
                                                    <Badge
                                                        className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50"
                                                        variant="outline"
                                                    >
                                                        System
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        className="border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50"
                                                        variant="outline"
                                                    >
                                                        Custom
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </motion.tr>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </motion.div>
        </AdminLayout>
    );
};
