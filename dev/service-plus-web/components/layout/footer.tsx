"use client";

import Link from "next/link";

import { usePartsAvailable } from "@/lib/companies";

import { Logo } from "./logo";
import { useNavItems } from "./nav-items";

export function Footer() {
  const items = useNavItems();
  const partsAvailable = usePartsAvailable() === true;

  return (
    <footer className="border-t border-border/60 bg-muted/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-10 sm:flex-row sm:justify-between lg:px-6">
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <Logo />
          <p className="max-w-xs text-center text-sm text-muted-foreground sm:text-left">
            {partsAvailable
              ? "Repair status, genuine spare parts and expert help — all in one place."
              : "Repair status and expert help — all in one place."}
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Service+. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
