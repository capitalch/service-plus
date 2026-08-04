import { Wrench } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <Wrench className="size-5 text-primary" />
        <span className="font-medium">Service Plus</span>
      </div>
    </header>
  );
}
