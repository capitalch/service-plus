import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PdfPreviewModal } from "@/components/shared/pdf-preview-modal";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP }     from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { type DivisionContextType, isGstDivision } from "@/features/client/types/division";
import type { UserInstanceType } from "@/lib/auth-service";

import {
    deliveryModalSchema, getDeliveryModalDefaults,
    type DeliveryModalFormValues, type JobDeliveryFullDetail,
    type AddReceiptFormValues, type JobInvoiceFullRow,
} from "./deliver-job-schema";
import { fmtCurrency, isJobInvoiceable } from "./deliver-job-helpers";
import { buildMultiJobDeliveryPdf } from "./deliver-job-pdf";
import { DeliveryModalJobsTable } from "./delivery-modal-jobs-table";
import { DeliveryModalInvoicesSection } from "./delivery-modal-invoices-section";
import { DeliveryModalReceiptsSection } from "./delivery-modal-receipts-section";
import { AddReceiptModal } from "./add-receipt-modal";

// ── Types ─────────────────────────────────────────────────────────────────────

type DeliveryMannerRow = { id: number; name: string };

type DocSeqRow = {
    document_type_code: string;
    id:                 number | null;
    prefix:             string | null;
    next_number:        number | null;
    padding:            number | null;
    separator:          string | null;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    jobs:               JobDeliveryFullDetail[];
    branchId:           number | null;
    deliveryManners:    DeliveryMannerRow[];
    availableDivisions: DivisionContextType[];
    deliveredStatusId:  number | null;
    currentUser:        UserInstanceType | null;
    dbName:             string | null;
    schema:             string | null;
    onClose:            () => void;
    onDelivered:        () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatInvoiceNo(seq: DocSeqRow): string {
    const padded = String(seq.next_number ?? 1).padStart(seq.padding ?? 0, "0");
    return `${seq.prefix ?? ""}${seq.separator ?? ""}${padded}`;
}

type InvoiceLine = {
    description: string;
    part_code:   string | null;
    hsn_code:    string | null;
    qty:         number;
    price:       number;
    aggregate:   number;
    gst_rate:    number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    amount:      number;
};

function buildInvoiceLines(job: JobDeliveryFullDetail, isGst: boolean, forceIgst: boolean): InvoiceLine[] {
    function computeTax(taxable: number, gstRate: number) {
        if (!isGst || gstRate === 0) return { cgst: 0, sgst: 0, igst: 0 };
        if (forceIgst) return { cgst: 0, sgst: 0, igst: Math.round(taxable * gstRate) / 100 };
        const half = Math.round(taxable * gstRate / 2) / 100;
        return { cgst: half, sgst: half, igst: 0 };
    }

    const partLines: InvoiceLine[] = (job.parts ?? []).map(p => {
        const taxable = Math.round(p.selling_price * p.qty * 100) / 100;
        const rate    = isGst ? p.gst_rate : 0;
        const { cgst, sgst, igst } = computeTax(taxable, rate);
        return {
            description: p.part_name,
            part_code:   p.part_code || null,
            hsn_code:    p.hsn_code || null,
            qty:         p.qty,
            price:       p.selling_price,
            aggregate:   taxable,
            gst_rate:    rate,
            cgst_amount: cgst,
            sgst_amount: sgst,
            igst_amount: igst,
            amount:      Math.round((taxable + cgst + sgst + igst) * 100) / 100,
        };
    });

    const chargeLines: InvoiceLine[] = (job.charges ?? []).map(c => {
        const taxable = Math.round(c.selling_price * c.qty * 100) / 100;
        const rate    = isGst ? c.gst_rate : 0;
        const { cgst, sgst, igst } = computeTax(taxable, rate);
        return {
            description: c.charge_name,
            part_code:   null,
            hsn_code:    c.hsn_code || null,
            qty:         c.qty,
            price:       c.selling_price,
            aggregate:   taxable,
            gst_rate:    rate,
            cgst_amount: cgst,
            sgst_amount: sgst,
            igst_amount: igst,
            amount:      Math.round((taxable + cgst + sgst + igst) * 100) / 100,
        };
    });

    return [...partLines, ...chargeLines];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeliveryModal({
    jobs: initialJobs,
    branchId,
    deliveryManners,
    availableDivisions,
    deliveredStatusId,
    currentUser,
    dbName,
    schema,
    onClose,
    onDelivered,
}: Props) {
    const [jobDetails,        setJobDetails]        = useState<JobDeliveryFullDetail[]>(initialJobs);
    const [creatingInvoices,  setCreatingInvoices]  = useState(false);
    const [delivering,        setDelivering]        = useState(false);
    const [pdfUrl,            setPdfUrl]            = useState<string | null>(null);
    const [showPdf,           setShowPdf]           = useState(false);
    const [receiptJob,        setReceiptJob]        = useState<JobDeliveryFullDetail | null>(null);
    const [showReceiptModal,  setShowReceiptModal]  = useState(false);

    const form = useForm<DeliveryModalFormValues>({
        defaultValues: getDeliveryModalDefaults(),
        mode:          "onChange",
        resolver:      zodResolver(deliveryModalSchema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    // ── Derived summary ───────────────────────────────────────────────────────

    const divisionIds  = [...new Set(jobDetails.map(j => j.division_id))];
    const singleDivId  = divisionIds.length === 1 ? divisionIds[0] : null;
    const divLabel     = singleDivId != null
        ? (availableDivisions.find(d => d.id === singleDivId)?.name ?? "—")
        : "Multiple";
    const allGst       = jobDetails.every(j => isGstDivision(availableDivisions.find(d => d.id === j.division_id) ?? null));
    const noneGst      = jobDetails.every(j => !isGstDivision(availableDivisions.find(d => d.id === j.division_id) ?? null));
    const gstLabel     = allGst ? "GST" : noneGst ? "Non-GST" : "Mixed";
    const totalAmt     = jobDetails.reduce((s, j) => s + Number(j.amount ?? 0), 0);
    const totalPaid    = jobDetails.reduce((s, j) => s + (j.payments ?? []).reduce((ps, p) => ps + Number(p.amount), 0), 0);
    const totalDue     = Math.max(0, totalAmt - totalPaid);

    const hasAnyInvoice       = jobDetails.some(j => !!j.invoice_id);
    const hasEligiblePending  = jobDetails.some(j => isJobInvoiceable(j.job_type_code, j.job_status_code) && !j.invoice_id);
    const canCreateInvoices   = hasEligiblePending && !creatingInvoices;
    const canShowPdf          = hasAnyInvoice;
    const canDeliver          = form.formState.isValid && !delivering && !!deliveredStatusId;

    // ── Reload job details ────────────────────────────────────────────────────

    async function reloadJobDetails() {
        if (!dbName || !schema) return;
        const res = await apolloClient.query<GenericQueryData<JobDeliveryFullDetail>>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId:   SQL_MAP.GET_DELIVERABLE_JOBS_DETAIL_MULTI,
                    sqlArgs: { job_ids: jobDetails.map(j => j.id) },
                }),
            },
        });
        setJobDetails(res.data?.genericQuery ?? []);
    }

    // ── Create Invoices ───────────────────────────────────────────────────────

    async function handleCreateInvoices() {
        if (!dbName || !schema) return;
        setCreatingInvoices(true);
        let created = 0;
        let skipped = 0;
        try {
            for (const job of jobDetails) {
                if (!isJobInvoiceable(job.job_type_code, job.job_status_code)) { skipped++; continue; }
                if (job.invoice_id) { skipped++; continue; }

                const division = availableDivisions.find(d => d.id === job.division_id) ?? null;
                const isGst    = isGstDivision(division);

                const seqRes = await apolloClient.query<GenericQueryData<DocSeqRow>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_DOCUMENT_SEQUENCES_BY_DIVISION,
                            sqlArgs: {
                                branch_id:   branchId ?? 0,
                                division_id: job.division_id ?? 0,
                            },
                        }),
                    },
                });
                const seq = (seqRes.data?.genericQuery ?? []).find(s => s.document_type_code === "SERVICE_INVOICE");
                if (!seq || !seq.id || seq.next_number == null) {
                    toast.error(`No SERVICE_INVOICE sequence configured for job #${job.job_no}.`);
                    continue;
                }

                const invoiceNo = formatInvoiceNo(seq);

                const lines = buildInvoiceLines(job, isGst, false);
                const aggregate   = Math.round(lines.reduce((s, l) => s + l.aggregate, 0) * 100) / 100;
                const cgst_amount = Math.round(lines.reduce((s, l) => s + l.cgst_amount, 0) * 100) / 100;
                const sgst_amount = Math.round(lines.reduce((s, l) => s + l.sgst_amount, 0) * 100) / 100;
                const igst_amount = Math.round(lines.reduce((s, l) => s + l.igst_amount, 0) * 100) / 100;
                const amount      = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;

                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.createSalesInvoice,
                    variables: {
                        db_name: dbName, schema,
                        value: encodeObj({
                            tableName: "job_invoice",
                            xData: {
                                job_id:            job.id,
                                invoice_no:        invoiceNo,
                                invoice_date:      new Date().toISOString().slice(0, 10),
                                supply_state_code: division?.gst_state_code ?? "",
                                aggregate,
                                cgst_amount,
                                sgst_amount,
                                igst_amount,
                                amount,
                            },
                            xDetails: lines.length > 0 ? [{
                                tableName: "job_invoice_line",
                                fkeyName:  "job_invoice_id",
                                xData:     lines,
                            }] : undefined,
                            doc_sequence_id:   seq.id,
                            doc_sequence_next: seq.next_number + 1,
                        }),
                    },
                });
                created++;
            }
            await reloadJobDetails();
            toast.success(created > 0
                ? `${created} invoice(s) created.${skipped > 0 ? ` ${skipped} already existed or skipped.` : ""}`
                : "All jobs already have invoices or were skipped."
            );
        } catch (err) {
            console.error("Invoice creation error:", err);
            toast.error("Failed to create invoices. Please try again.");
        } finally {
            setCreatingInvoices(false);
        }
    }

    // ── Show PDF ──────────────────────────────────────────────────────────────

    async function handleShowPdf() {
        if (!dbName || !schema) return;
        const invoicesMap = new Map<number, JobInvoiceFullRow>();
        try {
            for (const job of jobDetails) {
                if (!job.invoice_id) continue;
                const res = await apolloClient.query<GenericQueryData<JobInvoiceFullRow>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_JOB_INVOICE_BY_JOB,
                            sqlArgs: { job_id: job.id },
                        }),
                    },
                });
                const inv = res.data?.genericQuery?.[0];
                if (inv) invoicesMap.set(job.id, inv);
            }
        } catch {
            toast.error("Failed to load invoice data for PDF.");
            return;
        }

        const doc = buildMultiJobDeliveryPdf(jobDetails, invoicesMap);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(URL.createObjectURL(doc.output("blob")));
        setShowPdf(true);
    }

    // ── Add Receipt ───────────────────────────────────────────────────────────

    async function handleAddReceipt(values: AddReceiptFormValues) {
        if (!receiptJob || !dbName || !schema) return;
        await apolloClient.mutate({
            mutation:  GRAPHQL_MAP.genericUpdate,
            variables: {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericUpdateValue({
                    tableName: "job_payment",
                    xData: {
                        job_id:       receiptJob.id,
                        payment_date: values.payment_date,
                        payment_mode: values.payment_mode,
                        amount:       Number(values.amount),
                        reference_no: values.reference_no || null,
                        remarks:      values.remarks      || null,
                    },
                }),
            },
        });
        toast.success("Receipt added.");
        setShowReceiptModal(false);
        await reloadJobDetails();
    }

    // ── Deliver & Close ───────────────────────────────────────────────────────

    async function handleDeliver(values: DeliveryModalFormValues) {
        if (!deliveredStatusId || !dbName || !schema) return;
        setDelivering(true);
        try {
            for (const job of jobDetails) {
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.deliverJob,
                    variables: {
                        db_name: dbName, schema,
                        value: encodeObj({
                            job_id:               job.id,
                            last_transaction_id:  job.last_transaction_id,
                            performed_by_user_id: currentUser?.id ?? null,
                            delivered_status_id:  deliveredStatusId,
                            delivery_date:        values.delivery_date,
                            delivery_manner_name: values.delivery_manner,
                            remarks:              values.remarks ?? "",
                            payment: {
                                payment_date: values.delivery_date,
                                payment_mode: "Cash",
                                amount:       0,
                            },
                        }),
                    },
                });
            }
            toast.success(`${jobDetails.length} job(s) delivered and closed.`);
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            onDelivered();
        } catch {
            toast.error("Delivery failed. Please try again.");
        } finally {
            setDelivering(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <Dialog open modal onOpenChange={() => { /* blocked — use Cancel button */ }}>
                <DialogContent
                    className="w-[96vw] sm:max-w-6xl max-h-[95vh] flex flex-col overflow-hidden p-0 gap-0"
                    showCloseButton={false}
                    onPointerDownOutside={e => e.preventDefault()}
                    onEscapeKeyDown={e => e.preventDefault()}
                    aria-describedby={undefined}
                >
                    {/* ── Header ───────────────────────────────────────────── */}
                    <div className="shrink-0 border-b border-(--cl-border) bg-(--cl-surface) px-6 pt-5 pb-4">
                        {/* Title row */}
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
                                <Truck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <DialogTitle className="flex items-center gap-2 text-base font-semibold text-(--cl-text)">
                                    Deliver Job{jobDetails.length > 1 ? "s" : ""}
                                    <span className="rounded-full bg-(--cl-accent)/10 px-2 py-0.5 text-xs font-medium text-(--cl-accent)">
                                        {jobDetails.length} job{jobDetails.length !== 1 ? "s" : ""}
                                    </span>
                                </DialogTitle>
                                <p className="text-[11px] text-(--cl-text-muted) mt-0.5">
                                    Review jobs, create invoices, add receipts, then deliver.
                                </p>
                            </div>
                        </div>

                        {/* Summary chips */}
                        <div className="mt-3 flex flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 rounded-md bg-(--cl-surface-2) border border-(--cl-border) px-2.5 py-1 text-xs">
                                <span className="text-(--cl-text-muted)">Division</span>
                                <span className="font-semibold text-(--cl-text)">{divLabel}</span>
                            </div>
                            <div className={`flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${
                                gstLabel === "GST"
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                                    : gstLabel === "Non-GST"
                                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                                        : "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400"
                            }`}>
                                {gstLabel}
                            </div>
                            <div className="flex items-center gap-1.5 rounded-md bg-(--cl-surface-2) border border-(--cl-border) px-2.5 py-1 text-xs">
                                <span className="text-(--cl-text-muted)">Total</span>
                                <span className="font-bold text-(--cl-text)">{fmtCurrency(totalAmt)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-xs">
                                <span className="text-emerald-600 dark:text-emerald-400">Received</span>
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">{fmtCurrency(totalPaid)}</span>
                            </div>
                            <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
                                totalDue > 0
                                    ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800"
                                    : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                            }`}>
                                <span className={totalDue > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                                    Due
                                </span>
                                <span className={`font-bold ${totalDue > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                                    {fmtCurrency(totalDue)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Scrollable body ───────────────────────────────────── */}
                    <div className="flex-1 min-h-0 overflow-y-auto bg-(--cl-surface)">
                        <div className="px-6 py-5 space-y-6">

                            {/* Jobs table */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="h-px flex-1 bg-(--cl-border)" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted) px-2">
                                        Selected Jobs
                                    </span>
                                    <span className="h-px flex-1 bg-(--cl-border)" />
                                </div>
                                <DeliveryModalJobsTable jobs={jobDetails} availableDivisions={availableDivisions} />
                            </section>

                            {/* Invoices section */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="h-px flex-1 bg-(--cl-border)" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted) px-2">
                                        Invoices
                                    </span>
                                    <span className="h-px flex-1 bg-(--cl-border)" />
                                </div>
                                <DeliveryModalInvoicesSection jobs={jobDetails} />
                            </section>

                            {/* Receipts section */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="h-px flex-1 bg-(--cl-border)" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted) px-2">
                                        Money Receipts
                                    </span>
                                    <span className="h-px flex-1 bg-(--cl-border)" />
                                </div>
                                <DeliveryModalReceiptsSection
                                    jobs={jobDetails}
                                    onAddReceipt={job => { setReceiptJob(job); setShowReceiptModal(true); }}
                                />
                            </section>

                        </div>
                    </div>

                    {/* ── Footer ────────────────────────────────────────────── */}
                    <div className="shrink-0 border-t border-(--cl-border) bg-(--cl-surface-2)/60">

                        {/* Delivery form row */}
                        <div className="px-6 pt-4 pb-3 flex flex-wrap items-end gap-4">
                            {/* Delivery Manner */}
                            <div className="flex-1 min-w-[180px] max-w-[260px]">
                                <Label className="mb-1.5 block text-xs font-semibold text-(--cl-text)">
                                    Delivery Manner <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={form.watch("delivery_manner")}
                                    onValueChange={v => form.setValue("delivery_manner", v, { shouldValidate: true })}
                                >
                                    <SelectTrigger className="h-9 border-(--cl-border) bg-(--cl-surface) text-sm">
                                        <SelectValue placeholder="Select manner…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {deliveryManners.map(m => (
                                            <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Delivery Date */}
                            <div className="w-44">
                                <Label className="mb-1.5 block text-xs font-semibold text-(--cl-text)">
                                    Delivery Date <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="date"
                                    className="h-9 border-(--cl-border) bg-(--cl-surface) text-sm"
                                    {...form.register("delivery_date")}
                                />
                            </div>

                            {/* Remarks */}
                            <div className="flex-1 min-w-[200px]">
                                <Label className="mb-1.5 block text-xs font-semibold text-(--cl-text)">
                                    Remarks
                                </Label>
                                <Input
                                    placeholder="Optional remarks…"
                                    className="h-9 border-(--cl-border) bg-(--cl-surface) text-sm"
                                    {...form.register("remarks")}
                                />
                            </div>
                        </div>

                        {/* Action buttons row */}
                        <div className="px-6 pb-4 flex flex-wrap items-center justify-between gap-3">
                            {/* Left — document actions */}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    className="h-9 gap-2 px-4 text-sm bg-sky-600 hover:bg-sky-700 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    disabled={!canCreateInvoices}
                                    onClick={() => void handleCreateInvoices()}
                                >
                                    {creatingInvoices
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <FileText className="h-4 w-4" />
                                    }
                                    Create Invoice &amp; Receipts
                                </Button>
                                <Button
                                    className="h-9 gap-2 px-4 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    disabled={!canShowPdf}
                                    variant="outline"
                                    onClick={() => void handleShowPdf()}
                                >
                                    <FileText className="h-4 w-4" />
                                    Show PDF
                                </Button>
                            </div>

                            {/* Right — cancel / deliver */}
                            <div className="flex gap-3">
                                <Button
                                    className="h-9 px-5 text-sm"
                                    disabled={delivering || creatingInvoices}
                                    variant="outline"
                                    onClick={onClose}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="h-9 gap-2 px-6 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md tracking-wide disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed"
                                    disabled={!canDeliver}
                                    onClick={() => void form.handleSubmit(handleDeliver)()}
                                >
                                    {delivering
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <Truck className="h-4 w-4" />
                                    }
                                    Deliver &amp; Close
                                </Button>
                            </div>
                        </div>
                    </div>

                </DialogContent>
            </Dialog>

            {/* Add Receipt modal */}
            <AddReceiptModal
                open={showReceiptModal}
                defaultAmount={receiptJob
                    ? Math.max(0, Number(receiptJob.amount ?? 0) - (receiptJob.payments ?? []).reduce((s, p) => s + Number(p.amount), 0))
                    : 0
                }
                onClose={() => { setShowReceiptModal(false); setReceiptJob(null); }}
                onSave={handleAddReceipt}
            />

            {/* PDF preview */}
            <PdfPreviewModal
                isOpen={showPdf}
                onClose={() => setShowPdf(false)}
                pdfUrl={pdfUrl}
                title={`Delivery Note${jobDetails.length > 1 ? "s" : ""} — ${jobDetails.map(j => j.job_no).join(", ")}`}
                filename={`delivery-${jobDetails.map(j => j.job_no).join("-")}.pdf`}
            />
        </>
    );
}
