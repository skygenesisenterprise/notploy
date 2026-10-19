"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function Reveal({
	children,
	className,
	delay = 0,
	y = 24,
}: {
	children: ReactNode;
	className?: string;
	delay?: number;
	y?: number;
}) {
	const reduceMotion = useReducedMotion();

	return (
		<motion.div
			className={className}
			initial={reduceMotion ? false : { opacity: 0, y }}
			whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-80px" }}
			transition={{ duration: 0.55, delay, ease: "easeOut" }}
		>
			{children}
		</motion.div>
	);
}
