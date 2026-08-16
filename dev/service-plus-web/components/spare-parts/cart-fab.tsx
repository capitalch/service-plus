"use client";

import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  totalQty: number;
  totalAmount: number;
  onOpen: () => void;
};

export function CartFab({ totalQty, totalAmount, onOpen }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
      className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6"
    >
      <Button
        type="button"
        size="lg"
        onClick={onOpen}
        className="gap-2.5 rounded-full px-5 shadow-xl shadow-primary/30"
        aria-label="Open cart"
      >
        <span className="relative">
          <ShoppingCart className="size-5" />
          {totalQty > 0 && (
            <motion.span
              key={totalQty}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              className="absolute -top-2.5 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1 text-[11px] font-bold text-primary shadow-sm"
            >
              {totalQty}
            </motion.span>
          )}
        </span>
        <span className="tabular-nums">
          {totalAmount > 0 ? `₹${totalAmount.toFixed(0)}` : "Cart"}
        </span>
      </Button>
    </motion.div>
  );
}
