import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    ArrowDownIcon,
    ArrowUpDownIcon,
    ArrowUpIcon,
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    RefreshCwIcon,
    SearchIcon,
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
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { AddPartDialog } from "@/features/client/components/add-part-dialog";
import { DeletePartDialog } from "@/features/client/components/delete-part-dialog";
import { EditPartDialog } from "@/features/client/components/edit-part-dialog";
import type { BrandOption } from "@/features/client/types/model";
import type { PartType } from "@/features/client/types/part";

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

const thClass     = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]";
const thSortClass = `${thClass} cursor-pointer select-none hover:text-[var(--cl-text)]`;

// ─── Component ────────────────────────────────────────────────────────────────

export const PartsSection = () => {
    const dbName  = useAppSelector(selectDbName);
    const schema_ = useAppSelector(selectSchema);

    const [addOpen,     setAddOpen]     = useState(false);
    const [brands,      setBrands]      = useState<BrandOption[]>([]);
    const [deletePart,  setDeletePart]  = useState<PartType | null>(null);
    const [editPart,    setEditPart]    = useState<PartType | null>(null);
    const [loading,     setLoading]     = useState(false);
    const [parts,       setParts]       = useState<PartType[]>([]);
    const [search,      setSearch]      = useState("");
    const [sortCol,     setSortCol]     = useState<string | null>(null);
    const [sortDir,     setSortDir]     = useState<"asc" | "desc">("asc");

    const loadData = useCallback(async () => {
        if (!dbName || !schema_) return;
        setLoading(true);
        try {
            const [partsRes, brandsRes] = await Promise.all([
                apolloClient.query<GenericQueryDataType<PartType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema:  schema_,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_PARTS }),
                    },
                }),
                apolloClient.query<GenericQueryDataType<BrandOption>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema:  schema_,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
                    },
                }),
            ]);
            setParts(partsRes.data?.genericQuery ?? []);
            setBrands(brandsRes.data?.genericQuery ?? []);
        } catch {
            toast.error("Failed to load parts. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [dbName, schema_]);

    useEffect(() => { loadData(); }, [loadData]);

    async function handleToggleActive(part: PartType) {
        if (!dbName || !schema_) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "spare_part_master",
                        xData: { id: part.id, is_active: !part.is_active },
                    }),
                },
            });
            await loadData();
        } catch {
            toast.error("Failed to update part. Please try again.");
        }
    }

    function handleSort(col: string) {
        if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortCol(col); setSortDir("asc"); }
    }

    function SortIcon({ col }: { col: string }) {
        if (sortCol !== col) return <ArrowUpDownIcon className="ml-1 inline h-3 w-3 opacity-40" />;
        return sortDir === "asc"
            ? <ArrowUpIcon   className="ml-1 inline h-3 w-3" />
            : <ArrowDownIcon className="ml-1 inline h-3 w-3" />;
    }

    const displayParts = useMemo(() => {
        let rows = parts;
        if (search.trim()) {
            const q = search.toLowerCase();
            rows = rows.filter(r =>
                (r.brand_name?.toLowerCase().includes(q) ?? false) ||
                r.part_code.toLowerCase().includes(q) ||
                r.part_name.toLowerCase().includes(q) ||
                (r.category?.toLowerCase().includes(q) ?? false)
            );
        }
        if (sortCol) {
            rows = [...rows].sort((a, b) => {
                const av = (a as Record<string, unknown>)[sortCol];
                const bv = (b as Record<string, unknown>)[sortCol];
                if (av == null) return 1;
                if (bv == null) return -1;
                const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
                return sortDir === "asc" ? cmp : -cmp;
            });
        }
        return rows;
    }, [parts, search, sortCol, sortDir]);

    if (!schema_) {
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
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-[var(--cl-text)]">Parts</h1>
                        <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                            Manage spare parts and components.
                        </p>
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
                            Add Part
                        </Button>
                    </div>
                </div>

                {/* Search + count */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                        <Input
                            className="h-8 pl-8 text-sm"
                            disabled={loading}
                            placeholder="Search parts…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    {!loading && parts.length > 0 && (
                        <p className="shrink-0 text-xs text-[var(--cl-text-muted)]">
                            {displayParts.length} of {parts.length}
                        </p>
                    )}
                </div>

                {loading && parts.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--cl-surface-2)]" />
                        ))}
                    </div>
                ) : parts.length === 0 ? (
                    <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-6 py-12 text-center text-sm text-[var(--cl-text-muted)]">
                        No parts found. Click &quot;Add Part&quot; to create one.
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
                                        <TableHead className={thSortClass} onClick={() => handleSort("brand_name")}>Brand<SortIcon col="brand_name" /></TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("part_code")}>Part Code<SortIcon col="part_code" /></TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("part_name")}>Part Name<SortIcon col="part_name" /></TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("category")}>Category<SortIcon col="category" /></TableHead>
                                        <TableHead className={thClass}>UOM</TableHead>
                                        <TableHead className={thClass}>MRP</TableHead>
                                        <TableHead className={thClass}>GST%</TableHead>
                                        <TableHead className={thClass}>Status</TableHead>
                                        <TableHead className={thClass}>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayParts.length === 0 ? (
                                        <tr>
                                            <td colSpan={99} className="px-6 py-10 text-center text-sm text-[var(--cl-text-muted)]">
                                                No results match &ldquo;{search}&rdquo;.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayParts.map((part, idx) => (
                                            <motion.tr
                                                animate="visible"
                                                className="border-b border-[var(--cl-border)] transition-colors last:border-b-0 hover:bg-[var(--cl-surface-3)]"
                                                custom={idx}
                                                initial="hidden"
                                                key={part.id}
                                                variants={rowVariants}
                                            >
                                                <TableCell className="text-center text-xs text-[var(--cl-text-muted)]">{idx + 1}</TableCell>
                                                <TableCell className="font-mono text-sm text-[var(--cl-text-muted)]">{part.brand_name ?? "—"}</TableCell>
                                                <TableCell className="font-mono text-sm font-medium text-[var(--cl-text)]">{part.part_code}</TableCell>
                                                <TableCell className="max-w-xs truncate text-sm text-[var(--cl-text)]">{part.part_name}</TableCell>
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">{part.category ?? "—"}</TableCell>
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">{part.uom}</TableCell>
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">
                                                    {part.mrp != null ? part.mrp.toFixed(2) : "—"}
                                                </TableCell>
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">
                                                    {part.gst_rate != null ? `${part.gst_rate}%` : "—"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        className={part.is_active
                                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                            : "border-red-200 bg-red-100 text-red-500 hover:bg-red-100"}
                                                        variant="outline"
                                                    >
                                                        <span className={`mr-1 h-1.5 w-1.5 rounded-full ${part.is_active ? "bg-emerald-500" : "bg-red-400"}`} />
                                                        {part.is_active ? "Active" : "Inactive"}
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
                                                                onClick={() => setEditPart(part)}
                                                            >
                                                                <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            {part.is_active ? (
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-amber-600 focus:text-amber-600"
                                                                    onClick={() => handleToggleActive(part)}
                                                                >
                                                                    <ToggleLeftIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                    Deactivate
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-emerald-600 focus:text-emerald-600"
                                                                    onClick={() => handleToggleActive(part)}
                                                                >
                                                                    <ToggleRightIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                    Activate
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-red-600 focus:text-red-600"
                                                                onClick={() => setDeletePart(part)}
                                                            >
                                                                <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </motion.tr>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </motion.div>

            <AddPartDialog
                brands={brands}
                open={addOpen}
                onOpenChange={setAddOpen}
                onSuccess={loadData}
            />
            {editPart && (
                <EditPartDialog
                    brands={brands}
                    open={!!editPart}
                    part={editPart}
                    onOpenChange={(o) => { if (!o) setEditPart(null); }}
                    onSuccess={loadData}
                />
            )}
            {deletePart && (
                <DeletePartDialog
                    open={!!deletePart}
                    part={deletePart}
                    onOpenChange={(o) => { if (!o) setDeletePart(null); }}
                    onSuccess={loadData}
                />
            )}
        </>
    );
};
