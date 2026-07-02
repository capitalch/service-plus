import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Imperative handle a parent section exposes on a child grid so it can arm the
 * row/scroll restore right before triggering a mutation reload.
 */
export type GridRetentionHandle = { armRestore: () => void };

/**
 * Row-selection + row/scroll-position retention for a paginated job grid,
 * matching the behaviour implemented inline in `job-control-section.tsx`.
 *
 * After a mutation reloads the grid in place, the previously-selected row is
 * scrolled back into view. Restore is DOM-anchored via `data-job-id` +
 * `scrollIntoView` (NOT pixel scrollTop), so it survives row reordering/removal.
 *
 * Usage:
 *  - attach `scrollWrapperRef` to the scrollable grid container
 *  - stamp each row `<tr>` with `data-job-id={row.id}`, apply a highlight class
 *    when `selectedRowId === row.id`, and call `setSelectedRowId(row.id)` on row
 *    click and on `onPointerDownCapture` of the sticky Actions cell
 *  - call `armRestore()` right before a mutation-triggered reload; the restore
 *    effect fires on the next `loading === false` transition
 *  - call `disarmRestore()` at the start of a search/page/filter-driven reload so
 *    intentional navigation does NOT force a scroll
 *
 * `extraDep` is an optional extra dependency for the restore effect (e.g. a
 * full-screen sub-view flag whose return should also re-trigger the restore).
 */
export function useGridRowRetention(loading: boolean, extraDep?: unknown) {
    const scrollWrapperRef  = useRef<HTMLDivElement>(null);
    const pendingRestoreRef = useRef<boolean>(false);
    const savedScrollTopRef = useRef<number>(0);
    const savedIndexRef     = useRef<number>(-1);
    const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
    const selectedRowIdRef  = useRef<number | null>(null);

    useEffect(() => { selectedRowIdRef.current = selectedRowId; }, [selectedRowId]);

    // Snapshot the selected row's scroll offset AND its position (index) among the
    // currently-rendered rows, so we can fall back sensibly if that row is no
    // longer in the reloaded list.
    const armRestore = useCallback(() => {
        pendingRestoreRef.current = true;
        const wrapper = scrollWrapperRef.current;
        savedScrollTopRef.current = wrapper?.scrollTop ?? 0;
        savedIndexRef.current = -1;
        if (wrapper && selectedRowIdRef.current !== null) {
            const nodes = Array.from(wrapper.querySelectorAll<HTMLElement>("[data-job-id]"));
            savedIndexRef.current = nodes.findIndex(
                n => n.getAttribute("data-job-id") === String(selectedRowIdRef.current),
            );
        }
    }, []);
    const disarmRestore = useCallback(() => { pendingRestoreRef.current = false; }, []);

    // Restore, gated on `loading === false` so we only ever touch the real
    // <table>, never the loading-skeleton's differently-shaped rows.
    //  1. Preferred: DOM-anchor to the selected row via `data-job-id`.
    //  2. If that row is gone (e.g. an action moved it out of a status-filtered
    //     drilldown), reselect + anchor to whatever row now occupies the same
    //     slot, so both scroll position and a visible selection are retained.
    //  3. Last resort: restore the previous pixel scrollTop.
    useLayoutEffect(() => {
        if (!pendingRestoreRef.current) return;
        if (loading) return;                        // skeleton mounted — wait for next fire
        if (!scrollWrapperRef.current) return;      // grid unmounted — wait

        let rafId: number | null = null;
        let t1: ReturnType<typeof setTimeout> | null = null;
        let t2: ReturnType<typeof setTimeout> | null = null;

        const scrollTo = (el: HTMLElement) =>
            el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });

        const attempt = (): boolean => {
            const wrapper = scrollWrapperRef.current;
            if (!wrapper) return false;
            const nodes = Array.from(wrapper.querySelectorAll<HTMLElement>("[data-job-id]"));
            if (nodes.length === 0) return false;   // rows not rendered yet — retry

            const id = selectedRowIdRef.current;
            if (id !== null) {
                const exact = nodes.find(n => n.getAttribute("data-job-id") === String(id));
                if (exact) { scrollTo(exact); return true; }
            }
            // Selected row is gone — reselect the row now at the same slot.
            const idx = savedIndexRef.current;
            if (idx >= 0) {
                const target = nodes[Math.min(idx, nodes.length - 1)];
                scrollTo(target);
                const newId = Number(target.getAttribute("data-job-id"));
                if (!Number.isNaN(newId)) setSelectedRowId(newId);
                return true;
            }
            return false;
        };

        const giveUp = () => {
            const wrapper = scrollWrapperRef.current;
            if (wrapper) wrapper.scrollTop = savedScrollTopRef.current; // browser clamps to max
            pendingRestoreRef.current = false;
        };

        rafId = requestAnimationFrame(() => {
            if (attempt()) { pendingRestoreRef.current = false; return; }
            t1 = setTimeout(() => {
                if (attempt()) { pendingRestoreRef.current = false; return; }
                t2 = setTimeout(() => {
                    if (attempt()) pendingRestoreRef.current = false;
                    else giveUp();
                }, 150);
            }, 150);
        });

        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (t1) clearTimeout(t1);
            if (t2) clearTimeout(t2);
        };
    }, [loading, extraDep]);

    return { scrollWrapperRef, selectedRowId, setSelectedRowId, armRestore, disarmRestore };
}
