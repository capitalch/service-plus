import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES }    from "@/constants/messages";
import { SQL_MAP }     from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { isValidGstin, normalizeGstin, saveCustomerGstin } from "@/lib/gstin";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectAvailableDivisions, selectCurrentBranch, selectDefaultGstRate, selectDefaultHsnForSparePart, selectDefaultHsnForServiceCharge, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import type { JobDetailType } from "@/features/client/types/job";
import { isGstDivision } from "@/features/client/types/division";
import type { BrandOption } from "@/features/client/types/model";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { PartRow } from "../../inventory/part-code-input";

import {
    type FinalJobRow,
    type EditablePartLine,
    type EditableChargeLine,
    type AdditionalChargeMasterRow,
    emptyChargeLine,
} from "../final-a-job/final-a-job-schema";
import { FinalJobForm } from "../final-a-job/final-job-form";

// ─── Local types ──────────────────────────────────────────────────────────────

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

// ─── Private helpers (mirror of final-a-job-section.tsx) ──────────────────────

function emptyPartLine(gstRate = 0, hsn = ""): EditablePartLine {
    return { _key: crypto.randomUUID(), brand_id: null, part_id: null, part_code: "", part_name: "", cost_price: "0", selling_price: "0", sale_pr_gst: "0", gst_rate: String(gstRate), qty: 1, remarks: "", hsn_code: hsn, master_cost_price: 0, master_selling_price: 0, master_gst_rate: 0 };
}

function applyMarkup(cost: number, markupPct: number): number {
    return Math.round(cost * (1 + markupPct / 100) * 100) / 100;
}

