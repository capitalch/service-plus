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
 * Picks the item to absorb final rounding residue: the last key that isn't
 * pinned at its floor, falling back to the last key overall.
 */
export function pickResidualKey(keys: string[], pinned: Set<string>): string {
    for (let i = keys.length - 1; i >= 0; i--) {
        if (!pinned.has(keys[i])) return keys[i];
    }
    return keys[keys.length - 1];
}
