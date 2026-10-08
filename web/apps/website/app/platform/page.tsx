import { CallToAction } from "@/components/CallToAction";
import { Container } from "@/components/Container";
import { Button } from "@/components/ui/button";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	IconApi,
	IconCube,
	IconEye,
	IconKey,
	IconNetwork,
	IconRocket,
	IconServer2,
	IconShieldLock,
	IconStack2,
} from "@tabler/icons-react";
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

const capabilityGroups = [
	{
		icon: IconRocket,
		title: "Deploy",
		description:
			"From a Git repository or a container image to a running application, with build pipelines, environment variables and repeatable deployments.",
		items: [
			"Application deployment with Nixpacks, Buildpacks or a Dockerfile",
			"Native Docker Compose projects",
			"Databases: PostgreSQL, MySQL, MariaDB, MongoDB, Redis",
			"One-click templates for popular tools",
		],
	},
	{
		icon: IconServer2,
		title: "Infrastructure",
		description:
			"Manage the machines that run your workloads — a single server or a whole fleet — without leaving the platform.",
		items: [
			"Server management, local and remote",
			"Docker as the container runtime",
			"Docker Swarm clusters for multi-node deployments",
			"Storage, volumes and S3-compatible object storage",
		],
	},
	{
		icon: IconNetwork,
		title: "Networking",
		description:
			"Traffic, naming and encryption are handled by the platform so services reach each other and the outside world safely.",
		items: [
			"Internal networking between services",
			"DNS and custom domains per application",
			"Automatic TLS certificates and renewal",
			"Load balancing across nodes",
		],
	},
	{
		icon: IconShieldLock,
		title: "Security",
		description:
			"Access to infrastructure is explicit, auditable and revocable — for humans, applications and machines alike.",
		items: [
			"Secrets and encrypted environment variables",
			"Container registry credentials",
			"Role-based access control and SSO",
			"Audit logs and SSH key management",
		],
	},
	{
		icon: IconEye,
		title: "Operations",
		description:
			"Everything needed to keep applications healthy after the first deploy, from observability to automation.",
		items: [
			"Real-time monitoring: CPU, memory, network",
			"Backups and scheduled jobs",
			"REST API, CLI and TypeScript SDK",
			"Webhooks and notifications",
		],
	},
];

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
		question: "What is the difference between Notploy Platform, Self and Cloud?",
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
			<section className="relative overflow-hidden border-b border-border/30 bg-background py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-4xl text-center">
						<h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl lg:text-6xl">
							The capabilities behind the Notploy ecosystem
						</h1>
						<p className="mt-6 text-lg text-muted-foreground">
							Notploy Platform is the common set of capabilities shared by
							Notploy Self and Notploy Cloud: deploying applications, managing
							servers and clusters, routing traffic, protecting secrets and
							operating everything through one API. Easy by default,
							transparent by design.
						</p>
						<div className="mt-10 flex flex-wrap items-center justify-center gap-4">
							<Button className="rounded-full" asChild>
								<Link href="/self">Deploy with Notploy Self</Link>
							</Button>
							<Button
								className="rounded-full bg-primary hover:bg-primary/90"
								asChild
							>
								<Link href="/cloud" className="text-foreground">
									Explore Notploy Cloud
								</Link>
							</Button>
						</div>
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							Capabilities by operational domain
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							The platform covers the full lifecycle of an application, from the
							first commit to day-two operations. Each domain stands on its own,
							but they are designed to work together.
						</p>
					</div>
					<div className="mx-auto mt-16 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
						{capabilityGroups.map((group) => (
							<div
								key={group.title}
								className="rounded-xl border border-border/50 bg-card p-6"
							>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
									<group.icon className="h-6 w-6" />
								</div>
								<h3 className="text-xl font-semibold">{group.title}</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									{group.description}
								</p>
								<ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
									{group.items.map((item) => (
										<li key={item} className="flex gap-2.5">
											<span
												aria-hidden="true"
												className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-primary"
											/>
											<span>{item}</span>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 bg-background py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
							How the platform fits together
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							Notploy is infrastructure-first: the platform manages the
							machinery — servers, containers, routing, certificates, storage —
							while you keep ownership of it.
						</p>
					</div>
					<div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-3">
						{designPrinciples.map((principle) => (
							<div
								key={principle.title}
								className="rounded-xl border border-border/50 bg-card p-6"
							>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
									<principle.icon className="h-6 w-6" />
								</div>
								<h3 className="text-lg font-semibold">{principle.title}</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									{principle.description}
								</p>
							</div>
						))}
					</div>
					<div className="mx-auto mt-12 max-w-2xl text-center">
						<Button variant="outline" className="rounded-full" asChild>
							<Link
								href="https://docs.notploy.com/docs/core/architecture"
								target="_blank"
							>
								Read the architecture documentation
							</Link>
						</Button>
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							One platform, two ways to run it
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							The capabilities are the same. What changes is who operates the
							control plane — you, or Notploy.
						</p>
					</div>
					<div className="mx-auto mt-16 grid max-w-4xl gap-8 sm:grid-cols-2">
						<div className="rounded-xl border border-border/50 bg-card p-8">
							<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
								<IconServer2 className="h-6 w-6" />
							</div>
							<h3 className="text-2xl font-semibold text-foreground">
								Notploy Self
							</h3>
							<p className="mt-3 text-sm text-muted-foreground">
								The open-source edition. You install it on infrastructure you
								own and keep full control over updates, data and network
								boundaries.
							</p>
							<div className="mt-6">
								<Button variant="outline" className="rounded-full" asChild>
									<Link href="/self">Explore Self</Link>
								</Button>
							</div>
						</div>
						<div className="rounded-xl border border-border/50 bg-card p-8">
							<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
								<IconKey className="h-6 w-6" />
							</div>
							<h3 className="text-2xl font-semibold text-foreground">
								Notploy Cloud
							</h3>
							<p className="mt-3 text-sm text-muted-foreground">
								The managed service operated by Notploy. The control plane is
								run and upgraded for you, with support and availability
								commitments.
							</p>
							<div className="mt-6">
								<Button variant="outline" className="rounded-full" asChild>
									<Link href="/cloud">Explore Cloud</Link>
								</Button>
							</div>
						</div>
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							Platform FAQs
						</h2>
					</div>
					<div className="mx-auto mt-12 w-full max-w-3xl">
						<Accordion type="single" collapsible>
							{platformFaqs.map((faq, index) => (
								<AccordionItem value={`faq-${index}`} key={faq.question}>
									<AccordionTrigger className="text-left">
										{faq.question}
									</AccordionTrigger>
									<AccordionContent>{faq.answer}</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</div>
				</Container>
			</section>

			<CallToAction />
		</div>
	);
}
