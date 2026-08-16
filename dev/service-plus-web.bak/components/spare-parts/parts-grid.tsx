"use client";

import { PackageSearch } from "lucide-react";

import { PartCard } from "./part-card";
import type { Part } from "@/lib/types";

type Props = {
  parts: Part[];
  loading: boolean;
  startIndex: number;
  onSelectPart: (partId: number) => void;
  onAddToCart: (part: Part, qty: number) => void;
};

export function PartsGrid({ parts, loading, startIndex, onSelectPart, onAddToCart }: Props) {
  if (loading && parts.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (parts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        <PackageSearch className="size-6" />
        No parts found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Prominent, persistent — stays visible near the results, not per-card clutter. */}
      <p className="text-xs text-muted-foreground">
        Prices are indicative and subject to change without prior notice.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {parts.map((part, i) => (
          <PartCard
            key={part.id}
            part={part}
            index={startIndex + i + 1}
            onClick={() => onSelectPart(part.id)}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </div>
  );
}
