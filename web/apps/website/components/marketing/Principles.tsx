import { Container } from "@/components/Container";
import { links } from "@/lib/content/links";
import { principles } from "@/lib/content/home";
import { ArrowUpRight } from "lucide-react";

export function Principles() {
	return (
		<section
			id="principles"
			aria-labelledby="principles-title"
			className="border-b border-border/40 py-20 sm:py-24"
		>
			<Container>
				<div className="max-w-2xl">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Principles
					</p>
					<h2
						id="principles-title"
						className="mt-3 font-display text-3xl tracking-tight sm:text-4xl"
					>
						What we commit to — and what we do not claim
					</h2>
					<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
						Notploy is built around ownership and open technology. Where a
						statement depends on your setup or on the law, we say so instead of
						replacing it with a label.
					</p>
				</div>

				<dl className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border/50 bg-border/50 sm:grid-cols-2 lg:grid-cols-3">
					{principles.map((principle) => (
						<div key={principle.title} className="bg-background p-6 sm:p-8">
							<dt className="text-base font-semibold text-foreground">
								{principle.title}
							</dt>
							<dd className="mt-2 text-base leading-relaxed text-muted-foreground">
								{principle.description}
							</dd>
						</div>
					))}
					<div className="bg-background p-6 sm:p-8">
						<dt className="text-base font-semibold text-foreground">
							Verifiable statements
						</dt>
						<dd className="mt-2 text-base leading-relaxed text-muted-foreground">
							Claimed capabilities are traced to the documentation or the
							product. What is still being built is labelled as such.
						</dd>
						<a
							href={links.docs.philosophy}
							target="_blank"
							rel="noreferrer"
							className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"
						>
							Read the project philosophy
							<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
						</a>
					</div>
				</dl>
			</Container>
		</section>
	);
}
