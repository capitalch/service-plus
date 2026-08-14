"use client";

import { ImageOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchPartById, imageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PartDetail } from "@/lib/types";

type Props = {
  company: string;
  branch: string;
  partId: number;
  onClose: () => void;
};

export function PartDetailDialog({ company, branch, partId, onClose }: Props) {
  const [detail, setDetail] = useState<PartDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setDetail(null);
    setActiveImage(0);

    fetchPartById({ company, branch, partId })
      .then(setDetail)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [company, branch, partId]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{detail?.partName ?? "Part details"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !detail ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Couldn&apos;t load this part. Please try again.
          </p>
        ) : (
          <div className="space-y-4">
            {detail.images.length > 0 ? (
              <div className="space-y-2">
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(detail.images[activeImage])}
                    alt={
                      activeImage === 0
                        ? detail.partName
                        : `${detail.partName} — photo ${activeImage + 1}`
                    }
                    className="h-full w-full object-cover"
                  />
                </div>
                {detail.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {detail.images.map((img, index) => (
                      <button
                        key={img}
                        type="button"
                        onClick={() => setActiveImage(index)}
                        className={cn(
                          "size-14 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 transition-colors",
                          index === activeImage ? "border-primary" : "border-transparent",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl(img)}
                          alt={`${detail.partName} — photo ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ImageOff className="size-10" />
              </div>
            )}

            <div className="space-y-1">
              {detail.model && (
                <p className="text-sm text-muted-foreground">Model: {detail.model}</p>
              )}
              {detail.partDescription && <p className="text-sm">{detail.partDescription}</p>}
            </div>

            <p className="text-xl font-semibold">₹{detail.price.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              Prices are indicative and subject to change without prior notice.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
