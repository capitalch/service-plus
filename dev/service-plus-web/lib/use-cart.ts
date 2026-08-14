"use client";

import { useEffect, useState } from "react";

import { loadCart, saveCart } from "./cart";
import type { CartLine, Part } from "./types";

export function useCart(company: string | null, branch: string | null) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    setLines(company && branch ? loadCart(company, branch) : []);
  }, [company, branch]);

  function update(next: CartLine[]) {
    setLines(next);
    if (company && branch) saveCart(company, branch, next);
  }

  function addLine(part: Part, qty: number) {
    const existing = lines.find((line) => line.partId === part.id);
    const next = existing
      ? lines.map((line) => (line.partId === part.id ? { ...line, qty: line.qty + qty } : line))
      : [
          ...lines,
          { partId: part.id, partName: part.partName, price: part.price, imageUrl: part.imageUrl, qty },
        ];
    update(next);
  }

  function updateQty(partId: number, qty: number) {
    if (qty <= 0) {
      removeLine(partId);
      return;
    }
    update(lines.map((line) => (line.partId === partId ? { ...line, qty } : line)));
  }

  function removeLine(partId: number) {
    update(lines.filter((line) => line.partId !== partId));
  }

  function clear() {
    update([]);
  }

  const totalQty = lines.reduce((sum, line) => sum + line.qty, 0);
  const totalAmount = lines.reduce((sum, line) => sum + line.price * line.qty, 0);

  return { lines, addLine, updateQty, removeLine, clear, totalQty, totalAmount };
}
