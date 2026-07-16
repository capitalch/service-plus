import { allocateFloored, pickResidualKey, type FloorAllocItem } from "@/lib/back-calc";
import type { SalesLineFormItem } from "./sales-invoice-schema";

export function calcLine(l: SalesLineFormItem, isIgst: boolean) {
    const aggregate = l.qty * l.unit_price;
    const gst       = l.gst_rate;
    const total     = l.qty * l.unit_price * (1 + gst / 100);
    const taxTotal  = total - aggregate;
    const cgstAmt   = isIgst ? 0 : taxTotal / 2;
    const sgstAmt   = isIgst ? 0 : taxTotal / 2;
    const igstAmt   = isIgst ? taxTotal : 0;
    return { aggregate, cgstAmt, sgstAmt, igstAmt, total };
}

function withUnitPrice(l: SalesLineFormItem, newUnitPrice: number, isIgst: boolean): SalesLineFormItem {
    const c = calcLine({ ...l, unit_price: newUnitPrice }, isIgst);
    return {
        ...l,
        unit_price:       newUnitPrice,
        aggregate_amount: c.aggregate,
        cgst_amount:      c.cgstAmt,
        sgst_amount:      c.sgstAmt,
        igst_amount:      c.igstAmt,
        total_amount:     c.total,
    };
}

// Scales `active` lines (a subset of `allLines`) so their combined GST-inclusive
// total becomes `newTotal`, respecting each line's per-unit price floor unless
// `allowBelowFloor` is set (last-resort sell-at-a-loss). Lines not in `active`
// pass through unchanged.
function scaleLines(
    allLines: SalesLineFormItem[],
    active: SalesLineFormItem[],
    newTotal: number,
    isIgst: boolean,
    allowBelowFloor: boolean,
): SalesLineFormItem[] {
    const items: FloorAllocItem[] = active.map(l => {
        const multiplier = 1 + l.gst_rate / 100;
        const floorUnit  = allowBelowFloor ? 0 : l.cost_price;
        return { key: l._key, curIncl: l.unit_price * multiplier * l.qty, floorIncl: floorUnit * multiplier * l.qty };
    });
    const finalIncl   = allocateFloored(items, newTotal);
    const pinned      = new Set(items.filter(i => finalIncl.get(i.key) === i.floorIncl).map(i => i.key));
    const residualKey = pickResidualKey(active.map(l => l._key), pinned);

    const patch = new Map<string, number>(); // _key -> new unit_price
    let runningTotal = 0;
    active.forEach(l => {
        if (l._key === residualKey) return;
        const multiplier   = 1 + l.gst_rate / 100;
        const floor        = allowBelowFloor ? 0 : l.cost_price;
        const perUnitIncl  = (finalIncl.get(l._key) ?? 0) / l.qty;
        const unit         = multiplier > 0 ? perUnitIncl / multiplier : perUnitIncl;
        const finalUnit    = Math.round(Math.max(unit, floor) * 100) / 100;
        runningTotal += finalUnit * multiplier * l.qty;
        patch.set(l._key, finalUnit);
    });
    const residual = active.find(l => l._key === residualKey)!;
    {
        const multiplier  = 1 + residual.gst_rate / 100;
        const floor       = allowBelowFloor ? 0 : residual.cost_price;
        const perUnitIncl = (newTotal - runningTotal) / residual.qty;
        const unit        = multiplier > 0 ? perUnitIncl / multiplier : perUnitIncl;
        patch.set(residual._key, Math.round(Math.max(unit, floor) * 100) / 100);
    }
    return allLines.map(l => patch.has(l._key) ? withUnitPrice(l, patch.get(l._key)!, isIgst) : l);
}

export type BackCalcResult = { lines: SalesLineFormItem[]; wentBelowCost: boolean };

/**
 * Adjusts line Selling Prices so the invoice total matches `targetTotal`.
 * Increases are distributed proportionally across all priced lines. Decreases
 * are floored at each line's Cost Price first — a line that would drop below
 * cost is pinned at cost and the shortfall redistributed among the remaining
 * lines — and only if every line is already pinned at cost and the target is
 * still not met does it relax the floor to ₹0 (selling at a loss) as a last
 * resort, so results are never negative.
 */
export function computeBackCalc(
    currentLines: SalesLineFormItem[],
    targetTotal: number,
    isIgst: boolean,
): BackCalcResult {
    const active = currentLines.filter(l => l.qty > 0);
    const currentTotal = active.reduce((s, l) => s + calcLine(l, isIgst).total, 0);
    const diff = targetTotal - currentTotal;
    if (active.length === 0 || currentTotal <= 0 || Math.abs(diff) < 0.005) {
        return { lines: currentLines, wentBelowCost: false };
    }

    // Phase 1: scale toward the target, floored at cost price.
    const phase1 = scaleLines(currentLines, active, targetTotal, isIgst, false);
    const phase1Total = active.reduce((s, l) => {
        const updated = phase1.find(x => x._key === l._key)!;
        return s + calcLine(updated, isIgst).total;
    }, 0);
    if (Math.abs(targetTotal - phase1Total) < 0.005) {
        return { lines: phase1, wentBelowCost: false };
    }

    // Phase 3 (no separate "additional charges" section in Sales Entry, so
    // Phase 2 doesn't apply here): every line is pinned at cost and the
    // target still isn't reached — override the floor down to ₹0. Basis is
    // Phase 1's result (every line already at its cost price), so the
    // below-cost cut is distributed proportionally to cost price, matching
    // the "current Sale Price" each line actually holds at this point.
    const phase1Active = active.map(l => phase1.find(x => x._key === l._key)!);
    const phase3 = scaleLines(phase1, phase1Active, targetTotal, isIgst, true);
    return { lines: phase3, wentBelowCost: true };
}
