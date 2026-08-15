"use client";

import { ChevronLeft, ChevronRight, ImageOff, Minus, Plus, ShoppingCart } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { imageUrl } from "@/lib/api";
import type { Part } from "@/lib/types";

type Props = {
  part: Part;
  index: number;
  onClick: () => void;
  onAddToCart: (part: Part, qty: number) => void;
};

export function PartCard({ part, index, onClick, onAddToCart }: Props) {
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  // Falls back to the single cover photo when the list endpoint hasn't shipped
  // the full gallery yet (older backend deploys only send `imageUrl`).
  const images = part.images.length > 0 ? part.images : part.imageUrl ? [part.imageUrl] : [];
  const hasGallery = images.length > 1;

  function showImage(e: MouseEvent, i: number) {
    e.stopPropagation();
    setActiveImage((i + images.length) % images.length);
  }

  return (
    <Card className="gap-0 py-0 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="block w-full cursor-pointer text-left"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-t-xl bg-muted">
          <span className="absolute top-1.5 left-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-background/80 px-1 text-[11px] font-medium tabular-nums text-foreground shadow-sm backdrop-blur-sm">
            {index}
          </span>
          {images.length > 0 ? (
            // Static export, unoptimized images (next.config.ts) — a plain <img> avoids
            // next/image's loader entirely, same as every other image in this app.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(images[activeImage])}
              alt={
                activeImage === 0 ? part.partName : `${part.partName} — photo ${activeImage + 1}`
              }
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-8" />
            </div>
          )}

          {hasGallery && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(e) => showImage(e, activeImage - 1)}
                className="absolute top-1/2 left-1 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-background/70 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background/90"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => showImage(e, activeImage + 1)}
                className="absolute top-1/2 right-1 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-background/70 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background/90"
              >
                <ChevronRight className="size-3.5" />
              </button>
              <div className="absolute inset-x-0 bottom-1.5 z-10 flex justify-center gap-1">
                {images.map((img, i) => (
                  <button
                    key={img}
                    type="button"
                    aria-label={`Show photo ${i + 1}`}
                    onClick={(e) => showImage(e, i)}
                    className={cn(
                      "size-1.5 rounded-full shadow-sm transition-colors",
                      i === activeImage ? "bg-primary" : "bg-background/70",
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <CardContent className="space-y-1 pt-3">
          {part.partCode && (
            <p className="line-clamp-1 font-mono text-[11px] text-muted-foreground">
              {part.partCode}
            </p>
          )}
          <p className="line-clamp-1 text-sm font-medium">{part.partName}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{part.model ?? " "}</p>
          <p className="text-base font-semibold">₹{part.price.toFixed(2)}</p>
        </CardContent>
      </div>

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
