import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, FileText, Loader2, RefreshCw, Trash2, Truck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import type { DocumentSequenceRow } from "@/features/client/types/sales";

import {
    deliveryModalSchema, getDeliveryModalDefaults,
    type DeliveryModalFormValues, type JobDeliveryFullDetail,
    type AddReceiptFormValues, type JobInvoiceFullRow,
} from "./deliver-job-schema";
import { fmtCurrency, isJobInvoiceable } from "./deliver-job-helpers";
import { MESSAGES } from "@/constants/messages";
import { buildInvoicePdf, buildPackedInvoicePdf, buildReceiptPdf, buildDeliveryNotePdf } from "./deliver-job-pdf";
import { useAppSelector } from "@/store/hooks";
import { selectNoOfJobInvoicesPerPrint } from "@/store/context-slice";
import { DeliveryModalJobsTable } from "./delivery-modal-jobs-table";
import { DeliveryModalInvoicesSection } from "./delivery-modal-invoices-section";
import { DeliveryModalReceiptsSection } from "./delivery-modal-receipts-section";
import { AddReceiptModal } from "./add-receipt-modal";
import { JobDetailsModal } from "@/features/client/components/jobs/job-pipeline/job-details-modal";

// ── Types ─────────────────────────────────────────────────────────────────────

type DeliveryMannerRow = { id: number; name: string };

type GenericQueryData<T> = { genericQuery: T[] | null };

type ShowPartsInInvoiceSetting = { show: boolean; text: string; hsn: number; gst_rate: number };

type FlowStep = "idle" | "receipts" | "delivering" | "alert" | "invoicing" | "done";

