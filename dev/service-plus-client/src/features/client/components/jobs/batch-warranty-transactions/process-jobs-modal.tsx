import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TechnicianRow, WarrantyBatchJobRow } from "@/features/client/types/job";
import { TechnicianPicker } from "./technician-picker";
import { TransactionPicker } from "./transaction-picker";
import { getEligibleKinds, type TransactionKind } from "./transaction-eligibility";

export type ProcessJobsArgs = {
    checkedKinds:    Set<TransactionKind>;
    technicianId:    number | null;
    transactionDate: string;
    remarks:         string;
};

type Props = {
    jobs:         WarrantyBatchJobRow[];
    technicians:  TechnicianRow[];
    executing:    boolean;
    onCancel:     () => void;
    onRemoveJob:  (jobId: number) => void;
    onProceed:    (args: ProcessJobsArgs) => void;
};

const today = new Date().toISOString().slice(0, 10);

export function ProcessJobsModal({ jobs, technicians, executing, onCancel, onRemoveJob, onProceed }: Props) {
    const [checkedKinds,    setCheckedKinds]    = useState<Set<TransactionKind>>(new Set());
    const [technicianId,    setTechnicianId]    = useState<number | null>(null);
    const [transactionDate, setTransactionDate] = useState(today);
    const [remarks,         setRemarks]         = useState("");

    // Eligibility cascades on what's already checked (Completed OK unlocks
    // Final, which unlocks Deliver) — see transaction-eligibility.ts.
    const eligibleKinds = useMemo(() => getEligibleKinds(jobs, checkedKinds), [jobs, checkedKinds]);

    // If unchecking an earlier stage invalidates a later one that was only
    // reachable via the cascade (e.g. un-checking Completed OK while Final
    // was checked), drop it instead of leaving a checked-but-disabled box.
    useEffect(() => {
        setCheckedKinds(prev => {
            const next = new Set([...prev].filter(k => eligibleKinds.has(k)));
            return next.size === prev.size ? prev : next;
        });
    }, [eligibleKinds]);

    // Removing the last job leaves nothing to process — close automatically.
    useEffect(() => {
        if (jobs.length === 0 && !executing) onCancel();
    }, [jobs.length, executing, onCancel]);

    const requiresTechnician = checkedKinds.has("COMPLETED_OK");
    const canProceed = jobs.length > 0
        && checkedKinds.size > 0
        && (!requiresTechnician || technicianId !== null)
        && transactionDate.trim() !== ""
        && !executing;

    return (
        <Dialog open onOpenChange={open => { if (!open && !executing) onCancel(); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Process {jobs.length} Jobs</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Selected Jobs ({jobs.length})</Label>
                        <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-(--cl-border) p-2">
                            {jobs.map(job => (
                                <span
                                    key={job.id}
                                    className="flex items-center gap-1 rounded-md bg-(--cl-surface-2) py-1 pl-2 pr-1 text-xs font-mono font-semibold text-(--cl-accent)"
                                >
                                    {job.job_no}
                                    <button
                                        className="flex h-4 w-4 items-center justify-center rounded-full text-(--cl-text-muted) hover:bg-red-500/10 hover:text-red-500"
                                        title={`Remove job #${job.job_no} from this batch`}
                                        type="button"
                                        onClick={() => onRemoveJob(job.id)}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-4">
                        <TechnicianPicker
                            technicians={technicians}
                            value={technicianId}
                            required={requiresTechnician}
                            onChange={setTechnicianId}
                        />
                        <div className="space-y-1.5">
                            <Label htmlFor="pjm-date">
                                Date <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="pjm-date"
                                className="h-9 w-40"
                                required
                                type="date"
                                value={transactionDate}
                                onChange={e => setTransactionDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="pjm-remarks">Remarks</Label>
                        <Input
                            id="pjm-remarks"
                            placeholder="Optional remarks…"
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                        />
                    </div>

                    <TransactionPicker
                        eligibleKinds={eligibleKinds}
                        checkedKinds={checkedKinds}
                        onChange={setCheckedKinds}
                    />
                </div>

                <DialogFooter>
                    <Button disabled={executing} type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={!canProceed}
                        type="button"
                        onClick={() => onProceed({ checkedKinds, technicianId, transactionDate, remarks })}
                    >
                        {executing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Proceed
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
