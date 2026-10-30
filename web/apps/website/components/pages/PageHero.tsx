"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Container } from "../Container";
import AnimatedGridPattern from "../ui/animated-grid-pattern";

interface HeroLink {
	href: string;
	label: string;
	external?: boolean;
}

export interface PageHeroProps {
	badge?: string;
	badgeDetail?: string;
	badgeHref?: string;
	/** Small uppercase label above the headline ("European application infrastructure"). */
	eyebrow?: string;
	/** Plain lead-in of the headline. Keep it short enough for two lines. */
	title: string;
	/** Final words of the headline, drawn in the primary colour. */
	highlight?: string;
	description: string;
	actions?: ReactNode;
	links?: HeroLink[];
	children?: ReactNode;
	/** Use a smaller headline for long editorial titles (industry pages). */
	compact?: boolean;
}

function HeadlineUnderline() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 418 42"
			className="absolute left-0 top-2/3 h-[0.55em] w-full fill-primary/40"
			preserveAspectRatio="none"
		>
			<path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z" />
		</svg>
	);
}

export function PageHero({
	badge,
	badgeDetail,
	badgeHref,
	eyebrow,
	title,
	highlight,
	description,
	actions,
	links,
	children,
	compact = false,
}: PageHeroProps) {
	const reduceMotion = useReducedMotion();

	const fadeIn = reduceMotion
		? {}
		: {
				initial: { opacity: 0, y: 16 },
				animate: { opacity: 1, y: 0 },
			};

	const badgeContent = (
		<>
			<span className="h-1.5 w-1.5 rounded-full bg-primary" />
			<span>{badge}</span>
			{badgeDetail && (
				<>
					<span className="text-border">/</span>
					<span>{badgeDetail}</span>
				</>
			)}
		</>
	);

	return (
		<section className="relative overflow-hidden">
			<div className="relative flex items-center justify-center overflow-hidden py-20 sm:py-24 lg:py-28">
				<div
					className="pointer-events-none absolute inset-0"
					aria-hidden="true"
				>
					{!reduceMotion && (
						<AnimatedGridPattern
							numSquares={24}
							maxOpacity={0.08}
							height={40}
							width={40}
							duration={4}
							repeatDelay={1}
							className="absolute inset-0 h-full w-full [mask-image:radial-gradient(520px_circle_at_center,white,transparent)]"
						/>
					)}
				</div>

				<Container className="relative z-10">
					<div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
						{badge && (
							<motion.div
								{...fadeIn}
								transition={{ duration: 0.5, ease: "easeOut" }}
							>
								{badgeHref ? (
									<Link
										href={badgeHref}
										target={badgeHref.startsWith("http") ? "_blank" : undefined}
										rel={
											badgeHref.startsWith("http") ? "noreferrer" : undefined
										}
										className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
									>
										{badgeContent}
									</Link>
								) : (
									<div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-sm text-muted-foreground">
										{badgeContent}
									</div>
								)}
							</motion.div>
						)}

						{eyebrow && (
							<p className="mx-auto mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
								{eyebrow}
							</p>
						)}

						<motion.h1
							{...fadeIn}
							transition={{ duration: 0.55, delay: 0.06, ease: "easeOut" }}
							className={cn(
								"mx-auto w-full max-w-4xl font-display leading-[1.05] tracking-tight",
								eyebrow ? "mt-3" : "mt-8",
								compact
									? "text-3xl sm:text-4xl lg:text-5xl"
									: "text-4xl sm:text-6xl lg:text-7xl",
							)}
						>
							<span
								className={
									highlight ? "text-muted-foreground" : "text-foreground"
								}
							>
								{title}
								{highlight ? " " : ""}
							</span>
							{highlight && (
								<span className="relative whitespace-nowrap text-primary">
									{highlight}
									<HeadlineUnderline />
								</span>
							)}
						</motion.h1>

						<motion.p
							{...fadeIn}
							transition={{ duration: 0.55, delay: 0.12, ease: "easeOut" }}
							className="mx-auto mt-6 w-full max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
						>
							{description}
						</motion.p>

						{actions && (
							<motion.div
								{...fadeIn}
								transition={{ duration: 0.55, delay: 0.18, ease: "easeOut" }}
								className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row"
							>
								{actions}
							</motion.div>
						)}

						{children && (
							<motion.div
								{...fadeIn}
								transition={{ duration: 0.55, delay: 0.24, ease: "easeOut" }}
								className="mt-8 w-full"
							>
								{children}
							</motion.div>
						)}

						{links && links.length > 0 && (
							<div className="mt-6 flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
								{links.map((link, index) => (
									<span
										key={link.href}
										className="inline-flex items-center gap-4"
									>
										<Link
											href={link.href}
											target={link.external ? "_blank" : undefined}
											rel={link.external ? "noreferrer" : undefined}
											className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
										>
											{link.label}
										</Link>
										{index < links.length - 1 && (
											<span className="text-border" aria-hidden="true">
												·
											</span>
										)}
									</span>
								))}
							</div>
						)}
					</div>
				</Container>
			</div>
		</section>
	);
}
