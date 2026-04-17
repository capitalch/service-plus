import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { LocationOptionType, SetLocationLineType } from "@/features/client/types/set-part-location";
import { emptyLine } from "@/features/client/types/set-part-location";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    locations:   LocationOptionType[];
    open:        boolean;
    onOpenChange:(open: boolean) => void;
    onSuccess:   () => void;
};

type PartQueryRow = {
    part_id:       number;
    part_code:     string;
    part_name:     string;
    uom:           string | null;
    qty:           number;
    location_id:   number | null;
    location_name: string | null;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

const thCls = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] px-2 py-1.5 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-3)]";
const tdCls = "px-2 py-1 border-b border-[var(--cl-border)] text-sm align-top";

// ─── Row component (isolates debounce per row) ────────────────────────────────

type RowProps = {
    line:        SetLocationLineType;
    locations:   LocationOptionType[];
    allPartCodes:string[];
    dbName:      string | null;
    schema:      string | null;
    branchId:    number;
    index:       number;
    onUpdate:    (key: string, patch: Partial<SetLocationLineType>) => void;
    onRemove:    (key: string) => void;
    canRemove:   boolean;
};

function LocationRow({ line, locations, allPartCodes, dbName, schema, branchId, index, onUpdate, onRemove, canRemove }: RowProps) {
    const debouncedCode = useDebounce(line.part_code, 800);

    useEffect(() => {
        const code = debouncedCode.trim();
        if (!code) {
            onUpdate(line._key, { part_id: null, part_name: "", error: null, validating: false });
            return;
        }
        // Duplicate check within the dialog
        const dupeCount = allPartCodes.filter(c => c.trim().toLowerCase() === code.toLowerCase()).length;
        if (dupeCount > 1) {
            onUpdate(line._key, { part_id: null, part_name: "", error: "Part already added", validating: false });
            return;
        }
        if (!dbName || !schema) return;
        onUpdate(line._key, { validating: true, error: null });
        apolloClient
            .query<GenericQueryData<PartQueryRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: branchId, part_code: code },
                        sqlId:   SQL_MAP.GET_PART_IN_STOCK_BY_CODE,
                    }),
                },
            })
            .then((res) => {
                const row = res.data?.genericQuery?.[0];
                if (row) {
                    onUpdate(line._key, {
                        part_id:   row.part_id,
                        part_name: row.part_name,
                        error:     null,
                        validating: false,
                    });
                } else {
                    onUpdate(line._key, {
                        part_id:   null,
                        part_name: "",
                        error:     MESSAGES.ERROR_SET_PART_LOCATION_PART_NOT_FOUND,
                        validating: false,
                    });
                }
            })
            .catch(() => onUpdate(line._key, { part_id: null, part_name: "", error: "Validation error", validating: false }));
    }, [debouncedCode]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <tr>
            <td className={`${tdCls} w-8 text-center text-xs text-[var(--cl-text-muted)]`}>{index + 1}</td>
            <td className={tdCls}>
                <div className="flex flex-col gap-0.5">
                    <Input
                        autoComplete="off"
                        className="h-7 text-sm"
                        placeholder="Part code"
                        value={line.part_code}
                        onChange={(e) => onUpdate(line._key, { part_code: e.target.value, part_id: null, part_name: "", error: null })}
                    />
                    {line.validating && (
                        <span className="flex items-center gap-1 text-xs text-[var(--cl-text-muted)]">
                            <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                        </span>
                    )}
                    {line.error && <span className="text-xs text-red-500">{line.error}</span>}
                </div>
            </td>
            <td className={`${tdCls} text-[var(--cl-text-muted)]`}>
                {line.part_name || <span className="text-[var(--cl-text-muted)] opacity-40">—</span>}
            </td>
            <td className={tdCls}>
                <Select
                    value={line.location_id ? String(line.location_id) : ""}
                    onValueChange={(v) => onUpdate(line._key, { location_id: Number(v) })}
                >
                    <SelectTrigger className="h-7 text-sm">
                        <SelectValue placeholder="Select location" />
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
            <td className={`${tdCls} w-8 text-center`}>
                {canRemove && (
                    <Button
                        className="h-6 w-6 text-red-500 hover:text-red-600"
                        size="icon"
                        type="button"
                        variant="ghost"
                        onClick={() => onRemove(line._key)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                )}
            </td>
        </tr>
    );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

