import { useEffect, useState } from "react";
import { Loader2, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { PurchaseInvoiceType, PurchaseLineType } from "@/features/client/types/purchase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    invoice: PurchaseInvoiceType | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };
type DetailRow = PurchaseInvoiceType & { lines: PurchaseLineType[] };

// ─── Component ────────────────────────────────────────────────────────────────

export const PurchaseInvoicePrintLayout = ({ invoice, open, onOpenChange }: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [detail, setDetail] = useState<DetailRow | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !invoice) { 
            setDetail(null); 
            return; 
        }
        setLoading(true);
        apolloClient.query<GenericQueryData<DetailRow>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId: SQL_MAP.GET_PURCHASE_INVOICE_DETAIL,
                    sqlArgs: { id: invoice.id },
                }),
            },
        })
            .then(res => setDetail(res.data?.genericQuery?.[0] ?? null))
            .catch(() => toast.error(MESSAGES.ERROR_PURCHASE_LOAD_FAILED))
            .finally(() => setLoading(false));
    }, [open, invoice, dbName, schema]);

    const handlePrint = () => {
        window.print();
    };

    const lines = detail?.lines ?? [];
    const totalTaxable = lines.reduce((s, l) => s + Number(l.taxable_amount), 0);
    const totalCgst    = lines.reduce((s, l) => s + Number(l.cgst_amount), 0);
    const totalSgst    = lines.reduce((s, l) => s + Number(l.sgst_amount), 0);
    const totalIgst    = lines.reduce((s, l) => s + Number(l.igst_amount), 0);
    const grandTotal   = lines.reduce((s, l) => s + Number(l.total_amount), 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* 
              Tailwind print utilities:
              print:hidden hides an element during printing
              print:block shows it
              We hide the close button and print button during printing.
              We also expand the dialog content to fill the printed page.
            */}
            <DialogContent 
                className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 !bg-white text-black sm:rounded-md overflow-hidden print:bg-white print:text-black print:shadow-none print:w-full print:max-w-full print:h-auto print:absolute print:inset-0 print:border-none print:rounded-none m-0! print:p-0"
                hideCloseButton
            >
                {/* Title for screen readers, hidden visually */}
                <div className="sr-only">
                    <DialogTitle>Printable Purchase Invoice</DialogTitle>
                    <DialogDescription>Print layout for purchase invoice {invoice?.invoice_no}</DialogDescription>
                </div>

                <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4 print:hidden">
                    <h2 className="text-lg font-semibold text-gray-800">Print Preview</h2>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            <X className="mr-1.5 h-4 w-4" />
                            Close
                        </Button>
                        <Button size="sm" onClick={handlePrint} disabled={loading || !detail} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Printer className="mr-1.5 h-4 w-4" />
                            Print Document
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-gray-100 p-8 print:p-0 print:bg-white print:overflow-visible flex justify-center">
                    {loading ? (
                        <div className="flex h-full w-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : detail ? (
                        <div className="bg-white p-10 shadow-lg min-h-[297mm] w-full max-w-[210mm] text-black print:shadow-none print:m-0 print:min-h-0">
                            {/* Invoice Header */}
                            <div className="flex justify-between items-start border-b-2 border-gray-200 pb-6 mb-6">
                                <div>
                                    <h1 className="text-3xl font-bold uppercase tracking-widest text-gray-900 mb-1">Purchase Invoice</h1>
                                    <p className="text-gray-500 font-medium">Record Copy</p>
                                </div>
                                <div className="text-right text-sm">
                                    <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-1">
                                        <span className="text-gray-500 text-left">Invoice No:</span>
                                        <span className="font-semibold">{detail.invoice_no}</span>
                                        <span className="text-gray-500 text-left">Date:</span>
                                        <span className="font-semibold">{detail.invoice_date}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Supplier Info */}
                            <div className="mb-8">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-100 pb-1">Supplier Details</h3>
                                <p className="font-bold text-lg text-gray-800">{detail.supplier_name}</p>
                                {detail.supplier_state_code && (
                                    <p className="text-gray-600 mt-1">State Code: {detail.supplier_state_code}</p>
                                )}
                            </div>

                            {/* Line Items */}
                            <table className="w-full text-sm mb-8 border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-gray-800 text-gray-800">
                                        <th className="py-2 text-left font-bold w-12">#</th>
                                        <th className="py-2 text-left font-bold">Item & Description</th>
                                        <th className="py-2 text-right font-bold w-20">Qty</th>
                                        <th className="py-2 text-right font-bold w-24">Rate</th>
                                        <th className="py-2 text-right font-bold w-28">Taxable</th>
                                        <th className="py-2 text-right font-bold w-24">Tax</th>
                                        <th className="py-2 text-right font-bold w-28">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((line, idx) => (
                                        <tr key={line.id} className="border-b border-gray-200">
                                            <td className="py-3 align-top text-gray-500">{idx + 1}</td>
                                            <td className="py-3 align-top">
                                                <p className="font-semibold text-gray-900">{line.part_name}</p>
                                                <p className="text-xs text-gray-500 font-mono mt-0.5">Code: {line.part_code} / HSN: {line.hsn_code || 'N/A'}</p>
                                            </td>
                                            <td className="py-3 align-top text-right text-gray-700">{Number(line.quantity).toFixed(2)}</td>
                                            <td className="py-3 align-top text-right text-gray-700">{formatCurrency(line.unit_price)}</td>
                                            <td className="py-3 align-top text-right text-gray-700">{formatCurrency(line.taxable_amount)}</td>
                                            <td className="py-3 align-top text-right text-xs text-gray-500">
                                                <div>CGST: {formatCurrency(line.cgst_amount)}</div>
                                                <div>SGST: {formatCurrency(line.sgst_amount)}</div>
                                                {Number(line.igst_amount) > 0 && <div>IGST: {formatCurrency(line.igst_amount)}</div>}
                                            </td>
                                            <td className="py-3 align-top text-right font-semibold text-gray-900">{formatCurrency(line.total_amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Summary Totals */}
                            <div className="flex justify-between items-start mt-8">
                                <div className="w-1/2 text-sm text-gray-500 pr-8">
                                    {detail.remarks && (
                                        <>
                                            <h4 className="font-semibold text-gray-700 mb-1 border-b border-gray-100 pb-1">Remarks</h4>
                                            <p className="italic">{detail.remarks}</p>
                                        </>
                                    )}
                                </div>
                                <div className="w-1/2 max-w-[300px]">
                                    <table className="w-full text-sm">
                                        <tbody>
                                            <tr>
                                                <td className="py-1.5 text-gray-600">Taxable Amount</td>
                                                <td className="py-1.5 text-right font-medium text-gray-900">{formatCurrency(totalTaxable)}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1.5 text-gray-600">Total CGST</td>
                                                <td className="py-1.5 text-right font-medium text-gray-900">{formatCurrency(totalCgst)}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1.5 text-gray-600">Total SGST</td>
                                                <td className="py-1.5 text-right font-medium text-gray-900">{formatCurrency(totalSgst)}</td>
                                            </tr>
                                            {totalIgst > 0 && (
                                                <tr>
                                                    <td className="py-1.5 text-gray-600">Total IGST</td>
                                                    <td className="py-1.5 text-right font-medium text-gray-900">{formatCurrency(totalIgst)}</td>
                                                </tr>
                                            )}
                                            <tr className="border-t-2 border-gray-800">
                                                <td className="py-3 text-base font-bold text-gray-900 uppercase">Grand Total</td>
                                                <td className="py-3 text-right text-lg font-bold text-gray-900">{formatCurrency(grandTotal)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-16 text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
                                This is a computer-generated document and does not require a signature.
                            </div>
                        </div>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
};
