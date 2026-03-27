import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    RefreshCwIcon,
    ToggleLeftIcon,
    ToggleRightIcon,
    Trash2Icon,
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
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { AddLookupDialog } from "@/features/client/components/add-lookup-dialog";
import { DeleteLookupDialog } from "@/features/client/components/delete-lookup-dialog";
import { EditLookupDialog } from "@/features/client/components/edit-lookup-dialog";
import type { LookupConfig, LookupRecord } from "@/features/client/types/lookup";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType<T> = { genericQuery: T[] | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const rowVariants = {
    hidden:  { opacity: 0, y: 6 },
    visible: (i: number) => ({
        opacity:    1,
        transition: { delay: i * 0.04, duration: 0.22, ease: "easeOut" as const },
        y:          0,
    }),
};

// ─── Component ────────────────────────────────────────────────────────────────

type LookupSectionProps = {
    config: LookupConfig;
};

export const LookupSection = ({ config }: LookupSectionProps) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [addOpen,       setAddOpen]       = useState(false);
    const [deleteRecord,  setDeleteRecord]  = useState<LookupRecord | null>(null);
    const [editRecord,    setEditRecord]    = useState<LookupRecord | null>(null);
    const [loading,       setLoading]       = useState(false);
    const [records,       setRecords]       = useState<LookupRecord[]>([]);

    const loadData = useCallback(async () => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryDataType<LookupRecord>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: config.getAllSqlId }),
                },
            });
            setRecords(res.data?.genericQuery ?? []);
        } catch {
            toast.error(config.messages.loadFailed);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, config]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    async function handleToggleActive(record: LookupRecord) {
        if (!dbName || !schema) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: config.tableName,
                        xData: { id: record.id, is_active: !record.is_active },
                    }),
                },
            });
            await loadData();
        } catch {
            toast.error(config.messages.updateFailed);
        }
    }

    if (!schema) {
        return (
            <div className="flex items-center justify-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-20">
                <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--cl-text)]">No Business Unit</p>
                    <p className="mt-2 text-xs text-[var(--cl-text-muted)]">
                        No business unit is assigned. Please contact your administrator.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex flex-col gap-6"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                {/* Page header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-[var(--cl-text)]">{config.sectionTitle}</h1>
                        <p className="mt-1 text-sm text-[var(--cl-text-muted)]">{config.sectionDescription}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            className="gap-1.5 border border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] shadow-sm hover:bg-[var(--cl-surface-3)]"
                            disabled={loading}
                            size="sm"
                            variant="outline"
                            onClick={loadData}
                        >
                            <RefreshCwIcon className="h-3.5 w-3.5" />
                            Refresh
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700"
                            size="sm"
                            onClick={() => setAddOpen(true)}
                        >
                            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                            Add
                        </Button>
                    </div>
                </div>

                {/* Table */}
                {loading && records.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--cl-surface-2)]" />
                        ))}
                    </div>
                ) : records.length === 0 ? (
                    <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-6 py-12 text-center text-sm text-[var(--cl-text-muted)]">
                        No records found. Click &quot;Add&quot; to create one.
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-sm">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-[var(--cl-surface-3)] hover:bg-[var(--cl-surface-3)]">
                                        <TableHead className="w-8 text-center text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">#</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Code</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Name</TableHead>
                                        {config.hasPrefix && (
                                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Prefix</TableHead>
                                        )}
                                        {config.hasDescription && (
                                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Description</TableHead>
                                        )}
                                        {config.hasDisplayOrder && (
                                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Order</TableHead>
                                        )}
                                        {config.hasIsActive && (
                                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Status</TableHead>
                                        )}
                                        {config.hasSystemFlag !== false && (
                                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">System</TableHead>
                                        )}
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {records.map((record, idx) => (
                                        <motion.tr
                                            animate="visible"
                                            className="border-b border-[var(--cl-border)] transition-colors last:border-b-0 hover:bg-[var(--cl-surface-3)]"
                                            custom={idx}
                                            initial="hidden"
                                            key={record.id}
                                            variants={rowVariants}
                                        >
                                            <TableCell className="text-center text-xs text-[var(--cl-text-muted)]">{idx + 1}</TableCell>
                                            <TableCell className="font-mono text-sm font-medium text-[var(--cl-text)]">{record.code}</TableCell>
                                            <TableCell className="font-medium text-[var(--cl-text)]">{record.name}</TableCell>
                                            {config.hasPrefix && (
                                                <TableCell className="font-mono text-sm text-[var(--cl-text-muted)]">{record.prefix ?? "—"}</TableCell>
                                            )}
                                            {config.hasDescription && (
                                                <TableCell className="max-w-xs truncate text-sm text-[var(--cl-text-muted)]">{record.description ?? "—"}</TableCell>
                                            )}
                                            {config.hasDisplayOrder && (
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">{record.display_order ?? "—"}</TableCell>
                                            )}
                                            {config.hasIsActive && (
                                                <TableCell>
                                                    <Badge
                                                        className={record.is_active
                                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                            : "border-red-200 bg-red-100 text-red-500 hover:bg-red-100"}
                                                        variant="outline"
                                                    >
                                                        <span className={`mr-1 h-1.5 w-1.5 rounded-full ${record.is_active ? "bg-emerald-500" : "bg-red-400"}`} />
                                                        {record.is_active ? "Active" : "Inactive"}
                                                    </Badge>
                                                </TableCell>
                                            )}
                                            {config.hasSystemFlag !== false && (
                                                <TableCell>
                                                    {record.is_system ? (
                                                        <Badge
                                                            className="border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100"
                                                            variant="outline"
                                                        >
                                                            System
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-sm text-[var(--cl-text-muted)]">—</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            className="h-7 w-7 cursor-pointer text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]"
                                                            size="icon"
                                                            variant="ghost"
                                                        >
                                                            <MoreHorizontalIcon className="h-4 w-4" />
                                                            <span className="sr-only">Actions</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-44">
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-sky-600 focus:text-sky-600"
                                                            onClick={() => setEditRecord(record)}
                                                        >
                                                            <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        {config.hasIsActive && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                {record.is_active ? (
                                                                    <DropdownMenuItem
                                                                        className="cursor-pointer text-amber-600 focus:text-amber-600"
                                                                        onClick={() => handleToggleActive(record)}
                                                                    >
                                                                        <ToggleLeftIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                        Deactivate
                                                                    </DropdownMenuItem>
                                                                ) : (
                                                                    <DropdownMenuItem
                                                                        className="cursor-pointer text-emerald-600 focus:text-emerald-600"
                                                                        onClick={() => handleToggleActive(record)}
                                                                    >
                                                                        <ToggleRightIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                        Activate
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-red-600 focus:text-red-600"
                                                            onClick={() => setDeleteRecord(record)}
                                                        >
                                                            <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
                                                            Delete
                                                        </DropdownMenuItem>
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
            <AddLookupDialog
                config={config}
                open={addOpen}
                onOpenChange={setAddOpen}
                onSuccess={loadData}
            />
            {editRecord && (
                <EditLookupDialog
                    config={config}
                    open={!!editRecord}
                    record={editRecord}
                    onOpenChange={(o) => { if (!o) setEditRecord(null); }}
                    onSuccess={loadData}
                />
            )}
            {deleteRecord && (
                <DeleteLookupDialog
                    config={config}
                    open={!!deleteRecord}
                    record={deleteRecord}
                    onOpenChange={(o) => { if (!o) setDeleteRecord(null); }}
                    onSuccess={loadData}
                />
            )}
        </>
    );
};
