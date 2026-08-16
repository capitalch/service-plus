import { Check, CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/** Best-effort canonical pipeline for the standard/system status set. Statuses
 *  outside the map (per-tenant custom codes) simply skip the timeline and the
 *  card still shows the pill + description, so nothing regresses. */
const STAGES = [
  { label: "Received" },
  { label: "In service" },
  { label: "Ready" },
  { label: "Delivered" },
];

const STAGE_INDEX: Record<string, number> = {
  RECEIVED: 0,
  CANCELLED: 0,
  ASSIGNED: 1,
  ESTIMATED: 1,
  ESTIMATE_APPROVED: 1,
  IN_PROGRESS: 1,
  PARTS_PENDING: 1,
  ON_HOLD: 1,
  OUTSOURCED: 1,
  SENT_TO_COMPANY: 1,
  RECEIVED_BACK_FROM_COMPANY: 1,
  COMPLETED_OK: 2,
  RETURN: 2,
  DELIVERED_NOT_OK: 2,
  DISPOSED: 2,
  DELIVERED_OK: 3,
};

const TERMINAL_CODES = new Set(["CANCELLED", "DISPOSED", "DELIVERED_NOT_OK"]);

export function StatusTimeline({
  statusCode,
  isClosed,
}: {
  statusCode: string;
  isClosed: boolean;
}) {
  const current = STAGE_INDEX[statusCode];
  if (current === undefined) return null;

  const terminal = TERMINAL_CODES.has(statusCode);
  const currentIndex = terminal ? Math.min(current, STAGES.length - 1) : current;

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-start justify-between">
        {STAGES.map((stage, i) => {
          const reached = i <= currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={stage.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === 0 ? "invisible" : reached ? "bg-gradient-brand" : "bg-muted",
                  )}
                />
                <span
                  className={cn(
                    "relative flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                    reached
                      ? "bg-gradient-brand text-white shadow-sm shadow-primary/30"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {reached && !isCurrent && <Check className="size-3.5" />}
                  {!reached && i + 1}
                  {isCurrent && (
                    <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-primary/30" />
                  )}
                  {isCurrent && <span className="relative">{i + 1}</span>}
                </span>
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === STAGES.length - 1 ? "invisible" : reached ? "bg-gradient-brand" : "bg-muted",
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-center text-[11px] leading-tight",
                  isCurrent ? "font-medium text-foreground" : reached ? "text-muted-foreground" : "text-muted-foreground/70",
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {terminal && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          <CircleAlert className="size-3.5 shrink-0" />
          This job has been {statusCode === "CANCELLED" ? "cancelled" : statusCode === "DISPOSED" ? "closed as disposed" : "closed after delivery issues"}.
        </div>
      )}
    </div>
  );
}
