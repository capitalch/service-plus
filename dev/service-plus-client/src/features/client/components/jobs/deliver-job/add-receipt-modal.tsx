import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";

import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
    addReceiptSchema, getAddReceiptDefaults,
    type AddReceiptFormValues,
} from "./deliver-job-schema";
import { PAYMENT_MODES } from "./deliver-job-helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
    open:           boolean;
    defaultAmount?: number;
    onClose:        () => void;
    onSave:         (values: AddReceiptFormValues) => Promise<void>;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AddReceiptModal({ open, defaultAmount = 0, onClose, onSave }: Props) {
    const form = useForm<AddReceiptFormValues>({
        defaultValues: getAddReceiptDefaults(defaultAmount),
        mode:          "onChange",
        resolver:      zodResolver(addReceiptSchema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    // Reset with fresh defaults whenever the modal opens
    useEffect(() => {
        if (open) form.reset(getAddReceiptDefaults(defaultAmount));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleSave(values: AddReceiptFormValues) {
        await onSave(values);
        // onSave is responsible for closing via onClose if successful
    }

    const isSubmitting  = form.formState.isSubmitting;
    const paymentMode   = useWatch({ control: form.control, name: "payment_mode" });

    return (
        <Dialog
            open={open}
            onOpenChange={o => { if (!o && !isSubmitting) onClose(); }}
        >
            <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Add Receipt</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* Payment Date */}
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-(--cl-text)" htmlFor="ar-date">
                            Payment Date <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="ar-date"
                            type="date"
                            className="h-9 text-sm border-(--cl-border)"
                            {...form.register("payment_date")}
                        />
                    </div>

                    {/* Payment Mode */}
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-(--cl-text)">
                            Payment Mode <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={paymentMode}
                            onValueChange={v => form.setValue("payment_mode", v, { shouldValidate: true })}
                        >
                            <SelectTrigger className="h-9 text-sm border-(--cl-border)">
                                <SelectValue placeholder="Select mode" />
                            </SelectTrigger>
                            <SelectContent>
                                {PAYMENT_MODES.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Amount */}
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-(--cl-text)" htmlFor="ar-amount">
                            Amount <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="ar-amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="h-9 text-sm text-right tabular-nums border-(--cl-border)"
                            {...form.register("amount")}
                        />
                        {form.formState.errors.amount && (
                            <p className="mt-0.5 text-xs text-red-500">
                                {form.formState.errors.amount.message}
                            </p>
                        )}
                    </div>

                    {/* Reference No */}
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-(--cl-text)" htmlFor="ar-ref">
                            Reference No
                        </Label>
                        <Input
                            id="ar-ref"
                            placeholder="Optional"
                            className="h-9 text-sm border-(--cl-border)"
                            {...form.register("reference_no")}
                        />
                    </div>

                    {/* Remarks */}
                    <div>
                        <Label className="mb-1 block text-sm font-medium text-(--cl-text)" htmlFor="ar-remarks">
                            Remarks
                        </Label>
                        <Input
                            id="ar-remarks"
                            placeholder="Optional"
                            className="h-9 text-sm border-(--cl-border)"
                            {...form.register("remarks")}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed"
                        disabled={!form.formState.isValid || isSubmitting}
                        onClick={form.handleSubmit(handleSave)}
                    >
                        {isSubmitting
                            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            : <Save className="mr-1.5 h-3.5 w-3.5" />
                        }
                        Save Receipt
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
