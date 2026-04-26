import { useCallback, useEffect, useRef, useState } from "react";
import {ArrowLeft,
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Loader2, RefreshCw, Search, Truck, X} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { currentFinancialYearRange } from "@/lib/utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

// ─── Local types ──────────────────────────────────────────────────────────────

type SubView = "list" | "delivery";
type GenericQueryData<T> = { genericQuery: T[] | null };

type DeliverableJobRow = {
    id:              number;
    job_no:          string;
    job_date:        string;
    amount:          number | null;
    last_transaction_id: number | null;
    customer_name:   string;
    mobile:          string;
    job_status_name: string;
    technician_name: string | null;
    invoice_total:   number | null;
    invoice_no:      string | null;
};

type JobPayment = {
    id:           number;
    payment_date: string;
    payment_mode: string;
    amount:       number;
    reference_no: string | null;
    remarks:      string | null;
};

type JobDeliveryDetail = {
    id:                 number;
    job_no:             string;
    job_date:           string;
    problem_reported:   string | null;
    diagnosis:          string | null;
    work_done:          string | null;
    amount:             number | null;
    delivery_date:      string | null;
    is_closed:          boolean;
    last_transaction_id: number | null;
    customer_name:      string;
    mobile:             string;
    job_status_name:    string;
    technician_name:    string | null;
    invoice_id:         number | null;
    invoice_no:         string | null;
    invoice_date:       string | null;
    invoice_total:      number | null;
    payments:           JobPayment[];
};

type DeliveryMannerRow = {
    id:   number;
    name: string;
};

