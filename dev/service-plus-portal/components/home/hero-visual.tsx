"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Illustrative fragments of the app UI. These are examples of what the screens do, not claims
// about anyone's business.
const floatingCards = [
	{
		badge: "Ready for pickup",
		icon: Check,
		meta: "Job #4821 · WhatsApp sent",
		offset: "-bottom-5 -left-4 sm:-left-8",
		tone: "text-success bg-success/10",
	},
	{
		badge: "Parts consumed",
		icon: Sparkles,
		meta: "Screen assembly ×1 · posted to job",
		// Hidden on the smallest screens: two floating chips and a tilted screenshot do not fit.
		offset: "-top-5 right-2 hidden sm:-right-6 sm:flex",
		tone: "text-primary bg-primary/10",
	},
];

const FRACTION = 100;

/** The hero's product visual: a browser-chrome frame around the dashboard screenshot, with two
 *  floating UI chips, tilted to follow the pointer.
 *
 *  Pointer movement drives a pair of springs rather than the angle directly, so the card trails
 *  the cursor instead of snapping to it. The chips translate a little further than the card
 *  rotates, which is what sells the depth. Reduced-motion visitors get the static composition. */
export const HeroVisual = () => {
	const ref = useRef<HTMLDivElement>(null);
	const reduceMotion = useReducedMotion();

	const px = useMotionValue(0);
	const py = useMotionValue(0);
	const smoothX = useSpring(px, { damping: 20, stiffness: 150 });
	const smoothY = useSpring(py, { damping: 20, stiffness: 150 });

	const rotateY = useTransform(smoothX, [-FRACTION, FRACTION], [-6, 6]);
	const rotateX = useTransform(smoothY, [-FRACTION, FRACTION], [6, -6]);
	const shiftX = useTransform(smoothX, [-FRACTION, FRACTION], [8, -8]);
	const shiftY = useTransform(smoothY, [-FRACTION, FRACTION], [5, -5]);

	function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
		const rect = ref.current?.getBoundingClientRect();
		if (!rect) return;
		px.set(((event.clientX - rect.left) / rect.width - 0.5) * 2 * FRACTION);
		py.set(((event.clientY - rect.top) / rect.height - 0.5) * 2 * FRACTION);
	}

	function onPointerLeave() {
		px.set(0);
		py.set(0);
	}

	const frame = (
		<div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
			<div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
				<span aria-hidden className="flex gap-1.5">
					<span className="size-2.5 rounded-full bg-destructive/60" />
					<span className="size-2.5 rounded-full bg-amber-500/60" />
					<span className="size-2.5 rounded-full bg-success/60" />
				</span>
				<span className="text-muted-foreground mx-auto max-w-[60%] truncate rounded-md bg-background px-3 py-0.5 text-xs">
					serviceplus.app / dashboard
				</span>
			</div>
			{/* eslint-disable-next-line @next/next/no-img-element -- static export, images unoptimized */}
			<img
				alt="Service+ operations dashboard"
				className="block w-full"
				fetchPriority="high"
				height={651}
				src="/images/screens/dashboard.jpg"
				width={1400}
			/>
		</div>
	);

	const chips = floatingCards.map((card) => (
		<div
			className={cn(
				"absolute flex items-center gap-2.5 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm",
				card.offset,
			)}
			key={card.meta}
		>
			<span className={cn("flex size-7 items-center justify-center rounded-lg", card.tone)}>
				<card.icon aria-hidden className="size-4" />
			</span>
			<span className="text-left">
				<span className="block text-xs font-semibold">{card.badge}</span>
				<span className="text-muted-foreground block text-[0.7rem]">{card.meta}</span>
			</span>
		</div>
	));

	return (
		<div className="relative">
			<div className="bg-gradient-brand absolute -inset-3 rounded-3xl opacity-20 blur-2xl" />

			{reduceMotion ? (
				<>
					{frame}
					{chips}
				</>
			) : (
				<div
					onPointerLeave={onPointerLeave}
					onPointerMove={onPointerMove}
					ref={ref}
					style={{ perspective: 1200 }}
				>
					<motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
						{frame}
						{/* The chips move further than the frame rotates, which reads as depth. */}
						<motion.div className="absolute inset-0" style={{ x: shiftX, y: shiftY }}>
							{chips}
						</motion.div>
					</motion.div>
				</div>
			)}
		</div>
	);
};
