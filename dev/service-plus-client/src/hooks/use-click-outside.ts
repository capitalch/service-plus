import { type RefObject, useEffect, useRef } from "react";

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  open: boolean,
  onClose: () => void
): void {
  // Synchronous ref update — always has the latest callback without async delay
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    // capture: true fires before Radix Dialog or other portal components can stopPropagation
    document.addEventListener("pointerdown", handler, { capture: true });
    return () => document.removeEventListener("pointerdown", handler, { capture: true });
  }, [open, ref]);
}
