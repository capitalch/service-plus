import { useCallback, useEffect, useRef, useState } from "react";

type UseSyncedHorizontalScrollResultType = {
	contentWidth: number;
	isOverflowing: boolean;
	onMainScroll: () => void;
	onTopScroll: () => void;
	mainRef: React.RefObject<HTMLDivElement | null>;
	topRef: React.RefObject<HTMLDivElement | null>;
};

/** Pairs a wide scroll box (mainRef) with a thin scrollbar strip above it (topRef), kept in step
 *  both ways, so the horizontal scrollbar is reachable without scrolling to the box's bottom.
 *  `deps` should change whenever the box's content is re-rendered (e.g. the query data). */
export const useSyncedHorizontalScroll = (deps: unknown[]): UseSyncedHorizontalScrollResultType => {
	const mainRef = useRef<HTMLDivElement | null>(null);
	const topRef = useRef<HTMLDivElement | null>(null);
	const [contentWidth, setContentWidth] = useState<number>(0);
	const [isOverflowing, setIsOverflowing] = useState<boolean>(false);

	useEffect(() => {
		const main = mainRef.current;
		if (!main) return;
		function measure() {
			if (!main) return;
			setContentWidth(main.scrollWidth);
			setIsOverflowing(main.scrollWidth > main.clientWidth + 1);
		}
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(main);
		if (main.firstElementChild) observer.observe(main.firstElementChild);
		return () => observer.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);

	const onMainScroll = useCallback(() => {
		if (mainRef.current && topRef.current && topRef.current.scrollLeft !== mainRef.current.scrollLeft) {
			topRef.current.scrollLeft = mainRef.current.scrollLeft;
		}
	}, []);

	const onTopScroll = useCallback(() => {
		if (mainRef.current && topRef.current && mainRef.current.scrollLeft !== topRef.current.scrollLeft) {
			mainRef.current.scrollLeft = topRef.current.scrollLeft;
		}
	}, []);

	return { contentWidth, isOverflowing, mainRef, onMainScroll, onTopScroll, topRef };
};
