import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    RefreshCwIcon,
    SearchIcon,
    ToggleLeftIcon,
    ToggleRightIcon,
    Trash2Icon,
    UploadIcon,
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
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { AddPartDialog } from "./add-part-dialog";
import { DeleteBrandPartsWizardDialog } from "./delete-brand-parts-wizard-dialog";
import { DeletePartDialog } from "./delete-part-dialog";
import { EditPartDialog } from "./edit-part-dialog";
import { ImportPartDialog } from "./import-part-dialog";
import type { BrandOption } from "@/features/client/types/model";
import type { PartType } from "@/features/client/types/part";

// ─── Types ────────────────────────────────────────────────────────────────────

type CountRowType             = { total: number };
type GenericQueryDataType<T>  = { genericQuery: T[] | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 1200;
const PAGE_SIZE   = 50;

const rowVariants = {
    hidden:  { opacity: 0, y: 4 },
    visible: (i: number) => ({
        opacity:    1,
        transition: { delay: i * 0.03, duration: 0.18, ease: "easeOut" as const },
        y:          0,
    }),
};

const thClass = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const PartsSection = () => {
    const dbName  = useAppSelector(selectDbName);
    const schema_ = useAppSelector(selectSchema);

    // Brand
    const [brands,        setBrands]        = useState<BrandOption[]>([]);
    const [brandsLoading, setBrandsLoading] = useState(false);
    const [selectedBrand, setSelectedBrand] = useState<BrandOption | null>(null);

    // Parts
    const [addOpen,      setAddOpen]      = useState(false);
    const [cleanUpOpen,  setCleanUpOpen]  = useState(false);
    const [deletePart,   setDeletePart]   = useState<PartType | null>(null);
    const [editPart,     setEditPart]     = useState<PartType | null>(null);
    const [importOpen,   setImportOpen]   = useState(false);
    const [page,         setPage]         = useState(1);
    const [parts,        setParts]        = useState<PartType[]>([]);
    const [partsLoading, setPartsLoading] = useState(false);
    const [search,       setSearch]       = useState("");
    const [searchQ,      setSearchQ]      = useState("");
    const [total,        setTotal]        = useState(0);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ── Load brands ───────────────────────────────────────────────────────────

    const loadBrands = useCallback(async () => {
        if (!dbName || !schema_) return;
        setBrandsLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryDataType<BrandOption>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
                },
            });
            const list = res.data?.genericQuery ?? [];
            setBrands(list);
            if (list.length > 0) setSelectedBrand(list[0]);
        } catch {
            toast.error("Failed to load brands. Please try again.");
        } finally {
            setBrandsLoading(false);
        }
    }, [dbName, schema_]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { loadBrands(); }, [loadBrands]);

    // ── Load parts ────────────────────────────────────────────────────────────

    const loadParts = useCallback(async (brand: BrandOption, currentPage: number, q: string) => {
        if (!dbName || !schema_) return;
        setPartsLoading(true);
        try {
            const offset  = (currentPage - 1) * PAGE_SIZE;
            const sqlArgs = { brand_id: brand.id, limit: PAGE_SIZE, offset, search: q };

            const [partsRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryDataType<PartType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema:  schema_,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs,
                            sqlId: SQL_MAP.GET_PARTS_BY_BRAND_PAGED,
                        }),
                    },
                }),
                apolloClient.query<GenericQueryDataType<CountRowType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema:  schema_,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs: { brand_id: brand.id, search: q },
                            sqlId: SQL_MAP.GET_PARTS_BY_BRAND_COUNT,
                        }),
                    },
                }),
            ]);

            setParts(partsRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch {
            toast.error("Failed to load parts. Please try again.");
        } finally {
            setPartsLoading(false);
        }
    }, [dbName, schema_]);

    useEffect(() => {
        if (selectedBrand) loadParts(selectedBrand, page, searchQ);
    }, [loadParts, selectedBrand, page, searchQ]);

    // Debounce search — resets to page 1
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPage(1);
            setSearchQ(search);
        }, DEBOUNCE_MS);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleBrandChange(brandId: string) {
        const brand = brands.find(b => String(b.id) === brandId) ?? null;
        if (!brand || brand.id === selectedBrand?.id) return;
        setSelectedBrand(brand);
        setPage(1);
        setSearch("");
        setSearchQ("");
        setParts([]);
        setTotal(0);
    }

    async function handleToggleActive(part: PartType) {
        if (!dbName || !schema_ || !selectedBrand) return;
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
            await loadParts(selectedBrand, page, searchQ);
        } catch {
            toast.error("Failed to update part. Please try again.");
        }
    }

    // ── No BU guard ───────────────────────────────────────────────────────────

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

    // ── Derived ───────────────────────────────────────────────────────────────

    const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to   = Math.min(page * PAGE_SIZE, total);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex min-h-0 flex-1 flex-col gap-3"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                {/* Toolbar row */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Brand dropdown */}
                    <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-semibold text-[var(--cl-text-muted)] whitespace-nowrap">
                            Brand <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            disabled={brandsLoading || brands.length === 0}
                            value={selectedBrand ? String(selectedBrand.id) : ""}
                            onValueChange={handleBrandChange}
                        >
                            <SelectTrigger className="h-9 w-52 text-sm">
                                <SelectValue placeholder={brandsLoading ? "Loading…" : "Select brand"} />
                            </SelectTrigger>
                            <SelectContent>
                                {brands.map(b => (
                                    <SelectItem key={b.id} value={String(b.id)}>
                                        {b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Part count */}
                    {selectedBrand && !partsLoading && (
                        <span className="text-xs text-[var(--cl-text-muted)]">
                            {total} part{total !== 1 ? "s" : ""}
                        </span>
                    )}

                    {/* Push action buttons to the right */}
                    <div className="ml-auto flex items-center gap-2">
                        <Button
                            className="gap-1.5 border border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] shadow-sm hover:bg-[var(--cl-surface-3)]"
                            disabled={!selectedBrand || partsLoading}
                            size="sm"
                            variant="outline"
                            onClick={() => selectedBrand && loadParts(selectedBrand, page, searchQ)}
                        >
                            <RefreshCwIcon className="h-3.5 w-3.5" />
                            Refresh
                        </Button>
                        <Button
                            className="gap-1.5 border border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] shadow-sm hover:bg-[var(--cl-surface-3)]"
                            disabled={!selectedBrand}
                            size="sm"
                            variant="outline"
                            onClick={() => setImportOpen(true)}
                        >
                            <UploadIcon className="h-3.5 w-3.5" />
                            Import
                        </Button>
                        <Button
                            className="gap-1.5 border border-red-200 bg-red-50 text-red-600 shadow-sm hover:bg-red-100"
                            disabled={!selectedBrand || partsLoading}
                            size="sm"
                            title="Delete unused parts for this brand"
                            variant="outline"
                            onClick={() => setCleanUpOpen(true)}
                        >
                            <Trash2Icon className="h-3.5 w-3.5" />
                            Clean Up
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700"
                            disabled={!selectedBrand}
                            size="sm"
                            onClick={() => setAddOpen(true)}
                        >
                            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                            Add Part
                        </Button>
                    </div>
                </div>

                {/* No brand */}
                {!selectedBrand ? (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-16">
                        <p className="text-sm text-[var(--cl-text-muted)]">Select a brand to view its parts.</p>
                    </div>
                ) : (
                    <>
                        {/* Search + range */}
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                                <Input
                                    className="h-8 pl-8 text-sm"
                                    disabled={partsLoading}
                                    placeholder="Search by part code, name, description or model…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            {!partsLoading && total > 0 && (
                                <p className="shrink-0 text-xs text-[var(--cl-text-muted)]">
                                    {from}–{to} of {total}
                                </p>
                            )}
                        </div>

                        {/* Table */}
                        {partsLoading && parts.length === 0 ? (
                            <div className="flex flex-col gap-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-11 animate-pulse rounded-lg bg-[var(--cl-surface-2)]" />
                                ))}
                            </div>
                        ) : total === 0 && !partsLoading ? (
                            <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-6 py-12 text-center text-sm text-[var(--cl-text-muted)]">
                                {searchQ
                                    ? `No parts match "${searchQ}".`
                                    : `No parts for ${selectedBrand.name}. Click "Add Part" to create one.`}
                            </div>
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-sm">
                                <div className="overflow-x-auto overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="sticky top-0 z-10 bg-[var(--cl-surface-3)] hover:bg-[var(--cl-surface-3)]">
                                                <TableHead className={`w-8 text-center ${thClass}`}>#</TableHead>
                                                <TableHead className={thClass}>Part Code</TableHead>
                                                <TableHead className={thClass}>Part Name</TableHead>
                                                <TableHead className={thClass}>Description</TableHead>
                                                <TableHead className={thClass}>Model</TableHead>
                                                <TableHead className={`text-right ${thClass}`}>Cost Price</TableHead>
                                                <TableHead className={`text-right ${thClass}`}>Sale Price</TableHead>
                                                <TableHead className={thClass}>Status</TableHead>
                                                <TableHead className={thClass}>Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {parts.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="px-6 py-10 text-center text-sm text-[var(--cl-text-muted)]">
                                                        No results on this page.
                                                    </td>
                                                </tr>
                                            ) : (
                                                parts.map((part, idx) => (
                                                    <motion.tr
                                                        animate="visible"
                                                        className="border-b border-[var(--cl-border)] transition-colors last:border-b-0 hover:bg-[var(--cl-surface-3)]"
                                                        custom={idx}
                                                        initial="hidden"
                                                        key={part.id}
                                                        variants={rowVariants}
                                                    >
                                                        <TableCell className="text-center text-xs text-[var(--cl-text-muted)]">
                                                            {from + idx}
                                                        </TableCell>
                                                        <TableCell className="font-mono text-sm font-medium text-[var(--cl-text)]">
                                                            {part.part_code}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-[var(--cl-text)]">
                                                            {part.part_name}
                                                        </TableCell>
                                                        <TableCell className="max-w-xs truncate text-sm text-[var(--cl-text-muted)]">
                                                            {part.part_description ?? "—"}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-[var(--cl-text-muted)]">
                                                            {part.model ?? "—"}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm text-[var(--cl-text-muted)]">
                                                            {part.cost_price != null ? part.cost_price.toFixed(2) : "—"}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm text-[var(--cl-text-muted)]">
                                                            {part.mrp != null ? part.mrp.toFixed(2) : "—"}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                className={part.is_active
                                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                                    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"}
                                                                variant="outline"
                                                            >
                                                                <span className={`mr-1 h-1.5 w-1.5 rounded-full ${part.is_active ? "bg-emerald-500" : "bg-amber-400"}`} />
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

                                {/* Pagination footer */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2">
                                        <p className="text-xs text-[var(--cl-text-muted)]">
                                            Page {page} of {totalPages}
                                        </p>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                className="h-7 w-7"
                                                disabled={page <= 1 || partsLoading}
                                                size="icon"
                                                title="First page"
                                                variant="ghost"
                                                onClick={() => setPage(1)}
                                            >
                                                <ChevronsLeftIcon className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                className="h-7 w-7"
                                                disabled={page <= 1 || partsLoading}
                                                size="icon"
                                                title="Previous page"
                                                variant="ghost"
                                                onClick={() => setPage(p => p - 1)}
                                            >
                                                <ChevronLeftIcon className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                className="h-7 w-7"
                                                disabled={page >= totalPages || partsLoading}
                                                size="icon"
                                                title="Next page"
                                                variant="ghost"
                                                onClick={() => setPage(p => p + 1)}
                                            >
                                                <ChevronRightIcon className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                className="h-7 w-7"
                                                disabled={page >= totalPages || partsLoading}
                                                size="icon"
                                                title="Last page"
                                                variant="ghost"
                                                onClick={() => setPage(totalPages)}
                                            >
                                                <ChevronsRightIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </motion.div>

            {selectedBrand && (
                <AddPartDialog
                    brands={brands}
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    onSuccess={() => loadParts(selectedBrand, page, searchQ)}
                />
            )}
            {dbName && schema_ && selectedBrand && (
                <ImportPartDialog
                    brands={brands}
                    db_name={dbName}
                    open={importOpen}
                    schema={schema_}
                    onOpenChange={setImportOpen}
                    onSuccess={() => { setPage(1); loadParts(selectedBrand, 1, searchQ); }}
                />
            )}
            {editPart && selectedBrand && (
                <EditPartDialog
                    brands={brands}
                    open={!!editPart}
                    part={editPart}
                    onOpenChange={(o) => { if (!o) setEditPart(null); }}
                    onSuccess={() => loadParts(selectedBrand, page, searchQ)}
                />
            )}
            {deletePart && selectedBrand && (
                <DeletePartDialog
                    open={!!deletePart}
                    part={deletePart}
                    onOpenChange={(o) => { if (!o) setDeletePart(null); }}
                    onSuccess={() => loadParts(selectedBrand, page, searchQ)}
                />
            )}
            {selectedBrand && (
                <DeleteBrandPartsWizardDialog
                    brand={selectedBrand}
                    open={cleanUpOpen}
                    onClose={() => setCleanUpOpen(false)}
                    onDeleted={() => { setCleanUpOpen(false); setPage(1); loadParts(selectedBrand, 1, searchQ); }}
                />
            )}
        </>
    );
};
