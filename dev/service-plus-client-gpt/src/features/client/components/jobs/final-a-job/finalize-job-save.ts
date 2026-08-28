import { toast } from "sonner";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";
import { isValidGstin, saveCustomerGstin } from "@/lib/gstin";
import type { JobDetailType } from "@/features/client/types/job";

import type { EditablePartLine, EditableChargeLine, FinalJobRow } from "./final-a-job-schema";

export type FinalizeJobSaveArgs = {
    selectedJob:        JobDetailType;
    selectedRow:        FinalJobRow;
    dbName:             string | null;
    schema:             string | null;
    branchId:           number | null;
    selectedDivisionId: number | null;
    isGst:              boolean;
    forceIgst:          boolean;
    gstin:              string;
    showPartsInInvoice: boolean;
    partLines:          EditablePartLine[];
    chargeLines:        EditableChargeLine[];
    deletedPartIds:     number[];
    deletedChargeIds:   number[];
    jobConsumeTypeId:   number | null;
    backCalcTarget:     string;
    setSubmitting:      (v: boolean) => void;
    setDiffAlertMsg:    (v: string | null) => void;
};

/**
 * Shared "Final a Job" save routine, used by both the Final-a-Job section and the
 * Job Control finalize dialog. Runs all validation, builds the job/parts/charges
 * mutation (with stock transactions for new parts), enforces the target-vs-line
 * hard block (diff > ₹0.02), persists the job, and saves the customer GSTIN.
 *
 * Returns `true` if the job was saved, `false` if it was blocked (validation or
 * the diff guard) or errored. Callers own their post-save side effects.
 */
