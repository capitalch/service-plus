import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    MoreHorizontalIcon,
    PlusIcon,
    RefreshCwIcon,
    Trash2Icon,
    ToggleLeftIcon,
    ToggleRightIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { selectBusinessUnits, setBusinessUnits } from "@/features/admin/store/admin-slice";
import { AdminLayout } from "@/features/admin/components/admin-layout";
import { ActivateBusinessUnitDialog } from "@/features/admin/components/activate-business-unit-dialog";
import { CreateBusinessUnitDialog } from "@/features/admin/components/create-business-unit-dialog";
import { DeactivateBusinessUnitDialog } from "@/features/admin/components/deactivate-business-unit-dialog";
import { DeleteBusinessUnitDialog } from "@/features/admin/components/delete-business-unit-dialog";
import { EditBusinessUnitDialog } from "@/features/admin/components/edit-business-unit-dialog";
import type { BusinessUnitType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType = {
    genericQuery: BusinessUnitType[] | null;
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

export const BusinessUnitsPage = () => {
    const dispatch       = useAppDispatch();
    const dbName         = useAppSelector(selectDbName);
    const businessUnits  = useAppSelector(selectBusinessUnits);

    const [activateBu, setActivateBu]     = useState<BusinessUnitType | null>(null);
    const [createOpen, setCreateOpen]     = useState(false);
    const [deactivateBu, setDeactivateBu] = useState<BusinessUnitType | null>(null);
    const [deleteBu, setDeleteBu]         = useState<BusinessUnitType | null>(null);
    const [editBu, setEditBu]             = useState<BusinessUnitType | null>(null);
    const [loading, setLoading]           = useState(false);

    const loadBusinessUnits = useCallback(async () => {
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
                        sqlId: SQL_MAP.GET_ALL_BUS,
                    }),
                },
            });
            if (result.data?.genericQuery) {
                dispatch(setBusinessUnits(result.data.genericQuery));
            }
        } catch {
            toast.error(MESSAGES.ERROR_BU_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, dispatch]);

    useEffect(() => {
        loadBusinessUnits();
    }, [loadBusinessUnits]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleActivate   = (bu: BusinessUnitType) => setActivateBu(bu);
    const handleCreate     = () => setCreateOpen(true);
    const handleDeactivate = (bu: BusinessUnitType) => setDeactivateBu(bu);
    const handleDelete     = (bu: BusinessUnitType) => setDeleteBu(bu);
    const handleEdit       = (bu: BusinessUnitType) => setEditBu(bu);

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
                        <h1 className="text-xl font-bold text-slate-900">Business Units</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Manage business units for this client.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            className="gap-1.5 border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                            disabled={loading}
                            size="sm"
                            variant="outline"
                            onClick={loadBusinessUnits}
                        >
                            <RefreshCwIcon className="h-3.5 w-3.5" />
                            Refresh
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700"
                            size="sm"
                            onClick={handleCreate}
                        >
                            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                            Add Business Unit
                        </Button>
                    </div>
                </div>

                {/* Table */}
                {loading && businessUnits.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                        ))}
                    </div>
                ) : businessUnits.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400 shadow-sm">
                        No business units found. Click &quot;Add Business Unit&quot; to create one.
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
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Status
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {businessUnits.map((bu, idx) => (
                                        <motion.tr
                                            animate="visible"
                                            className={`border-b transition-colors last:border-b-0 ${
                                                bu.is_active
                                                    ? idx % 2 === 0
                                                        ? "bg-white hover:bg-emerald-50/30"
                                                        : "bg-slate-50/30 hover:bg-emerald-50/30"
                                                    : "border-l-2 border-l-red-300 bg-red-50/40 hover:bg-red-50/60"
                                            }`}
                                            custom={idx}
                                            initial="hidden"
                                            key={bu.id}
                                            variants={rowVariants}
                                        >
                                            <TableCell className="text-center text-xs text-slate-400">
                                                {idx + 1}
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-xs font-semibold uppercase text-slate-700">
                                                    {bu.code}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`font-medium ${bu.is_active ? "text-slate-900" : "text-slate-400 line-through decoration-slate-300"}`}>
                                                {bu.name}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={
                                                        bu.is_active
                                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                            : "border-red-200 bg-red-100 text-red-500 hover:bg-red-100"
                                                    }
                                                    variant="outline"
                                                >
                                                    <span
                                                        className={`mr-1 h-1.5 w-1.5 rounded-full ${
                                                            bu.is_active ? "bg-emerald-500" : "bg-red-400"
                                                        }`}
                                                    />
                                                    {bu.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            className="h-7 w-7 cursor-pointer text-slate-400 hover:text-slate-700"
                                                            size="icon"
                                                            variant="ghost"
                                                        >
                                                            <MoreHorizontalIcon className="h-4 w-4" />
                                                            <span className="sr-only">Actions</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40">
                                                        <DropdownMenuItem
                                                            className="cursor-pointer"
                                                            disabled={!bu.is_active}
                                                            onClick={() => handleEdit(bu)}
                                                        >
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        {bu.is_active ? (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-amber-600 focus:text-amber-600"
                                                                onClick={() => handleDeactivate(bu)}
                                                            >
                                                                <ToggleLeftIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                Deactivate
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-emerald-600 focus:text-emerald-600"
                                                                    onClick={() => handleActivate(bu)}
                                                                >
                                                                    <ToggleRightIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                    Activate
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-red-600 focus:text-red-600"
                                                                    onClick={() => handleDelete(bu)}
                                                                >
                                                                    <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </motion.tr>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* ── Dialogs ──────────────────────────────────────────────────────── */}
            <CreateBusinessUnitDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onSuccess={loadBusinessUnits}
            />
            {editBu && (
                <EditBusinessUnitDialog
                    open={!!editBu}
                    bu={editBu}
                    onOpenChange={(open) => { if (!open) setEditBu(null); }}
                    onSuccess={loadBusinessUnits}
                />
            )}
            {activateBu && (
                <ActivateBusinessUnitDialog
                    open={!!activateBu}
                    bu={activateBu}
                    onOpenChange={(open) => { if (!open) setActivateBu(null); }}
                    onSuccess={loadBusinessUnits}
                />
            )}
            {deactivateBu && (
                <DeactivateBusinessUnitDialog
                    open={!!deactivateBu}
                    bu={deactivateBu}
                    onOpenChange={(open) => { if (!open) setDeactivateBu(null); }}
                    onSuccess={loadBusinessUnits}
                />
            )}
            {deleteBu && (
                <DeleteBusinessUnitDialog
                    open={!!deleteBu}
                    bu={deleteBu}
                    onOpenChange={(open) => { if (!open) setDeleteBu(null); }}
                    onSuccess={loadBusinessUnits}
                />
            )}
        </AdminLayout>
    );
};
