import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckIcon, CopyIcon, EyeIcon, MapPin, Package } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { PartFinderResultType } from "@/features/client/types/part-finder";
import { getStockStatus } from "@/features/client/types/part-finder";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortDir  = "asc" | "desc";
type SortField = "brand_name" | "category" | "model" | "part_code" | "part_name" | "primary_location" | "qty";

type Props = {
    loading:       boolean;
    onSelectPart:  (part: PartFinderResultType) => void;
    parts:         PartFinderResultType[];
    selectedId:    number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const thClass = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]";

const rowVariants = {
    hidden:  { opacity: 0, y: 4 },
    visible: (i: number) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.02, duration: 0.18, ease: "easeOut" as const },
    }),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StockBadge({ qty }: { qty: number }) {
    const status = getStockStatus(qty);
    if (status === "out_of_stock") return (
        <Badge className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300" variant="outline">
            Out of Stock
        </Badge>
    );
    if (status === "low_stock") return (
        <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300" variant="outline">
            Low Stock
        </Badge>
    );
    return (
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" variant="outline">
            In Stock
        </Badge>
    );
}

function CopyCode({ code }: { code: string }) {
    const [copied, setCopied] = useState(false);
    function handleCopy(e: React.MouseEvent) {
        e.stopPropagation();
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }
    return (
        <span className="group flex items-center gap-1.5">
            <span className="font-mono text-sm font-medium text-[var(--cl-text)]">{code}</span>
            <button
                className="invisible rounded p-0.5 text-[var(--cl-text-muted)] opacity-0 transition-all group-hover:visible group-hover:opacity-100 hover:text-[var(--cl-text)]"
                title="Copy code"
                type="button"
                onClick={handleCopy}
            >
                {copied
                    ? <CheckIcon className="h-3 w-3 text-emerald-500" />
                    : <CopyIcon  className="h-3 w-3" />}
            </button>
        </span>
    );
}

function SortIcon({ dir, field, sortField }: { dir: SortDir; field: SortField; sortField: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
    return dir === "asc"
        ? <ArrowUp   className="ml-1 inline h-3 w-3 text-[var(--cl-accent)]" />
        : <ArrowDown className="ml-1 inline h-3 w-3 text-[var(--cl-accent)]" />;
}

function sortParts(parts: PartFinderResultType[], field: SortField, dir: SortDir): PartFinderResultType[] {
    return [...parts].sort((a, b) => {
        const av = a[field] ?? "";
        const bv = b[field] ?? "";
        const cmp = typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        return dir === "asc" ? cmp : -cmp;
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartFinderTable = ({ loading, onSelectPart, parts, selectedId }: Props) => {
    const [sortField, setSortField] = useState<SortField>("part_code");
    const [sortDir,   setSortDir]   = useState<SortDir>("asc");

    function handleSort(field: SortField) {
        if (sortField === field) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir("asc");
        }
    }

    const sorted = sortParts(parts, sortField, sortDir);

    if (loading && parts.length === 0) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--cl-surface-2)]" />
                ))}
            </div>
        );
    }

    if (parts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] py-16">
                <Package className="mb-3 h-10 w-10 text-[var(--cl-text-muted)] opacity-40" />
                <p className="text-sm font-medium text-[var(--cl-text-muted)]">No parts found</p>
                <p className="mt-1 text-xs text-[var(--cl-text-muted)] opacity-70">Try adjusting your filters or search term</p>
            </div>
        );
    }

    function ColHead({ field, label }: { field: SortField; label: string }) {
        return (
            <TableHead
                className={`${thClass} cursor-pointer select-none hover:text-[var(--cl-text)]`}
                onClick={() => handleSort(field)}
            >
                {label}<SortIcon dir={sortDir} field={field} sortField={sortField} />
            </TableHead>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-sm">
            <div className="overflow-x-auto overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="sticky top-0 z-10 bg-[var(--cl-surface-3)] hover:bg-[var(--cl-surface-3)]">
                            <TableHead className={`w-8 text-center ${thClass}`}>#</TableHead>
                            <ColHead field="part_code"       label="Part Code" />
                            <ColHead field="part_name"       label="Part Name" />
                            <ColHead field="brand_name"      label="Brand" />
                            <ColHead field="category"        label="Category" />
                            <ColHead field="model"           label="Model" />
                            <ColHead field="primary_location" label="Location" />
                            <ColHead field="qty"             label="Qty" />
                            <TableHead className={thClass}>UOM</TableHead>
                            <TableHead className={thClass}>Status</TableHead>
                            <TableHead className={`${thClass} text-center`}>Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sorted.map((part, idx) => {
                            const isActive = selectedId === part.id;
                            return (
                                <motion.tr
                                    animate="visible"
                                    className={`cursor-pointer border-b border-[var(--cl-border)] last:border-b-0 hover:bg-[var(--cl-surface-3)] ${
                                        isActive
                                            ? "bg-[var(--cl-accent)]/10 hover:bg-[var(--cl-accent)]/10"
                                            : idx % 2 === 1 ? "bg-[var(--cl-surface-3)]/40" : ""
                                    }`}
                                    custom={idx}
                                    initial="hidden"
                                    key={part.id}
                                    variants={rowVariants}
                                    onClick={() => onSelectPart(part)}
                                >
                                    <TableCell className="text-center text-xs text-[var(--cl-text-muted)]">{idx + 1}</TableCell>
                                    <TableCell onClick={e => e.stopPropagation()}>
                                        <CopyCode code={part.part_code} />
                                    </TableCell>
                                    <TableCell className="max-w-[180px]">
                                        <span className="line-clamp-1 text-sm text-[var(--cl-text)]" title={part.part_name}>
                                            {part.part_name}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm text-[var(--cl-text-muted)]">{part.brand_name ?? "—"}</TableCell>
                                    <TableCell>
                                        {part.category ? (
                                            <Badge className="border-[var(--cl-border)] bg-[var(--cl-surface-3)] text-[var(--cl-text-muted)]" variant="outline">
                                                {part.category}
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-[var(--cl-text-muted)]">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-[var(--cl-text-muted)]">{part.model ?? "—"}</TableCell>
                                    <TableCell>
                                        {part.primary_location ? (
                                            <span className="flex items-center gap-1 text-sm text-[var(--cl-text-muted)]">
                                                <MapPin className="h-3 w-3 shrink-0" />
                                                {part.primary_location}
                                                {part.location_count > 1 && (
                                                    <Badge className="ml-1 border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-400" variant="outline">
                                                        +{part.location_count - 1}
                                                    </Badge>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-[var(--cl-text-muted)]">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        <span className={`text-sm font-bold ${
                                            part.qty <= 0 ? "text-rose-600" : part.qty <= 5 ? "text-amber-600" : "text-emerald-600"
                                        }`}>
                                            {part.qty}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm text-[var(--cl-text-muted)]">{part.uom ?? "—"}</TableCell>
                                    <TableCell><StockBadge qty={part.qty} /></TableCell>
                                    <TableCell className="text-center">
                                        <Button
                                            className="h-6 w-6 p-0 text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]"
                                            size="sm"
                                            variant="ghost"
                                            onClick={e => { e.stopPropagation(); onSelectPart(part); }}
                                        >
                                            <EyeIcon className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                </motion.tr>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
