import { Container } from "@/components/Container";
import { Reveal } from "@/components/home/Reveal";
import { PageHero } from "@/components/pages/PageHero";
import { SectionHeading } from "@/components/pages/PagePrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getJobs } from "@/lib/ghost";
import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Notploy Jobs & Open Positions",
	description:
		"Join Notploy and help developers and teams ship faster with open-source and scalable deployment tools built for the modern web.",
};

export default async function JobsPage() {
	const jobs = await getJobs();
	const openPositions = jobs.map((job) => ({
		title: job.title,
		region: job.region,
		description: job.description,
		href: job.applyUrl,
	}));

	return (
		<div className="min-h-screen bg-background">
			<PageHero
				badge="Careers"
				badgeDetail="Remote-first"
				title="Help redefine how the world"
				highlight="deploys software"
				description="We are a small, focused team building tools that developers actually love. If you care about open source, developer experience and shipping things that matter, you will fit right in."
				actions={
					<Button className="rounded-full" asChild>
						<Link href="#open-positions">See open positions</Link>
					</Button>
				}
				links={[
					{ href: "https://github.com/skygenesisenterprise/notploy", label: "GitHub" },
					{ href: "/community", label: "Community" },
				]}
			/>

			<section id="open-positions" aria-labelledby="open-positions-heading" className="pb-20 sm:pb-28">
				<Container>
					<SectionHeading
						id="open-positions-heading"
						title="Open positions"
						description="We hire for curiosity and craft. Every role is remote-friendly and open source by default."
					/>

					{openPositions.length > 0 ? (
						<div className="mx-auto mt-12 max-w-4xl border-t border-border/40">
							{openPositions.map((position) => (
								<Reveal key={position.title}>
									<div className="flex flex-col gap-5 border-b border-border/40 py-6 sm:flex-row sm:items-center sm:justify-between">
										<div className="flex flex-col gap-2">
											<div className="flex flex-wrap items-center gap-3">
												<h3 className="text-lg font-semibold text-foreground">
													{position.title}
												</h3>
												<Badge
													variant="secondary"
													className="flex items-center gap-1 text-xs"
												>
													<MapPin className="h-3 w-3" />
													{position.region}
												</Badge>
											</div>
											<p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
												{position.description}
											</p>
										</div>
										<Button asChild variant="outline" className="shrink-0 rounded-full">
											<Link
												href={position.href}
												target={position.href.startsWith("http") ? "_blank" : undefined}
												rel={position.href.startsWith("http") ? "noreferrer" : undefined}
											>
												Learn more
												<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
											</Link>
										</Button>
									</div>
								</Reveal>
							))}
						</div>
					) : (
						<Reveal className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border/50 bg-card p-8 text-center">
							<p className="text-base text-muted-foreground">
								No open positions at the moment. Check back soon, or introduce
								yourself at{" "}
								<a
									href="mailto:careers@notploy.com"
									className="text-primary hover:underline"
								>
									careers@notploy.com
								</a>
								.
							</p>
						</Reveal>
					)}
				</Container>
			</section>
		</div>
	);
}
