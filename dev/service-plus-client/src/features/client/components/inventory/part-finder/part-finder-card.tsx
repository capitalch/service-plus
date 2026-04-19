import { motion } from "framer-motion";
import { MapPin, Package } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PartFinderResultType } from "@/features/client/types/part-finder";
import { getStockStatus } from "@/features/client/types/part-finder";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    loading:      boolean;
    onSelectPart: (part: PartFinderResultType) => void;
    parts:        PartFinderResultType[];
    selectedId:   number | null;
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

// ─── Animations ───────────────────────────────────────────────────────────────

const containerVariants = {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.04 } },
};

const cardVariants = {
    hidden:  { opacity: 0, scale: 0.97, y: 8 },
    visible: { opacity: 1, scale: 1,    y: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
};

// ─── Single card ──────────────────────────────────────────────────────────────

type CardItemProps = {
    isSelected:   boolean;
    onSelect:     (part: PartFinderResultType) => void;
    part:         PartFinderResultType;
};

function PartCard({ isSelected, onSelect, part }: CardItemProps) {
    const qtyColor = part.qty <= 0 ? "text-rose-600" : part.qty <= 5 ? "text-amber-600" : "text-emerald-600";

    return (
        <motion.div variants={cardVariants}>
            <Card
                className={`flex cursor-pointer flex-col gap-3 p-4 transition-all duration-150 hover:shadow-md ${
                    isSelected
                        ? "border-[var(--cl-accent)] bg-[var(--cl-accent)]/5 shadow-md"
                        : "border-[var(--cl-border)] bg-[var(--cl-surface-2)] hover:border-[var(--cl-accent)]/40"
                }`}
                onClick={() => onSelect(part)}
            >
                {/* Top row: part code + status badge */}
                <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-medium text-[var(--cl-text-muted)]">{part.part_code}</span>
                    <StockBadge qty={part.qty} />
                </div>

                {/* Part name */}
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--cl-text)]">
                    {part.part_name}
                </p>

                {/* Brand + Category */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {part.brand_name && (
                        <span className="text-xs text-[var(--cl-text-muted)]">{part.brand_name}</span>
                    )}
                    {part.brand_name && part.category && (
                        <span className="text-xs text-[var(--cl-text-muted)]">·</span>
                    )}
                    {part.category && (
                        <Badge className="border-[var(--cl-border)] bg-[var(--cl-surface-3)] text-[var(--cl-text-muted)]" variant="outline">
                            {part.category}
                        </Badge>
                    )}
                </div>

                {/* Model */}
                {part.model && (
                    <span className="rounded-md border border-[var(--cl-border)] bg-[var(--cl-surface-3)] px-2 py-0.5 text-xs text-[var(--cl-text-muted)] self-start">
                        {part.model}
                    </span>
                )}

                {/* Qty + UOM */}
                <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-bold tabular-nums ${qtyColor}`}>{part.qty}</span>
                    <span className="text-xs text-[var(--cl-text-muted)]">{part.uom ?? ""}</span>
                </div>

                {/* Location */}
                {part.primary_location && (
                    <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--cl-text-muted)]" />
                        <span className="text-xs text-[var(--cl-text-muted)]">{part.primary_location}</span>
                        {part.location_count > 1 && (
                            <Badge className="border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-400" variant="outline">
                                +{part.location_count - 1} more
                            </Badge>
                        )}
                    </div>
                )}

            </Card>
        </motion.div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartFinderCard = ({ loading, onSelectPart, parts, selectedId }: Props) => {
    if (loading) {
        return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-52 animate-pulse rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)]" />
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

    return (
        <motion.div
            animate="visible"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            variants={containerVariants}
        >
            {parts.map(part => (
                <PartCard
                    isSelected={selectedId === part.id}
                    key={part.id}
                    onSelect={onSelectPart}
                    part={part}
                />
            ))}
        </motion.div>
    );
};
