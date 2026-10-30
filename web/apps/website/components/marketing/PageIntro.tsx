import { Container } from "@/components/Container";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export interface PageIntroLink {
	href: string;
	label: string;
	external?: boolean;
}

export interface PageIntroProps {
	badge?: string;
	badgeDetail?: string;
	badgeHref?: string;
	eyebrow?: string;
	title: string;
	/** Final words of the headline, drawn in the primary colour. */
	highlight?: string;
	description: string;
	actions?: ReactNode;
	links?: PageIntroLink[];
	children?: ReactNode;
	compact?: boolean;
}

/**
 * Shared page opener, mirroring the homepage hero: eyebrow, headline,
 * description, calls to action and secondary links, with no decorative motion.
 */
export function PageIntro({
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
}: PageIntroProps) {
	const badgeContent = (
		<>
			<span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
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
		<section className="border-b border-border/40">
			<Container className="py-16 sm:py-20 lg:py-24">
				<div className="mx-auto flex max-w-4xl flex-col items-center text-center">
					{badge &&
						(badgeHref ? (
							<Link
								href={badgeHref}
								target={badgeHref.startsWith("http") ? "_blank" : undefined}
								rel={badgeHref.startsWith("http") ? "noreferrer" : undefined}
								className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
							>
								{badgeContent}
							</Link>
						) : (
							<div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-sm text-muted-foreground">
								{badgeContent}
							</div>
						))}

					{eyebrow && (
						<p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
							{eyebrow}
						</p>
					)}

					<h1
						className={
							compact
								? "mt-4 font-display text-3xl leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl"
								: "mt-4 font-display text-4xl leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl"
						}
					>
						{title}
						{highlight && (
							<>
								{" "}
								<span className="text-primary">{highlight}</span>
							</>
						)}
					</h1>

					<p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
						{description}
					</p>

					{actions && (
						<div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
							{actions}
						</div>
					)}

					{children && <div className="mt-8 w-full">{children}</div>}

					{links && links.length > 0 && (
						<div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
							{links.map((link) => (
								<Link
									key={link.href}
									href={link.href}
									target={link.external ? "_blank" : undefined}
									rel={link.external ? "noreferrer" : undefined}
									className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
								>
									{link.label}
									{link.external && (
										<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
									)}
								</Link>
							))}
						</div>
					)}
				</div>
			</Container>
		</section>
	);
}
