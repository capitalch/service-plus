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
          <div key={index} className="space-y-3 rounded-xl border border-border/50 p-3">
            <div className="aspect-square animate-pulse rounded-lg bg-muted" />
            <div className="h-3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (parts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <PackageSearch className="size-6" />
        </span>
        <p className="text-sm font-medium text-foreground">No parts found.</p>
        <p className="text-sm text-muted-foreground">Try a different search term.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
