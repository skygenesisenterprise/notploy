import { CallToAction } from "@/components/CallToAction";
import { Container } from "@/components/Container";
import { layers } from "@/components/home/content";
import { PageHero } from "@/components/pages/PageHero";
import { PlatformDomains } from "@/components/pages/PlatformDomains";
import {
	CellGrid,
	ChoicePanels,
	PageFaq,
	SectionHeading,
} from "@/components/pages/PagePrimitives";
import { Reveal } from "@/components/home/Reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	IconApi,
	IconArrowRight,
	IconCube,
	IconStack2,
} from "@tabler/icons-react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Platform",
	description:
		"Notploy Platform is the set of capabilities behind the Notploy ecosystem: application deployment, servers, Docker, Swarm, networking, DNS, TLS, storage, secrets, registries, monitoring, schedules and APIs.",
	alternates: {
		canonical: "https://notploy.com/platform",
	},
};

const designPrinciples = [
	{
		icon: IconStack2,
		title: "One control plane",
		description:
			"Applications, databases, servers, domains and users are managed from a single interface — no stitching together five separate tools.",
	},
	{
		icon: IconApi,
		title: "Everything is scriptable",
		description:
			"The dashboard and the API expose the same operations, so anything you can click, you can automate in CI or with your own tooling.",
	},
	{
		icon: IconCube,
		title: "Built on open standards",
		description:
			"Docker, Compose, Traefik and OIDC — Notploy builds on technologies your team already knows instead of inventing proprietary abstractions.",
	},
];

const platformFaqs = [
	{
		question:
			"What is the difference between Notploy Platform, Self and Cloud?",
		answer:
			"Notploy Platform is the shared set of capabilities — deployment, infrastructure, networking, security and operations. Notploy Self is the open-source edition you run yourself; Notploy Cloud is the managed service operated by Notploy. Both run the same platform capabilities.",
	},
	{
		question: "Do I need Kubernetes to use Notploy?",
		answer:
			"No. Notploy is built on Docker and Docker Swarm, with Traefik handling routing and certificates. You get clustering and load balancing without operating a Kubernetes stack.",
	},
	{
		question: "Can I use Notploy with my existing infrastructure?",
		answer:
			"Yes. Notploy runs on any Linux server and can manage remote servers over SSH, so it fits into existing VPS, bare-metal and homelab environments rather than requiring a specific provider.",
	},
	{
		question: "Is every platform capability available in both Self and Cloud?",
		answer:
			"The core capabilities are shared. Operational responsibilities differ: with Self you run and upgrade the control plane yourself, while Cloud operates it for you. See the Self and Cloud pages for details.",
	},
];

export default function PlatformPage() {
	return (
		<div className="min-h-screen bg-background">
			<PageHero
				badge="Platform"
				badgeDetail="Open standards · Docker · Traefik"
				title="One control plane for"
				highlight="every layer"
				description="Notploy Platform is the common set of capabilities shared by Notploy Self and Notploy Cloud: deploying applications, managing servers and clusters, routing traffic, protecting secrets and operating everything through one API. Easy by default, transparent by design."
				actions={
					<>
						<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
							<Link href="/self">
								Deploy with Notploy Self
								<IconArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
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
					</>
				}
				links={[
					{ href: "/integrations", label: "Ways to work with Notploy" },
					{ href: "/pricing", label: "Pricing" },
					{
						href: "https://docs.notploy.com/docs/core/architecture",
						label: "Architecture docs",
						external: true,
					},
				]}
			/>

			<section
				aria-labelledby="capabilities-by-operational-domain"
				className="pb-20 sm:pb-28"
			>
				<Container>
					<SectionHeading
						id="capabilities-by-operational-domain"
						title="Capabilities by operational domain"
						description="The platform covers the full lifecycle of an application, from the first commit to day-two operations. Each domain stands on its own, but they are designed to work together."
					/>
					<PlatformDomains />
				</Container>
			</section>

			<section
				aria-labelledby="how-the-platform-fits-together"
				className="py-20 sm:py-28"
			>
				<Container>
					<SectionHeading
						id="how-the-platform-fits-together"
						title="How the platform fits together"
						description="Notploy is infrastructure-first: the platform manages the machinery — servers, containers, routing, certificates, storage — while you keep ownership of it."
					/>

					<div className="mx-auto mt-12 max-w-4xl space-y-3">
						{layers.map((layer, index) => {
							const isPlatform = layer.layer === "Notploy";
							return (
								<Reveal key={layer.title} delay={index * 0.08}>
									<div
										className={cn(
											"grid gap-4 rounded-2xl border p-6 sm:grid-cols-[160px_1fr] sm:items-center sm:p-8",
											isPlatform
												? "border-primary bg-primary text-primary-foreground"
												: "border-border/50 bg-card",
										)}
									>
										<p
											className={cn(
												"text-sm font-medium",
												isPlatform
													? "text-primary-foreground/75"
													: "text-muted-foreground",
											)}
										>
											{layer.layer}
										</p>
										<div>
											<h3
												className={cn(
													"font-display text-xl tracking-tight sm:text-2xl",
													isPlatform
														? "text-primary-foreground"
														: "text-foreground",
												)}
											>
												{layer.title}
											</h3>
											<p
												className={cn(
													"mt-2 text-base leading-relaxed",
													isPlatform
														? "text-primary-foreground/75"
														: "text-muted-foreground",
												)}
											>
												{layer.description}
											</p>
										</div>
									</div>
								</Reveal>
							);
						})}
					</div>

					<div className="mt-8 text-center">
						<Button variant="outline" className="rounded-full" asChild>
							<Link
								href="https://docs.notploy.com/docs/core/architecture"
								target="_blank"
							>
								Read the architecture documentation
								<ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
					</div>
				</Container>
			</section>

			<CellGrid
				id="design-principles"
				title="How the platform is built"
				description="The decisions behind the product, visible in every screen and every endpoint."
				items={designPrinciples}
				columns={3}
			/>

			<ChoicePanels
				id="one-platform-two-ways-to-run-it"
				title="One platform, two ways to run it"
				description="The capabilities are the same. What changes is who operates the control plane — you, or Notploy."
				panels={[
					{
						name: "Notploy Self",
						tagline: "You operate the platform",
						description:
							"The open-source edition. You install it on infrastructure you own and keep full control over updates, data and network boundaries.",
						bullets: [
							"Apache-2.0 and free to self-host",
							"Run on any Linux server with Docker",
							"Keep data, secrets and backups inside your boundary",
							"Extend it, script it and audit it",
						],
						cta: "Explore Self",
						href: "/self",
					},
					{
						name: "Notploy Cloud",
						tagline: "Notploy operates it for you",
						description:
							"The managed service operated by Notploy. The control plane is run and upgraded for you, with support and availability commitments.",
						bullets: [
							"Control plane hosted and monitored for you",
							"Always on a supported release",
							"Support with response commitments",
							"Same platform capabilities as Self",
						],
						cta: "Explore Cloud",
						href: "/cloud",
						highlighted: true,
					},
				]}
			/>

			<PageFaq
				id="platform-faqs"
				title="Platform FAQs"
				description="How the shared platform relates to the two editions."
				faqs={platformFaqs}
			/>

			<CallToAction />
		</div>
	);
}
