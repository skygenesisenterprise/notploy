import { Container } from "@/components/Container";
import { links } from "@/lib/content/links";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const paths = [
	{
		label: "Install Notploy Self",
		description: "Free, open source, on the servers you control.",
		href: "/self",
		external: false,
	},
	{
		label: "Explore Notploy Cloud",
		description: "Managed by Notploy, with the control plane operated for you.",
		href: "/cloud",
		external: false,
	},
	{
		label: "Read the documentation",
		description: "Installation, architecture and reference.",
		href: links.docs.home,
		external: true,
	},
	{
		label: "View the source",
		description: "Apache-2.0 repository, issues and releases.",
		href: links.github.repo,
		external: true,
	},
];

export function FinalCta() {
	return (
		<section aria-labelledby="get-started" className="py-20 sm:py-24">
			<Container>
				<div className="max-w-4xl">
					<h2
						id="get-started"
						className="font-display text-3xl tracking-tight sm:text-4xl"
					>
						Start with the infrastructure you already have.
					</h2>
					<p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
						Install Notploy Self on a server you control, or let Notploy operate
						the control plane with Cloud. Both paths lead to the same platform.
					</p>
				</div>

				<ul className="mt-10 grid gap-4 sm:grid-cols-2">
					{paths.map((path) => {
						const content = (
							<>
								<span className="flex items-start justify-between gap-4">
									<span className="text-base font-semibold text-foreground">
										{path.label}
									</span>
									{path.external ? (
										<ArrowUpRight
											className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
											aria-hidden="true"
										/>
									) : (
										<ArrowRight
											className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
											aria-hidden="true"
										/>
									)}
								</span>
								<span className="mt-2 block text-base leading-relaxed text-muted-foreground">
									{path.description}
								</span>
							</>
						);

						return (
							<li key={path.label}>
								{path.external ? (
									<a
										href={path.href}
										target="_blank"
										rel="noreferrer"
										className="flex h-full flex-col rounded-xl border border-border/50 bg-card p-6 transition-colors hover:border-border"
									>
										{content}
									</a>
								) : (
									<Link
										href={path.href}
										className="flex h-full flex-col rounded-xl border border-border/50 bg-card p-6 transition-colors hover:border-border"
									>
										{content}
									</Link>
								)}
							</li>
						);
					})}
				</ul>
			</Container>
		</section>
	);
}
