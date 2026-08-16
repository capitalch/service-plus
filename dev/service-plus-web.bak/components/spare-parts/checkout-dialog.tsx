"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PartOrderResult } from "@/lib/types";

import { CheckoutForm, type CheckoutFormValues } from "./checkout-form";
import { OrderConfirmation } from "./order-confirmation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onSubmit: (values: CheckoutFormValues) => void;
  orderResult: PartOrderResult | null;
  branchName: string;
  supportPhone: string | null;
};

/** Small orchestrating wrapper — swaps CheckoutForm for OrderConfirmation in the
 * same dialog once an order is placed (Step 26's "wire cart → checkout → confirmation"). */
export function CheckoutDialog({
  open,
  onOpenChange,
  submitting,
  onSubmit,
  orderResult,
  branchName,
  supportPhone,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{orderResult ? "Order request sent" : "Checkout"}</DialogTitle>
        </DialogHeader>
        {orderResult ? (
          <OrderConfirmation
            orderId={orderResult.orderId}
            branchName={branchName}
            supportPhone={supportPhone}
          />
        ) : (
          <CheckoutForm submitting={submitting} onSubmit={onSubmit} />
        )}
      </DialogContent>
    </Dialog>
  );
}
