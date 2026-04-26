import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {ArrowDownIcon,
    ArrowUpDownIcon,
    ArrowUpIcon,
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    RefreshCwIcon,
    SearchIcon,
    ToggleLeftIcon,
    ToggleRightIcon,
    Trash2Icon, X} from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { AddLookupDialog } from "./add-lookup-dialog";
import { DeleteLookupDialog } from "./delete-lookup-dialog";
import { EditLookupDialog } from "./edit-lookup-dialog";
import type { LookupConfig, LookupRecord } from "@/features/client/types/lookup";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType<T> = { genericQuery: T[] | null };
type SortDir = "asc" | "desc";

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
    const dbName      = useAppSelector(selectDbName);
    const schema      = useAppSelector(selectSchema);
    const currentUser = useAppSelector(selectCurrentUser);
    const isAdmin     = currentUser?.userType === 'A' || currentUser?.userType === 'S';

    const [addOpen,      setAddOpen]      = useState(false);
    const [deleteRecord, setDeleteRecord] = useState<LookupRecord | null>(null);
    const [editRecord,   setEditRecord]   = useState<LookupRecord | null>(null);
    const [loading,      setLoading]      = useState(false);
    const [records,      setRecords]      = useState<LookupRecord[]>([]);
    const [search,       setSearch]       = useState("");
    const [sortCol,      setSortCol]      = useState<string | null>(null);
    const [sortDir,      setSortDir]      = useState<SortDir>("asc");

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

    function handleSort(col: string) {
        if (sortCol === col) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortCol(col);
            setSortDir("asc");
        }
    }

    function SortIcon({ col }: { col: string }) {
        if (sortCol !== col) return <ArrowUpDownIcon className="ml-1 inline h-3 w-3 opacity-40" />;
        return sortDir === "asc"
            ? <ArrowUpIcon   className="ml-1 inline h-3 w-3" />
            : <ArrowDownIcon className="ml-1 inline h-3 w-3" />;
    }

    // ── Derived: filter + sort ─────────────────────────────────────────────────

    const visibleRecords = useMemo(
        () => records.filter(r => isAdmin || !r.is_system),
        [records, isAdmin]
    );

    const displayRecords = useMemo(() => {
        let rows = visibleRecords;

        if (search.trim()) {
            const q = search.toLowerCase();
            rows = rows.filter(r =>
                r.code.toLowerCase().includes(q) ||
                r.name.toLowerCase().includes(q) ||
                (r.description?.toLowerCase().includes(q) ?? false) ||
                (r.prefix?.toLowerCase().includes(q) ?? false)
            );
        }

        if (sortCol) {
            rows = [...rows].sort((a, b) => {
                const av = (a as Record<string, unknown>)[sortCol];
                const bv = (b as Record<string, unknown>)[sortCol];
                if (av == null) return 1;
                if (bv == null) return -1;
                const cmp = typeof av === "number"
                    ? av - (bv as number)
                    : String(av).localeCompare(String(bv));
                return sortDir === "asc" ? cmp : -cmp;
            });
        }

        return rows;
    }, [visibleRecords, search, sortCol, sortDir]);

    // ── Sortable header helper ─────────────────────────────────────────────────

    const thClass = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]";
    const thSortClass = `${thClass} cursor-pointer select-none hover:text-[var(--cl-text)]`;

    // ── No schema ──────────────────────────────────────────────────────────────

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
                className="flex min-h-0 flex-1 flex-col gap-4"
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
                        {!config.readonly && (
                            <Button
                                className="bg-teal-600 text-white hover:bg-teal-700"
                                size="sm"
                                onClick={() => setAddOpen(true)}
                            >
                                <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                                Add {config.entityName}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Search + record count */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                        <Input
                            className="h-8 pl-8 text-sm"
                            disabled={loading}
                            placeholder={`Search ${config.sectionTitle.toLowerCase()}…`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                            {search && (
                                <button
                                    className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--cl-text-muted)] text-[var(--cl-surface)] hover:bg-[var(--cl-text)] focus:outline-none"
                                    type="button"
                                    onClick={() => setSearch("")}
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            )}
                    </div>
                    {!loading && records.length > 0 && (
                        <p className="shrink-0 text-xs text-[var(--cl-text-muted)]">
                            {displayRecords.length} of {visibleRecords.length}
                        </p>
                    )}
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
                    <div
                        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-sm"
                    >
                        <div className="overflow-x-auto overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="sticky top-0 z-10 bg-[var(--cl-surface-3)] hover:bg-[var(--cl-surface-3)]">
                                        <TableHead className={`w-8 text-center ${thClass}`}>#</TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("code")}>
                                            Code<SortIcon col="code" />
                                        </TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("name")}>
                                            Name<SortIcon col="name" />
                                        </TableHead>
                                        {config.hasPrefix && (
                                            <TableHead className={thSortClass} onClick={() => handleSort("prefix")}>
                                                Prefix<SortIcon col="prefix" />
                                            </TableHead>
                                        )}
                                        {config.hasDescription && (
                                            <TableHead className={thSortClass} onClick={() => handleSort("description")}>
                                                Description<SortIcon col="description" />
                                            </TableHead>
                                        )}
                                        {config.hasDisplayOrder && (
                                            <TableHead className={thSortClass} onClick={() => handleSort("display_order")}>
                                                Order<SortIcon col="display_order" />
                                            </TableHead>
                                        )}
                                        {config.hasIsActive && (
                                            <TableHead className={thClass}>Status</TableHead>
                                        )}
                                        {config.hasSystemFlag !== false && (
                                            <TableHead className={thClass}>System</TableHead>
                                        )}
                                        {!config.readonly && (
                                            <TableHead className={thClass}>Actions</TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayRecords.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={99}
                                                className="px-6 py-10 text-center text-sm text-[var(--cl-text-muted)]"
                                            >
                                                No results match &ldquo;{search}&rdquo;.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayRecords.map((record, idx) => (
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
                                                {!config.readonly && (
                                                    <TableCell>
                                                        {(!record.is_system || config.hasIsActive) && (
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
                                                                    {!record.is_system && (
                                                                        <DropdownMenuItem
                                                                            className="cursor-pointer text-sky-600 focus:text-sky-600"
                                                                            onClick={() => setEditRecord(record)}
                                                                        >
                                                                            <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                            Edit
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {config.hasIsActive && (
                                                                        <>
                                                                            {!record.is_system && <DropdownMenuSeparator />}
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
                                                                    {!record.is_system && (
                                                                        <>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                className="cursor-pointer text-red-600 focus:text-red-600"
                                                                                onClick={() => setDeleteRecord(record)}
                                                                            >
                                                                                <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </TableCell>
                                                )}
                                            </motion.tr>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* ── Dialogs ──────────────────────────────────────────────────────── */}
            {!config.readonly && (
                <AddLookupDialog
                    config={config}
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    onSuccess={loadData}
                />
            )}
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
