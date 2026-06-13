import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectDefaultGstRate, selectDefaultHsnForSparePart, selectSchema } from "@/store/context-slice";
import { PartCodeInput, type PartRow } from "@/features/client/components/inventory/part-code-input";

import type { ConsumptionRow } from "./part-used-schema";

const applyMarkup = (cost: number, pct: number) =>
    Math.round(cost * (1 + pct / 100) * 100) / 100;

function PriceInput({ value, className, onChange }: {
    value: number; onChange: (v: number) => void; className?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [raw, setRaw] = useState("");
    return (
        <Input
            className={className}
            inputMode="decimal"
            type="text"
            value={editing ? raw : value.toFixed(2)}
            onChange={e => setRaw(e.target.value)}
            onFocus={e => { setEditing(true); setRaw(value === 0 ? "" : String(value)); setTimeout(() => e.target.select(), 0); }}
            onBlur={() => { const n = Math.max(0, parseFloat(raw) || 0); onChange(n); setEditing(false); }}
        />
    );
}

type Props = {
    row:       ConsumptionRow | null;
    markupPct: number;
    onClose:   () => void;
    onSaved:   () => void;
};

export const EditPartUsedDialog = ({ row, markupPct, onClose, onSaved }: Props) => {
    const dbName               = useAppSelector(selectDbName);
    const schema               = useAppSelector(selectSchema);
    const defaultGstRate       = useAppSelector(selectDefaultGstRate);
    const defaultHsn           = useAppSelector(selectDefaultHsnForSparePart);

    const [editPartId,       setEditPartId]       = useState<number | null>(null);
    const [editPartCode,     setEditPartCode]     = useState("");
    const [editPartName,     setEditPartName]     = useState("");
    const [editBrandId,      setEditBrandId]      = useState<number | null>(null);
    const [editQty,          setEditQty]          = useState(1);
    const [editCostPrice,    setEditCostPrice]    = useState(0);
    const [editSellingPrice, setEditSellingPrice] = useState(0);
    const [editGstRate,      setEditGstRate]      = useState(0);
    const [editHsnCode,      setEditHsnCode]      = useState("");
    const [editRemarks,      setEditRemarks]      = useState("");
    const [saving,           setSaving]           = useState(false);

    useEffect(() => {
        if (!row) return;
        setEditPartId(row.part_id);
        setEditPartCode(row.part_code);
        setEditPartName(row.part_name);
        setEditBrandId(row.brand_id);
        setEditQty(Number(row.qty));
        setEditCostPrice(Number(row.cost_price));
        setEditSellingPrice(Number(row.selling_price));
        setEditGstRate(Number(row.gst_rate));
        setEditHsnCode(row.hsn_code ?? "");
        setEditRemarks(row.remarks ?? "");
    }, [row]);

    const handlePartSelect = (part: PartRow) => {
        const cost = part.cost_price ?? 0;
        setEditPartId(part.id);
        setEditPartCode(part.part_code);
        setEditPartName(part.part_name);
        setEditBrandId(part.brand_id);
        setEditCostPrice(cost);
        setEditSellingPrice(markupPct > 0 ? applyMarkup(cost, markupPct) : (part.selling_price ?? 0));
        setEditGstRate((part.gst_rate ?? 0) > 0 ? (part.gst_rate ?? 0) : (Number(defaultGstRate) || 0));
        setEditHsnCode((part.hsn_code ?? "").trim() || (defaultHsn ?? ""));
    };

    const handleSave = async () => {
        if (!row || !dbName || !schema || !editPartId) return;
        setSaving(true);
        try {
            const xData: Record<string, unknown> = {
                id:            row.id,
                part_id:       editPartId,
                qty:           editQty,
                cost_price:    editCostPrice,
                selling_price: editSellingPrice,
                gst_rate:      editGstRate,
                hsn_code:      editHsnCode.trim() || null,
                remarks:       editRemarks.trim() || null,
            };
            if (row.stock_transaction_id) {
                xData.xDetails = {
                    tableName: "stock_transaction",
                    fkeyName:  "job_part_used_id",
                    xData: {
                        id:      row.stock_transaction_id,
                        part_id: editPartId,
                        qty:     editQty,
                        remarks: editRemarks.trim() || null,
                    },
                };
            }
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericUpdateValue({ tableName: "job_part_used", xData }),
                },
            });
            toast.success(MESSAGES.SUCCESS_PART_USED_UPDATED);
            onSaved();
        } catch { toast.error(MESSAGES.ERROR_PART_USED_UPDATE_FAILED); }
        finally { setSaving(false); }
    };

    return (
        <Dialog open={row !== null} onOpenChange={open => { if (!open && !saving) onClose(); }}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-sm bg-white! text-(--cl-text)"
                onPointerDownOutside={e => e.preventDefault()}
                onEscapeKeyDown={e => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>Edit Part Usage</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-1">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) mb-0.5">Job</p>
                        <p className="text-sm font-mono font-medium text-(--cl-accent)">{row?.job_no}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) mb-1">
                            Part Code <span className="text-red-500">*</span>
                        </p>
                        <PartCodeInput
                            partCode={editPartCode}
                            partId={editPartId}
                            partName={editPartName}
                            brandId={editBrandId}
                            selectedBrandId={editBrandId}
                            showName={true}
                            onChange={setEditPartCode}
                            onClear={() => { setEditPartId(null); setEditPartCode(""); setEditPartName(""); }}
                            onSelect={handlePartSelect}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) mb-1 block">
                                Qty <span className="text-red-500">*</span>
                            </label>
                            <Input
                                className="h-9 border-(--cl-border) bg-(--cl-surface)"
                                min={0.01}
                                step="0.01"
                                type="number"
                                value={editQty}
                                onChange={e => setEditQty(Number(e.target.value))}
                                onFocus={e => e.target.select()}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) mb-1 block">GST %</label>
                            <PriceInput
                                className="h-9 border-(--cl-border) bg-(--cl-surface)"
                                value={editGstRate}
                                onChange={setEditGstRate}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) mb-1 block">Cost Price</label>
                            <PriceInput
                                className="h-9 border-(--cl-border) bg-(--cl-surface)"
                                value={editCostPrice}
                                onChange={cost => {
                                    setEditCostPrice(cost);
                                    if (markupPct > 0) setEditSellingPrice(applyMarkup(cost, markupPct));
                                }}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) mb-1 block">Selling Price</label>
                            <PriceInput
                                className="h-9 border-(--cl-border) bg-(--cl-surface)"
                                value={editSellingPrice}
                                onChange={setEditSellingPrice}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) mb-1 block">HSN Code</label>
                        <Input
                            className="h-9 border-(--cl-border) bg-(--cl-surface)"
                            placeholder="HSN code…"
                            value={editHsnCode}
                            onChange={e => setEditHsnCode(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) mb-1 block">Remarks</label>
                        <Input
                            className="h-9 border-(--cl-border) bg-(--cl-surface)"
                            placeholder="Optional remarks…"
                            value={editRemarks}
                            onChange={e => setEditRemarks(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button disabled={saving} variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={saving || editQty <= 0 || !editPartId}
                        onClick={() => void handleSave()}
                    >
                        {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
