import { Wrench } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2.5 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wrench className="size-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">Service Plus</span>
        </Link>
        <nav className="ml-auto">
          <Link
            href="/spare-parts"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Spare Parts
          </Link>
        </nav>
      </div>
    </header>
  );
}
