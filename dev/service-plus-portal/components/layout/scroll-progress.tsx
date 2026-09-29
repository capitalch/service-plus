"use client";

import { motion, useScroll, useSpring } from "framer-motion";

// A 2px brand line under the header that fills as the page scrolls. scaleX is compositor-driven,
// so it stays smooth on long pages; the spring takes the hard edges off wheel and touch scrolling.
export const ScrollProgress = () => {
	const { scrollYProgress } = useScroll();
	const scaleX = useSpring(scrollYProgress, { damping: 30, restDelta: 0.001, stiffness: 180 });

	return (
		<motion.div
			aria-hidden
			className="bg-gradient-brand absolute inset-x-0 bottom-0 h-0.5 origin-left"
			style={{ scaleX }}
		/>
	);
};
