import { Container } from "@/components/Container";
import { editionOptions } from "@/lib/content/home";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function EditionPaths() {
	return (
		<section
			id="self-or-cloud"
			aria-labelledby="self-or-cloud-title"
			className="border-b border-border/40 py-20 sm:py-24"
		>
			<Container>
				<div className="max-w-2xl">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Ways to run it
					</p>
					<h2
						id="self-or-cloud-title"
						className="mt-3 font-display text-3xl tracking-tight sm:text-4xl"
					>
						Same platform, two operating models
					</h2>
					<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
						Choose who operates the control plane. Your workloads stay on the
						servers you connect either way.
					</p>
				</div>

				<div className="mt-12 grid gap-4 lg:grid-cols-2">
					{editionOptions.map((option, index) => (
						<div
							key={option.name}
							className={cn(
								"flex flex-col rounded-xl border bg-card p-6 sm:p-8",
								index === 1 ? "border-primary/50" : "border-border/50",
							)}
						>
							<h3 className="font-display text-2xl tracking-tight text-foreground">
								{option.name}
							</h3>
							<p className="mt-1 text-sm font-medium text-primary">
								{option.operator}
							</p>
							<p className="mt-4 text-base leading-relaxed text-muted-foreground">
								{option.description}
							</p>
							<ul className="mt-6 flex-1 space-y-2.5">
								{option.bullets.map((bullet) => (
									<li
										key={bullet}
										className="flex gap-3 text-base leading-relaxed text-muted-foreground"
									>
										<span
											className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary"
											aria-hidden="true"
										/>
										<span>{bullet}</span>
									</li>
								))}
							</ul>
							<Link
								href={option.href}
								className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border/60 px-5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
							>
								{option.cta}
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Link>
						</div>
					))}
				</div>

				<p className="mt-6 text-sm text-muted-foreground">
					The choice is about who operates the platform, not which features you
					get.{" "}
					<Link
						href="/comparison"
						className="text-foreground underline underline-offset-4 hover:text-primary"
					>
						Compare Self and Cloud
					</Link>
					.
				</p>
			</Container>
		</section>
	);
}