export const SetPartLocationDialog = ({ locations, open, onOpenChange, onSuccess }: Props) => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    // Header state
    const [txnDate,    setTxnDate]    = useState(today());
    const [refNo,      setRefNo]      = useState("");
    const [remarks,    setRemarks]    = useState("");
    const [applyToAll, setApplyToAll] = useState<number>(0);

    // Lines state
    const [lines,      setLines]      = useState<SetLocationLineType[]>([emptyLine()]);
    const [submitting, setSubmitting] = useState(false);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setTxnDate(today());
            setRefNo("");
            setRemarks("");
            setApplyToAll(0);
            setLines([emptyLine()]);
            setSubmitting(false);
        }
    }, [open]);

    function handleUpdate(key: string, patch: Partial<SetLocationLineType>) {
        setLines(prev => prev.map(l => l._key === key ? { ...l, ...patch } : l));
    }

    function handleRemove(key: string) {
        setLines(prev => prev.filter(l => l._key !== key));
    }

    function handleAddRow() {
        setLines(prev => [...prev, emptyLine()]);
    }

    function handleApplyToAll(locationId: number) {
        setApplyToAll(locationId);
        setLines(prev => prev.map(l => ({ ...l, location_id: locationId })));
    }

    const allPartCodes = lines.map(l => l.part_code);

    const canSave =
        !submitting &&
        txnDate.length > 0 &&
        lines.length > 0 &&
        lines.every(l => !l.validating && !l.error && l.part_id !== null && l.location_id !== null);

    async function handleSubmit() {
        if (!canSave || !dbName || !schema || !currentBranch) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdateScript,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        sql_id:   SQL_MAP.SET_PART_LOCATIONS,
                        sql_args: {
                            branch_id:        currentBranch.id,
                            part_ids:         lines.map(l => l.part_id),
                            location_ids:     lines.map(l => l.location_id),
                            transaction_date: txnDate,
                            ref_no:           refNo    || "",
                            remarks:          remarks  || "",
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_SET_PART_LOCATIONS);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_SET_PART_LOCATIONS_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="flex max-h-[90vh] flex-col sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Set Part Location
                    </DialogTitle>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1 pr-1">
                    {/* ── Header fields ─────────────────────────────────────── */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="spl_date">
                                Date <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="spl_date"
                                type="date"
                                value={txnDate}
                                onChange={(e) => setTxnDate(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="spl_refno">Ref No</Label>
                            <Input
                                autoComplete="off"
                                id="spl_refno"
                                placeholder="Optional"
                                value={refNo}
                                onChange={(e) => setRefNo(e.target.value)}
                            />
                        </div>
                        <div className="col-span-2 flex flex-col gap-1.5">
                            <Label htmlFor="spl_remarks">Remarks</Label>
                            <Input
                                autoComplete="off"
                                id="spl_remarks"
                                placeholder="Optional"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* ── Apply to All ──────────────────────────────────────── */}
                    <div className="flex items-center gap-3 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-3 py-2">
                        <span className="shrink-0 text-sm font-medium text-[var(--cl-text)]">Apply location to all rows:</span>
                        <Select
                            value={applyToAll ? String(applyToAll) : ""}
                            onValueChange={(v) => handleApplyToAll(Number(v))}
                        >
                            <SelectTrigger className="h-8 flex-1 text-sm">
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

                    {/* ── Lines table ───────────────────────────────────────── */}
                    <div className="overflow-x-auto rounded-lg border border-[var(--cl-border)]">
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th className={`${thCls} w-8 text-center`}>#</th>
                                    <th className={thCls}>Part Code <span className="text-red-500">*</span></th>
                                    <th className={thCls}>Part Name</th>
                                    <th className={thCls}>Location <span className="text-red-500">*</span></th>
                                    <th className={`${thCls} w-8`} />
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((line, idx) => (
                                    <LocationRow
                                        key={line._key}
                                        allPartCodes={allPartCodes}
                                        branchId={currentBranch?.id ?? 0}
                                        canRemove={lines.length > 1}
                                        dbName={dbName}
                                        index={idx}
                                        line={line}
                                        locations={locations}
                                        schema={schema}
                                        onRemove={handleRemove}
                                        onUpdate={handleUpdate}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <Button
                        className="self-start"
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={handleAddRow}
                    >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add Row
                    </Button>
                </div>

                <DialogFooter className="pt-2">
                    <Button
                        disabled={submitting}
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                        disabled={!canSave}
                        type="button"
                        onClick={handleSubmit}
                    >
                        {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
