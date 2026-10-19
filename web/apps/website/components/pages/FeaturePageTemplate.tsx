import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CallToAction } from "../CallToAction";
import { Container } from "../Container";
import { Reveal } from "../home/Reveal";
import { Button } from "../ui/button";
import { PageHero, type PageHeroProps } from "./PageHero";
import {
	CellGrid,
	type CellItem,
	type FaqEntry,
	PageFaq,
	SplitFeatureList,
} from "./PagePrimitives";

export interface FeatureSectionConfig {
	id: string;
	title: string;
	description?: string;
	items: CellItem[];
	columns?: 2 | 3 | 4;
	layout?: "grid" | "split";
	callout?: {
		title: string;
		description: string;
		cta: string;
		href: string;
		external?: boolean;
	};
}

export interface FeaturePageTemplateProps {
	badge?: string;
	badgeDetail?: string;
	badgeHref?: string;
	title: string;
	highlight?: string;
	description: string;
	actions?: ReactNode;
	links?: PageHeroProps["links"];
	heroChildren?: ReactNode;
	sections: FeatureSectionConfig[];
	related?: {
		id: string;
		title: string;
		description?: string;
		items: CellItem[];
		columns?: 2 | 3 | 4;
	};
	faqs?: {
		id: string;
		title: string;
		description?: string;
		items: FaqEntry[];
	};
	/** Unique sections that do not fit the section schema. */
	children?: ReactNode;
	finalCta?: {
		title: string;
		description: string;
		cta: string;
		href: string;
		external?: boolean;
	};
}

export function FeaturePageTemplate({
	badge,
	badgeDetail,
	badgeHref,
	title,
	highlight,
	description,
	actions,
	links,
	heroChildren,
	sections,
	related,
	faqs,
	children,
	finalCta,
}: FeaturePageTemplateProps) {
	return (
		<div className="min-h-screen bg-background">
			<PageHero
				badge={badge}
				badgeDetail={badgeDetail}
				badgeHref={badgeHref}
				title={title}
				highlight={highlight}
				description={description}
				actions={actions}
				links={links}
			>
				{heroChildren}
			</PageHero>

			{sections.map((section) =>
				section.layout === "split" ? (
					<SplitFeatureList
						key={section.id}
						id={section.id}
						title={section.title}
						description={section.description}
						items={section.items.map((item) => ({
							icon: item.icon,
							title: item.title,
							description: item.description,
						}))}
					/>
				) : (
					<div key={section.id}>
						<CellGrid
							id={section.id}
							title={section.title}
							description={section.description}
							items={section.items}
							columns={section.columns}
						/>
						{section.callout && (
							<Container className="pb-20 sm:pb-28">
								<Reveal className="mx-auto max-w-3xl rounded-2xl border border-border/50 bg-card p-8 text-center">
									<h3 className="font-display text-2xl tracking-tight text-foreground">
										{section.callout.title}
									</h3>
									<p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
										{section.callout.description}
									</p>
									<div className="mt-6">
										<Button className="rounded-full" asChild>
											<Link
												href={section.callout.href}
												target={
													section.callout.external ? "_blank" : undefined
												}
												rel={
													section.callout.external ? "noreferrer" : undefined
												}
											>
												{section.callout.cta}
												<ArrowRight
													className="ml-2 h-4 w-4"
													aria-hidden="true"
												/>
											</Link>
										</Button>
									</div>
								</Reveal>
							</Container>
						)}
					</div>
				),
			)}

			{children}

			{related && (
				<CellGrid
					id={related.id}
					title={related.title}
					description={related.description}
					items={related.items}
					columns={related.columns ?? 3}
				/>
			)}

			{faqs && (
				<PageFaq
					id={faqs.id}
					title={faqs.title}
					description={faqs.description}
					faqs={faqs.items}
				/>
			)}

			{finalCta && (
				<section className="py-20 sm:py-28">
					<Container>
						<Reveal className="mx-auto max-w-2xl text-center">
							<h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
								{finalCta.title}
							</h2>
							<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
								{finalCta.description}
							</p>
							<div className="mt-8">
								<Button className="rounded-full" asChild>
									<Link
										href={finalCta.href}
										target={finalCta.external ? "_blank" : undefined}
										rel={finalCta.external ? "noreferrer" : undefined}
									>
										{finalCta.cta}
										<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
									</Link>
								</Button>
							</div>
						</Reveal>
					</Container>
				</section>
			)}

			{!finalCta && <CallToAction />}
		</div>
	);
}
