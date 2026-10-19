"use client";

import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Logo } from "../shared/Logo";
import AnimatedGridPattern from "../ui/animated-grid-pattern";

/**
 * The site's background theme, extracted from the homepage hero.
 *
 * `hero` is the full-strength treatment used at the top of the homepage.
 * `page` is the calmer variant used under page titles.
 * `ambient` is the near-invisible layer the root layout pins behind every route.
 */
export function HeroBackdrop({
	variant = "page",
	className,
}: {
	variant?: "hero" | "page" | "ambient";
	className?: string;
}) {
	const reduceMotion = useReducedMotion();
	const isHero = variant === "hero";
	const isAmbient = variant === "ambient";

	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 overflow-hidden",
				className,
			)}
		>
			{/* Warm glow that gives the dark canvas its Notploy tone. */}
			<div
				className={cn(
					"absolute left-1/2 -translate-x-1/2 rounded-full bg-primary/[0.05] blur-3xl",
					isHero
						? "top-1/2 h-[820px] w-[820px] -translate-y-1/2"
						: "top-0 h-[560px] w-[820px]",
					isAmbient && "bg-primary/[0.025]",
				)}
			/>

			{!reduceMotion && (
				<AnimatedGridPattern
					numSquares={isAmbient ? 14 : 24}
					maxOpacity={isAmbient ? 0.05 : 0.08}
					height={40}
					width={40}
					duration={4}
					repeatDelay={1}
					className={cn(
						"absolute inset-0 h-full w-full",
						isHero && "opacity-100",
						variant === "page" &&
							"[mask-image:radial-gradient(560px_circle_at_50%_0%,white,transparent)]",
						isAmbient &&
							"[mask-image:linear-gradient(to_bottom,white,transparent_65%)]",
					)}
				/>
			)}

			{!isAmbient && (
				<Logo
					className={cn(
						"absolute left-1/2 -translate-x-1/2 opacity-[0.035]",
						isHero
							? "top-1/2 h-[360px] w-[360px] -translate-y-1/2 sm:h-[560px] sm:w-[560px]"
							: "top-1/2 h-[360px] w-[360px] -translate-y-1/2 sm:h-[520px] sm:w-[520px]",
					)}
				/>
			)}
		</div>
	);
}
