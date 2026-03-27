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
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { AddStateDialog } from "@/features/client/components/add-state-dialog";
import { DeleteStateDialog } from "@/features/client/components/delete-state-dialog";
import { EditStateDialog } from "@/features/client/components/edit-state-dialog";
import type { StateType } from "@/features/client/types/state";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType = { genericQuery: StateType[] | null };

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

export const StateSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [addOpen,      setAddOpen]      = useState(false);
    const [deleteState,  setDeleteState]  = useState<StateType | null>(null);
    const [editState,    setEditState]    = useState<StateType | null>(null);
    const [loading,      setLoading]      = useState(false);
    const [states,       setStates]       = useState<StateType[]>([]);

    const loadStates = useCallback(async () => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const result = await apolloClient.query<GenericQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_STATES_FULL }),
                },
            });
            setStates(result.data?.genericQuery ?? []);
        } catch {
            toast.error(MESSAGES.ERROR_STATE_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        loadStates();
    }, [loadStates]);

    async function handleToggleActive(st: StateType) {
        if (!dbName || !schema) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "state",
                        xData: { id: st.id, is_active: !st.is_active },
                    }),
                },
            });
            await loadStates();
        } catch {
            toast.error(MESSAGES.ERROR_STATE_UPDATE_FAILED);
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
                        <h1 className="text-xl font-bold text-[var(--cl-text)]">States / Provinces</h1>
                        <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                            Manage states and provinces for this business unit.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            className="gap-1.5 border border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] shadow-sm hover:bg-[var(--cl-surface-3)]"
                            disabled={loading}
                            size="sm"
                            variant="outline"
                            onClick={loadStates}
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
                            Add State
                        </Button>
                    </div>
                </div>

                {/* Table */}
                {loading && states.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--cl-surface-2)]" />
                        ))}
                    </div>
                ) : states.length === 0 ? (
                    <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-6 py-12 text-center text-sm text-[var(--cl-text-muted)]">
                        No states found. Click &quot;Add State&quot; to create one.
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
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Country</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">GST Code</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Union Territory</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Status</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {states.map((st, idx) => (
                                        <motion.tr
                                            animate="visible"
                                            className="border-b border-[var(--cl-border)] transition-colors last:border-b-0 hover:bg-[var(--cl-surface-3)]"
                                            custom={idx}
                                            initial="hidden"
                                            key={st.id}
                                            variants={rowVariants}
                                        >
                                            <TableCell className="text-center text-xs text-[var(--cl-text-muted)]">{idx + 1}</TableCell>
                                            <TableCell>
                                                <span className="font-mono text-xs font-semibold text-[var(--cl-text)]">{st.code}</span>
                                            </TableCell>
                                            <TableCell className="font-medium text-[var(--cl-text)]">{st.name}</TableCell>
                                            <TableCell className="text-sm text-[var(--cl-text-muted)]">{st.country_code}</TableCell>
                                            <TableCell className="text-sm text-[var(--cl-text-muted)]">{st.gst_state_code ?? "—"}</TableCell>
                                            <TableCell>
                                                {st.is_union_territory ? (
                                                    <Badge className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50" variant="outline">Yes</Badge>
                                                ) : (
                                                    <span className="text-xs text-[var(--cl-text-muted)]">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={st.is_active
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                        : "border-red-200 bg-red-100 text-red-500 hover:bg-red-100"}
                                                    variant="outline"
                                                >
                                                    <span className={`mr-1 h-1.5 w-1.5 rounded-full ${st.is_active ? "bg-emerald-500" : "bg-red-400"}`} />
                                                    {st.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
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
                                                            onClick={() => setEditState(st)}
                                                        >
                                                            <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        {st.is_active ? (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-amber-600 focus:text-amber-600"
                                                                onClick={() => handleToggleActive(st)}
                                                            >
                                                                <ToggleLeftIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                Deactivate
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-emerald-600 focus:text-emerald-600"
                                                                onClick={() => handleToggleActive(st)}
                                                            >
                                                                <ToggleRightIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                Activate
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-red-600 focus:text-red-600"
                                                            onClick={() => setDeleteState(st)}
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
            <AddStateDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                onSuccess={loadStates}
            />
            {editState && (
                <EditStateDialog
                    state={editState}
                    open={!!editState}
                    onOpenChange={(o) => { if (!o) setEditState(null); }}
                    onSuccess={loadStates}
                />
            )}
            {deleteState && (
                <DeleteStateDialog
                    state={deleteState}
                    open={!!deleteState}
                    onOpenChange={(o) => { if (!o) setDeleteState(null); }}
                    onSuccess={loadStates}
                />
            )}
        </>
    );
};
