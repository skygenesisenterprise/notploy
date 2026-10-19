"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Container } from "../Container";
import { showcases } from "./content";
import { Reveal } from "./Reveal";

function viewPath(title: string) {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

export function ProductShowcase() {
	const [active, setActive] = useState(0);
	const reduceMotion = useReducedMotion();
	const current = showcases[active];

	return (
		<section
			id="features"
			aria-labelledby="showcase-title"
			className="relative overflow-hidden py-24 sm:py-32"
		>
			<Container>
				<Reveal>
					<div className="mx-auto max-w-2xl text-center">
						<h2
							id="showcase-title"
							className="font-display text-3xl tracking-tight text-foreground sm:text-4xl md:text-5xl"
						>
							The platform, in screenshots
						</h2>
						<p className="mt-5 text-lg leading-relaxed text-muted-foreground">
							Applications, Compose stacks, servers, logs, monitoring, backups
							and routing — the screenshots are the product, not a mockup.
						</p>
					</div>
				</Reveal>

				<div
					className="-mx-4 mt-10 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0"
					role="group"
					aria-label="Product views"
				>
					{showcases.map((item, index) => (
						<button
							key={item.title}
							type="button"
							aria-pressed={active === index}
							onClick={() => setActive(index)}
							className={cn(
								"shrink-0 rounded-full px-4 py-2 text-base transition-colors",
								active === index
									? "bg-primary text-primary-foreground"
									: "bg-card text-muted-foreground hover:text-foreground",
							)}
						>
							{item.title}
						</button>
					))}
				</div>

				<p
					aria-live="polite"
					className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-muted-foreground"
				>
					{current.description}
				</p>

				<Reveal className="mt-10" delay={0.08}>
					<div
						className="mx-auto max-w-6xl overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl"
						data-ui
					>
						<div className="flex h-11 items-center gap-2 border-b border-border/60 px-4">
							<span
								className="h-2.5 w-2.5 rounded-full bg-destructive/70"
								aria-hidden="true"
							/>
							<span
								className="h-2.5 w-2.5 rounded-full bg-primary/60"
								aria-hidden="true"
							/>
							<span
								className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40"
								aria-hidden="true"
							/>
							<span className="ml-3 truncate text-[13px] text-muted-foreground">
								app.notploy.com/{viewPath(current.title)}
							</span>
							<span className="ml-auto hidden text-[13px] text-muted-foreground sm:block">
								Notploy
							</span>
						</div>

						<div className="relative aspect-[4/3] w-full bg-secondary sm:aspect-[16/9]">
							<AnimatePresence mode="wait" initial={false}>
								<motion.div
									key={current.title}
									className="absolute inset-0"
									initial={reduceMotion ? false : { opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={reduceMotion ? undefined : { opacity: 0 }}
									transition={{ duration: 0.25, ease: "easeOut" }}
								>
									<Image
										src={current.image}
										alt={current.alt}
										fill
										sizes="(min-width: 1280px) 1152px, 100vw"
										className="object-cover object-left-top"
									/>
								</motion.div>
							</AnimatePresence>
						</div>
					</div>
				</Reveal>
			</Container>
		</section>
	);
}
