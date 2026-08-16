import { CalendarClock, PackageCheck, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { statusPillClass } from "@/lib/status-colors";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import { StatusTimeline } from "./status-timeline";

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function JobStatusResult({ result }: { result: JobStatus }) {
  return (
    <Card className="text-left">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Job {result.jobNo}</span>
          <Badge className={cn("shrink-0", statusPillClass(result.statusCode))}>
            {result.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatusTimeline statusCode={result.statusCode} isClosed={result.isClosed} />

        <div className="rounded-xl bg-primary/[0.06] p-4">
          <p className="text-sm font-semibold text-foreground">{result.status}</p>
          {result.statusDescription && (
            <p className="mt-1 text-sm text-muted-foreground">{result.statusDescription}</p>
          )}
        </div>

        <div className="divide-y divide-border/70">
          <DetailRow
            icon={Smartphone}
            label="Device"
            value={
              <>
                {result.deviceDetails ?? "—"}
                {result.serialNo && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    SN: {result.serialNo}
                  </span>
                )}
              </>
            }
          />
          <DetailRow icon={CalendarClock} label="Job date" value={formatDate(result.jobDate)} />
          <DetailRow
            icon={PackageCheck}
            label="Delivery date"
            value={formatDate(result.deliveryDate)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
