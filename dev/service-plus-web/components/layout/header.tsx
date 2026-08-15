import { Wrench } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 shadow-sm backdrop-blur-md">
      <div className="flex h-18 items-center px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wrench className="size-5" />
          </span>
          <span className="text-2xl font-bold tracking-tight">
            Service<span className="text-primary">+</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
