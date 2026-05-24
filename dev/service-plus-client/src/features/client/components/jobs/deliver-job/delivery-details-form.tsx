import type { UseFormReturn } from "react-hook-form";

import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import type { DeliverJobFormValues } from "./deliver-job-schema";
import { PAYMENT_MODES, fmtCurrency } from "./deliver-job-helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

type DeliveryMannerRow = {
    id:   number;
    name: string;
};

type Props = {
    form:            UseFormReturn<DeliverJobFormValues>;
    deliveryManners: DeliveryMannerRow[];
    balance:         number;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function DeliveryDetailsForm({ form, deliveryManners, balance }: Props) {
    const payAmt = Number(form.watch("payment_amount")) || 0;

    return (
        <>
            {/* Card 1 — Delivery Details */}
            <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-(--cl-text-muted)">
                    Delivery Details
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <Label
                            className="mb-1.5 block text-sm font-medium text-(--cl-text)"
                            htmlFor="dj-delivery-date"
                        >
                            Delivery Date <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="dj-delivery-date"
                            type="date"
                            className="h-9 border-(--cl-border) bg-white text-sm"
                            {...form.register("delivery_date")}
                        />
                    </div>
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium text-(--cl-text)">
                            Delivery Manner <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={form.watch("delivery_manner")}
                            onValueChange={v => form.setValue("delivery_manner", v, { shouldValidate: true })}
                        >
                            <SelectTrigger className="h-9 border-(--cl-border) bg-white text-sm">
                                <SelectValue placeholder="Select manner" />
                            </SelectTrigger>
                            <SelectContent>
                                {deliveryManners.map(m => (
                                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label
                            className="mb-1.5 block text-sm font-medium text-(--cl-text)"
                            htmlFor="dj-txn-remarks"
                        >
                            Transaction Remarks
                        </Label>
                        <Textarea
                            id="dj-txn-remarks"
                            placeholder="Optional remarks…"
                            rows={1}
                            className="h-9 min-h-[36px] border-(--cl-border) bg-white text-sm resize-none"
                            {...form.register("remarks")}
                        />
                    </div>
                </div>
            </div>

            {/* Card 2 — Optional Payment at Delivery */}
            <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-(--cl-text-muted)">
                    Payment at Delivery
                </p>
                <p className="mb-3 text-xs text-(--cl-text-muted)">
                    Leave amount = 0 to skip inserting a payment record.
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    <div>
                        <Label
                            className="mb-1.5 block text-sm font-medium text-(--cl-text)"
                            htmlFor="dj-pay-date"
                        >
                            Payment Date
                        </Label>
                        <Input
                            id="dj-pay-date"
                            type="date"
                            className="h-9 border-(--cl-border) bg-white text-sm"
                            {...form.register("payment_date")}
                        />
                    </div>
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium text-(--cl-text)">
                            Payment Mode
                        </Label>
                        <Select
                            value={form.watch("payment_mode")}
                            onValueChange={v => form.setValue("payment_mode", v, { shouldValidate: true })}
                        >
                            <SelectTrigger className="h-9 border-(--cl-border) bg-white text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PAYMENT_MODES.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label
                            className="mb-1.5 block text-sm font-medium text-(--cl-text)"
                            htmlFor="dj-pay-amount"
                        >
                            Amount
                        </Label>
                        <Input
                            id="dj-pay-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-9 border-(--cl-border) bg-white text-sm text-right tabular-nums"
                            {...form.register("payment_amount")}
                        />
                    </div>
                    <div>
                        <Label
                            className="mb-1.5 block text-sm font-medium text-(--cl-text)"
                            htmlFor="dj-ref-no"
                        >
                            Reference No
                        </Label>
                        <Input
                            id="dj-ref-no"
                            placeholder="Optional"
                            className="h-9 border-(--cl-border) bg-white text-sm"
                            {...form.register("payment_reference")}
                        />
                    </div>
                    <div>
                        <Label
                            className="mb-1.5 block text-sm font-medium text-(--cl-text)"
                            htmlFor="dj-pay-remarks"
                        >
                            Remarks
                        </Label>
                        <Input
                            id="dj-pay-remarks"
                            placeholder="Optional"
                            className="h-9 border-(--cl-border) bg-white text-sm"
                            {...form.register("payment_remarks")}
                        />
                    </div>
                </div>

                {balance > 0 && payAmt === 0 && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        Balance of {fmtCurrency(balance)} is outstanding — enter an amount here or use "Add Receipt" above to record a payment separately.
                    </p>
                )}
            </div>
        </>
    );
}
