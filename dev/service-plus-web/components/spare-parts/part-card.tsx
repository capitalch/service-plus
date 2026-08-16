"use client";

import { ChevronLeft, ChevronRight, ImageOff, Images, Minus, Plus, ShoppingCart } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { imageUrl } from "@/lib/api";
import type { Part } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  part: Part;
  index: number;
  onClick: () => void;
  onAddToCart: (part: Part, qty: number) => void;
};

export function PartCard({ part, index, onClick, onAddToCart }: Props) {
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const images = part.images.length > 0 ? part.images : part.imageUrl ? [part.imageUrl] : [];
  const hasGallery = images.length > 1;

  function showImage(e: MouseEvent, i: number) {
    e.stopPropagation();
    setActiveImage((i + images.length) % images.length);
  }

  return (
    <Card className="gap-0 overflow-hidden py-0 transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-xl hover:shadow-primary/10">
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
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <span className="absolute top-2 left-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-card/85 px-1.5 text-xs font-semibold tabular-nums text-foreground shadow-sm backdrop-blur-sm">
            {index}
          </span>
          {hasGallery && (
            <span
              className="absolute top-2 right-2 z-10 flex h-6 items-center gap-1 rounded-full bg-card/85 px-2 text-xs font-medium tabular-nums text-foreground shadow-sm backdrop-blur-sm"
              aria-label={`Photo ${activeImage + 1} of ${images.length}`}
            >
              <Images className="size-3" aria-hidden="true" />
              {activeImage + 1}/{images.length}
            </span>
          )}
          {images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(images[activeImage])}
              alt={
                activeImage === 0 ? part.partName : `${part.partName} — photo ${activeImage + 1}`
              }
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
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
                className="absolute top-1/2 left-2 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-card/80 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => showImage(e, activeImage + 1)}
                className="absolute top-1/2 right-2 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-card/80 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card"
              >
                <ChevronRight className="size-4" />
              </button>
              <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1">
                {images.map((img, i) => (
                  <button
                    key={img}
                    type="button"
                    aria-label={`Show photo ${i + 1}`}
                    onClick={(e) => showImage(e, i)}
                    className={cn(
                      "size-1.5 cursor-pointer rounded-full shadow-sm transition-colors",
                      i === activeImage ? "bg-primary" : "bg-card/80",
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <CardContent className="space-y-1 pt-3">
          <p className="line-clamp-1 text-[11px] text-muted-foreground">
            {part.partCode && <span className="font-mono">Part Code: {part.partCode}</span>}
            {part.partCode && part.brandName ? " · " : null}
            {part.brandName}
            {!part.partCode && !part.brandName ? " " : null}
          </p>
          <p className="line-clamp-3 h-[3.75rem] text-sm leading-5 font-medium">
            {part.partName}
            {part.partDescription && (
              <span className="font-normal text-muted-foreground"> · {part.partDescription}</span>
            )}
            {part.model && <span className="font-normal text-muted-foreground"> · {part.model}</span>}
          </p>
          <p className="text-base font-bold">₹{part.price.toFixed(2)}</p>
        </CardContent>
      </div>

      <CardContent className="mt-auto flex items-center gap-1.5 pt-2 pb-4">
        <div className="flex items-center gap-0.5 rounded-lg border border-input">
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