type Props = {
    jobs:                      JobDeliveryFullDetail[];
    branchId:                  number | null;
    branchName:                string | null;
    deliveryManners:           DeliveryMannerRow[];
    availableDivisions:        DivisionContextType[];
    currentUser:               UserInstanceType | null;
    dbName:                    string | null;
    schema:                    string | null;
    showPartsInInvoiceSetting: ShowPartsInInvoiceSetting | null;
    onClose:                   () => void;
    onDelivered:               () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function buildInvoiceLines(
    job: JobDeliveryFullDetail,
    isGst: boolean,
    forceIgst: boolean,
    showPartsSetting: ShowPartsInInvoiceSetting | null,
): InvoiceLine[] {
    function computeTax(taxable: number, gstRate: number) {
        if (!isGst || gstRate === 0) return { cgst: 0, sgst: 0, igst: 0 };
        if (forceIgst) return { cgst: 0, sgst: 0, igst: Math.round(taxable * gstRate) / 100 };
        const half = Math.round(taxable * gstRate / 2) / 100;
        return { cgst: half, sgst: half, igst: 0 };
    }

    const showDetail = job.to_show_parts_in_job_invoice ?? true;

    if (!showDetail && showPartsSetting) {
        const combinedTaxable = Math.round(
            ((job.parts  ?? []).reduce((s, p) => s + p.selling_price * p.qty, 0) +
             (job.charges ?? []).reduce((s, c) => s + c.selling_price * c.qty, 0)) * 100
        ) / 100;
        const rate = isGst ? showPartsSetting.gst_rate : 0;
        const { cgst, sgst, igst } = computeTax(combinedTaxable, rate);
        return [{
            description: showPartsSetting.text,
            part_code:   null,
            hsn_code:    isGst ? String(showPartsSetting.hsn) : null,
            qty:         1,
            price:       combinedTaxable,
            aggregate:   combinedTaxable,
            gst_rate:    rate,
            cgst_amount: cgst,
            sgst_amount: sgst,
            igst_amount: igst,
            amount:      Math.round((combinedTaxable + cgst + sgst + igst) * 100) / 100,
        }];
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

// ── Step section wrapper ──────────────────────────────────────────────────────

type StepAccent = "sky" | "violet" | "emerald";

const ACCENT: Record<StepAccent, { bubble: string; left: string; title: string }> = {
    sky:     { bubble: "bg-sky-500",     left: "border-l-sky-400",     title: "text-sky-700 dark:text-sky-300"     },
    violet:  { bubble: "bg-violet-500",  left: "border-l-violet-400",  title: "text-violet-700 dark:text-violet-300" },
    emerald: { bubble: "bg-emerald-500", left: "border-l-emerald-400", title: "text-emerald-700 dark:text-emerald-300" },
};

function StepSection({
    step, title, accent, count, children,
}: {
    step:     number;
    title:    string;
    accent:   StepAccent;
    count?:   number;
    children: React.ReactNode;
}) {
    const a = ACCENT[accent];
    return (
        <section className={`rounded-xl border border-(--cl-border) border-l-4 ${a.left} bg-(--cl-surface) shadow-sm overflow-hidden`}>
            <div className="flex items-center gap-3 px-4 py-3 bg-(--cl-surface-2)/50">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold shrink-0 ${a.bubble}`}>
                    {step}
                </span>
                <span className={`text-sm font-bold uppercase tracking-widest ${a.title}`}>{title}</span>
                {count !== undefined && (
                    <span className="text-sm text-(--cl-text-muted) font-medium">({count})</span>
                )}
            </div>
            <div className="px-4 pb-4">
                {children}
            </div>
        </section>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeliveryModal({
    jobs: initialJobs,
    branchId,
    branchName,
    deliveryManners,
    availableDivisions,
    currentUser,
    dbName,
    schema,
    showPartsInInvoiceSetting,
    onClose,
    onDelivered,
}: Props) {
    const noOfJobInvoicesPerPrint = useAppSelector(selectNoOfJobInvoicesPerPrint);

    const [jobDetails,                  setJobDetails]                  = useState<JobDeliveryFullDetail[]>(initialJobs);
    const [flowStep,                    setFlowStep]                    = useState<FlowStep>("idle");
    const [showDeliverySuccessAlert,    setShowDeliverySuccessAlert]    = useState(false);
    const [pdfUrl,                      setPdfUrl]                      = useState<string | null>(null);
    const [showInvoiceReceipt,          setShowInvoiceReceipt]          = useState(false);
    const [pdfTitle,                    setPdfTitle]                    = useState("");
    const [pdfFilename,                 setPdfFilename]                 = useState("");
    const [loadingPdfJobId,             setLoadingPdfJobId]             = useState<number | null>(null);
    const [deletingInvoiceJobId,        setDeletingInvoiceJobId]        = useState<number | null>(null);
    const [confirmDeleteJob,            setConfirmDeleteJob]            = useState<JobDeliveryFullDetail | null>(null);
    const [regeneratingInvoiceJobId,    setRegeneratingInvoiceJobId]    = useState<number | null>(null);
    const [confirmRegenerateJob,        setConfirmRegenerateJob]        = useState<JobDeliveryFullDetail | null>(null);
    const [receiptJob,                  setReceiptJob]                  = useState<JobDeliveryFullDetail | null>(null);
    const [showReceiptModal,            setShowReceiptModal]            = useState(false);
    const [receiptQueue,                setReceiptQueue]                = useState<JobDeliveryFullDetail[]>([]);
    const [viewJobId,                   setViewJobId]                   = useState<number | null>(null);
    const [deliveredOkStatusId,         setDeliveredOkStatusId]         = useState<number | null>(null);
    const [deliveredNotOkStatusId,      setDeliveredNotOkStatusId]      = useState<number | null>(null);
    const [divisionSequences,           setDivisionSequences]           = useState<Map<number, DocumentSequenceRow[]>>(new Map());

    // Continuation fired after all receipts are saved (drives delivery in combined flow)
    const postReceiptContinuation = useRef<(() => Promise<void>) | null>(null);
    // Tracks whether delivery succeeded so onDelivered() is called on modal close
    const didDeliver = useRef(false);

    useEffect(() => {
        if (!dbName || !schema || !branchId || jobDetails.length === 0) return;
        const divIds = [...new Set(jobDetails.map(j => j.division_id).filter((id): id is number => id != null))];
        Promise.all(
            divIds.map(divId =>
                apolloClient.query<GenericQueryData<DocumentSequenceRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DOCUMENT_SEQUENCES_BY_DIVISION, sqlArgs: { branch_id: branchId, division_id: divId } }) },
                }).then(res => ({ divId, rows: res.data?.genericQuery ?? [] }))
            )
        ).then(results => {
            const map = new Map<number, DocumentSequenceRow[]>();
            results.forEach(({ divId, rows }) => map.set(divId, rows));
            setDivisionSequences(map);
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbName, schema, branchId, jobDetails.length]);

    useEffect(() => {
        if (!dbName || !schema) return;
        apolloClient.query<GenericQueryData<{ id: number; code: string }>>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_STATUSES }) },
        }).then(res => {
            const statuses = res.data?.genericQuery ?? [];
            setDeliveredOkStatusId(statuses.find(s => s.code === "DELIVERED_OK")?.id ?? null);
            setDeliveredNotOkStatusId(statuses.find(s => s.code === "DELIVERED_NOT_OK")?.id ?? null);
        });
    }, [dbName, schema]);

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

    const mannerVal      = form.watch("delivery_manner");
    const dateVal        = form.watch("delivery_date");
    const flowBusy       = flowStep !== "idle" && flowStep !== "done";
    const flowDone       = flowStep === "done";
    const canRunFlow     = !flowBusy && !flowDone && !!mannerVal && !!dateVal;
    const canClose       = !flowBusy;
    const canShowInvoice = jobDetails.some(j => !!j.invoice_id);
    const isDelivered    = jobDetails.some(j => j.job_status_code === "DELIVERED_OK" || j.job_status_code === "DELIVERED_NOT_OK");

    const isSingleJob = jobDetails.length === 1;
    const firstJob    = jobDetails[0];
    const addressStr  = firstJob
        ? [
            firstJob.customer_address_line1,
            firstJob.customer_address_line2,
            firstJob.customer_landmark,
            firstJob.customer_city,
            firstJob.customer_postal_code,
          ].filter(Boolean).join(", ")
        : "";

    // ── Reload job details ────────────────────────────────────────────────────

    async function reloadJobDetails(): Promise<JobDeliveryFullDetail[]> {
        if (!dbName || !schema) return [];
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
        const fresh = res.data?.genericQuery ?? [];
        setJobDetails(fresh);
        return fresh;
    }

    // ── Combined flow: Receipts → Delivery → Alert → Invoice ─────────────────

    async function handleReceiptsDeliveryInvoice() {
        const valid = await form.trigger();
        if (!valid) {
            toast.error("Please fill in Delivery Manner and Delivery Date.");
            return;
        }

        const needReceipt = jobDetails.filter(j =>
            Number(j.amount ?? 0) > 0 &&
            (j.payments ?? []).reduce((s, p) => s + Number(p.amount), 0) < Number(j.amount ?? 0)
        );

        if (needReceipt.length > 0) {
            postReceiptContinuation.current = () => doDelivery();
            setFlowStep("receipts");
            setReceiptQueue(needReceipt.slice(1));
            setReceiptJob(needReceipt[0]);
            setShowReceiptModal(true);
            return;
        }

        await doDelivery();
    }

    async function doDelivery() {
        setFlowStep("delivering");
        const values = form.getValues();
        try {
            for (const job of jobDetails) {
                const statusId = job.job_status_code === "COMPLETED_OK"
                    ? deliveredOkStatusId
                    : deliveredNotOkStatusId;
                if (!statusId) continue;
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.deliverJob,
                    variables: {
                        db_name: dbName, schema,
                        value: encodeObj({
                            job_id:               job.id,
                            last_transaction_id:  job.last_transaction_id,
                            performed_by_user_id: currentUser?.id ?? null,
                            delivered_status_id:  statusId,
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
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            didDeliver.current = true;
            await reloadJobDetails();
            setFlowStep("alert");
            setShowDeliverySuccessAlert(true);
        } catch {
            toast.error("Delivery failed. Please try again.");
            setFlowStep("idle");
        }
    }

    async function handleDeliveryAlertClose() {
        setShowDeliverySuccessAlert(false);
        setFlowStep("invoicing");
        // Reload to get DELIVERED_OK status for isJobInvoiceable; pass fresh data
        // directly to doCreateInvoices to avoid stale-closure on jobDetails state.
        const fresh = await reloadJobDetails();
        await doCreateInvoices(fresh);
        await reloadJobDetails();   // reload again to show invoice numbers in UI
        setFlowStep("done");
    }

    async function doCreateInvoices(jobs: JobDeliveryFullDetail[]) {
        if (!dbName || !schema) return;
        let created = 0;
        let skipped = 0;
        try {
            for (const job of jobs) {
                if (!isJobInvoiceable(job.job_type_code, job.job_status_code)) { skipped++; continue; }
                if (job.invoice_id) { skipped++; continue; }

                const division = availableDivisions.find(d => d.id === job.division_id) ?? null;
                const isGst    = isGstDivision(division);

                const divSeqs  = (job.division_id != null ? divisionSequences.get(job.division_id) : undefined) ?? [];
                const svcSeq   = divSeqs.find(ds => ds.document_type_code === "SERVICE_INVOICE" && ds.id != null);
                if (!svcSeq || !svcSeq.prefix.trim()) {
                    toast.error(`${MESSAGES.ERROR_DOC_SEQ_SERVICE_INV_NOT_CONFIGURED} (Job #${job.job_no})`);
                    skipped++;
                    continue;
                }

                const lines = buildInvoiceLines(job, isGst, job.is_igst ?? false, showPartsInInvoiceSetting);
                if (lines.length === 0) {
                    toast.warning(`Job #${job.job_no}: ${MESSAGES.WARN_JOB_INVOICE_NO_LINES}`);
                    skipped++;
                    continue;
                }
                const aggregate   = Math.round(lines.reduce((s, l) => s + l.aggregate,   0) * 100) / 100;
                const cgst_amount = Math.round(lines.reduce((s, l) => s + l.cgst_amount, 0) * 100) / 100;
                const sgst_amount = Math.round(lines.reduce((s, l) => s + l.sgst_amount, 0) * 100) / 100;
                const igst_amount = Math.round(lines.reduce((s, l) => s + l.igst_amount, 0) * 100) / 100;
                // Use the finalized job.amount when it is a valid positive number
                // (set during "Final a Job", may include a user-adjusted total).
                // Fall back to the sum of invoice lines when job.amount is null or 0
                // (job never finalised, or finalised before parts were added).
                const lineTotal   = Math.round((aggregate + cgst_amount + sgst_amount + igst_amount) * 100) / 100;
                const jobAmt      = Number(job.amount ?? 0);
                const amount      = jobAmt > 0
                    ? Math.round(jobAmt * 100) / 100
                    : lineTotal;

                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.createJobInvoice,
                    variables: {
                        db_name: dbName, schema,
                        value: encodeObj({
                            tableName: "job_invoice",
                            xData: {
                                branch_id:         branchId,
                                division_id:       job.division_id,
                                job_id:            job.id,
                                invoice_date:      new Date().toISOString().slice(0, 10),
                                supply_state_code: division?.gst_state_code ?? "",
                                aggregate,
                                cgst_amount,
                                sgst_amount,
                                igst_amount,
                                amount,
                                xDetails: lines.length > 0 ? [{
                                    tableName: "job_invoice_line",
                                    fkeyName:  "job_invoice_id",
                                    xData:     lines,
                                }] : undefined,
                            },
                        }),
                    },
                });
                created++;
            }
            await reloadJobDetails();
            toast.success(created > 0
                ? `${created} invoice(s) created.${skipped > 0 ? ` ${skipped} skipped.` : ""}`
                : "All jobs already have invoices or were skipped."
            );
        } catch (err) {
            console.error("Invoice creation error:", err);
            toast.error("Failed to create invoices. Please try again.");
        }
    }

    // ── Delete Invoice ────────────────────────────────────────────────────────

    function handleDeleteInvoice(job: JobDeliveryFullDetail) {
        if (!job.invoice_id) return;
        setConfirmDeleteJob(job);
    }

    async function executeDeleteInvoice(job: JobDeliveryFullDetail) {
        if (!dbName || !schema || !job.invoice_id) return;
        setDeletingInvoiceJobId(job.id);
        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "job_invoice",
                        deletedIds: [job.invoice_id],
                        xData: [],
                    }),
                },
            });
            toast.success(`Invoice ${job.invoice_no ?? ""} deleted.`);
            await reloadJobDetails();
        } catch (err) {
            console.error("Invoice delete error:", err);
            toast.error(MESSAGES.ERROR_JOB_INVOICE_DELETE_FAILED);
        } finally {
            setDeletingInvoiceJobId(null);
        }
    }

    // ── Regenerate Invoice ────────────────────────────────────────────────────

    function handleRegenerateInvoice(job: JobDeliveryFullDetail) {
        if (!job.invoice_id) return;
        setConfirmRegenerateJob(job);
    }

    async function executeRegenerateInvoice(job: JobDeliveryFullDetail) {
        if (!dbName || !schema || !job.invoice_id) return;
        setRegeneratingInvoiceJobId(job.id);
        try {
            const division    = availableDivisions.find(d => d.id === job.division_id) ?? null;
            const isGst       = isGstDivision(division);
            const lines       = buildInvoiceLines(job, isGst, job.is_igst ?? false, showPartsInInvoiceSetting);
            if (lines.length === 0) {
                toast.error(MESSAGES.ERROR_JOB_INVOICE_REGEN_NO_LINES);
                return;
            }
            const aggregate   = Math.round(lines.reduce((s, l) => s + l.aggregate,   0) * 100) / 100;
            const cgst_amount = Math.round(lines.reduce((s, l) => s + l.cgst_amount, 0) * 100) / 100;
            const sgst_amount = Math.round(lines.reduce((s, l) => s + l.sgst_amount, 0) * 100) / 100;
            const igst_amount = Math.round(lines.reduce((s, l) => s + l.igst_amount, 0) * 100) / 100;
            const amount      = Math.round(Number(job.amount ?? 0) * 100) / 100;

            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.regenerateJobInvoice,
                variables: {
                    db_name: dbName, schema,
                    value: encodeObj({
                        tableName: "job_invoice",
                        xData: {
                            invoice_id: job.invoice_id,
                            aggregate, cgst_amount, sgst_amount, igst_amount, amount,
                            lines,
                        },
                    }),
                },
            });
            toast.success(`Invoice ${job.invoice_no ?? ""} regenerated.`);
            await reloadJobDetails();
        } catch (err) {
            console.error("Invoice regenerate error:", err);
            toast.error(MESSAGES.ERROR_JOB_INVOICE_REGEN_FAILED);
        } finally {
            setRegeneratingInvoiceJobId(null);
        }
    }

    // ── Invoice + Receipt PDF ─────────────────────────────────────────────────

    async function handleInvoiceReceipt() {
        if (!dbName || !schema) return;
        const items: Parameters<typeof buildPackedInvoicePdf>[0] = [];
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
                const invoice = res.data?.genericQuery?.[0];
                if (!invoice) continue;
                const division = availableDivisions.find(d => d.id === job.division_id) ?? null;
                const partHsnByCode = new Map((job.parts   ?? []).map(p => [p.part_code,   p.hsn_code ?? null]));
                const partHsnByName = new Map((job.parts   ?? []).map(p => [p.part_name,   p.hsn_code ?? null]));
                const chrgHsnByName = new Map((job.charges ?? []).map(c => [c.charge_name, c.hsn_code ?? null]));
                const patchedInvoice = {
                    ...invoice,
                    lines: invoice.lines.map(l => ({
                        ...l,
                        hsn_code: l.hsn_code !== null
                            ? l.hsn_code
                            : (l.part_code != null ? partHsnByCode.get(l.part_code) : undefined)
                                ?? partHsnByName.get(l.description)
                                ?? chrgHsnByName.get(l.description)
                                ?? null,
                    })),
                };
                items.push({ job, invoice: patchedInvoice, division });
            }
        } catch {
            toast.error("Failed to load invoice data for PDF.");
            return;
        }

        if (items.length === 0) { toast.error("No invoices to show."); return; }
        const doc = buildPackedInvoicePdf(items, branchName, noOfJobInvoicesPerPrint);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(URL.createObjectURL(doc.output("blob")));
        setPdfTitle(`Invoice${items.length > 1 ? "s" : ""} — ${jobDetails.map(j => j.job_no).join(", ")}`);
        setPdfFilename(`invoice-${jobDetails.map(j => j.job_no).join("-")}.pdf`);
        setShowInvoiceReceipt(true);
    }

    // ── Delivery Note PDF ─────────────────────────────────────────────────────

    function handleDeliveryNote() {
        const { delivery_date, delivery_manner, remarks } = form.getValues();
        const divisionId = jobDetails.length === 1 ? jobDetails[0].division_id : null;
        const division   = divisionId != null ? (availableDivisions.find(d => d.id === divisionId) ?? null) : null;
        const jobs = jobDetails.map(j => ({
            job_no:                  j.job_no,
            alternate_job_no:        j.alternate_job_no,
            job_date:                j.job_date,
            customer_name:           j.customer_name,
            mobile:                  j.mobile,
            customer_address_line1:  j.customer_address_line1,
            customer_address_line2:  j.customer_address_line2,
            customer_landmark:       j.customer_landmark,
            customer_city:           j.customer_city,
            customer_postal_code:    j.customer_postal_code,
            customer_state:          j.customer_state,
            device_details:          j.device_details,
            technician_name:         j.technician_name,
            amount:                  j.amount,
            invoice_no:              j.invoice_no ?? null,
            receipt_nos:             (j.payments ?? []).map(p => p.receipt_no).filter((r): r is string => !!r),
            delivery_ok:             null as boolean | null,
            delivery_date,
            delivery_manner,
            remarks:                 remarks ?? null,
        }));
        const doc = buildDeliveryNotePdf(jobs, division, branchName);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(URL.createObjectURL(doc.output("blob")));
        setPdfTitle(`Delivery Note — ${jobDetails.map(j => j.job_no).join(", ")}`);
        setPdfFilename(`delivery-note-${jobDetails.map(j => j.job_no).join("-")}.pdf`);
        setShowInvoiceReceipt(true);
    }

    // ── Per-job Invoice PDF ───────────────────────────────────────────────────

    async function handlePrintInvoicePdf(job: JobDeliveryFullDetail) {
        if (!dbName || !schema || !job.invoice_id) return;
        setLoadingPdfJobId(job.id);
        try {
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
            const invoice = res.data?.genericQuery?.[0];
            if (!invoice) { toast.error("Invoice data not found."); return; }
            const division = availableDivisions.find(d => d.id === job.division_id) ?? null;

            const partHsnByCode = new Map((job.parts   ?? []).map(p => [p.part_code,    p.hsn_code ?? null]));
            const partHsnByName = new Map((job.parts   ?? []).map(p => [p.part_name,    p.hsn_code ?? null]));
            const chrgHsnByName = new Map((job.charges ?? []).map(c => [c.charge_name,  c.hsn_code ?? null]));
            const patchedInvoice = {
                ...invoice,
                lines: invoice.lines.map(l => ({
                    ...l,
                    hsn_code: l.hsn_code !== null
                        ? l.hsn_code
                        : (l.part_code != null ? partHsnByCode.get(l.part_code) : undefined)
                            ?? partHsnByName.get(l.description)
                            ?? chrgHsnByName.get(l.description)
                            ?? null,
                })),
            };

            const doc = buildInvoicePdf(job, patchedInvoice, division, branchName, undefined, noOfJobInvoicesPerPrint);
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            setPdfUrl(URL.createObjectURL(doc.output("blob")));
            setPdfTitle(`Invoice ${invoice.invoice_no} — ${job.customer_name}`);
            setPdfFilename(`invoice-${job.job_no}.pdf`);
            setShowInvoiceReceipt(true);
        } catch {
            toast.error("Failed to generate invoice PDF.");
        } finally {
            setLoadingPdfJobId(null);
        }
    }

    // ── Per-job Receipt PDF ───────────────────────────────────────────────────

    function handlePrintReceiptPdf(job: JobDeliveryFullDetail) {
        const division = availableDivisions.find(d => d.id === job.division_id) ?? null;
        const doc = buildReceiptPdf(job, division);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(URL.createObjectURL(doc.output("blob")));
        setPdfTitle(`Receipt — ${job.job_no} / ${job.customer_name}`);
        setPdfFilename(`receipt-${job.job_no}.pdf`);
        setShowInvoiceReceipt(true);
    }

    // ── Add Receipt ───────────────────────────────────────────────────────────

    async function handleAddReceipt(values: AddReceiptFormValues) {
        if (!receiptJob || !dbName || !schema) return;
        const divSeqs  = (receiptJob.division_id != null ? divisionSequences.get(receiptJob.division_id) : undefined) ?? [];
        const rcptSeq  = divSeqs.find(ds => ds.document_type_code === "MONEY_RECEIPT" && ds.id != null);
        if (!rcptSeq || !rcptSeq.prefix.trim()) {
            toast.error(MESSAGES.ERROR_DOC_SEQ_RECEIPT_NOT_CONFIGURED);
            return;
        }
        await apolloClient.mutate({
            mutation:  GRAPHQL_MAP.createJobPayment,
            variables: {
                db_name: dbName, schema,
                value: encodeObj({
                    xData: {
                        branch_id:    branchId,
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

        if (receiptQueue.length > 0) {
            // More receipts pending — advance to next
            setReceiptJob(receiptQueue[0]);
            setReceiptQueue(prev => prev.slice(1));
            void reloadJobDetails();
        } else {
            // Last receipt done
            setShowReceiptModal(false);
            setReceiptJob(null);
            await reloadJobDetails();
            // Fire continuation if running in combined flow
            if (postReceiptContinuation.current) {
                const fn = postReceiptContinuation.current;
                postReceiptContinuation.current = null;
                await fn();
            }
        }
    }

    function handleReceiptModalClose() {
        setShowReceiptModal(false);
        setReceiptJob(null);
        setReceiptQueue([]);
        // User aborted receipts mid-flow — cancel and allow retry
        if (postReceiptContinuation.current) {
            postReceiptContinuation.current = null;
            setFlowStep("idle");
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    // Dynamic label for the combined-flow button
    const flowButtonLabel =
        flowStep === "receipts"   ? "Collecting Receipts…"    :
        flowStep === "delivering" ? "Delivering…"             :
        flowStep === "alert"      ? "Delivering…"             :
        flowStep === "invoicing"  ? "Invoice is being made…"  :
        "Receipts + Delivery + Invoice";

    return (
        <>
            <Dialog open modal onOpenChange={() => { /* blocked — use Close button */ }}>
                <DialogContent
                    className="w-[92vw] sm:max-w-5xl max-h-[95vh] flex flex-col overflow-hidden p-0 gap-0 shadow-2xl border-2 border-emerald-800 dark:border-emerald-400"
                    showCloseButton={false}
                    onPointerDownOutside={e => e.preventDefault()}
                    onEscapeKeyDown={e => e.preventDefault()}
                    aria-describedby={undefined}
                >
                    {/* ── Accent bar ───────────────────────────────────────── */}
                    <div className="h-1.5 w-full shrink-0 bg-emerald-600 dark:bg-emerald-500" />

                    {/* Close button — absolute top-right */}
                    <Button
                        className="absolute top-1 z-50 h-7 w-7 rounded-full text-(--cl-text-muted) hover:text-(--cl-text) hover:bg-(--cl-surface-2)"
                        style={{ right: -1 }}
                        disabled={!canClose}
                        size="icon"
                        title="Close"
                        variant="ghost"
                        onClick={() => { if (didDeliver.current) onDelivered(); onClose(); }}
                    >
                        <X className="h-4 w-4" />
                    </Button>

                    {/* ── Header ───────────────────────────────────────────── */}
                    <div className="shrink-0 bg-(--cl-surface) px-6 pt-4 pb-3">

                        <div className="flex items-start justify-between gap-4">

                            {/* Left: icon + identity */}
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-md mt-0.5">
                                    <Truck className="h-5 w-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    {/* Title row */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <DialogTitle className="text-xl font-bold text-(--cl-text) leading-tight">
                                            Deliver Job{!isSingleJob ? "s" : ""}
                                        </DialogTitle>

                                        {isSingleJob ? (
                                            /* Single-job: prominent job number + view button */
                                            <>
                                                <span className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-400 leading-tight">
                                                    #{firstJob.job_no}
                                                </span>
                                                {firstJob.alternate_job_no && (
                                                    <span className="text-sm text-(--cl-text-muted)">/ {firstJob.alternate_job_no}</span>
                                                )}
                                                <Button
                                                    className="h-7 gap-1.5 px-2.5 text-xs font-semibold"
                                                    size="sm"
                                                    title="View full job details"
                                                    variant="outline"
                                                    onClick={() => setViewJobId(firstJob.id)}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    View Job
                                                </Button>
                                            </>
                                        ) : (
                                            /* Multi-job: count badge */
                                            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                                {jobDetails.length} jobs
                                            </span>
                                        )}
                                    </div>

                                    {/* Identity row */}
                                    {isSingleJob ? (
                                        <>
                                            <div className="mt-1 flex items-center gap-2 min-w-0">
                                                <span className="font-semibold text-(--cl-text) text-sm truncate">{firstJob.customer_name}</span>
                                                {firstJob.mobile && (
                                                    <span className="text-sm text-(--cl-text-muted) shrink-0">{firstJob.mobile}</span>
                                                )}
                                            </div>
                                            {addressStr && (
                                                <p className="text-xs text-(--cl-text-muted) mt-0.5 truncate">{addressStr}</p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="mt-0.5 text-sm text-(--cl-text-muted) truncate">
                                            {jobDetails.map(j => `#${j.job_no}`).join(" · ")}
                                        </p>
                                    )}

                                    <p className="text-xs text-(--cl-text-muted) mt-1 font-medium tracking-wide">
                                        Review · Receipt · Deliver · Invoice
                                    </p>
                                </div>
                            </div>

                            {/* Right: summary stat pills */}
                            <div className="flex flex-wrap items-start gap-2 justify-end shrink-0">
                                <div className="flex items-center gap-1.5 rounded-lg border border-(--cl-border) bg-(--cl-surface-2) px-3 py-2">
                                    <span className="text-xs font-medium text-(--cl-text-muted) uppercase tracking-wide">Div</span>
                                    <span className="text-sm font-bold text-(--cl-text)">{divLabel}</span>
                                </div>
                                <div className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                                    gstLabel === "GST"
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                                        : gstLabel === "Non-GST"
                                            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                                            : "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
                                }`}>
                                    {gstLabel}
                                </div>
                                <div className="flex items-center gap-0 rounded-lg border border-(--cl-border) overflow-hidden divide-x divide-(--cl-border)">
                                    <div className="flex items-center gap-1.5 bg-(--cl-surface-2) px-3 py-2">
                                        <span className="text-xs text-(--cl-text-muted) uppercase font-medium">Total</span>
                                        <span className="text-sm font-bold tabular-nums text-(--cl-text)">{fmtCurrency(totalAmt)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2">
                                        <span className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-medium">Rcvd</span>
                                        <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{fmtCurrency(totalPaid)}</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-3 py-2 ${
                                        totalDue > 0
                                            ? "bg-red-50 dark:bg-red-950/40"
                                            : "bg-emerald-50 dark:bg-emerald-950/40"
                                    }`}>
                                        <span className={`text-xs uppercase font-medium ${totalDue > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>Due</span>
                                        <span className={`text-sm font-extrabold tabular-nums ${totalDue > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                                            {fmtCurrency(totalDue)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Scrollable body ───────────────────────────────────── */}
                    <div className="flex-1 min-h-0 overflow-y-auto bg-(--cl-surface-2)/30">
                        <div className="px-6 py-4 space-y-5">

                            {/* Step 1 – Selected Jobs */}
                            <StepSection step={1} title="Selected Jobs" accent="sky" count={jobDetails.length}>
                                <DeliveryModalJobsTable
                                    jobs={jobDetails}
                                    availableDivisions={availableDivisions}
                                    onViewJob={!isSingleJob ? id => setViewJobId(id) : undefined}
                                />
                            </StepSection>

                            {/* Step 2 – Receipts */}
                            <StepSection step={2} title="Money Receipts" accent="emerald">
                                <DeliveryModalReceiptsSection
                                    jobs={jobDetails}
                                    onAddReceipt={job => { setReceiptQueue([]); setReceiptJob(job); setShowReceiptModal(true); }}
                                    loadingPdfJobId={loadingPdfJobId}
                                    onPrintReceipt={handlePrintReceiptPdf}
                                />
                            </StepSection>

                            {/* Step 3 – Invoices */}
                            <StepSection step={3} title="Service Invoice" accent="violet">
                                <DeliveryModalInvoicesSection
                                    jobs={jobDetails}
                                    availableDivisions={availableDivisions}
                                    loadingPdfJobId={loadingPdfJobId}
                                    deletingInvoiceJobId={deletingInvoiceJobId}
                                    regeneratingInvoiceJobId={regeneratingInvoiceJobId}
                                    onPrintInvoice={job => void handlePrintInvoicePdf(job)}
                                    onDeleteInvoice={job => void handleDeleteInvoice(job)}
                                    onRegenerateInvoice={job => void handleRegenerateInvoice(job)}
                                />
                            </StepSection>

                        </div>
                    </div>

                    {/* ── Footer ────────────────────────────────────────────── */}
                    <div className="shrink-0 border-t-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">

                        {/* Step 4 label + delivery form */}
                        <div className="px-6 pt-4 pb-3">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold shrink-0">4</span>
                                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Delivery Details</span>
                            </div>

                            <div className="flex flex-wrap items-end gap-4">
                                {/* Delivery Manner */}
                                <div className="flex-1 min-w-[200px] max-w-[280px]">
                                    <Label className="mb-1.5 block text-sm font-semibold text-(--cl-text)">
                                        Delivery Manner <span className="text-red-500">*</span>
                                    </Label>
                                    <Select
                                        value={mannerVal}
                                        onValueChange={v => form.setValue("delivery_manner", v, { shouldValidate: true })}
                                        disabled={flowBusy || flowDone}
                                    >
                                        <SelectTrigger className="h-10 border-(--cl-border) bg-(--cl-surface) text-base shadow-sm">
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
                                <div className="w-48">
                                    <Label className="mb-1.5 block text-sm font-semibold text-(--cl-text)">
                                        Delivery Date <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="date"
                                        className="h-10 border-(--cl-border) bg-(--cl-surface) text-base shadow-sm"
                                        disabled={flowBusy || flowDone}
                                        {...form.register("delivery_date")}
                                    />
                                </div>

                                {/* Remarks */}
                                <div className="flex-1 min-w-[220px]">
                                    <Label className="mb-1.5 block text-sm font-semibold text-(--cl-text)">
                                        Remarks
                                    </Label>
                                    <Input
                                        placeholder="Optional remarks…"
                                        className="h-10 border-(--cl-border) bg-(--cl-surface) text-base shadow-sm"
                                        disabled={flowBusy || flowDone}
                                        {...form.register("remarks")}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action buttons row */}
                        <div className="px-6 pb-5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                {/* Primary action */}
                                <Button
                                    className="h-10 gap-2 px-5 text-base bg-sky-600 hover:bg-sky-700 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    disabled={!canRunFlow}
                                    onClick={() => void handleReceiptsDeliveryInvoice()}
                                >
                                    {flowBusy
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <Truck className="h-4 w-4" />
                                    }
                                    {flowButtonLabel}
                                </Button>

                                {/* Divider */}
                                <div className="h-7 w-px bg-(--cl-border)" />

                                {/* PDF buttons — individual light outline style */}
                                <div className="flex items-center gap-1.5 overflow-visible">
                                    {/* Invoice + Receipt */}
                                    <div className="relative group/inv">
                                        <Button
                                            className="h-9 gap-1.5 px-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                            disabled={!canShowInvoice}
                                            size="sm"
                                            variant="outline"
                                            onClick={() => void handleInvoiceReceipt()}
                                        >
                                            <FileText className="h-3.5 w-3.5 shrink-0" />
                                            Invoice + Receipt
                                        </Button>
                                        {!canShowInvoice && (
                                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/inv:opacity-100 transition-opacity">
                                                <div className="rounded-md bg-neutral-800 dark:bg-neutral-700 shadow-lg px-3 py-1.5 text-xs text-white whitespace-nowrap">
                                                    Invoice not yet created
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-800 dark:border-t-neutral-700" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Delivery Note */}
                                    <div className="relative group/note">
                                        <Button
                                            className="h-9 gap-1.5 px-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                            disabled={!isDelivered}
                                            size="sm"
                                            variant="outline"
                                            onClick={handleDeliveryNote}
                                        >
                                            <FileText className="h-3.5 w-3.5 shrink-0" />
                                            Delivery Note
                                        </Button>
                                        {!isDelivered && (
                                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/note:opacity-100 transition-opacity">
                                                <div className="rounded-md bg-neutral-800 dark:bg-neutral-700 shadow-lg px-3 py-1.5 text-xs text-white whitespace-nowrap">
                                                    Job not yet delivered
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-800 dark:border-t-neutral-700" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right — close */}
                            <Button
                                className="h-10 px-6 text-base font-semibold"
                                disabled={!canClose}
                                variant="outline"
                                onClick={() => { if (didDeliver.current) onDelivered(); onClose(); }}
                            >
                                Close
                            </Button>
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
                subtitle={receiptJob
                    ? `Job #${receiptJob.job_no} — ${receiptJob.customer_name}${receiptQueue.length > 0 ? ` (${receiptQueue.length} more pending)` : ""}`
                    : undefined
                }
                onClose={handleReceiptModalClose}
                onSave={handleAddReceipt}
            />

            {/* PDF preview */}
            <PdfPreviewModal
                isOpen={showInvoiceReceipt}
                onClose={() => setShowInvoiceReceipt(false)}
                pdfUrl={pdfUrl}
                title={pdfTitle}
                filename={pdfFilename}
            />

            {/* Job details viewer */}
            {viewJobId !== null && (
                <JobDetailsModal
                    jobId={viewJobId}
                    onClose={() => setViewJobId(null)}
                />
            )}

            {/* Delivery success alert — forced close, fires invoice creation */}
            <AlertDialog
                open={showDeliverySuccessAlert}
                onOpenChange={() => { /* blocked — user must click Continue */ }}
            >
                <AlertDialogContent
                    size="sm"
                    onEscapeKeyDown={e => e.preventDefault()}
                >
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600">
                            <Truck />
                        </AlertDialogMedia>
                        <AlertDialogTitle>
                            {jobDetails.length > 1 ? "Jobs Delivered Successfully!" : "Job Delivered Successfully!"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {jobDetails.map(j => `#${j.job_no}`).join(", ")} delivered on{" "}
                            {form.getValues("delivery_date")}. Click below to generate the invoice.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction
                            className="col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                            onClick={() => void handleDeliveryAlertClose()}
                        >
                            Continue → Generate Invoice
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Regenerate invoice confirmation */}
            <AlertDialog
                open={!!confirmRegenerateJob}
                onOpenChange={open => { if (!open) setConfirmRegenerateJob(null); }}
            >
                <AlertDialogContent size="sm">
                    {confirmRegenerateJob?.invoice_is_posted ? (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogMedia className="bg-amber-100 dark:bg-amber-950/40 text-amber-600">
                                    <RefreshCw />
                                </AlertDialogMedia>
                                <AlertDialogTitle>Cannot Regenerate Invoice</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Invoice <span className="font-semibold text-foreground">{confirmRegenerateJob.invoice_no}</span>:{" "}
                                    {MESSAGES.ERROR_JOB_INVOICE_REGEN_POSTED}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Close</AlertDialogCancel>
                            </AlertDialogFooter>
                        </>
                    ) : (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogMedia className="bg-sky-100 dark:bg-sky-950/40 text-sky-600">
                                    <RefreshCw />
                                </AlertDialogMedia>
                                <AlertDialogTitle>Regenerate Invoice?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Invoice <span className="font-semibold text-foreground">{confirmRegenerateJob?.invoice_no}</span>{" "}
                                    for job <span className="font-semibold text-foreground">#{confirmRegenerateJob?.job_no}</span>{" "}
                                    ({confirmRegenerateJob?.customer_name}) will be regenerated from the current parts and charges.
                                    The invoice number will be preserved.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => { void executeRegenerateInvoice(confirmRegenerateJob!); }}
                                >
                                    Regenerate
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete invoice confirmation */}
            <AlertDialog
                open={!!confirmDeleteJob}
                onOpenChange={open => { if (!open) setConfirmDeleteJob(null); }}
            >
                <AlertDialogContent size="sm">
                    {confirmDeleteJob?.invoice_is_posted ? (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogMedia className="bg-amber-100 dark:bg-amber-950/40 text-amber-600">
                                    <Trash2 />
                                </AlertDialogMedia>
                                <AlertDialogTitle>Cannot Delete Invoice</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Invoice <span className="font-semibold text-foreground">{confirmDeleteJob.invoice_no}</span>:{" "}
                                    {MESSAGES.ERROR_JOB_INVOICE_DELETE_POSTED}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Close</AlertDialogCancel>
                            </AlertDialogFooter>
                        </>
                    ) : (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogMedia className="bg-red-100 dark:bg-red-950/40 text-red-600">
                                    <Trash2 />
                                </AlertDialogMedia>
                                <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Invoice <span className="font-semibold text-foreground">{confirmDeleteJob?.invoice_no}</span>{" "}
                                    for job <span className="font-semibold text-foreground">#{confirmDeleteJob?.job_no}</span>{" "}
                                    ({confirmDeleteJob?.customer_name}) will be permanently deleted. This cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    variant="destructive"
                                    onClick={() => { void executeDeleteInvoice(confirmDeleteJob!); }}
                                >
                                    Delete Invoice
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
