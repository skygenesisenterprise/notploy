import type { ReactNode } from "react";
import { Container } from "../Container";
import { Reveal } from "../home/Reveal";
import { PageHero } from "./PageHero";

export function LegalPage({
	badge,
	title,
	updated,
	children,
}: {
	badge: string;
	title: string;
	updated?: string;
	children: ReactNode;
}) {
	return (
		<div className="min-h-screen bg-background">
			<PageHero
				compact
				badge="Legal"
				badgeDetail={badge}
				title={title}
				description={
					updated
						? `Last updated ${updated}. This document explains the terms that apply when you use Notploy.`
						: "The terms that apply when you use Notploy."
				}
			/>

			<section className="pb-20 sm:pb-28">
				<Container>
					<Reveal className="mx-auto max-w-3xl">
						<div className="space-y-8 text-base leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:leading-relaxed [&_p]:leading-relaxed [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
							{children}
						</div>
					</Reveal>
				</Container>
			</section>
		</div>
	);
}
