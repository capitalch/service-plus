import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectAvailableDivisions, selectCurrentBranch, selectCurrentDivision, selectDefaultGstRate, selectDefaultHsnForSparePart, selectDefaultHsnForServiceCharge, selectEffectiveGstStateCode, selectForceGstOnPartsForNonGst, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobDetailType } from "@/features/client/types/job";
import { isGstDivision } from "@/features/client/types/division";
import type { BrandOption } from "@/features/client/types/model";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import { type PartRow } from "../../inventory/part-code-input";
import { JobDetailsModal } from "../job-pipeline/job-details-modal";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import {
    type FinalJobRow,
    type FinalizedJobRow,
    type EditablePartLine,
    type EditableChargeLine,
    type AdditionalChargeMasterRow,
    emptyChargeLine,
} from "./final-a-job-schema";
import { PAGE_SIZE, DEBOUNCE_MS, calculateLinePricing } from "./final-a-job-helpers";
import { FinalJobForm } from "./final-job-form";
import { PendingJobsGrid } from "./pending-jobs-grid";
import { FinalizedJobsGrid } from "./finalized-jobs-grid";

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
    quantity: number;
    cost_price: number | null;
    selling_price: number | null;
    gst_rate: number | null;
    remarks: string | null;
    hsn_code: string | null;
};

type AdditionalChargeRow = {
    id: number;
    charge_name: string;
    ref_no: string | null;
    description: string | null;
    hsn_code: string | null;
    gst_rate: number;
    quantity: number;
    cost_price: number;
    selling_price: number;
};

function emptyPartLine(gstRate = 0, hsn = ""): EditablePartLine {
    return { _key: crypto.randomUUID(), brand_id: null, part_id: null, part_code: "", part_name: "", cost_price: "0", selling_price: "0", sale_pr_gst: "0", gst_rate: String(gstRate), quantity: 1, remarks: "", hsn_code: hsn };
}

// ─── Pricing helpers ──────────────────────────────────────────────────────────

function applyMarkup(cost: number, markupPct: number): number {
    return Math.round(cost * (1 + markupPct / 100) * 100) / 100;
}

function computePartPricesOnSelect(
    part: PartRow,
    isGst: boolean,
    forceGstOnPartsForNonGst: boolean,
    defaultGstRate: number,
    markupPct: number,
): Pick<EditablePartLine, "cost_price" | "selling_price" | "sale_pr_gst" | "gst_rate"> {
    const rawCost = part.cost_price ?? 0;
    const masterSelling = (part.selling_price != null && part.selling_price > 0) ? part.selling_price : null;
    const effectiveGstRate = (part.gst_rate ?? 0) > 0 ? (part.gst_rate ?? 0) : defaultGstRate;

    if (!isGst) {
        if (forceGstOnPartsForNonGst) {
            const adjustedCost = rawCost * (1 + effectiveGstRate / 100);
            const markupAmt = masterSelling != null ? masterSelling - rawCost : rawCost * markupPct / 100;
            const sale = adjustedCost + markupAmt;
            return { cost_price: adjustedCost.toFixed(2), selling_price: sale.toFixed(2), gst_rate: "0", sale_pr_gst: sale.toFixed(2) };
        }
        const sale = masterSelling ?? applyMarkup(rawCost, markupPct);
        return { cost_price: rawCost.toFixed(2), selling_price: sale.toFixed(2), gst_rate: "0", sale_pr_gst: sale.toFixed(2) };
    }

    const sale = masterSelling ?? applyMarkup(rawCost, markupPct);
    return {
        cost_price: rawCost.toFixed(2),
        selling_price: sale.toFixed(2),
        gst_rate: String(effectiveGstRate),
        sale_pr_gst: (sale * (1 + effectiveGstRate / 100)).toFixed(2),
    };
}

// ─── Invoice payload builder ──────────────────────────────────────────────────

