import { Container } from "@/components/Container";
import { links } from "@/lib/content/links";
import { capabilityGroups } from "@/lib/content/home";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function CapabilityOverview() {
	return (
		<section
			id="capabilities"
			aria-labelledby="capabilities-title"
			className="border-b border-border/40 py-20 sm:py-24"
		>
			<Container>
				<div className="max-w-2xl">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Capabilities
					</p>
					<h2
						id="capabilities-title"
						className="mt-3 font-display text-3xl tracking-tight sm:text-4xl"
					>
						Deploy, operate, observe, control
					</h2>
					<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
						What the platform covers today, grouped by the job it does. Feature
						availability depends on the edition and the integrations you use.
					</p>
				</div>

				<div className="mt-12 grid border-l border-t border-border/40 sm:grid-cols-2 lg:grid-cols-3">
					{capabilityGroups.map((group) => (
						<div
							key={group.title}
							className="border-b border-r border-border/40 px-6 py-7"
						>
							<h3 className="text-base font-semibold text-foreground">
								{group.title}
							</h3>
							<p className="mt-2 text-base leading-relaxed text-muted-foreground">
								{group.description}
							</p>
						</div>
					))}
				</div>

				<div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
					<Link
						href="/platform"
						className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-primary"
					>
						Explore the platform
						<ArrowRight className="h-4 w-4" aria-hidden="true" />
					</Link>
					<a
						href={links.docs.featureMatrix}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
					>
						See what is available today
						<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
					</a>
				</div>
			</Container>
		</section>
	);
}
