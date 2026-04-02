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
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { AddVendorDialog } from "./add-vendor-dialog";
import { DeleteVendorDialog } from "./delete-vendor-dialog";
import { EditVendorDialog } from "./edit-vendor-dialog";
import type { VendorType } from "@/features/client/types/vendor";
import type { StateOption } from "@/features/client/types/customer";

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

export const VendorSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [addOpen,       setAddOpen]       = useState(false);
    const [deleteVendor,  setDeleteVendor]  = useState<VendorType | null>(null);
    const [editVendor,    setEditVendor]    = useState<VendorType | null>(null);
    const [loading,       setLoading]       = useState(false);
    const [search,        setSearch]        = useState("");
    const [sortCol,       setSortCol]       = useState<string | null>(null);
    const [sortDir,       setSortDir]       = useState<"asc" | "desc">("asc");
    const [states,        setStates]        = useState<StateOption[]>([]);
    const [vendors,       setVendors]       = useState<VendorType[]>([]);

    const loadData = useCallback(async () => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const [vendorsRes, statesRes] = await Promise.all([
                apolloClient.query<GenericQueryDataType<VendorType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_VENDORS }),
                    },
                }),
                apolloClient.query<GenericQueryDataType<StateOption>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_STATES }),
                    },
                }),
            ]);
            setVendors(vendorsRes.data?.genericQuery ?? []);
            setStates(statesRes.data?.genericQuery ?? []);
        } catch {
            toast.error(MESSAGES.ERROR_VENDOR_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    async function handleToggleActive(vendor: VendorType) {
        if (!dbName || !schema) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "supplier",
                        xData: { id: vendor.id, is_active: !vendor.is_active },
                    }),
                },
            });
            await loadData();
        } catch {
            toast.error(MESSAGES.ERROR_VENDOR_UPDATE_FAILED);
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

    const displayVendors = useMemo(() => {
        let rows = vendors;
        if (search.trim()) {
            const q = search.toLowerCase();
            rows = rows.filter(r =>
                r.name.toLowerCase().includes(q) ||
                (r.phone?.toLowerCase().includes(q) ?? false) ||
                (r.email?.toLowerCase().includes(q) ?? false) ||
                (r.state_name?.toLowerCase().includes(q) ?? false) ||
                (r.city?.toLowerCase().includes(q) ?? false)
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
    }, [vendors, search, sortCol, sortDir]);

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
                        <h1 className="text-xl font-bold text-[var(--cl-text)]">Vendor / Supplier</h1>
                        <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                            Manage vendors / suppliers for this business unit.
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
                            Add Vendor
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
                            placeholder="Search vendors…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    {!loading && vendors.length > 0 && (
                        <p className="shrink-0 text-xs text-[var(--cl-text-muted)]">
                            {displayVendors.length} of {vendors.length}
                        </p>
                    )}
                </div>

                {/* Table */}
                {loading && vendors.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--cl-surface-2)]" />
                        ))}
                    </div>
                ) : vendors.length === 0 ? (
                    <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-6 py-12 text-center text-sm text-[var(--cl-text-muted)]">
                        No vendors found. Click &quot;Add Vendor&quot; to create one.
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
                                        <TableHead className={thSortClass} onClick={() => handleSort("name")}>Name<SortIcon col="name" /></TableHead>
                                        <TableHead className={thClass}>Phone</TableHead>
                                        <TableHead className={thClass}>Email</TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("state_name")}>State<SortIcon col="state_name" /></TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("city")}>City<SortIcon col="city" /></TableHead>
                                        <TableHead className={thClass}>Status</TableHead>
                                        <TableHead className={thClass}>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayVendors.length === 0 ? (
                                        <tr>
                                            <td colSpan={99} className="px-6 py-10 text-center text-sm text-[var(--cl-text-muted)]">
                                                No results match &ldquo;{search}&rdquo;.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayVendors.map((vendor, idx) => (
                                            <motion.tr
                                                animate="visible"
                                                className="border-b border-[var(--cl-border)] transition-colors last:border-b-0 hover:bg-[var(--cl-surface-3)]"
                                                custom={idx}
                                                initial="hidden"
                                                key={vendor.id}
                                                variants={rowVariants}
                                            >
                                                <TableCell className="text-center text-xs text-[var(--cl-text-muted)]">{idx + 1}</TableCell>
                                                <TableCell className="font-medium text-[var(--cl-text)]">{vendor.name}</TableCell>
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">{vendor.phone ?? "—"}</TableCell>
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">{vendor.email ?? "—"}</TableCell>
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">{vendor.state_name ?? "—"}</TableCell>
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">{vendor.city ?? "—"}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        className={vendor.is_active
                                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                            : "border-red-200 bg-red-100 text-red-500 hover:bg-red-100"}
                                                        variant="outline"
                                                    >
                                                        <span className={`mr-1 h-1.5 w-1.5 rounded-full ${vendor.is_active ? "bg-emerald-500" : "bg-red-400"}`} />
                                                        {vendor.is_active ? "Active" : "Inactive"}
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
                                                                onClick={() => setEditVendor(vendor)}
                                                            >
                                                                <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            {vendor.is_active ? (
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-amber-600 focus:text-amber-600"
                                                                    onClick={() => handleToggleActive(vendor)}
                                                                >
                                                                    <ToggleLeftIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                    Deactivate
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-emerald-600 focus:text-emerald-600"
                                                                    onClick={() => handleToggleActive(vendor)}
                                                                >
                                                                    <ToggleRightIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                    Activate
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-red-600 focus:text-red-600"
                                                                onClick={() => setDeleteVendor(vendor)}
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

            {/* ── Dialogs ──────────────────────────────────────────────────────── */}
            <AddVendorDialog
                open={addOpen}
                states={states}
                onOpenChange={setAddOpen}
                onSuccess={loadData}
            />
            {editVendor && (
                <EditVendorDialog
                    open={!!editVendor}
                    states={states}
                    vendor={editVendor}
                    onOpenChange={(o) => { if (!o) setEditVendor(null); }}
                    onSuccess={loadData}
                />
            )}
            {deleteVendor && (
                <DeleteVendorDialog
                    open={!!deleteVendor}
                    vendor={deleteVendor}
                    onOpenChange={(o) => { if (!o) setDeleteVendor(null); }}
                    onSuccess={loadData}
                />
            )}
        </>
    );
};
