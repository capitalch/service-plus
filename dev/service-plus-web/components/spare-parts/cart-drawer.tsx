"use client";

import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { imageUrl } from "@/lib/api";
import type { CartLine } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: CartLine[];
  totalAmount: number;
  onUpdateQty: (partId: number, qty: number) => void;
  onRemove: (partId: number) => void;
  onCheckout: () => void;
};

export function CartDrawer({
  open,
  onOpenChange,
  lines,
  totalAmount,
  onUpdateQty,
  onRemove,
  onCheckout,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="size-4" />
            Your cart
          </DialogTitle>
        </DialogHeader>

        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Your cart is empty.</p>
        ) : (
          <div className="space-y-4">
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {lines.map((line) => (
                <div key={line.partId} className="flex items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {line.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl(line.imageUrl)}
                        alt={line.partName}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.partName}</p>
                    <p className="text-xs text-muted-foreground">₹{line.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-input">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onUpdateQty(line.partId, line.qty - 1)}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-5 text-center text-xs tabular-nums">{line.qty}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onUpdateQty(line.partId, line.qty + 1)}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemove(line.partId)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-semibold">₹{totalAmount.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Prices are indicative and subject to change without prior notice.
            </p>
            <Button type="button" className="w-full" onClick={onCheckout}>
              Proceed to checkout
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
