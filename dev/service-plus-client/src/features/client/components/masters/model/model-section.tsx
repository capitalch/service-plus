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
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import { AddModelDialog } from "./add-model-dialog";
import { DeleteModelDialog } from "./delete-model-dialog";
import { EditModelDialog } from "./edit-model-dialog";
import type { ModelType, BrandOption, ProductOption } from "@/features/client/types/model";

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

const thClass = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]";
const thSortClass = `${thClass} cursor-pointer select-none hover:text-[var(--cl-text)]`;

// ─── Component ────────────────────────────────────────────────────────────────

export const ModelSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema_ = useAppSelector(selectSchema);

    const [addOpen, setAddOpen] = useState(false);
    const [brands, setBrands] = useState<BrandOption[]>([]);
    const [deleteModel, setDeleteModel] = useState<ModelType | null>(null);
    const [editModel, setEditModel] = useState<ModelType | null>(null);
    const [loading, setLoading] = useState(false);
    const [models, setModels] = useState<ModelType[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [search, setSearch] = useState("");
    const [sortCol, setSortCol] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    const loadData = useCallback(async () => {
        if (!dbName || !schema_) return;
        setLoading(true);
        try {
            const [modelsRes, brandsRes, productsRes] = await Promise.all([
                apolloClient.query<GenericQueryDataType<ModelType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema: schema_,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_MODELS }),
                    },
                }),
                apolloClient.query<GenericQueryDataType<BrandOption>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema: schema_,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
                    },
                }),
                apolloClient.query<GenericQueryDataType<ProductOption>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema: schema_,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_PRODUCTS }),
                    },
                }),
            ]);
            setModels(modelsRes.data?.genericQuery ?? []);
            setBrands(brandsRes.data?.genericQuery ?? []);
            setProducts(productsRes.data?.genericQuery ?? []);
        } catch {
            toast.error("Failed to load models. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [dbName, schema_]);

    useEffect(() => { loadData(); }, [loadData]);

    async function handleToggleActive(model: ModelType) {
        if (!dbName || !schema_) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema: schema_,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "product_brand_model",
                        xData: { id: model.id, is_active: !model.is_active },
                    }),
                },
            });
            await loadData();
        } catch {
            toast.error("Failed to update model. Please try again.");
        }
    }

    function handleSort(col: string) {
        if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortCol(col); setSortDir("asc"); }
    }

    function SortIcon({ col }: { col: string }) {
        if (sortCol !== col) return <ArrowUpDownIcon className="ml-1 inline h-3 w-3 opacity-40" />;
        return sortDir === "asc"
            ? <ArrowUpIcon className="ml-1 inline h-3 w-3" />
            : <ArrowDownIcon className="ml-1 inline h-3 w-3" />;
    }

    const displayModels = useMemo(() => {
        let rows = models;
        if (search.trim()) {
            const q = search.toLowerCase();
            rows = rows.filter(r =>
                (r.product_name?.toLowerCase().includes(q) ?? false) ||
                (r.brand_name?.toLowerCase().includes(q) ?? false) ||
                r.model_name.toLowerCase().includes(q)
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
    }, [models, search, sortCol, sortDir]);

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
                        <h1 className="text-xl font-bold text-[var(--cl-text)]">Models</h1>
                        <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                            Manage product-brand-model combinations.
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
                            Add Model
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
                            placeholder="Search models…"
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
                    {!loading && models.length > 0 && (
                        <p className="shrink-0 text-xs text-[var(--cl-text-muted)]">
                            {displayModels.length} of {models.length}
                        </p>
                    )}
                </div>

                {loading && models.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--cl-surface-2)]" />
                        ))}
                    </div>
                ) : models.length === 0 ? (
                    <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-6 py-12 text-center text-sm text-[var(--cl-text-muted)]">
                        No models found. Click &quot;Add Model&quot; to create one.
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
                                        <TableHead className={thSortClass} onClick={() => handleSort("product_name")}>Product<SortIcon col="product_name" /></TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("brand_name")}>Brand<SortIcon col="brand_name" /></TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("model_name")}>Model Name<SortIcon col="model_name" /></TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("launch_year")}>Year<SortIcon col="launch_year" /></TableHead>
                                        <TableHead className={thClass}>Status</TableHead>
                                        <TableHead className={thClass}>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayModels.length === 0 ? (
                                        <tr>
                                            <td colSpan={99} className="px-6 py-10 text-center text-sm text-[var(--cl-text-muted)]">
                                                No results match &ldquo;{search}&rdquo;.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayModels.map((model, idx) => (
                                            <motion.tr
                                                animate="visible"
                                                className="border-b border-[var(--cl-border)] transition-colors last:border-b-0 hover:bg-[var(--cl-surface-3)]"
                                                custom={idx}
                                                initial="hidden"
                                                key={model.id}
                                                variants={rowVariants}
                                            >
                                                <TableCell className="text-center text-xs text-[var(--cl-text-muted)]">{idx + 1}</TableCell>
                                                <TableCell className="font-mono text-sm font-medium text-[var(--cl-text)]">{model.product_name ?? "—"}</TableCell>
                                                <TableCell className="font-mono text-sm text-[var(--cl-text-muted)]">{model.brand_name ?? "—"}</TableCell>
                                                <TableCell className="font-medium text-[var(--cl-text)]">{model.model_name}</TableCell>
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">{model.launch_year ?? "—"}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        className={model.is_active
                                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                            : "border-red-200 bg-red-100 text-red-500 hover:bg-red-100"}
                                                        variant="outline"
                                                    >
                                                        <span className={`mr-1 h-1.5 w-1.5 rounded-full ${model.is_active ? "bg-emerald-500" : "bg-red-400"}`} />
                                                        {model.is_active ? "Active" : "Inactive"}
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
                                                                onClick={() => setEditModel(model)}
                                                            >
                                                                <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            {model.is_active ? (
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-amber-600 focus:text-amber-600"
                                                                    onClick={() => handleToggleActive(model)}
                                                                >
                                                                    <ToggleLeftIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                    Deactivate
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-emerald-600 focus:text-emerald-600"
                                                                    onClick={() => handleToggleActive(model)}
                                                                >
                                                                    <ToggleRightIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                    Activate
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-red-600 focus:text-red-600"
                                                                onClick={() => setDeleteModel(model)}
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

            <AddModelDialog
                brands={brands}
                open={addOpen}
                products={products}
                onOpenChange={setAddOpen}
                onSuccess={loadData}
            />
            {editModel && (
                <EditModelDialog
                    brands={brands}
                    model={editModel}
                    open={!!editModel}
                    products={products}
                    onOpenChange={(o) => { if (!o) setEditModel(null); }}
                    onSuccess={loadData}
                />
            )}
            {deleteModel && (
                <DeleteModelDialog
                    model={deleteModel}
                    open={!!deleteModel}
                    onOpenChange={(o) => { if (!o) setDeleteModel(null); }}
                    onSuccess={loadData}
                />
            )}
        </>
    );
};
