import type { JobInvoiceFullRow } from "./deliver-job-schema";
import { thClass, tdClass, fmtCurrency } from "./deliver-job-helpers";

type Props = {
    invoice: JobInvoiceFullRow | null;
};

export function DeliveryInvoiceCard({ invoice }: Props) {
    return (
        <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-(--cl-text-muted)">
                Invoice
            </p>

            {!invoice ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                    No invoice found — create one in Final a Job first.
                </p>
            ) : (
                <>
                    {/* Header info chips */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 sm:grid-cols-4">
                        {([
                            ["Invoice No",    invoice.invoice_no],
                            ["Date",          invoice.invoice_date.slice(0, 10)],
                            ["State Code",    invoice.supply_state_code],
                            ["Grand Total",   fmtCurrency(invoice.amount)],
                        ] as [string, string][]).map(([label, value]) => (
                            <div key={label}>
                                <p className="text-[10px] uppercase tracking-wider text-(--cl-text-muted)">{label}</p>
                                <p className="text-sm font-medium text-(--cl-text)">{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Line items table */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    {["Description", "Part Code", "HSN", "Qty", "Price", "Taxable", "GST%", "CGST", "SGST", "IGST", "Total"].map(h => (
                                        <th key={h} className={thClass}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(invoice.lines ?? []).map(l => (
                                    <tr key={l.id} className="hover:bg-(--cl-accent)/5">
                                        <td className={tdClass}>{l.description}</td>
                                        <td className={`${tdClass} font-mono text-xs`}>{l.part_code ?? "—"}</td>
                                        <td className={tdClass}>{l.hsn_code ?? "—"}</td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{l.qty}</td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(l.price)}</td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(l.aggregate)}</td>
                                        <td className={`${tdClass} text-right`}>{l.gst_rate}%</td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(l.cgst_amount)}</td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(l.sgst_amount)}</td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(l.igst_amount)}</td>
                                        <td className={`${tdClass} text-right tabular-nums font-semibold`}>{fmtCurrency(l.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-(--cl-surface-2)">
                                    <td colSpan={4} className={`${tdClass} font-semibold text-right text-(--cl-text-muted)`}>
                                        TOTAL
                                    </td>
                                    <td className={tdClass} />
                                    <td className={`${tdClass} text-right tabular-nums font-semibold`}>{fmtCurrency(invoice.aggregate)}</td>
                                    <td className={tdClass} />
                                    <td className={`${tdClass} text-right tabular-nums font-semibold`}>{fmtCurrency(invoice.cgst_amount)}</td>
                                    <td className={`${tdClass} text-right tabular-nums font-semibold`}>{fmtCurrency(invoice.sgst_amount)}</td>
                                    <td className={`${tdClass} text-right tabular-nums font-semibold`}>{fmtCurrency(invoice.igst_amount)}</td>
                                    <td className={`${tdClass} text-right tabular-nums font-bold text-(--cl-accent)`}>{fmtCurrency(invoice.amount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Tax summary strip */}
                    {(invoice.cgst_amount > 0 || invoice.igst_amount > 0) && (
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-(--cl-text-muted)">
                            <span>Taxable: <strong className="text-(--cl-text)">{fmtCurrency(invoice.aggregate)}</strong></span>
                            {invoice.cgst_amount > 0 && (
                                <>
                                    <span>CGST: <strong className="text-(--cl-text)">{fmtCurrency(invoice.cgst_amount)}</strong></span>
                                    <span>SGST: <strong className="text-(--cl-text)">{fmtCurrency(invoice.sgst_amount)}</strong></span>
                                </>
                            )}
                            {invoice.igst_amount > 0 && (
                                <span>IGST: <strong className="text-(--cl-text)">{fmtCurrency(invoice.igst_amount)}</strong></span>
                            )}
                            <span>Grand Total: <strong className="text-(--cl-text)">{fmtCurrency(invoice.amount)}</strong></span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
