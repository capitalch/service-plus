import { CheckCircle2, Circle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobStatus } from "@/lib/types";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function JobStatusResult({ result }: { result: JobStatus }) {
  return (
    <Card className="mt-6 text-left">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Job {result.jobNo}</span>
          <Badge variant={result.isClosed ? "default" : "secondary"}>
            {result.isClosed ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <Circle className="size-3" />
            )}
            {result.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Device</dt>
            <dd className="mt-0.5 font-medium">{result.deviceDetails ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Job date</dt>
            <dd className="mt-0.5 font-medium">{formatDate(result.jobDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Delivery date</dt>
            <dd className="mt-0.5 font-medium">{formatDate(result.deliveryDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Service center</dt>
            <dd className="mt-0.5 font-medium">{result.branchName ?? "—"}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
