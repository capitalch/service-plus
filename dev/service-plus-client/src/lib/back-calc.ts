// Generic proportional-with-floor allocation, shared by every "Apply" (target
// amount) price-adjustment feature (Jobs' Finalize form, Sales Entry) that
// needs to redistribute a target total across line items without letting any
// item drop below a per-item floor (e.g. cost price).

export type FloorAllocItem = { key: string; curIncl: number; floorIncl: number };

/**
 * Iteratively allocates `poolTarget` across `items` proportionally to their
 * current amounts. Any item whose proportional share would fall at or below
 * its floor is pinned there instead, and the shortfall is redistributed
 * proportionally among the remaining (not-yet-floored) items — repeating
 * until a fixed point (no new item pins) or every item is pinned. In the
 * all-pinned case the pool is infeasible at this floor: the returned values
 * sum to less than `poolTarget`, and the caller is expected to fall back to
 * a relaxed floor (or a different section) for the shortfall.
 */
export function allocateFloored(items: FloorAllocItem[], poolTarget: number): Map<string, number> {
    const result = new Map<string, number>();
    let pool = items;
    let target = poolTarget;
    while (pool.length > 0) {
        const curSum = pool.reduce((s, i) => s + i.curIncl, 0);
        const allocs = pool.map(i => curSum > 0 ? i.curIncl * target / curSum : target / pool.length);
        const notPinned: FloorAllocItem[] = [];
        let anyPinned = false;
        pool.forEach((item, idx) => {
            if (allocs[idx] <= item.floorIncl) {
                result.set(item.key, item.floorIncl);
                target -= item.floorIncl;
                anyPinned = true;
            } else {
                notPinned.push(item);
            }
        });
        if (!anyPinned) {
            pool.forEach((item, idx) => result.set(item.key, allocs[idx]));
            return result;
        }
        pool = notPinned;
    }
    return result;
}

/**
 * Picks the item to absorb final rounding residue. Prefers a non-pinned item
 * with qty === 1: only a single-unit line can absorb an arbitrary paisa
 * remainder exactly, because a qty>1 line's total moves in steps of qty × ₹0.01
 * (its per-unit price is rounded to 2dp, then multiplied by qty). Falls back to
 * any non-pinned item (best effort), then to the last item overall.
 */
export function pickResidualKey(items: { key: string; qty: number }[], pinned: Set<string>): string {
    const nonPinned = items.filter(i => !pinned.has(i.key));
    const unit = [...nonPinned].reverse().find(i => i.qty === 1);
    if (unit) return unit.key;
    if (nonPinned.length) return nonPinned[nonPinned.length - 1].key;
    return items[items.length - 1].key;
}

/**
 * Rounds an ideal GST-inclusive unit price to the nearest whole rupee (never
 * below floor), then derives the excl-GST price by simple division. This is a
 * straight round-to-nearest — no search — so the derived excl-GST price can be
 * off from `incl / multiplier` by a paisa or two once re-multiplied; that's the
 * accepted trade-off for a clean whole-rupee line amount.
 */
export function snapInclToWholeRupee(idealIncl: number, floor: number, multiplier: number): { sp: number; incl: number } {
    const whole = Math.max(Math.round(idealIncl), Math.ceil(floor * multiplier));
    const sp = parseFloat(Math.max(whole / multiplier, floor).toFixed(2));
    return { sp, incl: whole };
}
