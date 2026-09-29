"use client";

import { motion, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";

type AnimatedTabsListPropsType = {
	items: { id: string; label: React.ReactNode }[];
	/** Reported by Radix on the active trigger; the list itself stays uncontrolled. */
	value: string;
};

type BoxType = { h: number; w: number; x: number; y: number };

// Soft and quick: the highlight should arrive before the eye tracks across, not after.
const SPRING = { damping: 30, mass: 0.6, stiffness: 400 };

/** Segmented tab list with a highlight that slides to the active trigger.
 *
 *  The pill is rendered inside the list and measured from the active trigger rather than computed,
 *  so it stays correct whatever the labels turn out to be — including the per-group shot counts,
 *  which vary in width. Measurement re-runs on value change and on any resize of the list, which
 *  covers a window resize and a label that wraps on a narrow screen.
 *
 *  Because the pill is a child of the list, and the list is the offset parent of each trigger, the
 *  measured offsets are relative to exactly the element the pill is positioned against.
 *
 *  Decorative and hidden from assistive tech: Radix still owns the semantics through each
 *  trigger's `aria-selected` and `data-state`. Under reduced motion the same measured box is
 *  applied without the spring, so the state is identical, just instant. */
export const AnimatedTabsList = ({ items, value }: AnimatedTabsListPropsType) => {
	const listRef = useRef<HTMLDivElement>(null);
	const reduceMotion = useReducedMotion();
	const [box, setBox] = useState<BoxType | null>(null);

	useEffect(() => {
		const list = listRef.current;
		if (!list) return;

		const measure = () => {
			const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
			if (!active) {
				setBox(null);
				return;
			}
			setBox({ h: active.offsetHeight, w: active.offsetWidth, x: active.offsetLeft, y: active.offsetTop });
		};

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(list);
		return () => observer.disconnect();
	}, [value, items]);

	const x = useSpring(box?.x ?? 0, SPRING);
	const y = useSpring(box?.y ?? 0, SPRING);
	const width = useSpring(box?.w ?? 0, SPRING);
	const height = useSpring(box?.h ?? 0, SPRING);

	// Matches what the trigger itself used to paint, so the transition is a move rather than a
	// swap between two different-looking surfaces.
	const pillClass = "bg-card pointer-events-none absolute rounded-md shadow-sm";

	return (
		<TabsList className="relative" ref={listRef}>
			{box &&
				(reduceMotion ? (
					<div
						aria-hidden
						className={pillClass}
						style={{ height: box.h, left: box.x, top: box.y, width: box.w }}
					/>
				) : (
					<motion.div aria-hidden className={pillClass} initial={false} style={{ height, width, x, y }} />
				))}
			{items.map((item) => (
				<TabsTrigger
					className="data-[state=active]:bg-transparent data-[state=active]:shadow-none"
					key={item.id}
					value={item.id}
				>
					{item.label}
				</TabsTrigger>
			))}
		</TabsList>
	);
};
