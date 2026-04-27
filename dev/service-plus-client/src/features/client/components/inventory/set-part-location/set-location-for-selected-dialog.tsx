import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { LocationOptionType, StockBalanceWithLocationType } from "@/features/client/types/set-part-location";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    locations:    LocationOptionType[];
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    parts:        StockBalanceWithLocationType[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

const thCls = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] px-2 py-1.5 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-3)]";
const tdCls = "px-2 py-1.5 border-b border-[var(--cl-border)] text-sm";

const setLocationForSelectedSchema = z.object({
    txn_date: z.string().min(1),
    ref_no:   z.string().optional(),
    remarks:  z.string().optional(),
});
type SetLocationForSelectedFormValues = z.infer<typeof setLocationForSelectedSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export const SetLocationForSelectedDialog = ({ locations, onOpenChange, onSuccess, open, parts }: Props) => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const form = useForm<SetLocationForSelectedFormValues>({
        defaultValues: { txn_date: today(), ref_no: "", remarks: "" },
        mode:          "onChange",
        resolver:      zodResolver(setLocationForSelectedSchema),
    });

    const [locationId,     setLocationId]     = useState<number>(0);
    const [rowLocationIds, setRowLocationIds] = useState<Record<number, number>>({});

    useEffect(() => {
        if (!open) {
            form.reset({ txn_date: today(), ref_no: "", remarks: "" });
            setLocationId(0);
            setRowLocationIds({});
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // When global location changes, apply to all rows
    useEffect(() => {
        if (locationId > 0) {
            setRowLocationIds(
                Object.fromEntries(parts.map(p => [p.part_id, locationId]))
            );
        }
    }, [locationId, parts]);

    function handleRowLocationChange(partId: number, locId: number) {
        setRowLocationIds(prev => ({ ...prev, [partId]: locId }));
    }

    const allRowsHaveLocation = parts.length > 0 && parts.every(p => (rowLocationIds[p.part_id] ?? 0) > 0);

    async function executeSave(values: SetLocationForSelectedFormValues) {
        if (!dbName || !schema || !currentBranch) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdateScript,
                variables: {
                    db_name: dbName,
                    schema,
                    value: encodeObj({
                        sql_id:   SQL_MAP.SET_PART_LOCATIONS,
                        sql_args: {
                            branch_id:        currentBranch.id,
                            location_ids:     parts.map(p => rowLocationIds[p.part_id]),
                            part_ids:         parts.map(p => p.part_id),
                            ref_no:           values.ref_no   || "",
                            remarks:          values.remarks || "",
                            transaction_date: values.txn_date,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_SET_PART_LOCATIONS);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_SET_PART_LOCATIONS_FAILED);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="flex max-h-[90vh] flex-col sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Set Location for Selected Parts
                    </DialogTitle>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1 pr-1">
                    {/* Fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="slfs_date">
                                Date <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="slfs_date"
                                type="date"
                                {...form.register("txn_date")}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="slfs_refno">Ref No</Label>
                            <Input
                                autoComplete="off"
                                id="slfs_refno"
                                placeholder="Optional"
                                {...form.register("ref_no")}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="slfs_remarks">Remarks</Label>
                            <Input
                                autoComplete="off"
                                id="slfs_remarks"
                                placeholder="Optional"
                                {...form.register("remarks")}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="slfs_location">
                                Location (apply to all) <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={locationId ? String(locationId) : ""}
                                onValueChange={(v) => setLocationId(Number(v))}
                            >
                                <SelectTrigger id="slfs_location">
                                    <SelectValue placeholder="Select location…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map((loc) => (
                                        <SelectItem key={loc.id} value={String(loc.id)}>
                                            {loc.location}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Selected parts table */}
                    <div>
                        <p className="mb-1.5 text-xs font-medium text-[var(--cl-text-muted)]">
                            Selected parts ({parts.length})
                        </p>
                        <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--cl-border)]">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className={thCls}>Part Code</th>
                                        <th className={thCls}>Part Name</th>
                                        <th className={thCls}>Current Location</th>
                                        <th className={thCls}>New Location <span className="text-red-500">*</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parts.map((p) => (
                                        <tr key={p.part_id} className="hover:bg-[var(--cl-surface-3)] last:[&>td]:border-b-0">
                                            <td className={`${tdCls} font-mono font-medium text-[var(--cl-text)]`}>{p.part_code}</td>
                                            <td className={`${tdCls} text-[var(--cl-text)]`}>{p.part_name}</td>
                                            <td className={`${tdCls} text-[var(--cl-text-muted)]`}>{p.location_name ?? "—"}</td>
                                            <td className={tdCls}>
                                                <Select
                                                    value={rowLocationIds[p.part_id] ? String(rowLocationIds[p.part_id]) : ""}
                                                    onValueChange={(v) => handleRowLocationChange(p.part_id, Number(v))}
                                                >
                                                    <SelectTrigger className="h-7 text-sm">
                                                        <SelectValue placeholder="Select…" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {locations.map((loc) => (
                                                            <SelectItem key={loc.id} value={String(loc.id)}>
                                                                {loc.location}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <DialogFooter className="pt-2">
                    <Button
                        disabled={form.formState.isSubmitting}
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                        disabled={!form.formState.isValid || !allRowsHaveLocation || form.formState.isSubmitting}
                        type="button"
                        onClick={() => void form.handleSubmit(executeSave)()}
                    >
                        {form.formState.isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