function computePartPricesOnSelect(
    part: PartRow,
    isGst: boolean,
    inflateCostForNonGst: boolean,
    defaultGstRate: number,
    markupPct: number,
    currentCostPrice = 0,
    currentSellingPrice = 0,
): Pick<EditablePartLine, "cost_price" | "selling_price" | "sale_pr_gst" | "gst_rate"> {
    const dbcp = part.cost_price ?? 0;
    const effectiveGstRate = (part.gst_rate ?? 0) > 0 ? (part.gst_rate ?? 0) : defaultGstRate;
    let cp: number;
    if (!isGst && inflateCostForNonGst) {
        cp = dbcp > 0 ? dbcp * (1 + effectiveGstRate / 100) : currentCostPrice;
    } else {
        cp = dbcp > 0 ? dbcp : currentCostPrice;
    }
    const sp = currentSellingPrice > 0 ? currentSellingPrice : applyMarkup(cp, markupPct);
    return {
        cost_price:    cp.toFixed(2),
        selling_price: sp.toFixed(2),
        gst_rate:      String(effectiveGstRate),
        sale_pr_gst:   (isGst ? sp * (1 + effectiveGstRate / 100) : sp).toFixed(2),
    };
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
    jobId:       number;
    onClose:     () => void;
    onFinalized: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function FinalJobDialog({ jobId, onClose, onFinalized }: Props) {
    const dbName                  = useAppSelector(selectDbName);
    const schema                  = useAppSelector(selectSchema);
    const currentBranch           = useAppSelector(selectCurrentBranch);
    const availableDivisions      = useAppSelector(selectAvailableDivisions);
    const defaultGstRate          = useAppSelector(selectDefaultGstRate);
    const defaultHsnForSparePart  = useAppSelector(selectDefaultHsnForSparePart);
    const defaultHsnForServiceCharge = useAppSelector(selectDefaultHsnForServiceCharge);
    const branchId = currentBranch?.id ?? null;

    // ── Form state ────────────────────────────────────────────────────────────

    const [selectedJob,         setSelectedJob]         = useState<JobDetailType | null>(null);
    const [selectedRow,         setSelectedRow]         = useState<FinalJobRow | null>(null);
    const [receivedTotal,       setReceivedTotal]       = useState(0);
    const [selectedDivisionId,  setSelectedDivisionId]  = useState<number | null>(null);
    const [loading,             setLoading]             = useState(true);
    const [submitting,          setSubmitting]          = useState(false);

    const [partLines,           setPartLines]           = useState<EditablePartLine[]>([]);
    const [deletedPartIds,      setDeletedPartIds]      = useState<number[]>([]);
    const [chargeLines,         setChargeLines]         = useState<EditableChargeLine[]>([]);
    const [deletedChargeIds,    setDeletedChargeIds]    = useState<number[]>([]);

    const [brands,                   setBrands]                   = useState<BrandOption[]>([]);
    const [additionalChargeOptions,  setAdditionalChargeOptions]  = useState<AdditionalChargeMasterRow[]>([]);
    const [jobConsumeTypeId,         setJobConsumeTypeId]         = useState<number | null>(null);
    const [markupPct,                setMarkupPct]                = useState(0);

    const [forceIgst,           setForceIgst]           = useState(false);
    const [backCalcTarget,      setBackCalcTarget]      = useState("");
    const [showPartsInInvoice,  setShowPartsInInvoice]  = useState(true);
    const [gstin,               setGstin]               = useState("");
    const [viewJobId,           setViewJobId]           = useState<number | null>(null);
    const [diffAlertMsg,        setDiffAlertMsg]        = useState<string | null>(null);

    const division = availableDivisions.find(d => d.id === selectedDivisionId) ?? null;
    const isGst    = isGstDivision(division);

    // ── Load meta once ────────────────────────────────────────────────────────

    useEffect(() => {
        if (!dbName || !schema) return;
        const gq = <T,>(sqlId: string, sqlArgs?: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<T>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }) },
            });
        void Promise.all([
            gq<BrandOption>(SQL_MAP.GET_ALL_BRANDS),
            gq<StockTransactionTypeRow>(SQL_MAP.GET_STOCK_TRANSACTION_TYPES),
            gq<{ setting_value: unknown }>(SQL_MAP.GET_APP_SETTING_BY_KEY, { setting_key: "markup_percent_over_cost" }),
            gq<AdditionalChargeMasterRow>(SQL_MAP.GET_ALL_ADDITIONAL_CHARGES),
            gq<{ setting_value: unknown }>(SQL_MAP.GET_APP_SETTING_BY_KEY, { setting_key: "show_parts_in_job_invoice" }),
        ]).then(([brandsRes, txnRes, markupRes, chargesRes, showPartsRes]) => {
            setBrands(brandsRes.data?.genericQuery ?? []);
            const consume = txnRes.data?.genericQuery?.find(t => t.code === "CONSUMPTION");
            setJobConsumeTypeId(consume?.id ?? null);
            const rawMarkup = markupRes.data?.genericQuery?.[0]?.setting_value;
            const pct = rawMarkup != null ? Number(rawMarkup) : 0;
            setMarkupPct(isNaN(pct) ? 0 : pct);
            setAdditionalChargeOptions(chargesRes.data?.genericQuery ?? []);
            const rawShowParts = showPartsRes.data?.genericQuery?.[0]?.setting_value;
            const showPartsObj = rawShowParts != null && typeof rawShowParts === "object"
                ? (rawShowParts as { show?: boolean }) : null;
            setShowPartsInInvoice(showPartsObj?.show !== false);
        }).catch(() => { /* silent — non-critical meta */ });
    }, [dbName, schema]);

    // ── Load job data ─────────────────────────────────────────────────────────

    const loadJobData = async () => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const gq = <T,>(sqlId: string, sqlArgs?: Record<string, unknown>) =>
                apolloClient.query<GenericQueryData<T>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }) },
                });
            const [jobRes, partsRes, chargesRes, paymentsRes] = await Promise.all([
                gq<JobDetailType>(SQL_MAP.GET_JOB_DETAIL, { id: jobId }),
                gq<LoadedPartRow>(SQL_MAP.GET_JOB_PART_USED_BY_JOB, { job_id: jobId }),
                gq<AdditionalChargeRow>(SQL_MAP.GET_JOB_ADDITIONAL_CHARGES_BY_JOB, { job_id: jobId }),
                gq<{ amount: number }>(SQL_MAP.GET_JOB_PAYMENTS_BY_JOB, { job_id: jobId }),
            ]);
            const job     = jobRes.data?.genericQuery?.[0] ?? null;
            if (!job) { toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED); onClose(); return; }
            const parts   = partsRes.data?.genericQuery ?? [];
            const charges = chargesRes.data?.genericQuery ?? [];
            setReceivedTotal((paymentsRes.data?.genericQuery ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0));

            const loadedDivision = availableDivisions.find(d => d.id === job.division_id) ?? null;
            const loadedIsGst    = isGstDivision(loadedDivision);

            setSelectedJob(job);
            setSelectedRow({
                id:               job.id,
                job_no:           job.job_no,
                alternate_job_no: job.alternate_job_no,
                is_opening_job:   job.is_opening_job,
                purchase_date:    job.purchase_date,
                job_date:         job.job_date,
                job_type_name:    "",
                job_type_code:    "",
                customer_name:    job.customer_name ?? "",
                customer_gstin:   job.customer_gstin ?? null,
                mobile:           job.mobile,
                device_details:   [job.product_name, job.brand_name, job.model_name, job.serial_no].filter(Boolean).join(" ") || null,
                serial_no:        job.serial_no,
                batch_no:         null,
                amount:           job.amount,
                is_closed:        job.is_closed,
                is_final:         job.is_final,
                technician_name:  job.technician_name,
                division_id:      job.division_id,
                file_count:       0,
            });
            setForceIgst(job.is_igst ?? false);
            setShowPartsInInvoice(job.to_show_parts_in_job_invoice ?? true);
            setGstin(normalizeGstin(job.customer_gstin));
            setSelectedDivisionId(job.division_id);
            setPartLines(parts.length > 0
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
                : []
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
        } catch {
            toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void loadJobData(); }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Helpers ───────────────────────────────────────────────────────────────

    function resyncTarget(parts: EditablePartLine[], charges: EditableChargeLine[]) {
        const total =
            parts.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0) +
            charges.reduce((s, c) => s + (parseFloat(c.sale_pr_gst) || 0) * (parseFloat(c.qty) || 1), 0);
        setBackCalcTarget(total > 0 ? total.toFixed(2) : "");
    }

    // ── Part handlers ─────────────────────────────────────────────────────────

    function addPartLine() {
        setPartLines(prev => [...prev, emptyPartLine(isGst ? defaultGstRate : 0, defaultHsnForSparePart)]);
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

    function handleCostChange(key: string, value: string) {
        const isWarrantyJob = selectedRow?.job_type_code === "UNDER_WARRANTY";
        const cp = parseFloat(value) || 0;
        const next = partLines.map(l => {
            if (l._key !== key) return l;
            const sp   = isWarrantyJob ? (parseFloat(l.selling_price) || 0) : applyMarkup(cp, markupPct);
            const rate = isGst ? (parseFloat(l.gst_rate) || 0) : 0;
            return { ...l, cost_price: value, selling_price: sp.toFixed(2), sale_pr_gst: (sp * (1 + rate / 100)).toFixed(2) };
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

    // ── Charge handlers ───────────────────────────────────────────────────────

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

    // ── Division change ───────────────────────────────────────────────────────

    async function handleDivisionChange(newDivisionId: number) {
        setSelectedDivisionId(newDivisionId);
        const newDivision = availableDivisions.find(d => d.id === newDivisionId) ?? null;
        const newIsGst    = isGstDivision(newDivision);
        const gstStatusChanged = newIsGst !== isGst;

        const newPartLines = partLines.map(line => {
            if (line.part_id === null) return line;
            const syntheticPart = {
                id: line.part_id, brand_id: line.brand_id ?? 0,
                part_code: line.part_code, part_name: line.part_name,
                cost_price: line.master_cost_price, selling_price: line.master_selling_price,
                gst_rate: line.master_gst_rate, hsn_code: line.hsn_code || null,
                part_description: null, category: null, model: null,
                uom: "", mrp: null, is_active: true, brand_name: "",
            } satisfies PartRow;
            const pricePatch = computePartPricesOnSelect(syntheticPart, newIsGst, !newIsGst, defaultGstRate, markupPct, 0, 0);
            const effectiveHsn = newIsGst ? (line.hsn_code.trim() || defaultHsnForSparePart) : line.hsn_code;
            return { ...line, ...pricePatch, hsn_code: effectiveHsn };
        });

        const newChargeLines = chargeLines.map(c => {
            const sp = parseFloat(c.selling_price) || 0;
            if (newIsGst) {
                const gstRate  = parseFloat(c.gst_rate) > 0 ? parseFloat(c.gst_rate) : defaultGstRate;
                const hsn_code = c.hsn_code.trim() || defaultHsnForServiceCharge;
                return { ...c, gst_rate: String(gstRate), hsn_code, sale_pr_gst: (sp * (1 + gstRate / 100)).toFixed(2) };
            }
            return { ...c, gst_rate: "0", sale_pr_gst: sp.toFixed(2) };
        });

        setPartLines(newPartLines);
        setChargeLines(newChargeLines);
        resyncTarget(newPartLines, newChargeLines);
        setForceIgst(false);

        if (!gstStatusChanged || !selectedJob || !dbName || !schema) return;
        const partsToUpdate   = newPartLines.filter(p => p.id !== undefined);
        const chargesToUpdate = newChargeLines.filter(c => c.id !== undefined);
        if (partsToUpdate.length === 0 && chargesToUpdate.length === 0) return;

        const xDetails: object[] = [];
        if (partsToUpdate.length > 0) {
            xDetails.push({ tableName: "job_part_used", fkeyName: "job_id",
                xData: partsToUpdate.map(p => ({ id: p.id, gst_rate: parseFloat(p.gst_rate) || 0, hsn_code: p.hsn_code, cost_price: parseFloat(p.cost_price) || 0, selling_price: parseFloat(p.selling_price) || 0 })) });
        }
        if (chargesToUpdate.length > 0) {
            xDetails.push({ tableName: "job_additional_charge", fkeyName: "job_id",
                xData: chargesToUpdate.map(c => ({ id: c.id, gst_rate: parseFloat(c.gst_rate) || 0, hsn_code: c.hsn_code, selling_price: parseFloat(c.selling_price) || 0 })) });
        }
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: encodeObj({ tableName: "job", xData: { id: selectedJob.id, division_id: newDivisionId, to_set_updated_at: true, xDetails } }) },
            });
        } catch { /* best-effort — don't toast, user is still editing */ }
    }

    // ── Reset prices ──────────────────────────────────────────────────────────

    function handleReset() {
        setPartLines(prev => prev.map(line => {
            if (line.part_id === null) return line;
            const syntheticPart = {
                id: line.part_id, brand_id: line.brand_id ?? 0,
                part_code: line.part_code, part_name: line.part_name,
                part_description: null, category: null, model: null,
                uom: "", mrp: null, is_active: true, brand_name: "",
                cost_price:    line.master_cost_price,
                selling_price: line.master_selling_price,
                gst_rate:      line.master_gst_rate,
                hsn_code:      line.hsn_code || null,
            } satisfies PartRow;
            const pricePatch = computePartPricesOnSelect(syntheticPart, isGst, !isGst, defaultGstRate, markupPct, 0, 0);
            return { ...line, ...pricePatch };
        }));
        setChargeLines(prev => prev.map(c => {
            if (!c.charge_name.trim()) return c;
            const gstRate = isGst ? defaultGstRate : 0;
            const sp = parseFloat(c.selling_price) || 0;
            return { ...c, gst_rate: String(gstRate), hsn_code: c.hsn_code.trim() || defaultHsnForServiceCharge, sale_pr_gst: (sp * (1 + gstRate / 100)).toFixed(2) };
        }));
    }

    // ── Save final ────────────────────────────────────────────────────────────

    async function handleSaveFinal(force = false) {
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
            toast.error("Target amount cannot be set without any parts or charges.");
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
                const missingHsnParts   = partLines.filter(l => l.part_id && !l.hsn_code.trim()).length;
                const missingHsnCharges = chargeLines.filter(c => c.charge_name.trim() && !c.hsn_code.trim()).length;
                if (missingHsnParts > 0 || missingHsnCharges > 0) {
                    toast.error("HSN is required for all parts and charges in a GST invoice.");
                    return;
                }
                const missingGstParts   = partLines.filter(l => l.part_id && !(parseFloat(l.gst_rate) > 0)).length;
                const missingGstCharges = chargeLines.filter(c => c.charge_name.trim() && !(parseFloat(c.gst_rate) > 0)).length;
                if (missingGstParts > 0 || missingGstCharges > 0) {
                    toast.error("GST rate must be greater than 0 for all parts and charges in a GST invoice.");
                    return;
                }
            }

            const invalidParts = partLines.some(l => l.part_id
                && (l.qty <= 0 || (parseFloat(l.cost_price) || 0) < 0 || (parseFloat(l.selling_price) || 0) < 0));
            const invalidCharges = chargeLines.some(c => c.charge_name.trim()
                && ((parseFloat(c.qty) || 0) <= 0 || (parseFloat(c.cost_price) || 0) < 0 || (parseFloat(c.selling_price) || 0) < 0));
            if (invalidParts || invalidCharges) {
                toast.error("Qty must be greater than 0 and Cost/Sale prices cannot be negative. Please fix the highlighted rows before finalizing.");
                return;
            }

            const chargeUpsertRows = chargeLines.filter(c => c.charge_name.trim()).map(c => ({
                ...(c.id !== undefined ? { id: c.id } : {}),
                charge_name:   c.charge_name.trim(),
                ref_no:        c.ref_no.trim()        || null,
                description:   c.description.trim()   || null,
                hsn_code:      (isGst && !isWarrantyJob) ? (c.hsn_code.trim() || null) : null,
                gst_rate:      !isWarrantyJob ? (parseFloat(c.gst_rate) || 0) : 0,
                qty:           parseFloat(c.qty) || 1,
                cost_price:    parseFloat(c.cost_price) || 0,
                selling_price: isWarrantyJob ? 0 : (parseFloat(c.selling_price) || 0),
            }));

            const xDetails: Record<string, unknown>[] = [];
            const existingUpdates = partLines.filter(l => l.id !== undefined && l.part_id).map(l => ({
                id: l.id, part_id: l.part_id,
                cost_price:    parseFloat(l.cost_price)    || 0,
                selling_price: isWarrantyJob ? 0 : (parseFloat(l.selling_price) || 0),
                gst_rate:      !isWarrantyJob ? (parseFloat(l.gst_rate) || 0) : 0,
                qty:     l.qty,
                remarks: l.remarks.trim() || null,
                hsn_code: (isGst && !isWarrantyJob) ? (l.hsn_code.trim() || null) : null,
            }));
            const newInserts = newParts.map(l => ({
                part_id: l.part_id,
                cost_price:    parseFloat(l.cost_price)    || 0,
                selling_price: isWarrantyJob ? 0 : (parseFloat(l.selling_price) || 0),
                gst_rate:      !isWarrantyJob ? (parseFloat(l.gst_rate) || 0) : 0,
                qty:     l.qty,
                remarks: l.remarks.trim() || null,
                hsn_code: (isGst && !isWarrantyJob) ? (l.hsn_code.trim() || null) : null,
                xDetails: {
                    tableName: "stock_transaction",
                    fkeyName:  "job_part_used_id",
                    xData: {
                        branch_id: branchId,
                        part_id:   l.part_id,
                        qty:       l.qty,
                        dr_cr:     "C",
                        transaction_date:         selectedJob.job_date,
                        stock_transaction_type_id: jobConsumeTypeId,
                        remarks: l.remarks.trim() || null,
                    },
                },
            }));

            const allPartXData = [...existingUpdates, ...newInserts];
            if (allPartXData.length > 0 || deletedPartIds.length > 0) {
                xDetails.push({
                    tableName: "job_part_used",
                    fkeyName:  "job_id",
                    ...(deletedPartIds.length > 0 ? { deletedIds: deletedPartIds } : {}),
                    xData: allPartXData,
                });
            }
            xDetails.push({
                tableName: "job_additional_charge",
                fkeyName:  "job_id",
                ...(deletedChargeIds.length > 0 ? { deletedIds: deletedChargeIds } : {}),
                xData: chargeUpsertRows,
            });

            const backCalcNum    = parseFloat(backCalcTarget);
            const hasTarget      = backCalcTarget !== "" && !isNaN(backCalcNum) && backCalcNum > 0;
            const computedTotal  =
                partLines.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0) +
                chargeLines.reduce((s, c) => s + (parseFloat(c.sale_pr_gst) || 0) * (parseFloat(c.qty) || 1), 0);
            // The job is always saved with the true achieved line total — not the
            // aspirational Apply target, which may be unreachable (e.g. part
            // selling prices are floored at cost and can't be discounted further).
            const amount = isWarrantyJob ? 0 : computedTotal;

            if (!isWarrantyJob && !force && hasTarget) {
                const diff = Math.abs(backCalcNum - computedTotal);
                if (diff > 0.5) {
                    setDiffAlertMsg(
                        `Your target amount (₹${backCalcNum.toFixed(2)}) differs from the achievable line total (₹${computedTotal.toFixed(2)}) by ₹${diff.toFixed(2)}. This usually happens because part selling prices can't be discounted below their cost price. Saving will use the achievable total of ₹${computedTotal.toFixed(2)}.`
                    );
                    setSubmitting(false);
                    return;
                }
            }

            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName, schema,
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
            onFinalized();
        } catch {
            toast.error("Failed to save. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading || !selectedJob || !selectedRow) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-3 p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-(--cl-accent)" />
                    <span className="text-sm text-(--cl-text-muted)">Loading job…</span>
                </div>
            </div>
        );
    }

    return (
        <>
            <Dialog open={diffAlertMsg !== null} onOpenChange={open => { if (!open) setDiffAlertMsg(null); }}>
                <DialogContent aria-describedby={undefined} className="sm:max-w-md !bg-white text-(--cl-text)">
                    <DialogHeader>
                        <DialogTitle className="text-amber-600">Target Amount Not Fully Achievable</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-(--cl-text) leading-relaxed">{diffAlertMsg}</p>
                    <DialogFooter>
                        <Button className="cursor-pointer" variant="outline" onClick={() => setDiffAlertMsg(null)}>Cancel</Button>
                        <Button
                            className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => { setDiffAlertMsg(null); void handleSaveFinal(true); }}
                        >
                            Save Anyway
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <FinalJobForm
                selectedJob={selectedJob}
                selectedRow={selectedRow}
                receivedTotal={receivedTotal}
                submitting={submitting}
                loadingDetail={false}
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
                setBackCalcTarget={setBackCalcTarget}
                setShowPartsInInvoice={setShowPartsInInvoice}
                setGstin={setGstin}
                setChargeLines={setChargeLines as Dispatch<SetStateAction<EditableChargeLine[]>>}
                setPartLines={setPartLines as Dispatch<SetStateAction<EditablePartLine[]>>}
                setViewJobId={setViewJobId}
                onBack={onClose}
                onSave={handleSaveFinal}
                onRefresh={loadJobData}
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
                onDivisionChange={id => void handleDivisionChange(id)}
            />
        </>
    );
}