type JobStatusRow = {
    id:   number;
    code: string;
    name: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1200;

const PAYMENT_MODES = ["Cash", "Card", "UPI", "Cheque", "Online Transfer", "Other"];

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function fmtCurrency(n: number | null | undefined): string {
    if (n == null) return "—";
    return `₹${Number(n).toFixed(2)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DeliverJobSection = () => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const currentUser   = useAppSelector(selectCurrentUser);
    const branchId      = currentBranch?.id ?? null;

    const { from: defaultFrom, to: defaultTo } = currentFinancialYearRange();

    // ── List state ──────────────────────────────────────────────────────────
    const [subView,  setSubView]  = useState<SubView>("list");
    const [fromDate, setFromDate] = useState(defaultFrom);
    const [toDate,   setToDate]   = useState(defaultTo);
    const [search,   setSearch]   = useState("");
    const [searchQ,  setSearchQ]  = useState("");
    const [page,     setPage]     = useState(1);
    const [rows,     setRows]     = useState<DeliverableJobRow[]>([]);
    const [total,    setTotal]    = useState(0);
    const [loading,  setLoading]  = useState(false);

    // ── Meta ────────────────────────────────────────────────────────────────
    const [deliveryManners,   setDeliveryManners]   = useState<DeliveryMannerRow[]>([]);
    const [deliveredStatusId, setDeliveredStatusId] = useState<number | null>(null);
    const [metaLoaded,        setMetaLoaded]        = useState(false);

    // ── Delivery view state ─────────────────────────────────────────────────
    const [detail,         setDetail]         = useState<JobDeliveryDetail | null>(null);
    const [loadingDetail,  setLoadingDetail]  = useState(false);
    const [submitting,     setSubmitting]     = useState(false);

    // Delivery form fields
    const [deliveryDate,        setDeliveryDate]        = useState(today());
    const [deliveryMannerName,  setDeliveryMannerName]  = useState("");
    const [transactionNotes,    setTransactionNotes]    = useState("");
    const [paymentDate,         setPaymentDate]         = useState(today());
    const [paymentMode,         setPaymentMode]         = useState("Cash");
    const [paymentAmount,       setPaymentAmount]       = useState("0");
    const [paymentReferenceNo,  setPaymentReferenceNo]  = useState("");
    const [paymentRemarks,      setPaymentRemarks]      = useState("");

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollRef   = useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = useState(0);

    const recalc = useCallback(() => {
        if (scrollRef.current) {
            const rect = scrollRef.current.getBoundingClientRect();
            setMaxHeight(Math.max(200, window.innerHeight - rect.top - 80));
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(recalc, 100);
        window.addEventListener("resize", recalc);
        return () => { clearTimeout(timer); window.removeEventListener("resize", recalc); };
    }, [recalc, rows.length, subView]);

    // ── Load meta once ──────────────────────────────────────────────────────
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

    // ── Load list ───────────────────────────────────────────────────────────
    const loadData = useCallback(async (bid: number, from: string, to: string, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bid, from_date: from, to_date: to, search: q };
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
        void loadData(branchId, fromDate, toDate, searchQ, page);
    }, [branchId, fromDate, toDate, searchQ, page, loadData, subView]);

    function handleSearchChange(value: string) {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    }

    // ── Open delivery view for a row ────────────────────────────────────────
    async function handleRowClick(row: DeliverableJobRow) {
        if (!dbName || !schema) return;
        setLoadingDetail(true);
        try {
            const res = await apolloClient.query<GenericQueryData<JobDeliveryDetail>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DELIVERY_DETAIL, sqlArgs: { job_id: row.id } }),
                },
            });
            const d = res.data?.genericQuery?.[0] ?? null;
            if (!d) { toast.error(MESSAGES.ERROR_JOB_DELIVERY_DETAIL_FAILED); return; }

            setDetail(d);

            // Pre-fill payment amount = invoice_total − already paid
            const alreadyPaid = (d.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
            const balance     = Math.max(0, Number(d.invoice_total ?? 0) - alreadyPaid);
            setPaymentAmount(balance > 0 ? balance.toFixed(2) : "0");
            setDeliveryDate(today());
            setDeliveryMannerName("");
            setTransactionNotes("");
            setPaymentDate(today());
            setPaymentMode("Cash");
            setPaymentReferenceNo("");
            setPaymentRemarks("");

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
    }

    // ── Deliver & Close ─────────────────────────────────────────────────────
    async function handleDeliver() {
        if (!detail || !dbName || !schema || !deliveredStatusId) return;

        setSubmitting(true);
        try {
            const amount = parseFloat(paymentAmount) || 0;
            const payload: Record<string, unknown> = {
                job_id:               detail.id,
                last_transaction_id:  detail.last_transaction_id,
                performed_by_user_id: currentUser?.id ?? null,
                delivered_status_id:  deliveredStatusId,
                delivery_date:        deliveryDate,
                delivery_manner_name: deliveryMannerName,
                transaction_notes:    transactionNotes,
                payment: {
                    payment_date: paymentDate,
                    payment_mode: paymentMode,
                    amount,
                    reference_no: paymentReferenceNo,
                    remarks:      paymentRemarks,
                },
            };

            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.deliverJob,
                variables: { db_name: dbName, schema, value: encodeObj(payload) },
            });

            toast.success(MESSAGES.SUCCESS_JOB_DELIVERED);
            handleBack();
            if (branchId) void loadData(branchId, fromDate, toDate, searchQ, page);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_DELIVER_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ─── Delivery View ────────────────────────────────────────────────────────

    if (subView === "delivery" && detail) {
        const alreadyPaid  = (detail.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
        const balance      = Math.max(0, Number(detail.invoice_total ?? 0) - alreadyPaid);
        const payAmt       = parseFloat(paymentAmount) || 0;
        const needsPayment = balance > 0 && payAmt === 0;
        const canDeliver   = !!deliveryDate && !needsPayment && !submitting && !!deliveredStatusId;

        return (
            <motion.div
                animate={{ opacity: 1 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                {/* Header */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-2">
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs"
                        disabled={submitting}
                        variant="ghost"
                        onClick={handleBack}
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to List
                    </Button>
                    <div className="flex items-baseline gap-2">
                        <span className="font-mono font-bold text-[var(--cl-accent)] text-sm">#{detail.job_no}</span>
                        <span className="text-sm font-medium text-[var(--cl-text)]">{detail.customer_name}</span>
                    </div>
                    <div className="flex-1" />
                    <Button
                        className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed"
                        disabled={!canDeliver}
                        onClick={() => void handleDeliver()}
                    >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                        Deliver &amp; Close Job
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {/* Job summary */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--cl-text-muted)]">Job Summary</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                            {([
                                ["Job No",      detail.job_no],
                                ["Job Date",    detail.job_date],
                                ["Customer",    detail.customer_name],
                                ["Mobile",      detail.mobile],
                                ["Technician",  detail.technician_name ?? "—"],
                                ["Status",      detail.job_status_name],
                                ["Amount",      fmtCurrency(detail.amount)],
                            ] as [string, string][]).map(([lbl, val]) => (
                                <div key={lbl}>
                                    <p className="text-[10px] uppercase tracking-wider text-[var(--cl-text-muted)]">{lbl}</p>
                                    <p className="text-sm font-medium text-[var(--cl-text)]">{val}</p>
                                </div>
                            ))}
                        </div>
                        {(detail.problem_reported || detail.diagnosis || detail.work_done) && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                {detail.problem_reported && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--cl-text-muted)]">Problem Reported</p>
                                        <p className="mt-0.5 text-sm text-[var(--cl-text)]">{detail.problem_reported}</p>
                                    </div>
                                )}
                                {detail.diagnosis && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--cl-text-muted)]">Diagnosis</p>
                                        <p className="mt-0.5 text-sm text-[var(--cl-text)]">{detail.diagnosis}</p>
                                    </div>
                                )}
                                {detail.work_done && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--cl-text-muted)]">Work Done</p>
                                        <p className="mt-0.5 text-sm text-[var(--cl-text)]">{detail.work_done}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Invoice summary */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--cl-text-muted)]">Invoice Summary</p>
                        {detail.invoice_id ? (
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                                {([
                                    ["Invoice No",    detail.invoice_no ?? "—"],
                                    ["Invoice Date",  detail.invoice_date?.slice(0, 10) ?? "—"],
                                    ["Invoice Total", fmtCurrency(detail.invoice_total)],
                                    ["Already Paid",  fmtCurrency(alreadyPaid)],
                                    ["Balance Due",   fmtCurrency(balance)],
                                ] as [string, string][]).map(([lbl, val]) => (
                                    <div key={lbl}>
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--cl-text-muted)]">{lbl}</p>
                                        <p className="text-sm font-medium text-[var(--cl-text)]">{val}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                                No invoice found — create one in Ready for Delivery first.
                            </p>
                        )}
                    </div>

                    {/* Existing payments */}
                    {(detail.payments ?? []).length > 0 && (
                        <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-4">
                            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--cl-text-muted)]">Existing Payments</p>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            {["#", "Date", "Mode", "Amount", "Ref No", "Remarks"].map(h => (
                                                <th key={h} className={thClass}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detail.payments.map((p, i) => (
                                            <tr key={p.id}>
                                                <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{i + 1}</td>
                                                <td className={tdClass}>{p.payment_date}</td>
                                                <td className={tdClass}>{p.payment_mode}</td>
                                                <td className={`${tdClass} tabular-nums font-medium`}>{fmtCurrency(p.amount)}</td>
                                                <td className={`${tdClass} font-mono text-xs`}>{p.reference_no ?? "—"}</td>
                                                <td className={tdClass}>{p.remarks ?? "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Delivery details */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--cl-text-muted)]">Delivery Details</p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div>
                                <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="dj-delivery-date">
                                    Delivery Date <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                                    id="dj-delivery-date"
                                    type="date"
                                    value={deliveryDate}
                                    onChange={e => setDeliveryDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]">Delivery Manner</Label>
                                <Select value={deliveryMannerName} onValueChange={setDeliveryMannerName}>
                                    <SelectTrigger className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm">
                                        <SelectValue placeholder="Select manner" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {deliveryManners.map(m => (
                                            <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="sm:col-span-1">
                                <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="dj-txn-notes">
                                    Transaction Notes
                                </Label>
                                <Textarea
                                    className="h-9 min-h-[36px] border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm resize-none"
                                    id="dj-txn-notes"
                                    placeholder="Optional notes…"
                                    rows={1}
                                    value={transactionNotes}
                                    onChange={e => setTransactionNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Payment */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-4">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--cl-text-muted)]">Payment</p>
                        <p className="mb-3 text-xs text-[var(--cl-text-muted)]">Leave amount = 0 to skip inserting a payment record.</p>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                            <div>
                                <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="dj-pay-date">
                                    Payment Date
                                </Label>
                                <Input
                                    className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                                    id="dj-pay-date"
                                    type="date"
                                    value={paymentDate}
                                    onChange={e => setPaymentDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]">Payment Mode</Label>
                                <Select value={paymentMode} onValueChange={setPaymentMode}>
                                    <SelectTrigger className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAYMENT_MODES.map(m => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="dj-pay-amount">
                                    Amount
                                </Label>
                                <Input
                                    className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm text-right tabular-nums"
                                    id="dj-pay-amount"
                                    min="0"
                                    step="0.01"
                                    type="number"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="dj-ref-no">
                                    Reference No
                                </Label>
                                <Input
                                    className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                                    id="dj-ref-no"
                                    placeholder="Optional"
                                    value={paymentReferenceNo}
                                    onChange={e => setPaymentReferenceNo(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="dj-remarks">
                                    Remarks
                                </Label>
                                <Input
                                    className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                                    id="dj-remarks"
                                    placeholder="Optional"
                                    value={paymentRemarks}
                                    onChange={e => setPaymentRemarks(e.target.value)}
                                />
                            </div>
                        </div>
                        {needsPayment && (
                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                Balance of {fmtCurrency(balance)} is due — enter an amount or set to 0 to skip.
                            </p>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    }

    // ─── List View ────────────────────────────────────────────────────────────

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-1">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <Truck className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-bold text-[var(--cl-text)]">Deliver Job</h1>
                        <span className="text-xs text-[var(--cl-text-muted)]">
                            {loading ? "Loading…" : `(${total})`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-1 bg-[var(--cl-surface-2)]/30">
                <div className="flex items-center gap-1">
                    <Input
                        className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                        disabled={loading}
                        type="date"
                        value={fromDate}
                        onChange={e => { setFromDate(e.target.value); setPage(1); }}
                    />
                    <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                    <Input
                        className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                        disabled={loading}
                        type="date"
                        value={toDate}
                        onChange={e => { setToDate(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                    <Input
                        className="h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-8 text-xs"
                        disabled={loading}
                        placeholder="Job no, customer or mobile…"
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                    />
                            {search && (
                                <button
                                    className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--cl-text-muted)] text-[var(--cl-surface)] hover:bg-[var(--cl-text)] focus:outline-none"
                                    type="button"
                                    onClick={() => handleSearchChange("")}
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            )}
                </div>
                <Button
                    className="h-8 px-2.5 text-xs"
                    disabled={loading || !branchId}
                    size="sm"
                    variant="outline"
                    onClick={() => { if (branchId) void loadData(branchId, fromDate, toDate, searchQ, page); }}
                >
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                </Button>
            </div>

            {/* Grid */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm mx-4">
                <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: maxHeight || undefined }}>
                    {loading ? (
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr>
                                    {["#", "Date", "Job No", "Customer", "Mobile", "Status", "Technician", "Invoice", "Invoice Total", "Action"].map(h => (
                                        <th key={h} className={thClass}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 10 }).map((__, j) => (
                                            <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-[var(--cl-border)]" /></td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                            No jobs ready for delivery for the selected filters.
                        </div>
                    ) : (
                        <table className="min-w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <th className={thClass}>#</th>
                                    <th className={thClass}>Date</th>
                                    <th className={thClass}>Job No</th>
                                    <th className={thClass}>Customer</th>
                                    <th className={thClass}>Mobile</th>
                                    <th className={thClass}>Status</th>
                                    <th className={thClass}>Technician</th>
                                    <th className={thClass}>Invoice</th>
                                    <th className={`${thClass} text-right`}>Invoice Total</th>
                                    <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                {rows.map((row, idx) => (
                                    <motion.tr
                                        key={row.id}
                                        animate={{ opacity: 1 }}
                                        className="group transition-colors hover:bg-[var(--cl-accent)]/5"
                                        initial={{ opacity: 0 }}
                                        transition={{ delay: idx * 0.015, duration: 0.15 }}
                                    >
                                        <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                        <td className={tdClass}>{row.job_date}</td>
                                        <td className={`${tdClass} font-mono font-semibold text-[var(--cl-accent)]`}>#{row.job_no}</td>
                                        <td className={tdClass}>{row.customer_name}</td>
                                        <td className={`${tdClass} font-mono text-xs`}>{row.mobile}</td>
                                        <td className={tdClass}>
                                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                                                {row.job_status_name}
                                            </span>
                                        </td>
                                        <td className={tdClass}>{row.technician_name ?? "—"}</td>
                                        <td className={`${tdClass} font-mono text-xs`}>{row.invoice_no ?? "—"}</td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(row.invoice_total)}</td>
                                        <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`}>
                                            <Button
                                                className="h-7 px-2 text-xs text-[var(--cl-text-muted)] hover:text-[var(--cl-accent)]"
                                                disabled={loadingDetail}
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => void handleRowClick(row)}
                                            >
                                                {loadingDetail
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : "Deliver"
                                                }
                                            </Button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2">
                    <span className="text-xs text-[var(--cl-text-muted)]">
                        Page {page} of {totalPages} · {total} records
                    </span>
                    <div className="flex items-center gap-1">
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="First"    variant="ghost" onClick={() => setPage(1)}><ChevronsLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="Previous" variant="ghost" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Next" variant="ghost" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Last" variant="ghost" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
