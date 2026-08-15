import { Bot } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export default function AiRepairHelpPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Bot className="size-5" />
      </span>
      <h1 className="mt-4 flex items-center justify-center gap-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        AI repair help
        <Badge variant="outline">Coming soon</Badge>
      </h1>
      <p className="mt-3 text-muted-foreground">
        Describe a fault and get an instant estimate before you visit a center. We&apos;re
        building this now — check back soon.
      </p>
    </div>
  );
}
