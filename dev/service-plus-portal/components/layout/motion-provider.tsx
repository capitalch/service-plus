"use client";

import { MotionConfig } from "framer-motion";

export const MotionProvider = ({ children }: { children: React.ReactNode }) => {
	return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
};
