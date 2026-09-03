import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    ImageIcon,
    ImageOffIcon,
    MapPinIcon,
    MoreHorizontalIcon,
    PackageIcon,
    PencilIcon,
    PlusIcon,
    SearchIcon,
    ToggleLeftIcon,
    ToggleRightIcon,
    Trash2Icon,
    X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/shared/refresh-button";
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
import { getApiBaseUrl } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { DeleteSparePartWebDialog } from "./delete-spare-part-web-dialog";
import { SparePartWebDialog } from "./spare-part-web-dialog";
import { SparePartWebPhotosDialog } from "./spare-part-web-photos-dialog";
import type { SparePartWebType } from "@/features/client/types/spare-part-web";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType<T> = { genericQuery: T[] | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const rowVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.04, duration: 0.22, ease: "easeOut" as const },
        y: 0,
    }),
};

const thClass = "text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted)";

// ─── Component ────────────────────────────────────────────────────────────────

export const SparePartWebSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const [addOpen, setAddOpen] = useState(false);
    const [deletePart, setDeletePart] = useState<SparePartWebType | null>(null);
    const [editPart, setEditPart] = useState<SparePartWebType | null>(null);
    const [photosPart, setPhotosPart] = useState<SparePartWebType | null>(null);
    const [loading, setLoading] = useState(false);
    const [parts, setParts] = useState<SparePartWebType[]>([]);
    const [search, setSearch] = useState("");

    const loadData = useCallback(async () => {
        if (!dbName || !schema || !currentBranch) return;
        setLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryDataType<SparePartWebType>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: currentBranch.id },
                        sqlId: SQL_MAP.GET_SPARE_PART_WEB_BY_BRANCH,
                    }),
                },
            });
            setParts(res.data?.genericQuery ?? []);
        } catch {
            toast.error(MESSAGES.ERROR_SPARE_PART_WEB_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, currentBranch]);

    // Reacts to a branch switch (top-nav switcher) by refetching, never showing a stale list.
    useEffect(() => { loadData(); }, [loadData]);

    async function handleToggleActive(part: SparePartWebType) {
        if (!dbName || !schema || !currentBranch) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "spare_part_web",
                        xData: { id: part.id, is_active: !part.is_active },
                    }),
                },
            });
            await loadData();
        } catch {
            toast.error(MESSAGES.ERROR_SPARE_PART_WEB_UPDATE_FAILED);
        }
    }

    // part_ids already linked in this branch — disables them in the dialog's autocomplete
    // (spare_part_web_branch_part_uq allows a part to be linked only once per branch).
    const existingPartIds = useMemo(
        () => parts.map(p => p.part_id).filter((id): id is number => id != null),
        [parts]
    );

    const displayParts = useMemo(() => {
        if (!search.trim()) return parts;
        const q = search.toLowerCase();
        return parts.filter(p =>
            p.part_name.toLowerCase().includes(q) ||
            (p.part_description?.toLowerCase().includes(q) ?? false) ||
            (p.model?.toLowerCase().includes(q) ?? false)
        );
    }, [parts, search]);

    // ── No BU guard ───────────────────────────────────────────────────────────

    if (!schema) {
        return (
            <div className="flex items-center justify-center rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-20">
                <div className="text-center">
                    <p className="text-sm font-semibold text-(--cl-text)">No Business Unit</p>
                    <p className="mt-2 text-xs text-(--cl-text-muted)">
                        No business unit is assigned. Please contact your administrator.
                    </p>
                </div>
            </div>
        );
    }

    if (!currentBranch) {
        return (
            <div className="flex items-center justify-center rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-20">
                <div className="text-center">
                    <p className="text-sm font-semibold text-(--cl-text)">No Branch Selected</p>
                    <p className="mt-2 text-xs text-(--cl-text-muted)">
                        Select a branch from the top navigation to manage its web parts.
                    </p>
                </div>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Page header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-(--cl-text)">Spare Parts Web</h1>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-(--cl-text-muted)">
                        <MapPinIcon className="h-3.5 w-3.5 text-indigo-600" />
                        {currentBranch.name}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <RefreshButton loading={loading} onClick={loadData} />
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
                    <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <Input
                        className="h-8 pl-8 text-sm"
                        disabled={loading}
                        placeholder="Search by part name, description or model…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button
                            className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text) focus:outline-none"
                            type="button"
                            onClick={() => setSearch("")}
                        >
                            <X className="h-2.5 w-2.5 text-muted-foreground" />
                        </button>
                    )}
                </div>
                {!loading && parts.length > 0 && (
                    <p className="shrink-0 text-xs text-(--cl-text-muted)">
                        {displayParts.length} of {parts.length}
                    </p>
                )}
            </div>

            {/* Table */}
            {loading && parts.length === 0 ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-lg bg-(--cl-surface-2)" />
                    ))}
                </div>
            ) : parts.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-(--cl-border) bg-(--cl-surface-2) px-6 py-12 text-center">
                    <div>
                        <PackageIcon className="mx-auto h-8 w-8 text-(--cl-text-muted)" />
                        <p className="mt-2 text-sm text-(--cl-text-muted)">
                            No web parts for {currentBranch.name} yet.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-(--cl-border) bg-(--cl-surface-2) shadow-sm">
                    <div className="overflow-x-auto overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="sticky top-0 z-10 bg-(--cl-surface-3) hover:bg-(--cl-surface-3)">
                                    <TableHead className={`w-8 text-center ${thClass}`}>#</TableHead>
                                    <TableHead className={`w-14 ${thClass}`}>Photo</TableHead>
                                    <TableHead className={thClass}>Brand</TableHead>
                                    <TableHead className={thClass}>Part Code</TableHead>
                                    <TableHead className={thClass}>Part Details</TableHead>
                                    <TableHead className={thClass}>Model</TableHead>
                                    <TableHead className={`text-right ${thClass}`}>Price</TableHead>
                                    <TableHead className={thClass}>HSN</TableHead>
                                    <TableHead className={thClass}>Status</TableHead>
                                    <TableHead className={thClass}>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayParts.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-10 text-center text-sm text-(--cl-text-muted)">
                                            No results match &ldquo;{search}&rdquo;.
                                        </td>
                                    </tr>
                                ) : (
                                    displayParts.map((part, idx) => (
                                        <motion.tr
                                            animate="visible"
                                            className="border-b border-(--cl-border) transition-colors last:border-b-0 hover:bg-(--cl-surface-3)"
                                            custom={idx}
                                            initial="hidden"
                                            key={part.id}
                                            variants={rowVariants}
                                        >
                                            <TableCell className="text-center text-xs text-(--cl-text-muted)">
                                                {idx + 1}
                                            </TableCell>
                                            <TableCell>
                                                {part.thumbnail_url ? (
                                                    <img
                                                        alt={part.part_name}
                                                        className="h-10 w-10 rounded-md border border-(--cl-border) object-cover"
                                                        src={`${getApiBaseUrl()}/api/images/${part.thumbnail_url}`}
                                                    />
                                                ) : (
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-(--cl-border) bg-(--cl-surface-3)">
                                                        <ImageOffIcon className="h-4 w-4 text-(--cl-text-muted)" />
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-(--cl-text-muted)">
                                                {part.brand_name ?? "—"}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm text-(--cl-text-muted)">
                                                {part.part_code ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-sm font-medium text-(--cl-text)">
                                                {part.part_name}
                                                {part.part_description && (
                                                    <p className="mt-0.5 max-w-xs truncate text-xs text-(--cl-text-muted)">
                                                        {part.part_description}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-(--cl-text-muted)">
                                                {part.model ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-sm text-(--cl-text-muted)">
                                                {part.price != null ? part.price.toFixed(2) : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm text-(--cl-text-muted)">
                                                {part.hsn_code ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={part.is_active
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                        : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100"}
                                                    variant="outline"
                                                >
                                                    <span className={`mr-1 h-1.5 w-1.5 rounded-full ${part.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                                                    {part.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            className="h-7 w-7 cursor-pointer text-(--cl-text-muted) hover:text-(--cl-text)"
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
                                                            <PencilIcon className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-violet-600 focus:text-violet-600"
                                                            onClick={() => setPhotosPart(part)}
                                                        >
                                                            <ImageIcon className="mr-1.5 h-3.5 w-3.5 text-violet-600" />
                                                            Photos
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
                                                            <Trash2Icon className="mr-1.5 h-3.5 w-3.5 text-red-600" />
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

            <SparePartWebDialog
                existingPartIds={existingPartIds}
                mode="add"
                open={addOpen}
                onOpenChange={setAddOpen}
                onSuccess={loadData}
            />
            {editPart && (
                <SparePartWebDialog
                    existingPartIds={existingPartIds}
                    mode="edit"
                    open={!!editPart}
                    part={editPart}
                    onOpenChange={(o) => { if (!o) setEditPart(null); }}
                    onSuccess={loadData}
                />
            )}
            {photosPart && (
                <SparePartWebPhotosDialog
                    open={!!photosPart}
                    part={photosPart}
                    onOpenChange={(o) => { if (!o) setPhotosPart(null); }}
                    onSuccess={loadData}
                />
            )}
            {deletePart && (
                <DeleteSparePartWebDialog
                    open={!!deletePart}
                    part={deletePart}
                    onOpenChange={(o) => { if (!o) setDeletePart(null); }}
                    onSuccess={loadData}
                />
            )}
        </motion.div>
    );
};
