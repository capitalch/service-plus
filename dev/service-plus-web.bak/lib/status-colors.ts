// Ported from service-plus-client's STATUS_COLORS (single source of truth at
// src/features/client/components/jobs/job-pipeline/status-transitions.ts), keyed by
// job_status.code, so the public site's status pill matches the internal admin app —
// for tenants using the standard/system status set.
//
// job_status is per-tenant customizable (businesses can rename/add statuses beyond the
// defaults), so an exact-match-only map falls back to grey for any custom code. Instead,
// mirror job-badges.tsx's JOB_TYPE_PALETTE technique: known codes get their fixed color,
// any other code gets a deterministic (stable, still colorful) pick from a fallback
// palette instead of uniform grey.
const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-blue-500 text-white",
  ASSIGNED: "bg-indigo-500 text-white",
  ESTIMATED: "bg-purple-500 text-white",
  ESTIMATE_APPROVED: "bg-violet-500 text-white",
  ESTIMATE_REJECTED: "bg-pink-500 text-white",
  IN_PROGRESS: "bg-orange-500 text-white",
  PARTS_PENDING: "bg-amber-500 text-white",
  ON_HOLD: "bg-yellow-500 text-black",
  OUTSOURCED: "bg-teal-500 text-white",
  SENT_TO_COMPANY: "bg-cyan-600 text-white",
  COMPLETED_OK: "bg-emerald-500 text-white",
  RETURN: "bg-lime-600 text-white",
  DELIVERED_OK: "bg-green-600 text-white",
  DELIVERED_NOT_OK: "bg-orange-500 text-white",
  CANCELLED: "bg-slate-400 text-white",
  DISPOSED: "bg-zinc-600 text-white",
  RECEIVED_BACK_FROM_COMPANY: "bg-sky-600 text-white",
};

const FALLBACK_PALETTE = [
  "bg-blue-500 text-white",
  "bg-orange-500 text-white",
  "bg-emerald-500 text-white",
  "bg-purple-500 text-white",
  "bg-pink-500 text-white",
  "bg-teal-500 text-white",
  "bg-amber-500 text-black",
  "bg-indigo-500 text-white",
  "bg-cyan-600 text-white",
  "bg-lime-600 text-white",
];

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function statusPillClass(code: string | null | undefined): string {
  if (code && STATUS_COLORS[code]) return STATUS_COLORS[code];
  if (!code) return "bg-slate-400 text-white";
  return FALLBACK_PALETTE[hashCode(code) % FALLBACK_PALETTE.length];
}
