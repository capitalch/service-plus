"use client";

import { Building2, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchCompanies } from "@/lib/api";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Show each company's catalogue size — only meaningful on the spare-parts page. */
  showPartsCount?: boolean;
};

export function CompanySelect({
  id = "company",
  value,
  onChange,
  error,
  showPartsCount = false,
}: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  function load() {
    setLoading(true);
    setFailed(false);
    fetchCompanies()
      .then(setCompanies)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Company</Label>
      {loading ? (
        <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading companies…
        </div>
      ) : (
        <Select value={value} onValueChange={onChange} disabled={failed || companies.length === 0}>
          <SelectTrigger id={id} className="w-full">
            <span
              className={cn(
                "flex items-center gap-2",
                failed && "text-destructive",
                !failed && !value && "text-muted-foreground",
              )}
            >
              <Building2 className="size-4 shrink-0" />
              <SelectValue placeholder={failed ? "Couldn't load companies" : "Select a company"} />
            </span>
          </SelectTrigger>
          <SelectContent>
            {companies.map((company) => (
              <SelectItem
                key={company.id}
                value={company.id}
                trailing={
                  showPartsCount && company.partsCount !== null ? (
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                      {company.partsCount === 1 ? "1 part" : `${company.partsCount} parts`}
                    </span>
                  ) : undefined
                }
              >
                {company.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {failed && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          Couldn&apos;t load companies.
          <button
            type="button"
            onClick={load}
            className="inline-flex cursor-pointer items-center gap-0.5 font-medium underline underline-offset-2"
          >
            <RefreshCw className="size-3" />
            Retry
          </button>
        </p>
      )}
      {!failed && error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
