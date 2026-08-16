import { CalendarClock, PackageCheck, Smartphone } from "lucide-react";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { statusPillClass } from "@/lib/status-colors";
import type { JobStatus } from "@/lib/types";

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
        <CardTitle className="flex items-center justify-between">
          <span>Job {result.jobNo}</span>
          <Badge className={statusPillClass(result.statusCode)}>{result.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg bg-accent/40 p-4">
          <p className="text-sm font-medium text-accent-foreground">{result.status}</p>
          {result.statusDescription && (
            <p className="mt-1 text-sm text-muted-foreground">{result.statusDescription}</p>
          )}
        </div>

        <div className="mt-1 divide-y divide-border">
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
