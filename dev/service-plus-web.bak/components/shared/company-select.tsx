"use client";

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

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Show each company's catalogue size — only meaningful on the spare-parts page. */
  showPartsCount?: boolean;
};

/**
 * Shared company (business unit) picker — the same "select client + BU" step every
 * public lookup (job status, open jobs, spare parts) starts with. Extracted out of
 * job-status-form.tsx / open-jobs-form.tsx so a third feature doesn't re-fetch and
 * re-render its own copy.
 */
export function CompanySelect({
  id = "company",
  value,
  onChange,
  error,
  showPartsCount = false,
}: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesError, setCompaniesError] = useState(false);

  useEffect(() => {
    fetchCompanies()
      .then(setCompanies)
      .catch(() => setCompaniesError(true));
  }, []);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Company</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue
            placeholder={companiesError ? "Couldn't load companies" : "Select a company"}
          />
        </SelectTrigger>
        <SelectContent>
          {companies.map((company) => (
            <SelectItem
              key={company.id}
              value={company.id}
              trailing={
                showPartsCount ? (
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
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
