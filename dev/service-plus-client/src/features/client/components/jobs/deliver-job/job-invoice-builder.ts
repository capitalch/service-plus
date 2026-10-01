import type { JobDeliveryFullDetail } from "./deliver-job-schema";

// Shared job-invoice payload builder. Used by Deliver Job (create + regenerate) and the
// one-time warranty invoice backfill, so every job invoice is built the same way.

export type ShowPartsInInvoiceSettingType = { gst_rate: number; hsn: number; show: boolean; text: string };

export type InvoiceLineType = {
	aggregate: number;
	amount: number;
	cgst_amount: number;
	description: string;
	gst_rate: number;
	hsn_code: string | null;
	igst_amount: number;
	part_code: string | null;
	price: number;
	qty: number;
	sgst_amount: number;
};

export type JobInvoicePayloadType = {
	aggregate: number;
	amount: number;
	cgst_amount: number;
	igst_amount: number;
	lines: InvoiceLineType[];
	sgst_amount: number;
};

// NO_LINES: the job has no parts or charges. LINES_ZERO: the job amount is above 0 but every
// line is priced 0 — reconciling would dump the whole amount into the last line as untaxed
// value, so the invoice is refused instead.
export type JobInvoiceBuildResultType =
	{ ok: true; payload: JobInvoicePayloadType } | { ok: false; reason: "LINES_ZERO" | "NO_LINES" };

export function buildInvoiceLines(
	job: JobDeliveryFullDetail,
	isGst: boolean,
	forceIgst: boolean,
	showPartsSetting: ShowPartsInInvoiceSettingType | null,
): InvoiceLineType[] {
	function computeTax(taxable: number, gstRate: number) {
		if (!isGst || gstRate === 0) return { cgst: 0, sgst: 0, igst: 0 };
		if (forceIgst) return { cgst: 0, sgst: 0, igst: Math.round(taxable * gstRate) / 100 };
		const half = Math.round((taxable * gstRate) / 2) / 100;
		return { cgst: half, sgst: half, igst: 0 };
	}

	const showDetail = job.to_show_parts_in_job_invoice ?? true;

	if (!showDetail && showPartsSetting) {
		const combinedTaxable =
			Math.round(
				((job.parts ?? []).reduce((s, p) => s + p.selling_price * p.qty, 0) +
					(job.charges ?? []).reduce((s, c) => s + c.selling_price * c.qty, 0)) *
					100,
			) / 100;
		const rate = isGst ? showPartsSetting.gst_rate : 0;
		const { cgst, sgst, igst } = computeTax(combinedTaxable, rate);
		return [
			{
				description: showPartsSetting.text,
				part_code: null,
				hsn_code: isGst ? String(showPartsSetting.hsn) : null,
				qty: 1,
				price: combinedTaxable,
				aggregate: combinedTaxable,
				gst_rate: rate,
				cgst_amount: cgst,
				sgst_amount: sgst,
				igst_amount: igst,
				amount: Math.round((combinedTaxable + cgst + sgst + igst) * 100) / 100,
			},
		];
	}

	const partLines: InvoiceLineType[] = (job.parts ?? []).map((p) => {
		const taxable = Math.round(p.selling_price * p.qty * 100) / 100;
		const rate = isGst ? p.gst_rate : 0;
		const { cgst, sgst, igst } = computeTax(taxable, rate);
		return {
			description: p.part_name,
			part_code: p.part_code || null,
			hsn_code: p.hsn_code || null,
			qty: p.qty,
			price: p.selling_price,
			aggregate: taxable,
			gst_rate: rate,
			cgst_amount: cgst,
			sgst_amount: sgst,
			igst_amount: igst,
			amount: Math.round((taxable + cgst + sgst + igst) * 100) / 100,
		};
	});

	const chargeLines: InvoiceLineType[] = (job.charges ?? []).map((c) => {
		const taxable = Math.round(c.selling_price * c.qty * 100) / 100;
		const rate = isGst ? c.gst_rate : 0;
		const { cgst, sgst, igst } = computeTax(taxable, rate);
		// Ref no / description ride along on the same "show detail" checkbox
		// that gates itemized vs. combined lines — gated on showDetail
		// directly (not just "we're in the itemized branch") since that
		// branch can still be reached with showDetail false when
		// showPartsSetting is unset.
		const extras = [c.ref_no?.trim() ? `Ref: ${c.ref_no.trim()}` : null, c.description?.trim() || null]
			.filter((v): v is string => !!v)
			.join(", ");
		const description = showDetail && extras ? `${c.charge_name} (${extras})` : c.charge_name;
		return {
			description,
			part_code: null,
			hsn_code: c.hsn_code || null,
			qty: c.qty,
			price: c.selling_price,
			aggregate: taxable,
			gst_rate: rate,
			cgst_amount: cgst,
			sgst_amount: sgst,
			igst_amount: igst,
			amount: Math.round((taxable + cgst + sgst + igst) * 100) / 100,
		};
	});

	return [...partLines, ...chargeLines];
}

// Builds the full invoice payload for a job: lines, GST totals and header amount. The header
// amount is the finalized job.amount when positive (it may carry a user-adjusted total), else
// the line total. Lines are reconciled so Σ line.amount === header amount.
export function buildJobInvoicePayload(
	job: JobDeliveryFullDetail,
	isGst: boolean,
	forceIgst: boolean,
	showPartsSetting: ShowPartsInInvoiceSettingType | null,
): JobInvoiceBuildResultType {
	const lines = buildInvoiceLines(job, isGst, forceIgst, showPartsSetting);
	if (lines.length === 0) return { ok: false, reason: "NO_LINES" };
	const cgst_amount = Math.round(lines.reduce((s, l) => s + l.cgst_amount, 0) * 100) / 100;
	const sgst_amount = Math.round(lines.reduce((s, l) => s + l.sgst_amount, 0) * 100) / 100;
	const igst_amount = Math.round(lines.reduce((s, l) => s + l.igst_amount, 0) * 100) / 100;
	const preAggregate = Math.round(lines.reduce((s, l) => s + l.aggregate, 0) * 100) / 100;
	const lineTotal = Math.round((preAggregate + cgst_amount + sgst_amount + igst_amount) * 100) / 100;
	const jobAmt = Number(job.amount ?? 0);
	if (jobAmt > 0 && lineTotal <= 0) return { ok: false, reason: "LINES_ZERO" };
	const amount = jobAmt > 0 ? Math.round(jobAmt * 100) / 100 : lineTotal;
	reconcileLineAmounts(lines, amount);
	const aggregate = Math.round(lines.reduce((s, l) => s + l.aggregate, 0) * 100) / 100;
	return { ok: true, payload: { aggregate, amount, cgst_amount, igst_amount, lines, sgst_amount } };
}

// Nudge line amounts so they sum EXACTLY to the invoice header amount. The
// header comes from the finalized job.amount, while the lines sum to
// aggregate + gst; a paisa-level rounding residual between the two makes the
// trace-plus edit form (which re-derives the total from the line values) differ
// from the grid. Absorb the residual into the last line as taxable so that
// Σ line.amount === targetAmount while keeping amount = aggregate + gst per line.
export function reconcileLineAmounts(lines: InvoiceLineType[], targetAmount: number): InvoiceLineType[] {
	if (lines.length === 0) return lines;
	const sum = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
	const residual = Math.round((targetAmount - sum) * 100) / 100;
	if (residual === 0) return lines;
	const last = lines[lines.length - 1];
	last.amount = Math.round((last.amount + residual) * 100) / 100;
	last.aggregate = Math.round((last.aggregate + residual) * 100) / 100;
	return lines;
}
