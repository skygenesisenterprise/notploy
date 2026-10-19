import { ArrowRight, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { Container } from "../Container";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../ui/accordion";
import { Reveal } from "../home/Reveal";

export type FeatureIcon = React.ComponentType<{
	className?: string;
	"aria-hidden"?: boolean | "true" | "false";
}>;

export interface SectionHeadingProps {
	id?: string;
	title: string;
	description?: string;
	className?: string;
	/** Left-aligned headings are used to break the centred rhythm. */
	align?: "center" | "left";
}

export function SectionHeading({
	id,
	title,
	description,
	className,
	align = "center",
}: SectionHeadingProps) {
	return (
		<Reveal
			className={cn(
				align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl",
				className,
			)}
		>
			<h2
				id={id}
				className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
			>
				{title}
			</h2>
			{description && (
				<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
					{description}
				</p>
			)}
		</Reveal>
	);
}

export interface CellItem {
	title: string;
	description: string;
	icon?: FeatureIcon;
	href?: string;
}

export function CellGrid({
	id,
	title,
	description,
	items,
	columns = 4,
	className,
}: {
	id?: string;
	title: string;
	description?: string;
	items: CellItem[];
	columns?: 2 | 3 | 4;
	className?: string;
}) {
	const columnClass =
		columns === 2
			? "sm:grid-cols-2"
			: columns === 3
				? "sm:grid-cols-2 lg:grid-cols-3"
				: "sm:grid-cols-2 lg:grid-cols-4";

	return (
		<section aria-labelledby={id} className={cn("py-20 sm:py-28", className)}>
			<Container>
				<SectionHeading id={id} title={title} description={description} />

				<div
					className={cn(
						"mx-auto mt-12 grid max-w-7xl grid-cols-1 border-l border-t border-border/40",
						columnClass,
					)}
				>
					{items.map((item) => {
						const content = (
							<>
								{item.icon && (
									<item.icon
										className="mb-5 h-7 w-7 text-primary [stroke-width:1.5]"
										aria-hidden
									/>
								)}
								<div className="mb-2 flex items-start gap-3">
									<span className="mt-1 h-5 w-0.5 shrink-0 rounded-full bg-primary/30 transition-all duration-200 group-hover:h-7 group-hover:bg-primary" />
									<h3 className="text-lg font-semibold leading-snug text-foreground transition-transform duration-200 group-hover:translate-x-1">
										{item.title}
									</h3>
								</div>
								<p className="text-base leading-relaxed text-muted-foreground">
									{item.description}
								</p>
							</>
						);

						const cellClass =
							"group relative flex flex-col border-b border-r border-border/40 px-8 py-9 transition-colors hover:bg-card";

						return item.href ? (
							<Link key={item.title} href={item.href} className={cellClass}>
								{content}
							</Link>
						) : (
							<div key={item.title} className={cellClass}>
								{content}
							</div>
						);
					})}
				</div>
			</Container>
		</section>
	);
}

export interface SplitFeature {
	title: string;
	description: string;
	icon?: FeatureIcon;
	meta?: string;
}

export function SplitFeatureList({
	id,
	title,
	description,
	items,
	aside,
	className,
}: {
	id?: string;
	title: string;
	description?: string;
	items: SplitFeature[];
	aside?: React.ReactNode;
	className?: string;
}) {
	return (
		<section
			aria-labelledby={id}
			className={cn("relative py-20 sm:py-28", className)}
		>
			<Container>
				<div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] lg:gap-20">
					<div className="lg:sticky lg:top-28 lg:self-start">
						<Reveal>
							<h2
								id={id}
								className="max-w-md font-display text-3xl tracking-tight text-foreground sm:text-4xl"
							>
								{title}
							</h2>
							{description && (
								<p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
									{description}
								</p>
							)}
							{aside}
						</Reveal>
					</div>

					<ul className="border-t border-border/40">
						{items.map((item, index) => (
							<Reveal key={item.title} delay={index * 0.04}>
								<li className="grid gap-4 border-b border-border/40 py-8 sm:grid-cols-[auto_1fr] sm:gap-6">
									{item.icon ? (
										<item.icon
											className="mt-0.5 h-6 w-6 text-primary [stroke-width:1.5]"
											aria-hidden
										/>
									) : (
										<span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
									)}
									<div>
										<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
											<h3 className="text-xl font-semibold text-foreground">
												{item.title}
											</h3>
											{item.meta && (
												<span className="text-sm text-muted-foreground">
													{item.meta}
												</span>
											)}
										</div>
										<p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
											{item.description}
										</p>
									</div>
								</li>
							</Reveal>
						))}
					</ul>
				</div>
			</Container>
		</section>
	);
}

export interface ProcessStep {
	title: string;
	description: string;
	label?: string;
}

