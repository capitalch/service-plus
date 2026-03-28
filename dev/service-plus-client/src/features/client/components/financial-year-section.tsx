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
    Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

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
import { AddFinancialYearDialog } from "@/features/client/components/add-financial-year-dialog";
import { DeleteFinancialYearDialog } from "@/features/client/components/delete-financial-year-dialog";
import { EditFinancialYearDialog } from "@/features/client/components/edit-financial-year-dialog";
import type { FinancialYearType } from "@/features/client/types/financial-year";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType = { genericQuery: FinancialYearType[] | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    if (!iso) return "—";
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
}

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

export const FinancialYearSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [addOpen,    setAddOpen]    = useState(false);
    const [deleteFy,   setDeleteFy]   = useState<FinancialYearType | null>(null);
    const [editFy,     setEditFy]     = useState<FinancialYearType | null>(null);
    const [fys,        setFys]        = useState<FinancialYearType[]>([]);
    const [loading,    setLoading]    = useState(false);
    const [search,     setSearch]     = useState("");
    const [sortCol,    setSortCol]    = useState<string | null>(null);
    const [sortDir,    setSortDir]    = useState<"asc" | "desc">("asc");

    const loadFys = useCallback(async () => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const result = await apolloClient.query<GenericQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_FINANCIAL_YEARS }),
                },
            });
            setFys(result.data?.genericQuery ?? []);
        } catch {
            toast.error(MESSAGES.ERROR_FY_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        loadFys();
    }, [loadFys]);

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

    const displayFys = useMemo(() => {
        let rows = fys;
        if (search.trim()) {
            const q = search.toLowerCase();
            rows = rows.filter(r =>
                String(r.id).includes(q) ||
                r.start_date.toLowerCase().includes(q) ||
                r.end_date.toLowerCase().includes(q)
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
    }, [fys, search, sortCol, sortDir]);

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
                        <h1 className="text-xl font-bold text-[var(--cl-text)]">Financial Years</h1>
                        <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                            Manage financial years for this business unit.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            className="gap-1.5 border border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] shadow-sm hover:bg-[var(--cl-surface-3)]"
                            disabled={loading}
                            size="sm"
                            variant="outline"
                            onClick={loadFys}
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
                            Add Financial Year
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
                            placeholder="Search financial years…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    {!loading && fys.length > 0 && (
                        <p className="shrink-0 text-xs text-[var(--cl-text-muted)]">
                            {displayFys.length} of {fys.length}
                        </p>
                    )}
                </div>

                {/* Table */}
                {loading && fys.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--cl-surface-2)]" />
                        ))}
                    </div>
                ) : fys.length === 0 ? (
                    <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-6 py-12 text-center text-sm text-[var(--cl-text-muted)]">
                        No financial years found. Click &quot;Add Financial Year&quot; to create one.
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
                                        <TableHead className={thSortClass} onClick={() => handleSort("id")}>Year<SortIcon col="id" /></TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("start_date")}>Start Date<SortIcon col="start_date" /></TableHead>
                                        <TableHead className={thSortClass} onClick={() => handleSort("end_date")}>End Date<SortIcon col="end_date" /></TableHead>
                                        <TableHead className={thClass}>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayFys.length === 0 ? (
                                        <tr>
                                            <td colSpan={99} className="px-6 py-10 text-center text-sm text-[var(--cl-text-muted)]">
                                                No results match &ldquo;{search}&rdquo;.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayFys.map((fy, idx) => (
                                            <motion.tr
                                                animate="visible"
                                                className="border-b border-[var(--cl-border)] transition-colors last:border-b-0 hover:bg-[var(--cl-surface-3)]"
                                                custom={idx}
                                                initial="hidden"
                                                key={fy.id}
                                                variants={rowVariants}
                                            >
                                                <TableCell className="text-center text-xs text-[var(--cl-text-muted)]">{idx + 1}</TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-xs font-semibold text-[var(--cl-text)]">{fy.id}</span>
                                                </TableCell>
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">{formatDate(fy.start_date)}</TableCell>
                                                <TableCell className="text-sm text-[var(--cl-text-muted)]">{formatDate(fy.end_date)}</TableCell>
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
                                                                onClick={() => setEditFy(fy)}
                                                            >
                                                                <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-red-600 focus:text-red-600"
                                                                onClick={() => setDeleteFy(fy)}
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
            <AddFinancialYearDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                onSuccess={loadFys}
            />
            {editFy && (
                <EditFinancialYearDialog
                    fy={editFy}
                    open={!!editFy}
                    onOpenChange={(o) => { if (!o) setEditFy(null); }}
                    onSuccess={loadFys}
                />
            )}
            {deleteFy && (
                <DeleteFinancialYearDialog
                    fy={deleteFy}
                    open={!!deleteFy}
                    onOpenChange={(o) => { if (!o) setDeleteFy(null); }}
                    onSuccess={loadFys}
                />
            )}
        </>
    );
};