function computeInvoicePayload(
    partLines:   EditablePartLine[],
    chargeLines: EditableChargeLine[],
    jobNo:       string,
    isGst:       boolean,
    forceIgst:   boolean,
    stateCode:   string | null,
): { invoiceHeader: Record<string, unknown>; invoiceLines: Record<string, unknown>[] } {
    const today      = new Date().toISOString().split("T")[0];
    const supplyCode = (stateCode ?? "00").substring(0, 2);
    const lines: Record<string, unknown>[] = [];
    let taxable = 0, cgst = 0, sgst = 0, igst = 0;

    for (const l of partLines.filter(l => l.part_id !== null)) {
        const sp      = parseFloat(l.selling_price) || 0;
        const qty     = l.quantity;
        const gstRate = isGst ? (parseFloat(l.gst_rate) || 0) : 0;
        const rowAgg  = sp * qty;
        const rc = isGst && !forceIgst ? rowAgg * gstRate / 2 / 100 : 0;
        const rs = isGst && !forceIgst ? rowAgg * gstRate / 2 / 100 : 0;
        const ri = isGst && forceIgst  ? rowAgg * gstRate     / 100 : 0;
        lines.push({
            description: l.part_name || l.part_code || "",
            part_code:   l.part_code || null,
            hsn_code:    l.hsn_code  || null,
            quantity: qty, price: sp, aggregate: rowAgg,
            gst_rate: gstRate,
            cgst_amount: rc, sgst_amount: rs, igst_amount: ri,
            amount: rowAgg + rc + rs + ri,
        });
        taxable += rowAgg; cgst += rc; sgst += rs; igst += ri;
    }

    for (const c of chargeLines.filter(c => c.charge_name.trim() !== "")) {
        const sp      = parseFloat(c.selling_price) || 0;
        const qty     = parseFloat(c.quantity) || 1;
        const gstRate = isGst ? (parseFloat(c.gst_rate) || 0) : 0;
        const rowAgg  = sp * qty;
        const rc = isGst && !forceIgst ? rowAgg * gstRate / 2 / 100 : 0;
        const rs = isGst && !forceIgst ? rowAgg * gstRate / 2 / 100 : 0;
        const ri = isGst && forceIgst  ? rowAgg * gstRate     / 100 : 0;
        lines.push({
            description: c.charge_name,
            part_code:   null,
            hsn_code:    c.hsn_code || null,
            quantity: qty, price: sp, aggregate: rowAgg,
            gst_rate: gstRate,
            cgst_amount: rc, sgst_amount: rs, igst_amount: ri,
            amount: rowAgg + rc + rs + ri,
        });
        taxable += rowAgg; cgst += rc; sgst += rs; igst += ri;
    }

    return {
        invoiceHeader: {
            invoice_no:        jobNo,
            invoice_date:      today,
            supply_state_code: supplyCode,
            aggregate:         taxable,
            cgst_amount:       cgst,
            sgst_amount:       sgst,
            igst_amount:       igst,
            amount:            taxable + cgst + sgst + igst,
        },
        invoiceLines: lines,
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FinalAJobSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const availableDivisions = useAppSelector(selectAvailableDivisions);
    const currentDivision = useAppSelector(selectCurrentDivision);
    const defaultGstRate = useAppSelector(selectDefaultGstRate);
    const defaultHsnForSparePart = useAppSelector(selectDefaultHsnForSparePart);
    const defaultHsnForServiceCharge = useAppSelector(selectDefaultHsnForServiceCharge);
    const forceGstOnPartsForNonGst = useAppSelector(selectForceGstOnPartsForNonGst);
    const effectiveGstStateCode = useAppSelector(selectEffectiveGstStateCode);
    const branchId = currentBranch?.id ?? null;

    // ── List state ──────────────────────────────────────────────────────────
    const [subView, setSubView] = useState<SubView>("list");
    const [activeTab, setActiveTab] = useState<"pending" | "finalized">("pending");
    const [search, setSearch] = useState("");
    const [searchQ, setSearchQ] = useState("");
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<FinalJobRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const [viewJobId, setViewJobId] = useState<number | null>(null);
    const [attachJobId, setAttachJobId]     = useState<number | null>(null);
    const [attachJobNo, setAttachJobNo]     = useState<string>("");
    const [attachSource, setAttachSource]   = useState<"pending" | "finalized">("pending");

    // ── Finalized Jobs tab state ────────────────────────────────────────────
    const [finalizedRows, setFinalizedRows]       = useState<FinalizedJobRow[]>([]);
    const [finalizedTotal, setFinalizedTotal]     = useState(0);
    const [finalizedPage, setFinalizedPage]       = useState(1);
    const [finalizedSearch, setFinalizedSearch]   = useState("");
    const [finalizedSearchQ, setFinalizedSearchQ] = useState("");
    const [finalizedLoading, setFinalizedLoading] = useState(false);

    // ── Edit mode state ─────────────────────────────────────────────────────
    const [isEditMode, setIsEditMode]               = useState(false);
    const [existingInvoiceId, setExistingInvoiceId] = useState<number | null>(null);

    // ── Final sub-view state ────────────────────────────────────────────────
    const [selectedJob, setSelectedJob] = useState<JobDetailType | null>(null);
    const [selectedRow, setSelectedRow] = useState<FinalJobRow | null>(null);
    const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [changeDivOpen, setChangeDivOpen] = useState(false);

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

    const debounceRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
    const finalizedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Derived: effective division and GST flag for the currently-open job
    const division = availableDivisions.find(d => d.id === selectedDivisionId) ?? null;
    const isGst = isGstDivision(division);

    // ── Load brands + JOB_CONSUME type once ─────────────────────────────────
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchMeta = async () => {
            try {
                const [brandsRes, txnRes, markupRes, additionalChargesRes] = await Promise.all([
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
                ]);
                setBrands(brandsRes.data?.genericQuery ?? []);
                const consume = txnRes.data?.genericQuery?.find(t => t.code === "JOB_CONSUME");
                setJobConsumeTypeId(consume?.id ?? null);
                const rawMarkup = markupRes.data?.genericQuery?.[0]?.setting_value;
                const pct = rawMarkup != null ? Number(rawMarkup) : 0;
                setMarkupPct(isNaN(pct) ? 0 : pct);
                setAdditionalChargeOptions(additionalChargesRes.data?.genericQuery ?? []);
            } catch { /* silent */ }
        };
        void fetchMeta();
    }, [dbName, schema]);

    // ── Load list ───────────────────────────────────────────────────────────
    const loadData = useCallback(async (bid: number, q: string, pg: number, divisionId: number | null = null) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bid, division_id: divisionId, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<FinalJobRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_COMPLETED_JOBS_PAGED,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_COMPLETED_JOBS_COUNT, sqlArgs: commonArgs }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(Number(countRes.data?.genericQuery?.[0]?.total ?? 0));
        } catch {
            toast.error(MESSAGES.ERROR_FINAL_JOBS_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
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
        try {
            const args = {
                branch_id: branchId,
                search:    finalizedSearchQ,
                limit:     PAGE_SIZE,
                offset:    (finalizedPage - 1) * PAGE_SIZE,
            };
            const [countRes, rowsRes] = await Promise.all([
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERABLE_JOBS_COUNT, sqlArgs: args }) },
                }),
                apolloClient.query<GenericQueryData<FinalizedJobRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERABLE_JOBS_PAGED, sqlArgs: args }) },
                }),
            ]);
            setFinalizedTotal(Number(countRes.data?.genericQuery?.[0]?.total ?? 0));
            setFinalizedRows(rowsRes.data?.genericQuery ?? []);
        } catch {
            toast.error("Failed to load finalized jobs.");
        } finally {
            setFinalizedLoading(false);
        }
    }, [branchId, dbName, schema, finalizedSearchQ, finalizedPage]);

    useEffect(() => {
        if (activeTab === "finalized" && subView === "list") void loadFinalizedData();
    }, [activeTab, subView, loadFinalizedData]);

    // ── Open Final sub-view ─────────────────────────────────────────────────
    async function handleOpenFinal(row: FinalJobRow) {
        if (!dbName || !schema) return;
        setLoadingDetail(true);
        try {
            const [jobRes, partsRes, chargesRes] = await Promise.all([
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
            ]);

            const job = jobRes.data?.genericQuery?.[0] ?? null;
            if (!job) { toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED); return; }

            const parts = partsRes.data?.genericQuery ?? [];
            const charges = chargesRes.data?.genericQuery ?? [];

            setSelectedJob(job);
            setSelectedRow(row);
            setSelectedDivisionId(row.division_id);
            setPartLines(
                parts.length > 0
                    ? parts.map(p => {
                        const gr = (p.gst_rate ?? 0) > 0 ? (p.gst_rate ?? 0) : defaultGstRate;
                        return {
                            _key: crypto.randomUUID(),
                            id: p.id,
                            brand_id: p.brand_id,
                            part_id: p.part_id,
                            part_code: p.part_code,
                            part_name: p.part_name,
                            cost_price: String(p.cost_price ?? 0),
                            selling_price: String(p.selling_price ?? 0),
                            gst_rate: String(gr),
                            sale_pr_gst: ((p.selling_price ?? 0) * (1 + gr / 100)).toFixed(2),
                            quantity: Number(p.quantity),
                            remarks: p.remarks ?? "",
                            hsn_code: p.hsn_code?.trim() || defaultHsnForSparePart,
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
                quantity: String(c.quantity ?? 1),
                cost_price: String(c.cost_price),
                selling_price: String(c.selling_price),
                sale_pr_gst: (c.selling_price * (1 + (c.gst_rate ?? 0) / 100)).toFixed(2),
            })));
            setDeletedChargeIds([]);
            setSubView("final");
        } catch {
            toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED);
        } finally {
            setLoadingDetail(false);
        }
    }

    async function handleOpenFinalForEdit(row: FinalizedJobRow) {
        setIsEditMode(true);
        await handleOpenFinal(row as unknown as FinalJobRow);
        if (!dbName || !schema) return;
        try {
            const res = await apolloClient.query<GenericQueryData<{ id: number; igst_amount: number }>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_INVOICE_BY_JOB, sqlArgs: { job_id: row.id } }) },
            });
            const inv = res.data?.genericQuery?.[0];
            setExistingInvoiceId(inv ? inv.id : null);
            if (inv) setForceIgst(Number(inv.igst_amount) > 0);
        } catch { /* leave defaults */ }
    }

    function handleBack() {
        setSubView("list");
        setSelectedJob(null);
        setSelectedRow(null);
        setSelectedDivisionId(null);
        setPartLines([]);
        setDeletedPartIds([]);
        setBackCalcTarget("");
        if (isEditMode) {
            setIsEditMode(false);
            setExistingInvoiceId(null);
            setActiveTab("finalized");
        }
    }

    async function handleSaveEdit() {
        if (!selectedJob || !dbName || !schema || !branchId) return;

        const newParts = partLines.filter(l => !l.id && l.part_id && l.quantity > 0);
        if (newParts.length > 0 && !jobConsumeTypeId) {
            toast.error("Stock transaction type not loaded. Please try again.");
            return;
        }

        setSubmitting(true);
        try {
            if (isGst) {
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
                    job_id: selectedJob.id,
                    charge_name: c.charge_name.trim(),
                    ref_no: c.ref_no.trim() || null,
                    description: c.description.trim() || null,
                    hsn_code: isGst ? (c.hsn_code.trim() || null) : null,
                    gst_rate: isGst ? (parseFloat(c.gst_rate) || 0) : 0,
                    quantity: parseFloat(c.quantity) || 1,
                    cost_price: parseFloat(c.cost_price) || 0,
                    selling_price: parseFloat(c.selling_price) || 0,
                }));

            const xDetails: Record<string, unknown>[] = [];

            const existingUpdates = partLines
                .filter(l => l.id !== undefined && l.part_id)
                .map(l => ({
                    id: l.id,
                    job_id: selectedJob.id,
                    part_id: l.part_id,
                    cost_price: parseFloat(l.cost_price) || 0,
                    selling_price: parseFloat(l.selling_price) || 0,
                    gst_rate: parseFloat(l.gst_rate) || 0,
                    quantity: l.quantity,
                    remarks: l.remarks.trim() || null,
                    hsn_code: isGst ? (l.hsn_code.trim() || null) : null,
                }));

            const newInserts = newParts.map(l => ({
                job_id: selectedJob.id,
                part_id: l.part_id,
                cost_price: parseFloat(l.cost_price) || 0,
                selling_price: parseFloat(l.selling_price) || 0,
                gst_rate: parseFloat(l.gst_rate) || 0,
                quantity: l.quantity,
                remarks: l.remarks.trim() || null,
                hsn_code: isGst ? (l.hsn_code.trim() || null) : null,
                xDetails: {
                    tableName: "stock_transaction",
                    fkeyName: "job_part_used_id",
                    xData: {
                        branch_id: branchId,
                        part_id: l.part_id,
                        quantity: l.quantity,
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

            const { invoiceHeader, invoiceLines } = computeInvoicePayload(
                partLines, chargeLines, selectedJob.job_no, isGst, forceIgst, effectiveGstStateCode
            );
            xDetails.push({
                tableName: "job_invoice",
                fkeyName: "job_id",
                ...(existingInvoiceId !== null ? { deletedIds: [existingInvoiceId] } : {}),
                xData: [{
                    ...invoiceHeader,
                    xDetails: {
                        tableName: "job_invoice_line",
                        fkeyName: "job_invoice_id",
                        xData: invoiceLines,
                    },
                }],
            });

            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: encodeObj({
                        tableName: "job",
                        xData: { id: selectedJob.id, is_final: true, division_id: selectedDivisionId },
                        xDetails,
                    }),
                },
            });

            toast.success("Finalized job updated.");
            setIsEditMode(false);
            setExistingInvoiceId(null);
            setSubView("list");
            setBackCalcTarget("");
            setActiveTab("finalized");
            void loadFinalizedData();
        } catch {
            toast.error("Failed to save. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    // ── Undo Final ──────────────────────────────────────────────────────────
    const [undoingJobId, setUndoingJobId] = useState<number | null>(null);

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
            void loadFinalizedData();
            if (branchId) void loadData(branchId, searchQ, page, currentDivision?.id ?? null);
        } catch {
            toast.error("Failed to undo final. Please try again.");
        } finally {
            setUndoingJobId(null);
        }
    }

    // ── Change division (saves to DB + refreshes job detail) ────────────────
    async function handleChangeDivision(newDivisionId: number) {
        if (!dbName || !schema || !selectedJob) return;
        await apolloClient.mutate({
            mutation: GRAPHQL_MAP.genericUpdate,
            variables: {
                db_name: dbName,
                schema,
                value: encodeObj({ tableName: "job", xData: { id: selectedJob.id, division_id: newDivisionId } }),
            },
        });
        const jobRes = await apolloClient.query<GenericQueryData<JobDetailType>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DETAIL, sqlArgs: { id: selectedJob.id } }) },
        });
        const refreshed = jobRes.data?.genericQuery?.[0];
        if (refreshed) setSelectedJob(refreshed);
        setSelectedDivisionId(newDivisionId);
        const newDivision = availableDivisions.find(d => d.id === newDivisionId) ?? null;
        const newIsGst = isGstDivision(newDivision);
        setPartLines(prev => prev.map(line => ({ ...line, ...calculateLinePricing(line, {}, newIsGst) })));
        toast.success("Division updated.");
    }

    // ── Part mutations ──────────────────────────────────────────────────────
    function addPartLine() {
        setPartLines(prev => [...prev, emptyPartLine(isGst ? defaultGstRate : 0, defaultHsnForSparePart)]);
    }

    function removePartLine(key: string, id?: number) {
        setPartLines(prev => prev.filter(l => l._key !== key));
        if (id !== undefined) setDeletedPartIds(prev => [...prev, id]);
    }

    function updatePartLine(key: string, patch: Partial<EditablePartLine>) {
        setPartLines(prev => prev.map(l => l._key === key ? { ...l, ...patch } : l));
    }

    function handlePartSelect(key: string, part: PartRow) {
        const pricePatch = computePartPricesOnSelect(part, isGst, forceGstOnPartsForNonGst, defaultGstRate, markupPct);
        updatePartLine(key, {
            part_id: part.id,
            part_code: part.part_code,
            part_name: part.part_name,
            brand_id: part.brand_id,
            hsn_code: part.hsn_code?.trim() || defaultHsnForSparePart,
            ...pricePatch,
        });
    }

    // ── Charge mutations ────────────────────────────────────────────────────
    function addChargeLine() {
        setChargeLines(prev => [...prev, emptyChargeLine(isGst ? defaultGstRate : 0, defaultHsnForServiceCharge)]);
    }

    function removeChargeLine(key: string, id?: number) {
        setChargeLines(prev => prev.filter(c => c._key !== key));
        if (id !== undefined) setDeletedChargeIds(prev => [...prev, id]);
    }

    function updateChargeLine(key: string, field: keyof EditableChargeLine, value: string) {
        setChargeLines(prev => prev.map(c => c._key === key ? { ...c, [field]: value } : c));
    }

    function patchChargeLine(key: string, patch: Partial<EditableChargeLine>) {
        setChargeLines(prev => prev.map(c => c._key === key ? { ...c, ...patch } : c));
    }

    // ── Save final ──────────────────────────────────────────────────────────
    async function handleSaveFinal() {
        if (!selectedJob || !dbName || !schema || !branchId) return;

        const newParts = partLines.filter(l => !l.id && l.part_id && l.quantity > 0);
        if (newParts.length > 0 && !jobConsumeTypeId) {
            toast.error("Stock transaction type not loaded. Please try again.");
            return;
        }

        setSubmitting(true);
        try {
            if (isGst) {
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
                    job_id: selectedJob.id,
                    charge_name: c.charge_name.trim(),
                    ref_no: c.ref_no.trim() || null,
                    description: c.description.trim() || null,
                    hsn_code: isGst ? (c.hsn_code.trim() || null) : null,
                    gst_rate: isGst ? (parseFloat(c.gst_rate) || 0) : 0,
                    quantity: parseFloat(c.quantity) || 1,
                    cost_price: parseFloat(c.cost_price) || 0,
                    selling_price: parseFloat(c.selling_price) || 0,
                }));

            const xDetails: Record<string, unknown>[] = [];

            // Existing part updates (have id)
            const existingUpdates = partLines
                .filter(l => l.id !== undefined && l.part_id)
                .map(l => ({
                    id: l.id,
                    job_id: selectedJob.id,
                    part_id: l.part_id,
                    cost_price: parseFloat(l.cost_price) || 0,
                    selling_price: parseFloat(l.selling_price) || 0,
                    gst_rate: parseFloat(l.gst_rate) || 0,
                    quantity: l.quantity,
                    remarks: l.remarks.trim() || null,
                    hsn_code: isGst ? (l.hsn_code.trim() || null) : null,
                }));

            // New part inserts (no id, valid part_id) with stock transactions
            const newInserts = newParts.map(l => ({
                job_id: selectedJob.id,
                part_id: l.part_id,
                cost_price: parseFloat(l.cost_price) || 0,
                selling_price: parseFloat(l.selling_price) || 0,
                gst_rate: parseFloat(l.gst_rate) || 0,
                quantity: l.quantity,
                remarks: l.remarks.trim() || null,
                hsn_code: isGst ? (l.hsn_code.trim() || null) : null,
                xDetails: {
                    tableName: "stock_transaction",
                    fkeyName: "job_part_used_id",
                    xData: {
                        branch_id: branchId,
                        part_id: l.part_id,
                        quantity: l.quantity,
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

            const { invoiceHeader, invoiceLines } = computeInvoicePayload(
                partLines, chargeLines, selectedJob.job_no, isGst, forceIgst, effectiveGstStateCode
            );
            xDetails.push({
                tableName: "job_invoice",
                fkeyName: "job_id",
                xData: [{
                    ...invoiceHeader,
                    xDetails: {
                        tableName: "job_invoice_line",
                        fkeyName: "job_invoice_id",
                        xData: invoiceLines,
                    },
                }],
            });

            // await apolloClient.mutate({
            //     mutation: GRAPHQL_MAP.genericUpdate,
            //     variables: {
            //         db_name: dbName,
            //         schema,
            //         value: encodeObj({
            //             tableName: "job",
            //             xData: { id: selectedJob.id, is_final: true, division_id: selectedDivisionId },
            //             xDetails,
            //         }),
            //     },
            // });
            console.log("xDetails", JSON.stringify(xDetails));

            toast.success("Job marked as final and invoice created.");
            handleBack();
            if (branchId) void loadData(branchId, searchQ, page, currentDivision?.id ?? null);
        } catch {
            toast.error("Failed to save. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ─── Final sub-view ───────────────────────────────────────────────────────

    if (subView === "final" && selectedJob && selectedRow) {
        return (
            <FinalJobForm
                selectedJob={selectedJob}
                selectedRow={selectedRow}
                isEditMode={isEditMode}
                submitting={submitting}
                loadingDetail={loadingDetail}
                changeDivOpen={changeDivOpen}
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
                defaultHsnForSparePart={defaultHsnForSparePart}
                defaultHsnForServiceCharge={defaultHsnForServiceCharge}
                viewJobId={viewJobId}
                setForceIgst={setForceIgst}
                setBackCalcTarget={setBackCalcTarget}
                setChangeDivOpen={setChangeDivOpen}
                setChargeLines={setChargeLines}
                setPartLines={setPartLines}
                setViewJobId={setViewJobId}
                onBack={handleBack}
                onSave={isEditMode ? handleSaveEdit : handleSaveFinal}
                onRefresh={() => handleOpenFinal(selectedRow)}
                onAddPart={addPartLine}
                onRemovePart={removePartLine}
                onUpdatePart={updatePartLine}
                onPartSelect={handlePartSelect}
                onAddCharge={addChargeLine}
                onRemoveCharge={removeChargeLine}
                onUpdateCharge={updateChargeLine}
                onPatchCharge={patchChargeLine}
                onChangeDivision={handleChangeDivision}
            />
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
                            className={`h-9 gap-2 px-4 text-sm transition-transform duration-200 rounded-lg border-0 ${
                                activeTab === "pending"
                                    ? "bg-emerald-600 text-white font-bold shadow-lg scale-105 hover:brightness-110"
                                    : "bg-transparent text-(--cl-text-muted) hover:text-white hover:bg-emerald-600 hover:scale-105 font-semibold"
                            }`}
                            size="sm"
                            onClick={() => setActiveTab("pending")}
                        >
                            Final a Job
                        </Button>
                        <Button
                            className={`h-9 gap-2 px-4 text-sm transition-transform duration-200 rounded-lg border-0 ${
                                activeTab === "finalized"
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
                    rows={finalizedRows}
                    loading={finalizedLoading}
                    total={finalizedTotal}
                    page={finalizedPage}
                    setPage={setFinalizedPage}
                    search={finalizedSearch}
                    branchId={branchId}
                    availableDivisions={availableDivisions}
                    loadingDetail={loadingDetail}
                    undoingJobId={undoingJobId}
                    onSearchChange={handleFinalizedSearchChange}
                    onRefresh={() => void loadFinalizedData()}
                    onViewJob={id => setViewJobId(id)}
                    onEdit={row => void handleOpenFinalForEdit(row)}
                    onUndo={row => void handleUndoFinal(row)}
                    onOpenAttach={(id, jobNo) => { setAttachSource("finalized"); setAttachJobId(id); setAttachJobNo(jobNo); }}
                />
                )}
            </motion.div>

            {viewJobId !== null && (
                <JobDetailsModal
                    jobId={viewJobId}
                    onClose={() => {
                        setViewJobId(null);
                        if (activeTab === "finalized") {
                            void loadFinalizedData();
                        } else if (branchId) {
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
        </>
    );
};
