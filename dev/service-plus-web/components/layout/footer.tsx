import { Wrench } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/30 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wrench className="size-4 text-primary" />
          Service Plus
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Service Plus. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
