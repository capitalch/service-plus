import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FileText, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES }    from "@/constants/messages";
import { SQL_MAP }     from "@/constants/sql-map";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient }   from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { PdfPreviewModal } from "@/components/shared/pdf-preview-modal";
import { JobAttachDialog } from "../single-job/job-attach-dialog";

import {
    deliverJobSchema, getDeliverJobDefaultValues,
    type DeliverJobFormValues, type JobInvoiceFullRow, type AddReceiptFormValues,
} from "./deliver-job-schema";
import { PAGE_SIZE, DEBOUNCE_MS, fmtCurrency } from "./deliver-job-helpers";
import { buildDeliverJobPdf }    from "./deliver-job-pdf";
import { DeliverableJobsGrid, type DeliverableJobRow } from "./deliverable-jobs-grid";
import { DeliveryInvoiceCard }   from "./delivery-invoice-card";
import { DeliveryReceiptsCard, type JobPayment } from "./delivery-receipts-card";
import { AddReceiptModal }       from "./add-receipt-modal";
import { DeliveryDetailsForm }   from "./delivery-details-form";

// ── Local types ───────────────────────────────────────────────────────────────

type SubView = "list" | "delivery";

type GenericQueryData<T> = { genericQuery: T[] | null };

type JobDeliveryDetail = {
    id:                  number;
    job_no:              string;
    alternate_job_no:    string | null;
    job_date:            string;
    problem_reported:    string | null;
    diagnosis:           string | null;
    work_done:           string | null;
    amount:              number | null;
    delivery_date:       string | null;
    is_closed:           boolean;
    last_transaction_id: number | null;
    customer_name:       string;
    mobile:              string;
    job_status_name:     string;
    technician_name:     string | null;
    invoice_id:          number | null;
    invoice_no:          string | null;
    invoice_date:        string | null;
    invoice_total:       number | null;
    payments:            JobPayment[];
};

type DeliveryMannerRow = { id: number; name: string };
type JobStatusRow      = { id: number; code: string; name: string };

// ── Component ─────────────────────────────────────────────────────────────────

