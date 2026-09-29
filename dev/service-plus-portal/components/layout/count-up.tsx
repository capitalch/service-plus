"use client";

import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef } from "react";

type CountUpPropsType = {
	duration?: number;
	suffix?: string;
	value: number;
};

// React warns about useLayoutEffect during server rendering. The alias makes it a no-op there,
// where there is no layout to read anyway, and keeps the pre-paint behaviour on the client.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Counts from zero to `value` as soon as it mounts.
 *
 *  The number is written straight to the node from a MotionValue subscription rather than held in
 *  React state, so a 1.4s animation causes zero re-renders.
 *
 *  Deliberately not gated on scroll-into-view: this runs in a layout effect, which sets the text
 *  to "0" and starts the animation in the same frame before the browser paints. Anything that
 *  waited for an IntersectionObserver would first paint the finished number and then visibly jump
 *  back to zero. Reduced-motion visitors keep the server-rendered final number untouched. */
export const CountUp = ({ duration = 1.4, suffix, value }: CountUpPropsType) => {
	const ref = useRef<HTMLSpanElement>(null);
	const reduceMotion = useReducedMotion();
	const count = useMotionValue(0);

	useIsomorphicLayoutEffect(() => {
		const node = ref.current;
		if (!node || reduceMotion) return;

		node.textContent = "0";
		const controls = animate(count, value, { duration, ease: "easeOut" });
		const unsubscribe = count.on("change", (latest) => {
			node.textContent = Math.round(latest).toLocaleString("en-IN");
		});

		return () => {
			controls.stop();
			unsubscribe();
			// Restore the real number so a remount (or a bailed-out animation) cannot leave a zero.
			node.textContent = value.toLocaleString("en-IN");
		};
	}, [count, duration, reduceMotion, value]);

	return (
		<span ref={ref}>
			{value.toLocaleString("en-IN")}
			{suffix}
		</span>
	);
};
