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
      <CheckCircle2 className="mx-auto size-10 text-primary" />
      <div>
        <p className="text-lg font-semibold">Order request received</p>
        <p className="text-sm text-muted-foreground">
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
          <a href={`tel:${supportPhone}`} className="font-medium underline">
            {supportPhone}
          </a>
        </p>
      )}
    </div>
  );
}
