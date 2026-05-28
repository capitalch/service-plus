import type { JobDeliveryFullDetail } from "./deliver-job-schema";
import { fmtCurrency, isJobInvoiceable } from "./deliver-job-helpers";

type Props = {
    jobs: JobDeliveryFullDetail[];
};

export function DeliveryModalInvoicesSection({ jobs }: Props) {
    return (
        <div className="space-y-2">
            {jobs.map(job => {
                const invoiceable = isJobInvoiceable(job.job_type_code, job.job_status_code);
                return (
                    <div key={job.id} className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-3">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-(--cl-accent)">#{job.job_no}</span>
                                <span className="text-xs text-(--cl-text-muted)">{job.customer_name}</span>
                            </div>
                            {!invoiceable ? (
                                <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                    Skipped — {job.job_type_name || job.job_status_name}
                                </span>
                            ) : job.invoice_id ? (
                                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                    Invoice #{job.invoice_no} — {fmtCurrency(job.invoice_total)}
                                </span>
                            ) : (
                                <span className="rounded-full bg-sky-100 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-400">
                                    Pending — will generate
                                </span>
                            )}
                        </div>

                        {/* Parts and charges preview (only for pending invoiceable jobs) */}
                        {invoiceable && !job.invoice_id && (job.parts.length > 0 || job.charges.length > 0) && (
                            <div className="mt-2 space-y-1 pl-2 border-l-2 border-(--cl-border)">
                                {job.parts.map(p => (
                                    <div key={p.id} className="flex justify-between text-xs text-(--cl-text-muted)">
                                        <span>{p.part_name} × {p.qty}</span>
                                        <span>{fmtCurrency(p.selling_price * p.qty)}</span>
                                    </div>
                                ))}
                                {job.charges.map(c => (
                                    <div key={c.id} className="flex justify-between text-xs text-(--cl-text-muted)">
                                        <span>{c.charge_name} × {c.qty}</span>
                                        <span>{fmtCurrency(c.selling_price * c.qty)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {invoiceable && !job.invoice_id && job.parts.length === 0 && job.charges.length === 0 && (
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 pl-2">
                                No parts or charges recorded — invoice will be empty.
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
