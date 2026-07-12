import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName, selectCurrentUser } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { isValidGstin, normalizeGstin, saveCustomerGstin } from "@/lib/gstin";
import { selectAvailableDivisions, selectCurrentBranch, selectCurrentDivision, selectDefaultGstRate, selectDefaultHsnForSparePart, selectDefaultHsnForServiceCharge, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobDetailType } from "@/features/client/types/job";
import { isGstDivision } from "@/features/client/types/division";
import type { BrandOption } from "@/features/client/types/model";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import { type PartRow } from "../../inventory/part-code-input";
import { JobDetailsModal } from "../job-pipeline/job-details-modal";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
    type FinalJobRow,
    type FinalizedJobRow,
    type EditablePartLine,
    type EditableChargeLine,
    type AdditionalChargeMasterRow,
    emptyChargeLine,
} from "./final-a-job-schema";
import { PAGE_SIZE, DEBOUNCE_MS } from "./final-a-job-helpers";
import { FinalJobForm } from "./final-job-form";
import { PendingJobsGrid } from "./pending-jobs-grid";
import { FinalizedJobsGrid } from "./finalized-jobs-grid";
import type { GridRetentionHandle } from "../use-grid-row-retention";
import { JobChargesReadonlyModal, type ChargesViewPartLine, type ChargesViewChargeLine } from "./job-charges-readonly-modal";
import { DeliveryModal } from "../deliver-job/delivery-modal";
import { JobPdfModal } from "../job-control/job-pdf-modal";
import { JobProformaInvoiceModal } from "../job-control/job-proforma-invoice-modal";
import type { JobDeliveryFullDetail } from "../deliver-job/deliver-job-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubView = "list" | "final";
type GenericQueryData<T> = { genericQuery: T[] | null };

type LoadedPartRow = {
    id: number;
    part_id: number;
    brand_id: number | null;
    part_code: string;
    part_name: string;
    uom: string;
    qty: number;
    cost_price: number | null;
    selling_price: number | null;
    gst_rate: number | null;
    remarks: string | null;
    hsn_code: string | null;
    master_cost_price:    number | null;
    master_selling_price: number | null;
    master_gst_rate:      number | null;
};

type AdditionalChargeRow = {
    id: number;
    charge_name: string;
    ref_no: string | null;
    description: string | null;
    hsn_code: string | null;
    gst_rate: number;
    qty: number;
    cost_price: number;
    selling_price: number;
};


function emptyPartLine(gstRate = 0, hsn = ""): EditablePartLine {
    return { _key: crypto.randomUUID(), brand_id: null, part_id: null, part_code: "", part_name: "", cost_price: "0", selling_price: "0", sale_pr_gst: "0", gst_rate: String(gstRate), qty: 1, remarks: "", hsn_code: hsn, master_cost_price: 0, master_selling_price: 0, master_gst_rate: 0 };
}

// ─── Pricing helpers ──────────────────────────────────────────────────────────

function applyMarkup(cost: number, markupPct: number): number {
    return Math.round(cost * (1 + markupPct / 100) * 100) / 100;
}