export function ProcessRail({
	id,
	title,
	description,
	steps,
	className,
}: {
	id?: string;
	title: string;
	description?: string;
	steps: ProcessStep[];
	className?: string;
}) {
	return (
		<section aria-labelledby={id} className={cn("py-20 sm:py-28", className)}>
			<Container>
				<SectionHeading id={id} title={title} description={description} />

				<Reveal className="mx-auto mt-12 max-w-6xl">
					<div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-10">
						<ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
							{steps.map((step) => (
								<li key={step.title} className="relative flex flex-col">
									<div className="flex items-center gap-3" aria-hidden="true">
										<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
										<span className="h-px flex-1 bg-border" />
									</div>
									{step.label && (
										<span className="mt-5 w-fit rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
											{step.label}
										</span>
									)}
									<h3 className="mt-4 text-lg font-semibold text-foreground">
										{step.title}
									</h3>
									<p className="mt-2 text-base leading-relaxed text-muted-foreground">
										{step.description}
									</p>
								</li>
							))}
						</ol>
					</div>
				</Reveal>
			</Container>
		</section>
	);
}

export interface ChoicePanel {
	name: string;
	tagline: string;
	description: string;
	bullets: string[];
	cta: string;
	href: string;
	external?: boolean;
	highlighted?: boolean;
}

export function ChoicePanels({
	id,
	title,
	description,
	panels,
	columns = 2,
	className,
}: {
	id?: string;
	title: string;
	description?: string;
	panels: ChoicePanel[];
	columns?: 2 | 3;
	className?: string;
}) {
	return (
		<section aria-labelledby={id} className={cn("py-20 sm:py-28", className)}>
			<Container>
				<SectionHeading id={id} title={title} description={description} />

				<div
					className={cn(
						"mx-auto mt-10 grid max-w-5xl gap-4",
						columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
					)}
				>
					{panels.map((panel, index) => (
						<Reveal key={panel.name} delay={index * 0.08}>
							<div
								className={cn(
									"flex h-full flex-col rounded-2xl border p-8",
									panel.highlighted
										? "border-primary bg-primary text-primary-foreground"
										: "border-border/50 bg-card text-foreground",
								)}
							>
								<h3 className="font-display text-2xl tracking-tight">
									{panel.name}
								</h3>
								<p
									className={cn(
										"mt-2 text-base font-medium",
										panel.highlighted ? "text-primary-foreground" : "text-primary",
									)}
								>
									{panel.tagline}
								</p>
								<p
									className={cn(
										"mt-4 text-base leading-relaxed",
										panel.highlighted
											? "text-primary-foreground/75"
											: "text-muted-foreground",
									)}
								>
									{panel.description}
								</p>

								<ul className="mt-6 flex-1 space-y-3">
									{panel.bullets.map((bullet) => (
										<li key={bullet} className="flex gap-3 text-base">
											<span
												className={cn(
													"mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
													panel.highlighted
														? "bg-primary-foreground"
														: "bg-primary",
												)}
											/>
											<span
												className={
													panel.highlighted
														? "text-primary-foreground/75"
														: "text-muted-foreground"
												}
											>
												{bullet}
											</span>
										</li>
									))}
								</ul>

								<div className="mt-8">
									<Link
										href={panel.href}
										target={panel.external ? "_blank" : undefined}
										rel={panel.external ? "noreferrer" : undefined}
										className={cn(
											"inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors",
											panel.highlighted
												? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
												: "bg-primary text-primary-foreground hover:bg-primary/90",
										)}
									>
										{panel.cta}
										<ArrowRight className="h-4 w-4" aria-hidden="true" />
									</Link>
								</div>
							</div>
						</Reveal>
					))}
				</div>
			</Container>
		</section>
	);
}

export interface FaqEntry {
	question: string;
	answer: React.ReactNode;
}

export function PageFaq({
	id,
	title,
	description,
	faqs,
	className,
}: {
	id: string;
	title: string;
	description?: string;
	faqs: FaqEntry[];
	className?: string;
}) {
	return (
		<section aria-labelledby={id} className={cn("py-20 sm:py-28", className)}>
			<Container>
				<SectionHeading id={id} title={title} description={description} />

				<Reveal className="mx-auto mt-12 w-full max-w-3xl">
					<Accordion type="single" collapsible>
						{faqs.map((faq, index) => (
							<AccordionItem value={`faq-${index}`} key={faq.question}>
								<AccordionTrigger className="text-left text-base">
									{faq.question}
								</AccordionTrigger>
								<AccordionContent>{faq.answer}</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</Reveal>
			</Container>
		</section>
	);
}

export function ProductFrame({
	src,
	alt,
	path,
	caption,
	className,
}: {
	src: string;
	alt: string;
	path: string;
	caption?: string;
	className?: string;
}) {
	return (
		<Reveal className={cn("mx-auto max-w-6xl", className)}>
			<div
				className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl"
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
						{path}
					</span>
					<span className="ml-auto hidden text-[13px] text-muted-foreground sm:block">
						Notploy
					</span>
				</div>
				<div className="relative aspect-[4/3] w-full bg-secondary sm:aspect-[16/9]">
					<Image
						src={src}
						alt={alt}
						fill
						sizes="(min-width: 1280px) 1152px, 100vw"
						className="object-cover object-left-top"
					/>
				</div>
			</div>
			{caption && (
				<p className="mt-3 text-center text-sm text-muted-foreground">
					{caption}
				</p>
			)}
		</Reveal>
	);
}

export function Checklist({ items }: { items: string[] }) {
	return (
		<ul className="space-y-3">
			{items.map((item) => (
				<li key={item} className="flex gap-3 text-base text-muted-foreground">
					<Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
					<span>{item}</span>
				</li>
			))}
		</ul>
	);
}
