import { Wrench } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-md shadow-primary/25 transition-transform duration-300 group-hover:scale-105">
        <Wrench className="size-5" />
      </span>
      <span className="text-xl font-bold tracking-tight sm:text-2xl">
        Service<span className="text-gradient-brand">+</span>
      </span>
    </Link>
  );
}