function computePartPricesOnSelect(
    part: PartRow,
    isGst: boolean,
    inflateCostForNonGst: boolean, // true in Final-a-Job for non-GST: absorb supplier GST into cost
    defaultGstRate: number,
    markupPct: number,
    currentCostPrice = 0,    // customcp — existing line cost before selection
    currentSellingPrice = 0, // customsp — existing line selling price before selection
): Pick<EditablePartLine, "cost_price" | "selling_price" | "sale_pr_gst" | "gst_rate"> {
    const dbcp = part.cost_price ?? 0;
    const effectiveGstRate = (part.gst_rate ?? 0) > 0 ? (part.gst_rate ?? 0) : defaultGstRate;

    let cp: number;
    if (!isGst && inflateCostForNonGst) {
        // inflate only when master has a price; otherwise keep customcp un-inflated
        cp = dbcp > 0 ? dbcp * (1 + effectiveGstRate / 100) : currentCostPrice;
    } else {
        cp = dbcp > 0 ? dbcp : currentCostPrice;
    }

    // sp = customsp or cp*(1+markup/100)  [first non-zero]
    const sp = currentSellingPrice > 0 ? currentSellingPrice : applyMarkup(cp, markupPct);

    return {
        cost_price:    cp.toFixed(2),
        selling_price: sp.toFixed(2),
        gst_rate:      String(effectiveGstRate),                          // always store master rate
        sale_pr_gst:   (isGst ? sp * (1 + effectiveGstRate / 100) : sp).toFixed(2), // GST only when isGst
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FinalAJobSectionProps {
    onBack?: () => void;
    initialTab?: "pending" | "finalized";
}

export const FinalAJobSection = ({ onBack, initialTab }: FinalAJobSectionProps = {}) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const availableDivisions = useAppSelector(selectAvailableDivisions);
    const currentDivision = useAppSelector(selectCurrentDivision);
    const defaultGstRate = useAppSelector(selectDefaultGstRate);
    const defaultHsnForSparePart = useAppSelector(selectDefaultHsnForSparePart);
    const defaultHsnForServiceCharge = useAppSelector(selectDefaultHsnForServiceCharge);
    const branchId = currentBranch?.id ?? null;
    const currentUser = useAppSelector(selectCurrentUser);

    // ── List state ──────────────────────────────────────────────────────────
    const [subView, setSubView] = useState<SubView>("list");
    const [activeTab, setActiveTab] = useState<"pending" | "finalized">(initialTab ?? "pending");
    const [search, setSearch] = useState("");
    const [searchQ, setSearchQ] = useState("");
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<FinalJobRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const [viewJobId, setViewJobId] = useState<number | null>(null);
    const [attachJobId, setAttachJobId] = useState<number | null>(null);
    const [attachJobNo, setAttachJobNo] = useState<string>("");
    const [attachSource, setAttachSource] = useState<"pending" | "finalized">("pending");

    // ── Finalized Jobs tab state ────────────────────────────────────────────
    const [finalizedRows, setFinalizedRows] = useState<FinalizedJobRow[]>([]);
    const [finalizedTotal, setFinalizedTotal] = useState(0);
    const [finalizedPage, setFinalizedPage] = useState(1);
    const [finalizedSearch, setFinalizedSearch] = useState("");
    const [finalizedSearchQ, setFinalizedSearchQ] = useState("");
    const [finalizedLoading, setFinalizedLoading] = useState(false);

    // ── Final sub-view state ────────────────────────────────────────────────
    const [selectedJob, setSelectedJob] = useState<JobDetailType | null>(null);
    const [selectedRow, setSelectedRow] = useState<FinalJobRow | null>(null);
    const [receivedTotal, setReceivedTotal] = useState(0);
    const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
    const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Unified editable parts
    const [partLines, setPartLines] = useState<EditablePartLine[]>([]);
    const [deletedPartIds, setDeletedPartIds] = useState<number[]>([]);

    // Additional charges (full CRUD)
    const [chargeLines, setChargeLines] = useState<EditableChargeLine[]>([]);
    const [deletedChargeIds, setDeletedChargeIds] = useState<number[]>([]);

    // Meta
    const [brands, setBrands] = useState<BrandOption[]>([]);
    const [additionalChargeOptions, setAdditionalChargeOptions] = useState<AdditionalChargeMasterRow[]>([]);
    const [jobConsumeTypeId, setJobConsumeTypeId] = useState<number | null>(null);
    const [markupPct, setMarkupPct] = useState(0);
    const [forceIgst, setForceIgst] = useState(false);
    const [backCalcTarget, setBackCalcTarget] = useState("");
    const [showPartsInInvoice, setShowPartsInInvoice] = useState(true);
    const [gstin, setGstin] = useState("");
    const [diffAlertMsg, setDiffAlertMsg] = useState<string | null>(null);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const finalizedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingGridRef = useRef<GridRetentionHandle>(null);
    const finalizedGridRef = useRef<GridRetentionHandle>(null);
    // Derived: effective division and GST flag for the currently-open job
    const division = availableDivisions.find(d => d.id === selectedDivisionId) ?? null;
    const isGst = isGstDivision(division);

    // ── Load brands + JOB_CONSUME type once ─────────────────────────────────
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchMeta = async () => {
            try {
                const [brandsRes, txnRes, markupRes, additionalChargesRes, showPartsSettingRes] = await Promise.all([
                    apolloClient.query<GenericQueryData<BrandOption>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }) },
                    }),
                    apolloClient.query<GenericQueryData<StockTransactionTypeRow>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STOCK_TRANSACTION_TYPES }) },
                    }),
                    apolloClient.query<GenericQueryData<{ setting_value: unknown }>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_APP_SETTING_BY_KEY, sqlArgs: { setting_key: "markup_percent_over_cost" } }) },
                    }),
                    apolloClient.query<GenericQueryData<AdditionalChargeMasterRow>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_ADDITIONAL_CHARGES }) },
                    }),
                    apolloClient.query<GenericQueryData<{ setting_value: unknown }>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_APP_SETTING_BY_KEY, sqlArgs: { setting_key: "show_parts_in_job_invoice" } }) },
                    }),
                ]);
                setBrands(brandsRes.data?.genericQuery ?? []);
                const consume = txnRes.data?.genericQuery?.find(t => t.code === "CONSUMPTION");
                setJobConsumeTypeId(consume?.id ?? null);
                const rawMarkup = markupRes.data?.genericQuery?.[0]?.setting_value;
                const pct = rawMarkup != null ? Number(rawMarkup) : 0;
                setMarkupPct(isNaN(pct) ? 0 : pct);
                setAdditionalChargeOptions(additionalChargesRes.data?.genericQuery ?? []);
                const rawShowParts = showPartsSettingRes.data?.genericQuery?.[0]?.setting_value;
                const showPartsObj = rawShowParts != null && typeof rawShowParts === "object"
                    ? (rawShowParts as { show?: boolean })
                    : null;
                setShowPartsInInvoice(showPartsObj?.show !== false);
                if (rawShowParts != null && typeof rawShowParts === "object")
                    setDeliveryPartsInvoiceSetting(rawShowParts as { show: boolean; text: string; hsn: number; gst_rate: number });
            } catch { /* silent */ }
        };
        void fetchMeta();
        apolloClient.query<GenericQueryData<DeliveryMannerRow>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DELIVERY_MANNERS }) },
        }).then(res => setDeliveryManners(res.data?.genericQuery ?? [])).catch(() => {});
    }, [dbName, schema]);

    // ── Load list ───────────────────────────────────────────────────────────
    const loadData = useCallback(async (bid: number, q: string, pg: number, divisionId: number | null = null) => {
        if (!dbName || !schema) return;
        setLoading(true);
        const commonArgs = { branch_id: bid, division_id: divisionId, search: q };

        const rowsPromise = apolloClient.query({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId: SQL_MAP.GET_COMPLETED_JOBS_PAGED,
                    sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                }),
            },
        }).then(res => setRows((res.data as GenericQueryData<FinalJobRow>).genericQuery ?? []));

        const countPromise = apolloClient.query({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_COMPLETED_JOBS_COUNT, sqlArgs: commonArgs }),
            },
        }).then(res => setTotal(Number((res.data as GenericQueryData<{ total: number }>).genericQuery?.[0]?.total ?? 0)));

        const results = await Promise.allSettled([rowsPromise, countPromise]);
        if (results.some(r => r.status === "rejected")) toast.error(MESSAGES.ERROR_FINAL_JOBS_LOAD_FAILED);
        setLoading(false);
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId || subView !== "list") return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadData(branchId, searchQ, page, currentDivision?.id ?? null);
    }, [branchId, searchQ, page, loadData, subView, currentDivision]);

    function handleSearchChange(value: string) {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    }

    function handleFinalizedSearchChange(value: string) {
        setFinalizedSearch(value);
        if (finalizedDebounceRef.current) clearTimeout(finalizedDebounceRef.current);
        finalizedDebounceRef.current = setTimeout(() => { setFinalizedPage(1); setFinalizedSearchQ(value); }, DEBOUNCE_MS);
    }

    const loadFinalizedData = useCallback(async () => {
        if (!branchId || !dbName || !schema) return;
        setFinalizedLoading(true);
        const args = {
            branch_id: branchId,
            search: finalizedSearchQ,
            limit: PAGE_SIZE,
            offset: (finalizedPage - 1) * PAGE_SIZE,
        };

        const countPromise = apolloClient.query({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERABLE_JOBS_COUNT, sqlArgs: args }) },
        }).then(res => setFinalizedTotal(Number((res.data as GenericQueryData<{ total: number }>).genericQuery?.[0]?.total ?? 0)));

        const rowsPromise = apolloClient.query({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERABLE_JOBS_PAGED, sqlArgs: args }) },
        }).then(res => setFinalizedRows((res.data as GenericQueryData<FinalizedJobRow>).genericQuery ?? []));

        const results = await Promise.allSettled([countPromise, rowsPromise]);
        if (results.some(r => r.status === "rejected")) toast.error("Failed to load finalized jobs.");
        setFinalizedLoading(false);
    }, [branchId, dbName, schema, finalizedSearchQ, finalizedPage]);

    useEffect(() => {
        if (activeTab === "finalized" && subView === "list") void loadFinalizedData();
    }, [activeTab, subView, loadFinalizedData]);

    // ── Open Final sub-view ─────────────────────────────────────────────────
    async function handleOpenFinal(row: FinalJobRow) {
        if (!dbName || !schema) return;
        setLoadingDetail(row.id);
        try {
            const [jobRes, partsRes, chargesRes, paymentsRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobDetailType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DETAIL, sqlArgs: { id: row.id } }) },
                }),
                apolloClient.query<GenericQueryData<LoadedPartRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_PART_USED_BY_JOB, sqlArgs: { job_id: row.id } }) },
                }),
                apolloClient.query<GenericQueryData<AdditionalChargeRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_ADDITIONAL_CHARGES_BY_JOB, sqlArgs: { job_id: row.id } }) },
                }),
                apolloClient.query<GenericQueryData<{ amount: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_PAYMENTS_BY_JOB, sqlArgs: { job_id: row.id } }) },
                }),
            ]);

            const job = jobRes.data?.genericQuery?.[0] ?? null;
            if (!job) { toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED); return; }

            const parts = partsRes.data?.genericQuery ?? [];
            const charges = chargesRes.data?.genericQuery ?? [];
            setReceivedTotal((paymentsRes.data?.genericQuery ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0));

            // GST status of the job's own division — drives sale_pr_gst on load (before state is set)
            const loadedDivision = availableDivisions.find(d => d.id === row.division_id) ?? null;
            const loadedIsGst = isGstDivision(loadedDivision);

            setSelectedJob(job);
            setSelectedRow(row);
            setGstin(normalizeGstin(job.customer_gstin));
            setForceIgst(job.is_igst ?? false);
            setShowPartsInInvoice(job.to_show_parts_in_job_invoice ?? true);
            setSelectedDivisionId(row.division_id);
            setPartLines(
                parts.length > 0
                    ? parts.map(p => {
                        const gr = (p.gst_rate ?? 0) > 0 ? (p.gst_rate ?? 0) : defaultGstRate;
                        const sp = p.selling_price ?? 0;
                        return {
                            _key: crypto.randomUUID(),
                            id: p.id,
                            brand_id: p.brand_id,
                            part_id: p.part_id,
                            part_code: p.part_code,
                            part_name: p.part_name,
                            cost_price: String(p.cost_price ?? 0),
                            selling_price: String(sp),
                            gst_rate: String(gr),
                            sale_pr_gst: (loadedIsGst ? sp * (1 + gr / 100) : sp).toFixed(2),
                            qty: Number(p.qty),
                            remarks: p.remarks ?? "",
                            hsn_code: p.hsn_code?.trim() || defaultHsnForSparePart,
                            master_cost_price:    p.master_cost_price ?? 0,
                            master_selling_price: p.master_selling_price ?? 0,
                            master_gst_rate:      p.master_gst_rate ?? 0,
                        };
                    })
                    : [],
            );
            setDeletedPartIds([]);
            setChargeLines(charges.map(c => ({
                _key: crypto.randomUUID(),
                id: c.id,
                charge_name: c.charge_name,
                ref_no: c.ref_no ?? "",
                description: c.description ?? "",
                hsn_code: c.hsn_code ?? "",
                gst_rate: String(c.gst_rate ?? 0),
                qty: String(c.qty ?? 1),
                cost_price: String(c.cost_price),
                selling_price: String(c.selling_price),
                sale_pr_gst: (loadedIsGst ? c.selling_price * (1 + (c.gst_rate ?? 0) / 100) : c.selling_price).toFixed(2),
            })));
            setDeletedChargeIds([]);

            // Seed back-calc target: job.amount if set, else the computed grand total
            const computedTotal =
                parts.reduce((s, p) => {
                    const gr = (p.gst_rate ?? 0) > 0 ? (p.gst_rate ?? 0) : defaultGstRate;
                    const sp = p.selling_price ?? 0;
                    return s + (loadedIsGst ? sp * (1 + gr / 100) : sp) * Number(p.qty);
                }, 0) +
                charges.reduce((s, c) => {
                    const sp = c.selling_price ?? 0;
                    return s + (loadedIsGst ? sp * (1 + (c.gst_rate ?? 0) / 100) : sp) * Number(c.qty ?? 1);
                }, 0);
            const seedTarget = (job.amount && Number(job.amount) > 0) ? Number(job.amount) : computedTotal;
            setBackCalcTarget(seedTarget > 0 ? seedTarget.toFixed(2) : "");
            setSubView("final");
        } catch {
            toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED);
        } finally {
            setLoadingDetail(null);
        }
    }

    function handleBack() {
        setSubView("list");
        setSelectedJob(null);
        setSelectedRow(null);
        setReceivedTotal(0);
        setSelectedDivisionId(null);
        setPartLines([]);
        setDeletedPartIds([]);
        setBackCalcTarget("");
        setForceIgst(false);
        setGstin("");
    }

    // ── Undo Final ──────────────────────────────────────────────────────────
    const [undoingJobId, setUndoingJobId] = useState<number | null>(null);
    const [undoConfirmRow, setUndoConfirmRow] = useState<FinalizedJobRow | null>(null);

    // ── PDF / Proforma / Delivery modals ─────────────────────────────────────
    type DeliveryMannerRow = { id: number; name: string };
    const [pdfJobId,                    setPdfJobId]                    = useState<number | null>(null);
    const [proformaJobId,               setProformaJobId]               = useState<number | null>(null);
    const [deliveryLoadingJobId,        setDeliveryLoadingJobId]        = useState<number | null>(null);
    const [deliveryJobDetails,          setDeliveryJobDetails]          = useState<JobDeliveryFullDetail[]>([]);
    const [showDeliveryModal,           setShowDeliveryModal]           = useState(false);
    const [deliveryManners,             setDeliveryManners]             = useState<DeliveryMannerRow[]>([]);
    const [deliveryPartsInvoiceSetting, setDeliveryPartsInvoiceSetting] =
        useState<{ show: boolean; text: string; hsn: number; gst_rate: number } | null>(null);

    // ── Charges view ─────────────────────────────────────────────────────────
    const [chargesViewOpen, setChargesViewOpen] = useState(false);
    const [chargesLoadingJobId, setChargesLoadingJobId] = useState<number | null>(null);
    const [chargesViewJobNo, setChargesViewJobNo] = useState("");
    const [chargesViewIsGst, setChargesViewIsGst] = useState(false);
    const [chargesViewIsWarranty, setChargesViewIsWarranty] = useState(false);
    const [chargesViewForceIgst, setChargesViewForceIgst] = useState(false);
    const [chargesViewAmount, setChargesViewAmount] = useState<number | null>(null);
    const [chargesViewParts, setChargesViewParts] = useState<ChargesViewPartLine[]>([]);
    const [chargesViewCharges, setChargesViewCharges] = useState<ChargesViewChargeLine[]>([]);

    async function handleOpenChargesView(row: FinalizedJobRow) {
        if (!dbName || !schema) return;
        setChargesLoadingJobId(row.id);
        try {
            const [partsRes, chargesRes, jobRes] = await Promise.all([
                apolloClient.query<GenericQueryData<LoadedPartRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_PART_USED_BY_JOB, sqlArgs: { job_id: row.id } }) },
                }),
                apolloClient.query<GenericQueryData<AdditionalChargeRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_ADDITIONAL_CHARGES_BY_JOB, sqlArgs: { job_id: row.id } }) },
                }),
                apolloClient.query<GenericQueryData<JobDetailType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DETAIL, sqlArgs: { id: row.id } }) },
                }),
            ]);
            const jobDetail = jobRes.data?.genericQuery?.[0] ?? null;
            const division = availableDivisions.find(d => d.id === row.division_id) ?? null;
            setChargesViewJobNo(row.job_no);
            setChargesViewIsGst(isGstDivision(division));
            setChargesViewIsWarranty(row.job_type_code === "UNDER_WARRANTY");
            setChargesViewForceIgst(jobDetail?.is_igst ?? false);
            setChargesViewAmount(row.amount);
            setChargesViewParts(partsRes.data?.genericQuery ?? []);
            setChargesViewCharges(chargesRes.data?.genericQuery ?? []);
            setChargesViewOpen(true);
        } catch {
            toast.error("Failed to load charges. Please try again.");
        } finally {
            setChargesLoadingJobId(null);
        }
    }

    async function handleReviseFinal(row: FinalizedJobRow) {
        const adapted: FinalJobRow = {
            ...row,
            is_closed: false,
            is_final:  true,
        };
        await handleOpenFinal(adapted);
    }

    async function handleUndoFinal(row: FinalizedJobRow) {
        if (!dbName || !schema) return;
        setUndoingJobId(row.id);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: encodeObj({ tableName: "job", xData: { id: row.id, is_final: false } }),
                },
            });
            toast.success(`Job #${row.job_no} moved back to pending.`);
            finalizedGridRef.current?.armRestore();
            void loadFinalizedData();
            if (branchId) void loadData(branchId, searchQ, page, currentDivision?.id ?? null);
        } catch {
            toast.error("Failed to undo final. Please try again.");
        } finally {
            setUndoingJobId(null);
        }
    }

    async function handleOpenDelivery(jobId: number) {
        if (!dbName || !schema) return;
        setDeliveryLoadingJobId(jobId);
        try {
            const res = await apolloClient.query<GenericQueryData<JobDeliveryFullDetail>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_DELIVERABLE_JOBS_DETAIL_MULTI,
                        sqlArgs: { job_ids: [jobId] },
                    }),
                },
            });
            const details = res.data?.genericQuery ?? [];
            if (details.length === 0) { toast.error("Failed to load job delivery details."); return; }
            setDeliveryJobDetails(details);
            setShowDeliveryModal(true);
        } catch {
            toast.error("Failed to load job delivery details.");
        } finally {
            setDeliveryLoadingJobId(null);
        }
    }

    // ── Change division ───────────────────────────────────────────────────────
    async function handleDivisionChange(newDivisionId: number) {
        setSelectedDivisionId(newDivisionId);
        const newDivision = availableDivisions.find(d => d.id === newDivisionId) ?? null;
        const newIsGst = isGstDivision(newDivision);
        const gstStatusChanged = newIsGst !== isGst;

        const newPartLines = partLines.map(line => {
            if (line.part_id === null) return line;
            // Always compute from master reference fields so toggling back is idempotent
            const syntheticPart = {
                id: line.part_id,
                brand_id: line.brand_id ?? 0,
                part_code: line.part_code,
                part_name: line.part_name,
                cost_price:    line.master_cost_price,
                selling_price: line.master_selling_price,
                gst_rate:      line.master_gst_rate,
                hsn_code:      line.hsn_code || null,
                part_description: null, category: null, model: null,
                uom: "", mrp: null, is_active: true, brand_name: "",
            } satisfies PartRow;
            const pricePatch = computePartPricesOnSelect(
                syntheticPart, newIsGst, !newIsGst,
                defaultGstRate, markupPct,
                0, 0,
            );
            const effectiveHsn = newIsGst
                ? (line.hsn_code.trim() || defaultHsnForSparePart)
                : line.hsn_code;
            return { ...line, ...pricePatch, hsn_code: effectiveHsn };
        });

        const newChargeLines = chargeLines.map(c => {
            const sp = parseFloat(c.selling_price) || 0;
            if (newIsGst) {
                const gstRate = parseFloat(c.gst_rate) > 0 ? parseFloat(c.gst_rate) : defaultGstRate;
                const hsn_code = c.hsn_code.trim() || defaultHsnForServiceCharge;
                return { ...c, gst_rate: String(gstRate), hsn_code, sale_pr_gst: (sp * (1 + gstRate / 100)).toFixed(2) };
            }
            return { ...c, gst_rate: "0", sale_pr_gst: sp.toFixed(2) };
        });

        setPartLines(newPartLines);
        setChargeLines(newChargeLines);
        resyncTarget(newPartLines, newChargeLines);
        setForceIgst(false);

        // When GST status changes, immediately persist the recalculated rates to the DB
        // so that reopening the job before finalization shows correct values.
        if (!gstStatusChanged || !selectedJob || !dbName || !schema) return;

        const partsToUpdate = newPartLines.filter(p => p.id !== undefined);
        const chargesToUpdate = newChargeLines.filter(c => c.id !== undefined);
        if (partsToUpdate.length === 0 && chargesToUpdate.length === 0) return;

        const xDetails: object[] = [];
        if (partsToUpdate.length > 0) {
            xDetails.push({
                tableName: "job_part_used",
                fkeyName: "job_id",
                xData: partsToUpdate.map(p => ({
                    id: p.id,
                    gst_rate: parseFloat(p.gst_rate) || 0,
                    hsn_code: p.hsn_code,
                    cost_price: parseFloat(p.cost_price) || 0,
                    selling_price: parseFloat(p.selling_price) || 0,
                })),
            });
        }
        if (chargesToUpdate.length > 0) {
            xDetails.push({
                tableName: "job_additional_charge",
                fkeyName: "job_id",
                xData: chargesToUpdate.map(c => ({
                    id: c.id,
                    gst_rate: parseFloat(c.gst_rate) || 0,
                    hsn_code: c.hsn_code,
                    selling_price: parseFloat(c.selling_price) || 0,
                })),
            });
        }

        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: encodeObj({
                        tableName: "job",
                        xData: { id: selectedJob.id, division_id: newDivisionId, to_set_updated_at: true, xDetails },
                    }),
                },
            });
        } catch {
            toast.error("Failed to persist GST rate changes. Save the job manually to avoid stale rates.");
        }
    }

    // ── Part mutations ──────────────────────────────────────────────────────
    function addPartLine() {
        setPartLines(prev => [...prev, emptyPartLine(isGst ? defaultGstRate : 0, defaultHsnForSparePart)]);
    }

    // Re-seed the back-calc target to the current grand total whenever lines change,
    // so "Total" tracks parts + charges as the user edits. Manual target entry and
    // Back Calculate bypass these handlers, so they are left untouched.
    function resyncTarget(parts: EditablePartLine[], charges: EditableChargeLine[]) {
        const total =
            parts.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0) +
            charges.reduce((s, c) => s + (parseFloat(c.sale_pr_gst) || 0) * (parseFloat(c.qty) || 1), 0);
        setBackCalcTarget(total > 0 ? total.toFixed(2) : "");
    }

    function removePartLine(key: string, id?: number) {
        const next = partLines.filter(l => l._key !== key);
        setPartLines(next);
        if (id !== undefined) setDeletedPartIds(prev => [...prev, id]);
        resyncTarget(next, chargeLines);
    }

    function updatePartLine(key: string, patch: Partial<EditablePartLine>) {
        const next = partLines.map(l => l._key === key ? { ...l, ...patch } : l);
        setPartLines(next);
        resyncTarget(next, chargeLines);
    }

    // Cost edit cascades: selling = cost*(1+markup%), sale_pr_gst = selling*(1+gst%) when GST,
    // then re-seed the back-calc target to the new grand total.
    function handleCostChange(key: string, value: string) {
        const isWarrantyJob = selectedRow?.job_type_code === "UNDER_WARRANTY";
        const cp = parseFloat(value) || 0;
        const next = partLines.map(l => {
            if (l._key !== key) return l;
            const sp = isWarrantyJob ? (parseFloat(l.selling_price) || 0) : applyMarkup(cp, markupPct);
            const rate = isGst ? (parseFloat(l.gst_rate) || 0) : 0;
            return {
                ...l,
                cost_price:    value,
                selling_price: sp.toFixed(2),
                sale_pr_gst:   (sp * (1 + rate / 100)).toFixed(2),
            };
        });
        setPartLines(next);
        resyncTarget(next, chargeLines);
    }

    function handlePartSelect(key: string, part: PartRow) {
        const line = partLines.find(l => l._key === key);
        const currentCostPrice    = parseFloat(line?.cost_price    ?? "0") || 0;
        const currentSellingPrice = parseFloat(line?.selling_price ?? "0") || 0;
        const pricePatch = computePartPricesOnSelect(
            part, isGst, !isGst, defaultGstRate, markupPct,
            currentCostPrice, currentSellingPrice,
        );
        updatePartLine(key, {
            part_id:              part.id,
            part_code:            part.part_code,
            part_name:            part.part_name,
            brand_id:             part.brand_id,
            hsn_code:             part.hsn_code?.trim() || defaultHsnForSparePart,
            master_cost_price:    part.cost_price ?? 0,
            master_selling_price: part.selling_price ?? 0,
            master_gst_rate:      part.gst_rate ?? 0,
            ...pricePatch,
        });
    }

    // ── Charge mutations ────────────────────────────────────────────────────
    function addChargeLine() {
        setChargeLines(prev => [...prev, emptyChargeLine(isGst ? defaultGstRate : 0, defaultHsnForServiceCharge)]);
    }

    function removeChargeLine(key: string, id?: number) {
        const next = chargeLines.filter(c => c._key !== key);
        setChargeLines(next);
        if (id !== undefined) setDeletedChargeIds(prev => [...prev, id]);
        resyncTarget(partLines, next);
    }

    function updateChargeLine(key: string, field: keyof EditableChargeLine, value: string) {
        const next = chargeLines.map(c => c._key === key ? { ...c, [field]: value } : c);
        setChargeLines(next);
        resyncTarget(partLines, next);
    }

    function patchChargeLine(key: string, patch: Partial<EditableChargeLine>) {
        const next = chargeLines.map(c => c._key === key ? { ...c, ...patch } : c);
        setChargeLines(next);
        resyncTarget(partLines, next);
    }

    // ── Reset prices ────────────────────────────────────────────────────────
    function handleReset() {
        setPartLines(prev => prev.map(line => {
            if (line.part_id === null) return line;
            // Build a minimal PartRow-compatible object from the master data stored on the line
            const syntheticPart = {
                id: line.part_id,
                brand_id: line.brand_id ?? 0,
                part_code: line.part_code,
                part_name: line.part_name,
                part_description: null, category: null, model: null,
                uom: "", mrp: null, is_active: true, brand_name: "",
                cost_price:    line.master_cost_price,
                selling_price: line.master_selling_price,
                gst_rate:      line.master_gst_rate,   // use stored master rate, not mutable line.gst_rate
                hsn_code:      line.hsn_code || null,
            } satisfies PartRow;
            const pricePatch = computePartPricesOnSelect(
                syntheticPart, isGst, !isGst, defaultGstRate, markupPct,
                0, 0, // force fresh computation — no custom overrides
            );
            return { ...line, ...pricePatch };
        }));
        setChargeLines(prev => prev.map(c => {
            if (!c.charge_name.trim()) return c;
            const gstRate = isGst ? defaultGstRate : 0;
            const sp = parseFloat(c.selling_price) || 0;
            return {
                ...c,
                gst_rate:    String(gstRate),
                hsn_code:    c.hsn_code.trim() || defaultHsnForServiceCharge,
                sale_pr_gst: (sp * (1 + gstRate / 100)).toFixed(2),
            };
        }));
    }

    // ── Save final ──────────────────────────────────────────────────────────
    async function handleSaveFinal() {
        if (!selectedJob || !dbName || !schema || !branchId) return;

        const newParts = partLines.filter(l => !l.id && l.part_id && l.qty > 0);
        if (newParts.length > 0 && !jobConsumeTypeId) {
            toast.error("Stock transaction type not loaded. Please try again.");
            return;
        }

        const backCalcNumFinal = parseFloat(backCalcTarget);
        const hasTargetFinal   = backCalcTarget !== "" && !isNaN(backCalcNumFinal) && backCalcNumFinal > 0;
        const hasLinesFinal    = partLines.some(l => l.part_id) || chargeLines.some(c => c.charge_name.trim());
        if (hasTargetFinal && !hasLinesFinal) {
            toast.error("Target amount cannot be set without any parts or charges. Please add at least one part or charge, or clear the target amount.");
            return;
        }

        if (!isValidGstin(gstin)) {
            toast.error("Enter a valid 15-character GSTIN, or clear the field, before finalizing.");
            return;
        }

        const isWarrantyJob = selectedRow?.job_type_code === "UNDER_WARRANTY";
        setSubmitting(true);
        try {
            if (isGst && !isWarrantyJob) {
                const missingHsnParts = partLines.filter(l => l.part_id && !l.hsn_code.trim()).length;
                const missingHsnCharges = chargeLines.filter(c => c.charge_name.trim() && !c.hsn_code.trim()).length;
                if (missingHsnParts > 0 || missingHsnCharges > 0) {
                    toast.error("HSN is required for all parts and charges in a GST invoice.");
                    return;
                }
                const missingGstRateParts = partLines.filter(l => l.part_id && !(parseFloat(l.gst_rate) > 0)).length;
                const missingGstRateCharges = chargeLines.filter(c => c.charge_name.trim() && !(parseFloat(c.gst_rate) > 0)).length;
                if (missingGstRateParts > 0 || missingGstRateCharges > 0) {
                    toast.error("GST rate must be greater than 0 for all parts and charges in a GST invoice.");
                    return;
                }
            }

            const chargeUpsertRows = chargeLines
                .filter(c => c.charge_name.trim())
                .map(c => ({
                    ...(c.id !== undefined ? { id: c.id } : {}),
                    charge_name: c.charge_name.trim(),
                    ref_no: c.ref_no.trim() || null,
                    description: c.description.trim() || null,
                    hsn_code: (isGst && !isWarrantyJob) ? (c.hsn_code.trim() || null) : null,
                    gst_rate: !isWarrantyJob ? (parseFloat(c.gst_rate) || 0) : 0,
                    qty: parseFloat(c.qty) || 1,
                    cost_price: parseFloat(c.cost_price) || 0,
                    selling_price: isWarrantyJob ? 0 : (parseFloat(c.selling_price) || 0),
                }));

            const xDetails: Record<string, unknown>[] = [];

            // Existing part updates (have id)
            const existingUpdates = partLines
                .filter(l => l.id !== undefined && l.part_id)
                .map(l => ({
                    id: l.id,
                    part_id: l.part_id,
                    cost_price: parseFloat(l.cost_price) || 0,
                    selling_price: isWarrantyJob ? 0 : (parseFloat(l.selling_price) || 0),
                    gst_rate: !isWarrantyJob ? (parseFloat(l.gst_rate) || 0) : 0,
                    qty: l.qty,
                    remarks: l.remarks.trim() || null,
                    hsn_code: (isGst && !isWarrantyJob) ? (l.hsn_code.trim() || null) : null,
                }));

            // New part inserts (no id, valid part_id) with stock transactions
            const newInserts = newParts.map(l => ({
                part_id: l.part_id,
                cost_price: parseFloat(l.cost_price) || 0,
                selling_price: isWarrantyJob ? 0 : (parseFloat(l.selling_price) || 0),
                gst_rate: !isWarrantyJob ? (parseFloat(l.gst_rate) || 0) : 0,
                qty: l.qty,
                remarks: l.remarks.trim() || null,
                hsn_code: (isGst && !isWarrantyJob) ? (l.hsn_code.trim() || null) : null,
                xDetails: {
                    tableName: "stock_transaction",
                    fkeyName: "job_part_used_id",
                    xData: {
                        branch_id: branchId,
                        part_id: l.part_id,
                        qty: l.qty,
                        dr_cr: "C",
                        transaction_date: selectedJob.job_date,
                        stock_transaction_type_id: jobConsumeTypeId,
                        remarks: l.remarks.trim() || null,
                    },
                },
            }));

            const allPartXData = [...existingUpdates, ...newInserts];
            if (allPartXData.length > 0 || deletedPartIds.length > 0) {
                xDetails.push({
                    tableName: "job_part_used",
                    fkeyName: "job_id",
                    ...(deletedPartIds.length > 0 ? { deletedIds: deletedPartIds } : {}),
                    xData: allPartXData,
                });
            }

            xDetails.push({
                tableName: "job_additional_charge",
                fkeyName: "job_id",
                ...(deletedChargeIds.length > 0 ? { deletedIds: deletedChargeIds } : {}),
                xData: chargeUpsertRows,
            });

            const backCalcNum = parseFloat(backCalcTarget);
            const computedTotal = partLines.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0)
                + chargeLines.reduce((s, c) => s + (parseFloat(c.sale_pr_gst) || 0) * (parseFloat(c.qty) || 1), 0);
            const amount = isWarrantyJob
                ? 0
                : ((backCalcTarget !== "" && !isNaN(backCalcNum) && backCalcNum > 0) ? backCalcNum : computedTotal);

            if (!isWarrantyJob) {
                const diff = Math.abs(amount - computedTotal);
                if (diff > 0.5) {
                    setDiffAlertMsg(
                        `Job total (₹${amount.toFixed(2)}) differs from the calculated line total (₹${computedTotal.toFixed(2)}) by ₹${diff.toFixed(2)}. Maximum allowed difference is ₹0.50. Please adjust line amounts or use Back Calculate.`
                    );
                    setSubmitting(false);
                    return;
                }
            }

            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: encodeObj({
                        tableName: "job",
                        xData: { id: selectedJob.id, is_final: true, is_igst: forceIgst, division_id: selectedDivisionId, amount, to_show_parts_in_job_invoice: showPartsInInvoice, to_set_updated_at: true, xDetails },
                    }),
                },
            });

            await saveCustomerGstin({
                customerId: selectedJob.customer_contact_id,
                gstin,
                currentGstin: selectedJob.customer_gstin,
                dbName,
                schema,
            });

            toast.success("Job marked as final.");
            handleBack();
            if (branchId) void loadData(branchId, searchQ, page, currentDivision?.id ?? null);
            void loadFinalizedData();
        } catch {
            toast.error("Failed to save. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    // const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ─── Final sub-view ───────────────────────────────────────────────────────

    if (subView === "final" && selectedJob && selectedRow) {
        return (
            <>
            <FinalJobForm
                selectedJob={selectedJob}
                selectedRow={selectedRow}
                receivedTotal={receivedTotal}
                submitting={submitting}
                loadingDetail={loadingDetail !== null}
                selectedDivisionId={selectedDivisionId}
                division={division}
                isGst={isGst}
                availableDivisions={availableDivisions}
                brands={brands}
                additionalChargeOptions={additionalChargeOptions}
                partLines={partLines}
                chargeLines={chargeLines}
                deletedPartIds={deletedPartIds}
                forceIgst={forceIgst}
                backCalcTarget={backCalcTarget}
                showPartsInInvoice={showPartsInInvoice}
                gstin={gstin}
                defaultHsnForSparePart={defaultHsnForSparePart}
                defaultHsnForServiceCharge={defaultHsnForServiceCharge}
                viewJobId={viewJobId}
                setForceIgst={setForceIgst}
                setGstin={setGstin}
                setBackCalcTarget={setBackCalcTarget}
                setShowPartsInInvoice={setShowPartsInInvoice}
                setChargeLines={setChargeLines}
                setPartLines={setPartLines}
                setViewJobId={setViewJobId}
                onBack={handleBack}
                onSave={handleSaveFinal}
                onRefresh={() => handleOpenFinal(selectedRow)}
                onReset={handleReset}
                onAddPart={addPartLine}
                onRemovePart={removePartLine}
                onUpdatePart={updatePartLine}
                onCostChange={handleCostChange}
                onPartSelect={handlePartSelect}
                onAddCharge={addChargeLine}
                onRemoveCharge={removeChargeLine}
                onUpdateCharge={updateChargeLine}
                onPatchCharge={patchChargeLine}
                onDivisionChange={handleDivisionChange}
            />
            <Dialog open={diffAlertMsg !== null} onOpenChange={open => { if (!open) setDiffAlertMsg(null); }}>
                <DialogContent aria-describedby={undefined} className="sm:max-w-md !bg-white text-(--cl-text)">
                    <DialogHeader>
                        <DialogTitle className="text-amber-600">Amount Difference Too Large</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-(--cl-text) leading-relaxed">{diffAlertMsg}</p>
                    <DialogFooter>
                        <Button className="cursor-pointer" onClick={() => setDiffAlertMsg(null)}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            </>
        );
    }
    // ─── List view ────────────────────────────────────────────────────────────

    return (
        <>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                {/* Header */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-1">
                    {onBack && (
                        <Button
                            className="h-8 gap-1.5 px-3 font-semibold text-(--cl-accent) border border-(--cl-accent) hover:bg-(--cl-accent) hover:text-white transition-colors shrink-0"
                            size="sm"
                            variant="outline"
                            onClick={onBack}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                            <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h1 className="text-lg font-bold text-(--cl-text)">Final a Job</h1>
                            <span className="text-xs text-(--cl-text-muted)">
                                {activeTab === "pending"
                                    ? (loading ? "Loading…" : `(${total})`)
                                    : (finalizedLoading ? "Loading…" : `(${finalizedTotal})`)}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1" />

                    <div className="flex shrink-0 items-center gap-2 rounded-xl border-2 border-(--cl-border) bg-(--cl-surface-2) p-1 shadow-md mr-44">
                        <Button
                            className={`h-9 gap-2 px-4 text-sm transition-transform duration-200 rounded-lg border-0 ${activeTab === "pending"
                                    ? "bg-emerald-600 text-white font-bold shadow-lg scale-105 hover:brightness-110"
                                    : "bg-transparent text-(--cl-text-muted) hover:text-white hover:bg-emerald-600 hover:scale-105 font-semibold"
                                }`}
                            size="sm"
                            onClick={() => setActiveTab("pending")}
                        >
                            Final a Job
                        </Button>
                        <Button
                            className={`h-9 gap-2 px-4 text-sm transition-transform duration-200 rounded-lg border-0 ${activeTab === "finalized"
                                    ? "bg-sky-600 text-white font-bold shadow-lg scale-105 hover:brightness-110"
                                    : "bg-transparent text-(--cl-text-muted) hover:text-white hover:bg-sky-600 hover:scale-105 font-semibold"
                                }`}
                            size="sm"
                            onClick={() => setActiveTab("finalized")}
                        >
                            Finalized Jobs
                        </Button>
                    </div>
                </div>

                {activeTab === "pending" && (
                    <PendingJobsGrid
                        ref={pendingGridRef}
                        rows={rows}
                        loading={loading}
                        total={total}
                        page={page}
                        setPage={setPage}
                        search={search}
                        branchId={branchId}
                        availableDivisions={availableDivisions}
                        loadingDetail={loadingDetail}
                        onSearchChange={handleSearchChange}
                        onRefresh={() => { if (branchId) void loadData(branchId, searchQ, page, currentDivision?.id ?? null); }}
                        onViewJob={id => setViewJobId(id)}
                        onOpenFinal={row => void handleOpenFinal(row)}
                        onOpenAttach={(id, jobNo) => { setAttachSource("pending"); setAttachJobId(id); setAttachJobNo(jobNo); }}
                    />
                )}

                {activeTab === "finalized" && (
                    <FinalizedJobsGrid
                        ref={finalizedGridRef}
                        rows={finalizedRows}
                        loading={finalizedLoading}
                        total={finalizedTotal}
                        page={finalizedPage}
                        setPage={setFinalizedPage}
                        search={finalizedSearch}
                        branchId={branchId}
                        availableDivisions={availableDivisions}
                        undoingJobId={undoingJobId}
                        chargesLoadingJobId={chargesLoadingJobId}
                        deliveryLoadingJobId={deliveryLoadingJobId}
                        onSearchChange={handleFinalizedSearchChange}
                        onRefresh={() => void loadFinalizedData()}
                        onViewJob={id => setViewJobId(id)}
                        onUndo={row => setUndoConfirmRow(row)}
                        onOpenAttach={(id, jobNo) => { setAttachSource("finalized"); setAttachJobId(id); setAttachJobNo(jobNo); }}
                        onViewCharges={row => void handleOpenChargesView(row)}
                        onDeliver={id => void handleOpenDelivery(id)}
                        onProforma={setProformaJobId}
                        onPdf={setPdfJobId}
                        onReviseFinal={row => void handleReviseFinal(row)}
                    />
                )}
            </motion.div>

            {viewJobId !== null && (
                <JobDetailsModal
                    jobId={viewJobId}
                    onClose={() => {
                        setViewJobId(null);
                        if (activeTab === "finalized") {
                            finalizedGridRef.current?.armRestore();
                            void loadFinalizedData();
                        } else if (branchId) {
                            pendingGridRef.current?.armRestore();
                            void loadData(branchId, searchQ, page, currentDivision?.id ?? null);
                        }
                    }}
                />
            )}

            {attachJobId !== null && (
                <JobAttachDialog
                    jobId={attachJobId}
                    jobNo={attachJobNo}
                    onClose={() => { setAttachJobId(null); setAttachJobNo(""); }}
                    onFilesChanged={count => {
                        const id = attachJobId;
                        if (attachSource === "finalized") {
                            setFinalizedRows(prev => prev.map(r => r.id === id ? { ...r, file_count: count } : r));
                        } else {
                            setRows(prev => prev.map(r => r.id === id ? { ...r, file_count: count } : r));
                        }
                    }}
                />
            )}

            <JobChargesReadonlyModal
                open={chargesViewOpen}
                onClose={() => setChargesViewOpen(false)}
                jobNo={chargesViewJobNo}
                isGst={chargesViewIsGst}
                isWarranty={chargesViewIsWarranty}
                forceIgst={chargesViewForceIgst}
                amount={chargesViewAmount}
                parts={chargesViewParts}
                charges={chargesViewCharges}
            />

            {pdfJobId !== null && (
                <JobPdfModal jobId={pdfJobId} onClose={() => setPdfJobId(null)} />
            )}

            {proformaJobId !== null && (
                <JobProformaInvoiceModal jobId={proformaJobId} onClose={() => setProformaJobId(null)} />
            )}

            {showDeliveryModal && deliveryJobDetails.length > 0 && (
                <DeliveryModal
                    jobs={deliveryJobDetails}
                    branchId={currentBranch?.id ?? null}
                    branchName={currentBranch?.name ?? null}
                    deliveryManners={deliveryManners}
                    availableDivisions={availableDivisions}
                    currentUser={currentUser}
                    dbName={dbName}
                    schema={schema}
                    showPartsInInvoiceSetting={deliveryPartsInvoiceSetting}
                    onClose={() => { setShowDeliveryModal(false); setDeliveryJobDetails([]); }}
                    onDelivered={() => {
                        setShowDeliveryModal(false);
                        setDeliveryJobDetails([]);
                        finalizedGridRef.current?.armRestore();
                        void loadFinalizedData();
                    }}
                />
            )}

            <AlertDialog open={!!undoConfirmRow} onOpenChange={open => { if (!open) setUndoConfirmRow(null); }}>
                <AlertDialogContent className="max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Undo Final?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Job <span className="font-medium text-foreground">#{undoConfirmRow?.job_no}</span> will be moved back to pending. Are you sure?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { if (undoConfirmRow) { void handleUndoFinal(undoConfirmRow); setUndoConfirmRow(null); } }}
                        >
                            Undo Final
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
