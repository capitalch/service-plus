"use client";

import { CheckCircle2, Phone } from "lucide-react";

type Props = {
  orderId: number;
  branchName: string;
  supportPhone: string | null;
};

export function OrderConfirmation({ orderId, branchName, supportPhone }: Props) {
  return (
    <div className="space-y-4 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="size-7" />
      </span>
      <div>
        <p className="text-lg font-semibold">Order request received</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Order #{orderId} — {branchName}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        No online payment. No return or replacement once shipped. Our team will contact you to
        arrange delivery and billing.
      </div>

      {supportPhone && (
        <p className="flex items-center justify-center gap-1.5 text-sm">
          <Phone className="size-4 text-primary" />
          Questions? Call {branchName}:{" "}
          <a href={`tel:${supportPhone}`} className="font-medium underline underline-offset-2">
            {supportPhone}
          </a>
        </p>
      )}
    </div>
  );
}
