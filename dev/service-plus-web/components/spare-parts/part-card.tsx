"use client";

import { ImageOff, Minus, Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { imageUrl } from "@/lib/api";
import type { Part } from "@/lib/types";

type Props = {
  part: Part;
  onClick: () => void;
  onAddToCart: (part: Part, qty: number) => void;
};

export function PartCard({ part, onClick, onAddToCart }: Props) {
  const [qty, setQty] = useState(1);

  return (
    <Card className="gap-0 py-0 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
      <button type="button" onClick={onClick} className="block w-full cursor-pointer text-left">
        <div className="aspect-square w-full overflow-hidden rounded-t-xl bg-muted">
          {part.imageUrl ? (
            // Static export, unoptimized images (next.config.ts) — a plain <img> avoids
            // next/image's loader entirely, same as every other image in this app.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(part.imageUrl)}
              alt={part.partName}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-8" />
            </div>
          )}
        </div>
        <CardContent className="space-y-1 pt-3">
          <p className="line-clamp-1 text-sm font-medium">{part.partName}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{part.model ?? " "}</p>
          <p className="text-base font-semibold">₹{part.price.toFixed(2)}</p>
        </CardContent>
      </button>

      <CardContent className="flex items-center gap-1.5 pt-2 pb-4">
        <div className="flex items-center gap-0.5 rounded-md border border-input">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            <Minus className="size-3" />
          </Button>
          <span className="w-5 text-center text-xs tabular-nums">{qty}</span>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => setQty((q) => q + 1)}>
            <Plus className="size-3" />
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => {
            onAddToCart(part, qty);
            setQty(1);
            toast.success(`Added "${part.partName}" to cart.`);
          }}
        >
          <ShoppingCart className="size-3.5" />
          Add
        </Button>
      </CardContent>
    </Card>
  );
}
