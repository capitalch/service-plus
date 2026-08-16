"use client";

import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-0">
        <SheetHeader className="border-b border-border/60 p-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="size-4" />
            Your cart
          </SheetTitle>
          <SheetDescription>
            {lines.length === 0 ? "Your cart is empty." : `${lines.length} item${lines.length === 1 ? "" : "s"} in your cart.`}
          </SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <ShoppingCart className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              Browse the catalogue and add parts to get started.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {lines.map((line) => (
                <div key={line.partId} className="flex items-center gap-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
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
                  <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-input">
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
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-border/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-bold">₹{totalAmount.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Prices are indicative and subject to change without prior notice.
              </p>
              <Button type="button" size="lg" className="w-full" onClick={onCheckout}>
                Proceed to checkout
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
