import { Container } from "@/components/Container";
import { audiencePaths } from "@/lib/content/home";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function AudiencePaths() {
	return (
		<section
			id="who-it-is-for"
			aria-labelledby="who-it-is-for-title"
			className="border-b border-border/40 py-20 sm:py-24"
		>
			<Container>
				<div className="max-w-2xl">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Who it is for
					</p>
					<h2
						id="who-it-is-for-title"
						className="mt-3 font-display text-3xl tracking-tight sm:text-4xl"
					>
						One platform, three starting points
					</h2>
					<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
						The same product, approached from a homelab, a development team or
						an organisation with governance requirements.
					</p>
				</div>

				<ul className="mt-12 grid gap-4 md:grid-cols-3">
					{audiencePaths.map((path) => (
						<li key={path.title}>
							<Link
								href={path.href}
								className="group flex h-full flex-col rounded-xl border border-border/50 bg-card p-6 transition-colors hover:border-border"
							>
								<h3 className="text-lg font-semibold text-foreground">
									{path.title}
								</h3>
								<p className="mt-3 flex-1 text-base leading-relaxed text-muted-foreground">
									{path.description}
								</p>
								<span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-foreground">
									{path.cta}
									<ArrowRight
										className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
										aria-hidden="true"
									/>
								</span>
							</Link>
						</li>
					))}
				</ul>
			</Container>
		</section>
	);
}
