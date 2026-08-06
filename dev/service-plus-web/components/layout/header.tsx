import { Wrench } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2.5 px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wrench className="size-4" />
        </span>
        <span className="text-base font-semibold tracking-tight">Service Plus</span>
      </div>
    </header>
  );
}
