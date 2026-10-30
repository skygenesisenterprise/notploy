import { Container } from "@/components/Container";
import { Button } from "@/components/ui/button";
import { links } from "@/lib/content/links";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { InstallStrip } from "./InstallStrip";

export function Hero() {
	return (
		<section className="relative border-b border-border/40">
			<div className="flex min-h-[calc(100svh_-_4rem)] items-center py-16 sm:py-20">
				<Container className="w-full">
					<div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
						<p className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-sm text-muted-foreground">
							<span
								className="h-1.5 w-1.5 rounded-full bg-primary"
								aria-hidden="true"
							/>
							European application infrastructure
						</p>

						<h1 className="mt-8 max-w-4xl font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
							Your services. Your infrastructure.{" "}
							<span className="text-primary">Your control.</span>
						</h1>

						<p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
							Notploy provides the tools to deploy, operate and control the
							services you depend on — from a personal server or homelab to a
							growing multi-node infrastructure. Run it yourself with Notploy
							Self, or choose Notploy Cloud for a managed experience.
						</p>

						<div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
							<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
								<Link href="/self">
									Install Notploy Self
									<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
								</Link>
							</Button>
							<Button
								variant="outline"
								className="w-full rounded-full px-6 sm:w-auto"
								asChild
							>
								<Link href="/cloud">
									Explore Notploy Cloud
									<ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
								</Link>
							</Button>
						</div>

						<div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
							<a
								href={links.docs.home}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								Read the documentation
								<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
							</a>
							<a
								href={links.github.repo}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								View the source
								<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
							</a>
							<Link
								href="/enterprise"
								className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								Notploy for teams
							</Link>
						</div>

						<InstallStrip />
					</div>
				</Container>
			</div>
		</section>
	);
}
