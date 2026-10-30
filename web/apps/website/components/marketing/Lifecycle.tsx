import { Container } from "@/components/Container";
import { lifecycle } from "@/lib/content/home";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function Lifecycle() {
	return (
		<section
			id="lifecycle"
			aria-labelledby="lifecycle-title"
			className="border-b border-border/40 py-20 sm:py-24"
		>
			<Container>
				<div className="max-w-2xl">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						How it fits together
					</p>
					<h2
						id="lifecycle-title"
						className="mt-3 font-display text-3xl tracking-tight sm:text-4xl"
					>
						From your infrastructure to running services
					</h2>
					<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
						Notploy sits between the machines you control and the services you
						depend on. Nothing else in the stack is owned by us.
					</p>
				</div>

				<ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border/50 bg-border/50 sm:grid-cols-3">
					{lifecycle.map((step) => (
						<li key={step.step} className="bg-background p-6 sm:p-8">
							<div className="flex items-baseline gap-3">
								<span className="font-mono text-sm text-primary">{step.step}</span>
								<h3 className="text-lg font-semibold text-foreground">
									{step.title}
								</h3>
							</div>
							<p className="mt-3 text-base leading-relaxed text-muted-foreground">
								{step.description}
							</p>
						</li>
					))}
				</ol>

				<div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
					<Link
						href="/platform"
						className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-primary"
					>
						Explore the platform
						<ArrowRight className="h-4 w-4" aria-hidden="true" />
					</Link>
					<span className="text-muted-foreground">
						Single server today, more nodes when you need them.
					</span>
				</div>
			</Container>
		</section>
	);
}
