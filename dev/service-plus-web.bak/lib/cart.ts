import type { CartLine } from "./types";

const STORAGE_KEY = "sp-cart-v1";

type CartStore = Record<string, CartLine[]>;

/** The cart is scoped to one (company, branch) pair (§9) — never merged, never shared. */
function cartKey(company: string, branch: string): string {
  return `${company}:${branch}`;
}

function readStore(): CartStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: CartStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage unavailable (private browsing, quota) — cart just won't persist.
  }
}

export function loadCart(company: string, branch: string): CartLine[] {
  return readStore()[cartKey(company, branch)] ?? [];
}

export function saveCart(company: string, branch: string, lines: CartLine[]): void {
  const store = readStore();
  const key = cartKey(company, branch);
  if (lines.length === 0) delete store[key];
  else store[key] = lines;
  writeStore(store);
}