export async function finalizeJobSave(args: FinalizeJobSaveArgs): Promise<boolean> {
    const {
        selectedJob, selectedRow, dbName, schema, branchId, selectedDivisionId,
        isGst, forceIgst, gstin, showPartsInInvoice, partLines, chargeLines,
        deletedPartIds, deletedChargeIds, jobConsumeTypeId, backCalcTarget,
        setSubmitting, setDiffAlertMsg,
    } = args;

    if (!selectedJob || !dbName || !schema || !branchId) return false;

    const newParts = partLines.filter(l => !l.id && l.part_id && l.qty > 0);
    if (newParts.length > 0 && !jobConsumeTypeId) {
        toast.error("Stock transaction type not loaded. Please try again.");
        return false;
    }

    const backCalcNumFinal = parseFloat(backCalcTarget);
    const hasTargetFinal   = backCalcTarget !== "" && !isNaN(backCalcNumFinal) && backCalcNumFinal > 0;
    const hasLinesFinal    = partLines.some(l => l.part_id) || chargeLines.some(c => c.charge_name.trim());
    if (hasTargetFinal && !hasLinesFinal) {
        toast.error("Target amount cannot be set without any parts or charges. Please add at least one part or charge, or clear the target amount.");
        return false;
    }

    if (!isValidGstin(gstin)) {
        toast.error("Enter a valid 15-character GSTIN, or clear the field, before finalizing.");
        return false;
    }

    const isWarrantyJob = selectedRow?.job_type_code === "UNDER_WARRANTY";
    setSubmitting(true);
    try {
        if (isGst && !isWarrantyJob) {
            const missingHsnParts   = partLines.filter(l => l.part_id && !l.hsn_code.trim()).length;
            const missingHsnCharges = chargeLines.filter(c => c.charge_name.trim() && !c.hsn_code.trim()).length;
            if (missingHsnParts > 0 || missingHsnCharges > 0) {
                toast.error("HSN is required for all parts and charges in a GST invoice.");
                return false;
            }
            const missingGstParts   = partLines.filter(l => l.part_id && !(parseFloat(l.gst_rate) > 0)).length;
            const missingGstCharges = chargeLines.filter(c => c.charge_name.trim() && !(parseFloat(c.gst_rate) > 0)).length;
            if (missingGstParts > 0 || missingGstCharges > 0) {
                toast.error("GST rate must be greater than 0 for all parts and charges in a GST invoice.");
                return false;
            }
        }

        const invalidParts = partLines.some(l => l.part_id
            && (l.qty <= 0 || (parseFloat(l.cost_price) || 0) < 0 || (parseFloat(l.selling_price) || 0) < 0));
        const invalidCharges = chargeLines.some(c => c.charge_name.trim()
            && ((parseFloat(c.qty) || 0) <= 0 || (parseFloat(c.cost_price) || 0) < 0 || (parseFloat(c.selling_price) || 0) < 0));
        if (invalidParts || invalidCharges) {
            toast.error("Qty must be greater than 0 and Cost/Sale prices cannot be negative. Please fix the highlighted rows before finalizing.");
            return false;
        }

        const chargeUpsertRows = chargeLines
            .filter(c => c.charge_name.trim())
            .map(c => ({
                ...(c.id !== undefined ? { id: c.id } : {}),
                charge_name:   c.charge_name.trim(),
                ref_no:        c.ref_no.trim()      || null,
                description:   c.description.trim() || null,
                hsn_code:      (isGst && !isWarrantyJob) ? (c.hsn_code.trim() || null) : null,
                gst_rate:      !isWarrantyJob ? (parseFloat(c.gst_rate) || 0) : 0,
                qty:           parseFloat(c.qty) || 1,
                cost_price:    parseFloat(c.cost_price) || 0,
                selling_price: isWarrantyJob ? 0 : (parseFloat(c.selling_price) || 0),
            }));

        const xDetails: Record<string, unknown>[] = [];

        const existingUpdates = partLines
            .filter(l => l.id !== undefined && l.part_id)
            .map(l => ({
                id: l.id,
                part_id: l.part_id,
                cost_price:    parseFloat(l.cost_price) || 0,
                selling_price: isWarrantyJob ? 0 : (parseFloat(l.selling_price) || 0),
                gst_rate:      !isWarrantyJob ? (parseFloat(l.gst_rate) || 0) : 0,
                qty:      l.qty,
                remarks:  l.remarks.trim() || null,
                hsn_code: (isGst && !isWarrantyJob) ? (l.hsn_code.trim() || null) : null,
            }));

        const newInserts = newParts.map(l => ({
            part_id: l.part_id,
            cost_price:    parseFloat(l.cost_price) || 0,
            selling_price: isWarrantyJob ? 0 : (parseFloat(l.selling_price) || 0),
            gst_rate:      !isWarrantyJob ? (parseFloat(l.gst_rate) || 0) : 0,
            qty:      l.qty,
            remarks:  l.remarks.trim() || null,
            hsn_code: (isGst && !isWarrantyJob) ? (l.hsn_code.trim() || null) : null,
            xDetails: {
                tableName: "stock_transaction",
                fkeyName:  "job_part_used_id",
                xData: {
                    branch_id: branchId,
                    part_id:   l.part_id,
                    qty:       l.qty,
                    dr_cr:     "C",
                    transaction_date:          selectedJob.job_date,
                    stock_transaction_type_id: jobConsumeTypeId,
                    remarks:   l.remarks.trim() || null,
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

        const backCalcNum   = parseFloat(backCalcTarget);
        const hasTarget     = backCalcTarget !== "" && !isNaN(backCalcNum) && backCalcNum > 0;
        const computedTotal =
            partLines.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0) +
            chargeLines.reduce((s, c) => s + (parseFloat(c.sale_pr_gst) || 0) * (parseFloat(c.qty) || 1), 0);
        // The job is always saved with the true achieved line total — not the
        // aspirational Apply target, which may be unreachable (e.g. part selling
        // prices are floored at cost and can't be discounted further).
        const amount = isWarrantyJob ? 0 : computedTotal;

        // Hard block: the entered target must be aligned with the actual line
        // total (via Apply) before saving. After a correct Apply this diff is ~0;
        // a diff over ₹0.02 means the target was never applied (or the lines were
        // hand-edited away from it). No override.
        if (!isWarrantyJob && hasTarget) {
            const diff = Math.abs(backCalcNum - computedTotal);
            if (diff > 0.02) {
                setDiffAlertMsg(
                    `Cannot save: your target amount (₹${backCalcNum.toFixed(2)}) does not match the current line total (₹${computedTotal.toFixed(2)}) — a difference of ₹${diff.toFixed(2)}. Click "Apply" to align the line prices with the target, then save.`
                );
                setSubmitting(false);
                return false;
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
            customerId:   selectedJob.customer_contact_id,
            gstin,
            currentGstin: selectedJob.customer_gstin,
            dbName,
            schema,
        });

        toast.success("Job marked as final.");
        return true;
    } catch {
        toast.error("Failed to save. Please try again.");
        return false;
    } finally {
        setSubmitting(false);
    }
}
