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
import { fetchBranches } from "@/lib/api";
import type { Branch } from "@/lib/types";

type Props = {
  company: string | null;
  value: string | null;
  onChange: (branch: string | null) => void;
  /** Lets the page know the resolved branch list — e.g. to render a full
   * "catalogue unavailable" state when a company has zero active branches. */
  onBranchesChange?: (branches: Branch[]) => void;
};

/**
 * Branch picker for the spare-parts catalogue (§9). Renders nothing at all in the
 * common case — a single-branch company's customer never learns branches exist:
 *   - exactly one active branch  -> selected silently, no dropdown, no layout shift
 *   - more than one              -> dropdown, preselected to the first branch
 *   - zero                       -> caller handles via onBranchesChange (empty state)
 *
 * The resolved branch is never persisted across a company change — every company
 * change clears it and refetches from scratch.
 */
export function BranchSelect({ company, value, onChange, onBranchesChange }: Props) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    onChange(null);
    setBranches([]);
    setError(false);

    // Deliberately not reported via onBranchesChange here (while company is unset
    // or the fetch is still in flight) — the page treats an empty list as "catalogue
    // unavailable," and reporting [] before the real result arrives would flash that
    // state on every company switch, even when the branch list turns out non-empty.
    if (!company) return;

    setLoading(true);
    fetchBranches(company)
      .then((result) => {
        setBranches(result);
        onBranchesChange?.(result);
        if (result.length > 0) onChange(result[0].code);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    // Only re-run when the company changes — onChange/onBranchesChange are stable
    // setState callbacks from the parent and must not retrigger this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  if (!company || loading || branches.length <= 1) {
    if (error) {
      return <p className="text-sm text-destructive">Couldn&apos;t load branches. Please try again.</p>;
    }
    return null;
  }

  // Disambiguate branches that share a display name with their city.
  const nameCounts = new Map<string, number>();
  for (const b of branches) nameCounts.set(b.name, (nameCounts.get(b.name) ?? 0) + 1);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="branch">Branch</Label>
      <Select value={value ?? branches[0].code} onValueChange={onChange}>
        <SelectTrigger id="branch" className="w-full">
          <SelectValue placeholder="Select a branch" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.code} value={branch.code}>
              {branch.name}
              {(nameCounts.get(branch.name) ?? 0) > 1 && branch.city ? ` — ${branch.city}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
