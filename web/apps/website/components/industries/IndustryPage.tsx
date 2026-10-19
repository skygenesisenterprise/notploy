import { CallToAction } from "@/components/CallToAction";
import { Container } from "@/components/Container";
import { Reveal } from "@/components/home/Reveal";
import { PageHero } from "@/components/pages/PageHero";
import {
	CellGrid,
	PageFaq,
	SectionHeading,
	SplitFeatureList,
} from "@/components/pages/PagePrimitives";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowUpRight, CheckCircle2, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export interface IndustryFeature {
	icon: LucideIcon;
	title: string;
	description: string;
}

export interface IndustryStep {
	title: string;
	description: string;
	flow: string;
}

export interface IndustryPageData {
	hero: {
		title: string;
		description: string;
	};
	features: {
		heading: string;
		description: string;
		items: IndustryFeature[];
	};
	comparison: {
		heading: string;
		description: string;
		without: { title: string; items: string[] };
		withNotploy: { title: string; items: string[] };
	};
	workflow: {
		heading: string;
		description: string;
		steps: IndustryStep[];
	};
	builtFor: {
		heading: string;
		paragraphs: string[];
		screenshotAlt: string;
	};
	detailRows: { area: string; support: string }[];
	faqs: {
		heading: string;
		items: { question: string; answer: string }[];
	};
}

export function IndustryPage({ data }: { data: IndustryPageData }) {
	return (
		<div className="min-h-screen bg-background">
			<PageHero
				compact
				badge="Industry"
				badgeDetail="Governed deployment"
				title={data.hero.title}
				description={data.hero.description}
				actions={
					<>
						<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
							<Link
								href="https://app.notploy.com/register"
								target="_blank"
								rel="noopener noreferrer"
							>
								Get Started
								<ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
						<Button
							variant="outline"
							className="w-full rounded-full px-6 sm:w-auto"
							asChild
						>
							<Link href="/contact">Contact Sales</Link>
						</Button>
					</>
				}
				links={[
					{ href: "/self", label: "Self-host Notploy" },
					{ href: "/platform", label: "Platform capabilities" },
					{ href: "/industries", label: "All industries" },
				]}
			/>

			<CellGrid
				id="industry-features"
				title={data.features.heading}
				description={data.features.description}
				items={data.features.items}
				columns={3}
			/>

			<section
				aria-labelledby="industry-comparison"
				className="py-20 sm:py-28"
			>
				<Container>
					<SectionHeading
						id="industry-comparison"
						title={data.comparison.heading}
						description={data.comparison.description}
					/>

					<div className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-2">
						<Reveal>
							<div className="flex h-full flex-col rounded-2xl border border-border/50 bg-card p-8">
								<h3 className="font-display text-2xl tracking-tight text-foreground">
									{data.comparison.without.title}
								</h3>
								<ul className="mt-6 flex-1 space-y-4">
									{data.comparison.without.items.map((item) => (
										<li key={item} className="flex items-start gap-3">
											<AlertTriangle
												className="mt-1 h-5 w-5 shrink-0 text-muted-foreground"
												aria-hidden="true"
											/>
											<span className="text-base leading-relaxed text-muted-foreground">
												{item}
											</span>
										</li>
									))}
								</ul>
							</div>
						</Reveal>

						<Reveal delay={0.08}>
							<div className="flex h-full flex-col rounded-2xl border border-primary bg-primary p-8 text-primary-foreground">
								<h3 className="font-display text-2xl tracking-tight">
									{data.comparison.withNotploy.title}
								</h3>
								<ul className="mt-6 flex-1 space-y-4">
									{data.comparison.withNotploy.items.map((item) => (
										<li key={item} className="flex items-start gap-3">
											<CheckCircle2
												className="mt-1 h-5 w-5 shrink-0 text-primary-foreground"
												aria-hidden="true"
											/>
											<span className="text-base leading-relaxed text-primary-foreground/75">
												{item}
											</span>
										</li>
									))}
								</ul>
							</div>
						</Reveal>
					</div>
				</Container>
			</section>

			<SplitFeatureList
				id="industry-workflow"
				title={data.workflow.heading}
				description={data.workflow.description}
				items={data.workflow.steps.map((step) => ({
					title: step.title,
					description: step.description,
					meta: step.flow,
				}))}
			/>

			<section aria-labelledby="industry-built-for" className="py-20 sm:py-28">
				<Container>
					<div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
						<Reveal>
							<h2
								id="industry-built-for"
								className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
							>
								{data.builtFor.heading}
							</h2>
							{data.builtFor.paragraphs.map((paragraph) => (
								<p
									key={paragraph}
									className="mt-5 text-base leading-relaxed text-muted-foreground"
								>
									{paragraph}
								</p>
							))}
						</Reveal>

						<Reveal delay={0.08}>
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
										notploy/environments
									</span>
								</div>
								<div className="relative aspect-video w-full bg-secondary">
									<Image
										src="/images/notploy-environments.png"
										alt={data.builtFor.screenshotAlt}
										fill
										className="object-cover object-top"
										sizes="(max-width: 1024px) 100vw, 55vw"
									/>
								</div>
							</div>
						</Reveal>
					</div>
				</Container>
			</section>

			<section aria-labelledby="industry-details" className="py-20 sm:py-28">
				<Container>
					<SectionHeading
						id="industry-details"
						title="Platform details at a glance"
						description="The same capabilities across every sector, visible in one table."
					/>

					<Reveal className="mx-auto mt-12 max-w-4xl">
						<div className="overflow-x-auto rounded-2xl border border-border/50">
							<table className="w-full border-collapse text-left">
								<thead className="bg-card">
									<tr>
										<th className="px-6 py-4 text-base font-semibold text-foreground">
											Area
										</th>
										<th className="px-6 py-4 text-base font-semibold text-foreground">
											What Notploy supports
										</th>
									</tr>
								</thead>
								<tbody>
									{data.detailRows.map((row) => (
										<tr key={row.area} className="border-t border-border/50">
											<td className="px-6 py-4 font-medium text-foreground">
												{row.area}
											</td>
											<td className="px-6 py-4 text-sm leading-relaxed text-muted-foreground">
												{row.support}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</Reveal>
				</Container>
			</section>

			<PageFaq
				id="industry-faqs"
				title={data.faqs.heading}
				description="The questions platform and security teams ask before the first deployment."
				faqs={data.faqs.items}
			/>

			<CallToAction />
		</div>
	);
}
