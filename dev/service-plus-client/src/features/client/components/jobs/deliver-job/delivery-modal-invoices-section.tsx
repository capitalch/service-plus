import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type DivisionContextType, isGstDivision } from "@/features/client/types/division";
import type { JobDeliveryFullDetail } from "./deliver-job-schema";
import { fmtCurrency, isJobInvoiceable } from "./deliver-job-helpers";

type Props = {
    jobs:               JobDeliveryFullDetail[];
    availableDivisions: DivisionContextType[];
    loadingPdfJobId?:   number | null;
    onPrintInvoice?:    (job: JobDeliveryFullDetail) => void;
};

function computeTaxSummary(job: JobDeliveryFullDetail) {
    let aggregate = 0, cgst = 0, sgst = 0, igst = 0;
    const isIgst = job.is_igst ?? false;
    for (const p of job.parts ?? []) {
        const taxable = p.selling_price * p.qty;
        aggregate += taxable;
        if (p.gst_rate > 0) {
            if (isIgst) { igst += taxable * p.gst_rate / 100; }
            else { const half = taxable * p.gst_rate / 200; cgst += half; sgst += half; }
        }
    }
    for (const c of job.charges ?? []) {
        const taxable = c.selling_price * c.qty;
        aggregate += taxable;
        if (c.gst_rate > 0) {
            if (isIgst) { igst += taxable * c.gst_rate / 100; }
            else { const half = taxable * c.gst_rate / 200; cgst += half; sgst += half; }
        }
    }
    return { aggregate, cgst, sgst, igst, isIgst, total: aggregate + cgst + sgst + igst };
}

function TaxSummaryRow({ tax, jobAmount }: { tax: ReturnType<typeof computeTaxSummary>; jobAmount: number | null }) {
    return (
        <div className="flex items-center justify-between text-sm tabular-nums text-(--cl-text-muted)">
            <div className="flex items-center gap-3">
                <span>Taxable <span className="text-(--cl-text)">{fmtCurrency(tax.aggregate)}</span></span>
                <span className="opacity-30">·</span>
                {tax.isIgst ? (
                    <span>IGST <span className="text-(--cl-text)">{fmtCurrency(tax.igst)}</span></span>
                ) : (
                    <>
                        <span>CGST <span className="text-(--cl-text)">{fmtCurrency(tax.cgst)}</span></span>
                        <span className="opacity-30">·</span>
                        <span>SGST <span className="text-(--cl-text)">{fmtCurrency(tax.sgst)}</span></span>
                    </>
                )}
                <span className="opacity-30">·</span>
                <span>Total <span className="font-semibold text-(--cl-text)">{fmtCurrency(tax.total)}</span></span>
            </div>
            <span>Amt <span className="font-semibold text-(--cl-text)">{fmtCurrency(jobAmount)}</span></span>
        </div>
    );
}

export function DeliveryModalInvoicesSection({ jobs, availableDivisions, loadingPdfJobId, onPrintInvoice }: Props) {
    return (
        <div className="space-y-3">
            {jobs.map(job => {
                const invoiceable = isJobInvoiceable(job.job_type_code, job.job_status_code);
                const division    = availableDivisions.find(d => d.id === job.division_id) ?? null;
                const isGst       = isGstDivision(division);
                const hasTaxLines = isGst && (
                    (job.parts   ?? []).some(p => p.gst_rate > 0) ||
                    (job.charges ?? []).some(c => c.gst_rate > 0)
                );
                const tax = hasTaxLines ? computeTaxSummary(job) : null;

                return (
                    <div key={job.id} className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) px-4 py-3">
                        {/* Header row */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5">
                                <span className="font-mono text-sm font-bold text-(--cl-accent)">#{job.job_no}</span>
                                <span className="text-sm text-(--cl-text-muted)">{job.customer_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {!invoiceable ? (
                                    <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                        Skipped — {job.job_type_name || job.job_status_name}
                                    </span>
                                ) : job.invoice_id ? (
                                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                        Invoice #{job.invoice_no} — {fmtCurrency(job.invoice_total)}
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-sky-100 dark:bg-sky-950/40 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-400">
                                        Pending — will generate
                                    </span>
                                )}
                                {invoiceable && job.invoice_id && onPrintInvoice && (
                                    <Button
                                        className="h-7 gap-1 px-2 text-xs"
                                        disabled={loadingPdfJobId === job.id}
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onPrintInvoice(job)}
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                        Print
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Tax breakdown for existing GST invoices */}
                        {invoiceable && job.invoice_id && tax && (
                            <div className="mt-2.5 pl-1">
                                <TaxSummaryRow tax={tax} jobAmount={job.amount} />
                            </div>
                        )}

                        {/* Parts + charges preview for pending invoiceable jobs */}
                        {invoiceable && !job.invoice_id && (job.parts.length > 0 || job.charges.length > 0) && (
                            <>
                                <div className="mt-2.5 space-y-1.5 pl-3 border-l-2 border-(--cl-border)">
                                    {job.parts.map(p => (
                                        <div key={p.id} className="flex justify-between text-sm text-(--cl-text-muted)">
                                            <span>{p.part_name} × {p.qty}</span>
                                            <div className="flex items-center gap-3 tabular-nums">
                                                {isGst && p.gst_rate > 0 && (
                                                    <span className="text-xs opacity-60">{p.gst_rate}% GST</span>
                                                )}
                                                <span>{fmtCurrency(p.selling_price * p.qty)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {job.charges.map(c => (
                                        <div key={c.id} className="flex justify-between text-sm text-(--cl-text-muted)">
                                            <span>{c.charge_name} × {c.qty}</span>
                                            <div className="flex items-center gap-3 tabular-nums">
                                                {isGst && c.gst_rate > 0 && (
                                                    <span className="text-xs opacity-60">{c.gst_rate}% GST</span>
                                                )}
                                                <span>{fmtCurrency(c.selling_price * c.qty)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {tax && (
                                    <div className="mt-2.5 pt-2 pl-1 border-t border-(--cl-border)/50">
                                        <TaxSummaryRow tax={tax} jobAmount={job.amount} />
                                    </div>
                                )}
                            </>
                        )}

                        {invoiceable && !job.invoice_id && job.parts.length === 0 && job.charges.length === 0 && (
                            <p className="mt-1.5 text-sm text-amber-600 dark:text-amber-400 pl-3">
                                No parts or charges recorded — invoice will be empty.
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
