"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function PartsSearch({ value, onChange }: Props) {
  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder="Search parts by name, model or description…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
