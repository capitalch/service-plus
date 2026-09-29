"use client";

import { motion, useReducedMotion } from "framer-motion";

type RevealPropsType = {
	children: React.ReactNode;
	className?: string;
	delay?: number;
	id?: string;
	/** How far the element travels on entry. 0 disables the slide, leaving a plain fade. */
	y?: number;
};

// Fade/slide in once on scroll. MotionConfig reducedMotion="user" in the root layout turns the
// slide off for visitors who prefer reduced motion, and the explicit check here also drops the
// offset rather than just shortening it.
export const Reveal = ({ children, className, delay = 0, id, y = 24 }: RevealPropsType) => {
	const reduceMotion = useReducedMotion();
	const offset = reduceMotion ? 0 : y;

	return (
		<motion.div
			className={className}
			id={id}
			initial={{ opacity: 0, y: offset }}
			transition={{ delay: reduceMotion ? 0 : delay, duration: 0.5, ease: "easeOut" }}
			viewport={{ margin: "-60px", once: true }}
			whileInView={{ opacity: 1, y: 0 }}
		>
			{children}
		</motion.div>
	);
};
