"use client";

import { motion } from "framer-motion";

type RevealPropsType = {
	children: React.ReactNode;
	className?: string;
	delay?: number;
};

// Fade/slide in once on scroll. MotionConfig reducedMotion="user" in the root layout turns the
// slide off for visitors who prefer reduced motion.
export const Reveal = ({ children, className, delay = 0 }: RevealPropsType) => {
	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, y: 24 }}
			transition={{ delay, duration: 0.5, ease: "easeOut" }}
			viewport={{ margin: "-60px", once: true }}
			whileInView={{ opacity: 1, y: 0 }}
		>
			{children}
		</motion.div>
	);
};
