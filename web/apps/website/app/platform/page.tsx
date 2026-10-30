import { Container } from "@/components/Container";
import { EditionPaths } from "@/components/marketing/EditionPaths";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Lifecycle } from "@/components/marketing/Lifecycle";
import { PageIntro } from "@/components/marketing/PageIntro";
import { Topology } from "@/components/marketing/Topology";
import { PageFaq } from "@/components/pages/PagePrimitives";
import { Button } from "@/components/ui/button";
import { links } from "@/lib/content/links";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Platform",
	description:
		"The Notploy platform in one control plane: workloads, infrastructure, operations, networking, access and automation — on infrastructure you control or as a managed service.",
	alternates: { canonical: "https://notploy.com/platform" },
};

const domains = [
	{
		title: "Workloads",
		description:
			"Applications built from Git or a Docker image, Docker Compose stacks, databases and scheduled jobs.",
	},
	{
		title: "Infrastructure",
		description:
			"The local server, remote servers over SSH, Docker Swarm clusters, volumes and container registries.",
	},
	{
		title: "Operations",
		description:
			"Deployment history and rollback, container and deployment logs, metrics, upstream health and backups.",
	},
	{
		title: "Networking",
		description:
			"Domains, Traefik routing, TLS certificates and internal service networks.",
	},
	{
		title: "Access",
		description:
			"Organisations, projects, roles, API keys, single sign-on and audit logs where available.",
	},
	{
		title: "Automation",
		description:
			"REST API, CLI, SDK, webhooks, CI triggers and an MCP server for agent-driven operations.",
	},
];

const faqs = [
	{
		question: "What is the difference between the platform, Self and Cloud?",
		answer:
			"Notploy is one platform. Self and Cloud are the two ways to run it: with Self you operate the control plane on your own servers; with Cloud, Notploy operates it for you. The capabilities are documented once, in the platform documentation.",
	},
	{
		question: "Do I need Kubernetes?",
		answer:
			"No. Notploy runs on Docker, uses Docker Swarm for multi-node deployments and Traefik for routing and certificates.",
	},
	{
		question: "Can I use my existing servers?",
		answer:
			"Yes. Any Linux server with Docker can host Notploy, and remote servers are added over SSH. Existing VPS, bare-metal and homelab setups are supported.",
	},
	{
		question: "Where is the authoritative list of capabilities?",
		answer:
			"The documentation ships a feature matrix and a limitations page. They are the reference for what a given release and edition support; marketing pages link to them instead of restating them loosely.",
	},
];

export default function PlatformPage() {
	return (
		<main>
			<PageIntro
				eyebrow="Platform"
				title="One control plane for"
				highlight="every layer"
				description="Notploy covers the lifecycle of a service: the infrastructure it runs on, the deployment that puts it there, and the operations that keep it healthy. You keep ownership of the machines and the data."
				actions={
					<>
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
							<Link href="/cloud">Explore Notploy Cloud</Link>
						</Button>
					</>
				}
				links={[
					{ href: "/capabilities", label: "Capabilities" },
					{ href: links.docs.architecture, label: "Architecture docs", external: true },
					{ href: links.docs.featureMatrix, label: "Feature matrix", external: true },
				]}
			/>

			<Container className="py-20 sm:py-24">
				<div className="max-w-2xl">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Domains
					</p>
					<h2 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
						What the platform covers
					</h2>
					<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
						Six areas, documented together. Availability of individual features
						depends on the release, the edition and the integrations you
						configure.
					</p>
				</div>

				<ul className="mt-12 grid border-l border-t border-border/40 sm:grid-cols-2 lg:grid-cols-3">
					{domains.map((domain) => (
						<li
							key={domain.title}
							className="border-b border-r border-border/40 px-6 py-7"
						>
							<h3 className="text-base font-semibold text-foreground">
								{domain.title}
							</h3>
							<p className="mt-2 text-base leading-relaxed text-muted-foreground">
								{domain.description}
							</p>
						</li>
					))}
				</ul>

				<p className="mt-6 text-sm text-muted-foreground">
					<a
						href={links.docs.limitations}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
					>
						Read the documented limitations
						<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
					</a>
				</p>
			</Container>

			<Lifecycle />
			<Topology />
			<EditionPaths />

			<PageFaq
				id="platform-faqs"
				title="Platform questions"
				description="How the shared platform relates to the two operating models."
				faqs={faqs}
			/>

			<FinalCta />
		</main>
	);
}
