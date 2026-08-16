"use client";

import { Search, SearchX } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function PartsSearch({ value, onChange }: Props) {
  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-10 pl-9"
        placeholder="Search parts by name, model or description…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className={cn(
            "absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
          )}
        >
          <SearchX className="size-3.5" />
        </button>
      )}
    </div>
  );
}
