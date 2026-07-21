import { useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectAvailableDivisions, selectCurrentBranch, selectNoOfJobInvoicesPerPrint, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { PdfPreviewModal } from "@/components/shared/pdf-preview-modal";
import { buildInvoicePdf, buildDeliveryNotePdf, type DeliveryNoteJobInfo } from "./deliver-job-pdf";
import type { JobInvoiceFullRow } from "./deliver-job-schema";
import type { DivisionContextType } from "@/features/client/types/division";

type GenericQueryData<T> = { genericQuery: T[] | null };

type PaymentRow = {
    id:            number;
    receipt_no:    string | null;
    payment_date:  string;
    payment_mode:  string;
    amount:        number;
    reference_no:  string | null;
    remarks:       string | null;
};

export interface DeliveredJobActionContext {
    id:                number;
    job_no:            string;
    alternate_job_no?: string | null;
    job_date:          string;
    customer_name:     string | null;
    mobile:            string;
    device_details:    string | null;
    technician_name:   string | null;
    amount:            number | null;
    job_status_code:   string;
    division_id?:      number | null;
    invoice_is_posted: boolean | null;
    delivery_date?:    string | null;
}

export function useDeliveredJobActions() {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const divisions     = useAppSelector(selectAvailableDivisions);
    const noOfInvoices  = useAppSelector(selectNoOfJobInvoicesPerPrint);

    const [pdfUrl,         setPdfUrl]         = useState<string | null>(null);
    const [pdfOpen,        setPdfOpen]        = useState(false);
    const [pdfType,        setPdfType]        = useState<"invoice" | "other">("other");
    const [invoiceCopies,  setInvoiceCopies]  = useState(1);
    const [undoPendingJob, setUndoPendingJob] = useState<DeliveredJobActionContext | null>(null);
    const [undoSubmitting, setUndoSubmitting] = useState(false);

    const pendingInvoiceRef = useRef<{
        job:      DeliveredJobActionContext;
        invoice:  JobInvoiceFullRow;
        payments: PaymentRow[];
        division: DivisionContextType | null;
    } | null>(null);

    function buildAndShowInvoicePdf(
        job:      DeliveredJobActionContext,
        invoice:  JobInvoiceFullRow,
        payments: PaymentRow[],
        division: DivisionContextType | null,
        copies:   number,
    ) {
        const doc = buildInvoicePdf(
            { ...job, customer_name: job.customer_name ?? "", alternate_job_no: job.alternate_job_no ?? null, payments },
            invoice,
            division,
            currentBranch?.name ?? currentBranch?.code ?? null,
            undefined,
            copies,
        );
        setPdfUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(doc.output("blob")); });
    }

    async function handleInvoiceReceipts(job: DeliveredJobActionContext) {
        if (!dbName || !schema) return;
        const gq = <T,>(sqlId: string, sqlArgs?: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<T>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }) },
            });
        try {
            const [invoiceRes, paymentsRes] = await Promise.all([
                gq<JobInvoiceFullRow>(SQL_MAP.GET_JOB_INVOICE_BY_JOB, { job_id: job.id }),
                gq<PaymentRow>(SQL_MAP.GET_JOB_PAYMENTS_BY_JOB, { job_id: job.id }),
            ]);
            const invoice  = invoiceRes.data?.genericQuery?.[0] ?? null;
            const payments = paymentsRes.data?.genericQuery ?? [];
            if (!invoice) { toast.error("Invoice not found."); return; }
            const division = job.division_id ? (divisions.find(d => d.id === job.division_id) ?? null) : null;
            const copies   = noOfInvoices ?? 1;
            pendingInvoiceRef.current = { job, invoice, payments, division };
            setInvoiceCopies(copies);
            setPdfType("invoice");
            buildAndShowInvoicePdf(job, invoice, payments, division, copies);
            setPdfOpen(true);
        } catch {
            toast.error("Failed to load invoice. Please try again.");
        }
    }

    function handleInvoiceCopiesChange(n: number) {
        setInvoiceCopies(n);
        const ctx = pendingInvoiceRef.current;
        if (!ctx) return;
        buildAndShowInvoicePdf(ctx.job, ctx.invoice, ctx.payments, ctx.division, n);
    }

    async function handleDeliveryNote(job: DeliveredJobActionContext) {
        if (!dbName || !schema) return;
        const gq = <T,>(sqlId: string, sqlArgs?: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<T>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }) },
            });
        try {
            const [detailRes, invoiceRes, paymentsRes] = await Promise.all([
                gq<{
                    customer_address_line1: string | null; customer_address_line2: string | null;
                    customer_landmark: string | null; customer_city: string | null;
                    customer_postal_code: string | null; customer_state: string | null;
                    delivery_date: string | null; remarks: string | null;
                }>(SQL_MAP.GET_JOB_DETAIL, { id: job.id }),
                gq<JobInvoiceFullRow>(SQL_MAP.GET_JOB_INVOICE_BY_JOB, { job_id: job.id }),
                gq<{ receipt_no: string | null }>(SQL_MAP.GET_JOB_PAYMENTS_BY_JOB, { job_id: job.id }),
            ]);
            const detail   = detailRes.data?.genericQuery?.[0];
            const invoice  = invoiceRes.data?.genericQuery?.[0];
            const payments = paymentsRes.data?.genericQuery ?? [];
            const division = job.division_id ? (divisions.find(d => d.id === job.division_id) ?? null) : null;
            const isOk     = job.job_status_code !== "DELIVERED_NOT_OK";
            const doc = buildDeliveryNotePdf([{
                job_no:                 job.job_no,
                alternate_job_no:       job.alternate_job_no ?? null,
                job_date:               job.job_date,
                customer_name:          job.customer_name ?? "",
                mobile:                 job.mobile,
                customer_address_line1: detail?.customer_address_line1 ?? null,
                customer_address_line2: detail?.customer_address_line2 ?? null,
                customer_landmark:      detail?.customer_landmark      ?? null,
                customer_city:          detail?.customer_city          ?? null,
                customer_postal_code:   detail?.customer_postal_code   ?? null,
                customer_state:         detail?.customer_state         ?? null,
                device_details:         job.device_details,
                technician_name:        job.technician_name,
                amount:                 job.amount,
                invoice_no:             invoice?.invoice_no ?? null,
                receipt_nos:            payments.map(p => p.receipt_no).filter((r): r is string => !!r),
                delivery_ok:            isOk,
                delivery_date:          detail?.delivery_date ?? job.delivery_date ?? "",
                remarks:                detail?.remarks ?? null,
            }], division, currentBranch?.name ?? currentBranch?.code ?? null);
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            setPdfUrl(URL.createObjectURL(doc.output("blob")));
            setPdfType("other");
            setPdfOpen(true);
        } catch {
            toast.error("Failed to generate delivery note.");
        }
    }

    // Combines several already-delivered jobs (same customer + delivery date,
    // validated by the caller) into one delivery note PDF instead of printing
    // one per job. DeliveredJobActionContext has no real customer id, so every
    // item gets the same synthetic customer_contact_id — buildDeliveryNotePdf
    // only needs it to be identical across the batch to group them onto one page.
    async function handleCombinedDeliveryNote(jobs: DeliveredJobActionContext[]) {
        if (!dbName || !schema || jobs.length === 0) return;
        const gq = <T,>(sqlId: string, sqlArgs?: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<T>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }) },
            });
        try {
            const noteJobs: DeliveryNoteJobInfo[] = await Promise.all(jobs.map(async job => {
                const [detailRes, invoiceRes, paymentsRes] = await Promise.all([
                    gq<{
                        customer_address_line1: string | null; customer_address_line2: string | null;
                        customer_landmark: string | null; customer_city: string | null;
                        customer_postal_code: string | null; customer_state: string | null;
                        delivery_date: string | null; remarks: string | null;
                    }>(SQL_MAP.GET_JOB_DETAIL, { id: job.id }),
                    gq<JobInvoiceFullRow>(SQL_MAP.GET_JOB_INVOICE_BY_JOB, { job_id: job.id }),
                    gq<{ receipt_no: string | null }>(SQL_MAP.GET_JOB_PAYMENTS_BY_JOB, { job_id: job.id }),
                ]);
                const detail   = detailRes.data?.genericQuery?.[0];
                const invoice  = invoiceRes.data?.genericQuery?.[0];
                const payments = paymentsRes.data?.genericQuery ?? [];
                const isOk     = job.job_status_code !== "DELIVERED_NOT_OK";
                return {
                    customer_contact_id:    0,
                    job_no:                 job.job_no,
                    alternate_job_no:       job.alternate_job_no ?? null,
                    job_date:               job.job_date,
                    customer_name:          job.customer_name ?? "",
                    mobile:                 job.mobile,
                    customer_address_line1: detail?.customer_address_line1 ?? null,
                    customer_address_line2: detail?.customer_address_line2 ?? null,
                    customer_landmark:      detail?.customer_landmark      ?? null,
                    customer_city:          detail?.customer_city          ?? null,
                    customer_postal_code:   detail?.customer_postal_code   ?? null,
                    customer_state:         detail?.customer_state         ?? null,
                    device_details:         job.device_details,
                    technician_name:        job.technician_name,
                    amount:                 job.amount,
                    invoice_no:             invoice?.invoice_no ?? null,
                    receipt_nos:            payments.map(p => p.receipt_no).filter((r): r is string => !!r),
                    delivery_ok:            isOk,
                    delivery_date:          detail?.delivery_date ?? job.delivery_date ?? "",
                    remarks:                detail?.remarks ?? null,
                };
            }));

            const divisionIds = new Set(jobs.map(j => j.division_id ?? null));
            const singleDivisionId = divisionIds.size === 1 ? jobs[0].division_id : null;
            const division = singleDivisionId ? (divisions.find(d => d.id === singleDivisionId) ?? null) : null;

            const doc = buildDeliveryNotePdf(noteJobs, division, currentBranch?.name ?? currentBranch?.code ?? null);
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            setPdfUrl(URL.createObjectURL(doc.output("blob")));
            setPdfType("other");
            setPdfOpen(true);
        } catch {
            toast.error("Failed to generate combined delivery note.");
        }
    }

    function handleUndoDelivery(job: DeliveredJobActionContext) {
        setUndoPendingJob(job);
    }

    function renderModals(onAfterUndo?: () => void) {
        return (
            <>
                {undoPendingJob && (
                    <Dialog open onOpenChange={open => { if (!open) setUndoPendingJob(null); }}>
                        <DialogContent className="max-w-sm bg-white dark:bg-zinc-950 border-(--cl-border)">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-red-600">
                                    <AlertTriangle className="h-4 w-4" />
                                    Undo Delivery
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3 text-sm text-(--cl-text)">
                                <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) px-3 py-2.5 space-y-1.5 text-xs">
                                    <div className="flex items-start gap-2">
                                        <span className="w-24 shrink-0 text-(--cl-text-muted)">Job No</span>
                                        <span className="font-mono font-semibold text-(--cl-accent)">#{undoPendingJob.job_no}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="w-24 shrink-0 text-(--cl-text-muted)">Customer</span>
                                        <span className="font-medium">{undoPendingJob.customer_name}</span>
                                    </div>
                                    {undoPendingJob.delivery_date && (
                                        <div className="flex items-start gap-2">
                                            <span className="w-24 shrink-0 text-(--cl-text-muted)">Delivered on</span>
                                            <span>{undoPendingJob.delivery_date}</span>
                                        </div>
                                    )}
                                </div>
                                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
                                    This will mark the job as <span className="font-bold">not delivered</span>. The job will return to the deliverable list.
                                </p>
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-(--cl-border)">
                                <Button
                                    className="h-8 px-4 text-xs"
                                    disabled={undoSubmitting}
                                    variant="ghost"
                                    onClick={() => setUndoPendingJob(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="h-8 px-4 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
                                    disabled={undoSubmitting}
                                    onClick={async () => {
                                        if (!undoPendingJob || !dbName || !schema) return;
                                        setUndoSubmitting(true);
                                        try {
                                            await apolloClient.mutate({
                                                mutation: GRAPHQL_MAP.undeliverJob,
                                                variables: { db_name: dbName, schema, value: encodeObj({ job_id: undoPendingJob.id }) },
                                            });
                                            toast.success(`Delivery undone — Job #${undoPendingJob.job_no} restored to its previous status.`);
                                            setUndoPendingJob(null);
                                            onAfterUndo?.();
                                        } catch (err) {
                                            const msg = (err as { graphQLErrors?: { message: string }[] })?.graphQLErrors?.[0]?.message
                                                ?? "Failed to undo delivery. Please try again.";
                                            toast.error(msg);
                                        } finally {
                                            setUndoSubmitting(false);
                                        }
                                    }}
                                >
                                    {undoSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                    Yes, Undo
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
                {pdfOpen && pdfUrl && (
                    <PdfPreviewModal
                        isOpen={pdfOpen}
                        pdfUrl={pdfUrl}
                        title={pdfType === "invoice" ? "Invoice + Receipts" : "Delivery Note"}
                        printCopies={pdfType === "invoice" ? invoiceCopies : undefined}
                        onPrintCopiesChange={pdfType === "invoice" ? handleInvoiceCopiesChange : undefined}
                        onClose={() => {
                            setPdfOpen(false);
                            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                            setPdfUrl(null);
                            pendingInvoiceRef.current = null;
                        }}
                    />
                )}
            </>
        );
    }

    return { handleDeliveryNote, handleCombinedDeliveryNote, handleInvoiceReceipts, handleUndoDelivery, renderModals };
}
