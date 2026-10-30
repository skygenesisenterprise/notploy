import { Container } from "@/components/Container";
import { links } from "@/lib/content/links";
import { ArrowUpRight } from "lucide-react";

const facts = [
	{
		title: "Apache-2.0",
		description:
			"The licence covers the platform source. Read it, audit it, modify it and redistribute it.",
		href: links.github.repo,
		label: "View the repository",
		external: true,
	},
	{
		title: "Public development",
		description:
			"Issues, pull requests and release notes are tracked in the open on GitHub.",
		href: links.github.releases,
		label: "Release notes",
		external: true,
	},
	{
		title: "Community",
		description:
			"Questions, setups and trade-offs are discussed in Discussions and on Discord.",
		href: links.github.discussions,
		label: "Join the discussions",
		external: true,
	},
	{
		title: "Service status",
		description:
			"Availability of the hosted services is published independently of this site.",
		href: links.status,
		label: "Open the status page",
		external: true,
	},
];

export function OpenSource() {
	return (
		<section
			id="open-source"
			aria-labelledby="open-source-title"
			className="border-b border-border/40 py-20 sm:py-24"
		>
			<Container>
				<div className="max-w-2xl">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Built in the open
					</p>
					<h2
						id="open-source-title"
						className="mt-3 font-display text-3xl tracking-tight sm:text-4xl"
					>
						You can verify what you are running
					</h2>
					<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
						Notploy is developed publicly and licensed for self-hosting. Source,
						releases and support channels are outside this marketing site.
					</p>
				</div>

				<ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border/50 bg-border/50 sm:grid-cols-2 lg:grid-cols-4">
					{facts.map((fact) => (
						<li key={fact.title} className="bg-background p-6">
							<h3 className="text-base font-semibold text-foreground">
								{fact.title}
							</h3>
							<p className="mt-2 text-base leading-relaxed text-muted-foreground">
								{fact.description}
							</p>
							<a
								href={fact.href}
								target={fact.external ? "_blank" : undefined}
								rel={fact.external ? "noreferrer" : undefined}
								className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"
							>
								{fact.label}
								<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
							</a>
						</li>
					))}
				</ul>
			</Container>
		</section>
	);
}