export const DeliverJobSection = () => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const currentUser   = useAppSelector(selectCurrentUser);
    const branchId      = currentBranch?.id ?? null;

    // ── List state ────────────────────────────────────────────────────────────
    const [subView,  setSubView]  = useState<SubView>("list");
    const [search,   setSearch]   = useState("");
    const [searchQ,  setSearchQ]  = useState("");
    const [page,     setPage]     = useState(1);
    const [rows,     setRows]     = useState<DeliverableJobRow[]>([]);
    const [total,    setTotal]    = useState(0);
    const [loading,  setLoading]  = useState(false);

    // ── Meta ──────────────────────────────────────────────────────────────────
    const [deliveryManners,   setDeliveryManners]   = useState<DeliveryMannerRow[]>([]);
    const [deliveredStatusId, setDeliveredStatusId] = useState<number | null>(null);
    const [metaLoaded,        setMetaLoaded]        = useState(false);

    // ── Delivery view state ───────────────────────────────────────────────────
    const [detail,           setDetail]           = useState<JobDeliveryDetail | null>(null);
    const [invoice,          setInvoice]          = useState<JobInvoiceFullRow | null>(null);
    const [loadingDetail,    setLoadingDetail]    = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptDefaultAmt, setReceiptDefaultAmt] = useState(0);
    const [pdfUrl,           setPdfUrl]           = useState<string | null>(null);
    const [showPdf,          setShowPdf]          = useState(false);
    const [attachJobId,      setAttachJobId]      = useState<number | null>(null);
    const [attachJobNo,      setAttachJobNo]      = useState<string>("");

    const form = useForm<DeliverJobFormValues>({
        defaultValues: getDeliverJobDefaultValues(),
        mode:          "onChange",
        resolver:      zodResolver(deliverJobSchema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Load meta once ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!dbName || !schema || metaLoaded) return;
        Promise.all([
            apolloClient.query<GenericQueryData<DeliveryMannerRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DELIVERY_MANNERS }) },
            }),
            apolloClient.query<GenericQueryData<JobStatusRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_STATUSES }) },
            }),
        ]).then(([mannerRes, statusRes]) => {
            setDeliveryManners(mannerRes.data?.genericQuery ?? []);
            const delivered = (statusRes.data?.genericQuery ?? []).find(s => s.code === "DELIVERED");
            setDeliveredStatusId(delivered?.id ?? null);
            setMetaLoaded(true);
        }).catch(() => toast.error(MESSAGES.ERROR_JOB_DELIVERY_DETAIL_FAILED));
    }, [dbName, schema, metaLoaded]);

    // ── Load list ─────────────────────────────────────────────────────────────
    const loadData = useCallback(async (bid: number, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bid, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<DeliverableJobRow>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_DELIVERABLE_JOBS_PAGED,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERABLE_JOBS_COUNT, sqlArgs: commonArgs }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(Number(countRes.data?.genericQuery?.[0]?.total ?? 0));
        } catch {
            toast.error(MESSAGES.ERROR_DELIVERABLE_JOBS_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId || subView !== "list") return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadData(branchId, searchQ, page).catch(() => {});
    }, [branchId, searchQ, page, loadData, subView]);

    function handleSearchChange(value: string) {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    }

    // ── Open delivery view ────────────────────────────────────────────────────
    async function handleRowClick(row: DeliverableJobRow) {
        if (!dbName || !schema) return;
        setLoadingDetail(true);
        setInvoice(null);
        try {
            const [detailRes, invRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobDeliveryDetail>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DELIVERY_DETAIL, sqlArgs: { job_id: row.id } }),
                    },
                }),
                apolloClient.query<GenericQueryData<JobInvoiceFullRow>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_INVOICE_BY_JOB, sqlArgs: { job_id: row.id } }),
                    },
                }),
            ]);
            const d   = detailRes.data?.genericQuery?.[0] ?? null;
            const inv = invRes.data?.genericQuery?.[0]    ?? null;
            if (!d) { toast.error(MESSAGES.ERROR_JOB_DELIVERY_DETAIL_FAILED); return; }
            setDetail(d);
            setInvoice(inv);
            const alreadyPaid = (d.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
            const balance     = Math.max(0, Number(d.invoice_total ?? 0) - alreadyPaid);
            form.reset(getDeliverJobDefaultValues(balance > 0 ? balance : 0));
            setSubView("delivery");
        } catch {
            toast.error(MESSAGES.ERROR_JOB_DELIVERY_DETAIL_FAILED);
        } finally {
            setLoadingDetail(false);
        }
    }

    function handleBack() {
        setSubView("list");
        setDetail(null);
        setInvoice(null);
        if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }
    }

    // ── Refresh payments only ─────────────────────────────────────────────────
    async function refreshPayments() {
        if (!detail || !dbName || !schema) return;
        try {
            const res = await apolloClient.query<GenericQueryData<JobPayment>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_JOB_PAYMENTS_BY_JOB,
                        sqlArgs: { job_id: detail.id },
                    }),
                },
            });
            const payments = res.data?.genericQuery ?? [];
            setDetail(prev => prev ? { ...prev, payments } : prev);
        } catch { /* silent — stale list is acceptable */ }
    }

    // ── Add receipt ───────────────────────────────────────────────────────────
    async function handleAddReceipt(values: AddReceiptFormValues) {
        if (!detail || !dbName || !schema) return;
        await apolloClient.mutate({
            mutation:  GRAPHQL_MAP.genericUpdate,
            variables: {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericUpdateValue({
                    tableName: "job_payment",
                    xData: {
                        job_id:       detail.id,
                        payment_date: values.payment_date,
                        payment_mode: values.payment_mode,
                        amount:       Number(values.amount),
                        reference_no: values.reference_no || null,
                        remarks:      values.remarks      || null,
                    },
                }),
            },
        });
        toast.success(MESSAGES.SUCCESS_RECEIPT_CREATED);
        setShowReceiptModal(false);
        await refreshPayments();
    }

    // ── PDF ───────────────────────────────────────────────────────────────────
    function handleOpenPdf() {
        if (!detail) return;
        const doc = buildDeliverJobPdf(detail, invoice);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(URL.createObjectURL(doc.output("blob")));
        setShowPdf(true);
    }

    // ── Deliver & Close ───────────────────────────────────────────────────────
    async function executeSave(values: DeliverJobFormValues) {
        if (!detail || !dbName || !schema || !deliveredStatusId) return;
        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.deliverJob,
                variables: {
                    db_name: dbName, schema,
                    value: encodeObj({
                        job_id:               detail.id,
                        last_transaction_id:  detail.last_transaction_id,
                        performed_by_user_id: currentUser?.id ?? null,
                        delivered_status_id:  deliveredStatusId,
                        delivery_date:        values.delivery_date,
                        delivery_manner_name: values.delivery_manner,
                        remarks:              values.remarks,
                        payment: {
                            payment_date: values.payment_date,
                            payment_mode: values.payment_mode,
                            amount:       values.payment_amount,
                            reference_no: values.payment_reference,
                            remarks:      values.payment_remarks,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_JOB_DELIVERED);
            handleBack();
            if (branchId) void loadData(branchId, searchQ, page);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_DELIVER_FAILED);
        }
    }

    // ── Derived values for delivery view ──────────────────────────────────────
    const alreadyPaid = detail ? (detail.payments ?? []).reduce((s, p) => s + Number(p.amount), 0) : 0;
    const balance     = Math.max(0, Number(detail?.invoice_total ?? 0) - alreadyPaid);
    const canDeliver  = form.formState.isValid && !form.formState.isSubmitting && !!deliveredStatusId;

    // ── Delivery view ─────────────────────────────────────────────────────────
    if (subView === "delivery" && detail) {
        return (
            <motion.div
                animate={{ opacity: 1 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                {/* Header bar */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-2 shrink-0">
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs"
                        disabled={form.formState.isSubmitting}
                        variant="ghost"
                        onClick={handleBack}
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to List
                    </Button>
                    <div className="flex items-baseline gap-2">
                        <span className="font-mono font-bold text-(--cl-accent) text-sm">#{detail.job_no}</span>
                        <span className="text-sm font-medium text-(--cl-text)">{detail.customer_name}</span>
                    </div>
                    <div className="flex-1" />
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs"
                        variant="outline"
                        onClick={handleOpenPdf}
                    >
                        <FileText className="h-3.5 w-3.5" />
                        PDF
                    </Button>
                    <Button
                        className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed"
                        disabled={!canDeliver}
                        onClick={() => void form.handleSubmit(executeSave)()}
                    >
                        {form.formState.isSubmitting
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Truck className="h-3.5 w-3.5" />
                        }
                        Deliver &amp; Close Job
                    </Button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                    {/* 1. Job Summary */}
                    <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-(--cl-text-muted)">Job Summary</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                            {([
                                ["Job No",     detail.alternate_job_no ? `${detail.job_no} · Alt: ${detail.alternate_job_no}` : detail.job_no],
                                ["Job Date",   detail.job_date],
                                ["Customer",   detail.customer_name],
                                ["Mobile",     detail.mobile],
                                ["Technician", detail.technician_name ?? "—"],
                                ["Status",     detail.job_status_name],
                                ["Amount",     fmtCurrency(detail.amount)],
                            ] as [string, string][]).map(([lbl, val]) => (
                                <div key={lbl}>
                                    <p className="text-[10px] uppercase tracking-wider text-(--cl-text-muted)">{lbl}</p>
                                    <p className="text-sm font-medium text-(--cl-text)">{val}</p>
                                </div>
                            ))}
                        </div>
                        {(detail.problem_reported || detail.diagnosis || detail.work_done) && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                {detail.problem_reported && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-(--cl-text-muted)">Problem Reported</p>
                                        <p className="mt-0.5 text-sm text-(--cl-text)">{detail.problem_reported}</p>
                                    </div>
                                )}
                                {detail.diagnosis && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-(--cl-text-muted)">Diagnosis</p>
                                        <p className="mt-0.5 text-sm text-(--cl-text)">{detail.diagnosis}</p>
                                    </div>
                                )}
                                {detail.work_done && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-(--cl-text-muted)">Work Done</p>
                                        <p className="mt-0.5 text-sm text-(--cl-text)">{detail.work_done}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. Invoice card (read-only, full line items) */}
                    <DeliveryInvoiceCard invoice={invoice} />

                    {/* 3. Receipts card */}
                    <DeliveryReceiptsCard
                        payments={detail.payments ?? []}
                        invoiceTotal={detail.invoice_total}
                        onAddReceipt={() => {
                            setReceiptDefaultAmt(Math.max(0, balance));
                            setShowReceiptModal(true);
                        }}
                    />

                    {/* 4. Delivery details + optional payment */}
                    <DeliveryDetailsForm
                        form={form}
                        deliveryManners={deliveryManners}
                        balance={balance}
                    />
                </div>

                {/* Add Receipt modal */}
                <AddReceiptModal
                    open={showReceiptModal}
                    defaultAmount={receiptDefaultAmt}
                    onClose={() => setShowReceiptModal(false)}
                    onSave={handleAddReceipt}
                />

                {/* PDF preview modal */}
                <PdfPreviewModal
                    isOpen={showPdf}
                    onClose={() => setShowPdf(false)}
                    pdfUrl={pdfUrl}
                    title={`Delivery Note — ${detail.job_no}`}
                    filename={`delivery-${detail.job_no}.pdf`}
                />
            </motion.div>
        );
    }

    // ── List view ─────────────────────────────────────────────────────────────
    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-1">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                        <Truck className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-bold text-(--cl-text)">Deliver Job</h1>
                        <span className="text-xs text-(--cl-text-muted)">
                            {loading ? "Loading…" : `(${total})`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Grid (toolbar + table + pagination) */}
            <DeliverableJobsGrid
                rows={rows}
                loading={loading}
                total={total}
                page={page}
                search={search}
                branchId={branchId}
                loadingDetail={loadingDetail}
                setPage={setPage}
                onSearch={handleSearchChange}
                onRefresh={() => { if (branchId) void loadData(branchId, searchQ, page); }}
                onDeliver={handleRowClick}
                onOpenAttach={(id, jobNo) => { setAttachJobId(id); setAttachJobNo(jobNo); }}
            />

            {attachJobId !== null && (
                <JobAttachDialog
                    jobId={attachJobId}
                    jobNo={attachJobNo}
                    onClose={() => { setAttachJobId(null); setAttachJobNo(""); }}
                    onFilesChanged={count => {
                        setRows(prev => prev.map(r => r.id === attachJobId ? { ...r, file_count: count } : r));
                    }}
                />
            )}
        </motion.div>
    );
};
