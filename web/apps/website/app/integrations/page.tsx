import { Container } from "@/components/Container";
import { FinalCta } from "@/components/marketing/FinalCta";
import { PageIntro } from "@/components/marketing/PageIntro";
import { PageFaq, ProcessRail, SectionHeading } from "@/components/pages/PagePrimitives";
import { links } from "@/lib/content/links";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Integrations",
	description:
		"Git providers, container registries, identity providers, DNS, object storage, CLI, API, SDK and MCP — the documented ways to connect Notploy to the tools you already use.",
	alternates: { canonical: "https://notploy.com/integrations" },
};

interface Integration {
	title: string;
	description: string;
	items: string[];
	href?: string;
	docsLabel?: string;
}

const integrations: Integration[] = [
	{
		title: "Git providers",
		description:
			"Connect a repository and deploy on push: GitHub, GitLab, Gitea and Bitbucket.",
		href: links.docs.home,
		docsLabel: "Git provider documentation",
		items: ["GitHub", "GitLab", "Gitea", "Bitbucket"],
	},
	{
		title: "Container registries",
		description:
			"Deploy images you already build, with credentials stored for private registries.",
		items: ["Docker Hub", "Private registries", "Registry-based rollbacks"],
	},
	{
		title: "Identity & access",
		description:
			"Single sign-on and provisioning where the commercial offer includes them.",
		href: links.docs.sso,
		docsLabel: "SSO documentation",
		items: ["OIDC / SAML providers", "SCIM provisioning", "Roles and API keys"],
	},
	{
		title: "DNS & certificates",
		description:
			"Point domains at services and let the routing layer handle TLS.",
		items: ["Custom domains", "Automatic certificates", "DNS provider adapters"],
	},
	{
		title: "Storage & backups",
		description:
			"Send database and volume backups to storage you control.",
		items: ["S3-compatible destinations", "Scheduled backups", "Restore workflows"],
	},
	{
		title: "Automation surfaces",
		description:
			"Drive the platform from your own systems instead of the dashboard.",
		href: links.docs.ai,
		docsLabel: "AI & MCP documentation",
		items: ["REST API", "CLI", "TypeScript SDK", "Webhooks & CI", "MCP server"],
	},
];

const workflow = [
	{
		title: "A change lands",
		description:
			"A push reaches your Git provider, or your pipeline calls the API.",
		label: "Git or CI",
	},
	{
		title: "Notploy plans the release",
		description:
			"Configuration, environment and secrets are resolved before anything is built.",
		label: "Plan",
	},
	{
		title: "The release is built and scheduled",
		description:
			"An image is built and containers are scheduled on the servers you connected.",
		label: "Build",
	},
	{
		title: "Traffic moves, operations continue",
		description:
			"Routing and TLS update; logs, metrics and rollbacks stay available.",
		label: "Live",
	},
];

const faqs = [
	{
		question: "Are all integrations available in every edition?",
		answer:
			"Not necessarily. Identity providers, audit features and support belong to the commercial offer, and some adapters depend on the release. The documentation feature matrix is the reference.",
	},
	{
		question: "Can I request an integration?",
		answer:
			"Yes. Open a discussion on GitHub or contact us with the provider and the workflow you need. Requests are triaged in public.",
	},
	{
		question: "Do integrations require outbound internet access?",
		answer:
			"Integrations that call an external provider do. A self-hosted installation without those providers keeps working locally; the documentation lists what each integration requires.",
	},
];

export default function IntegrationsPage() {
	return (
		<main>
			<PageIntro
				eyebrow="Integrations"
				title="Fits"
				highlight="the way you work"
				description="Notploy is not only a dashboard. It connects to your repositories, your identity provider and your automation, so the platform fits into existing workflows instead of replacing them."
				actions={
					<>
						<Button className="rounded-full px-6" asChild>
							<Link href="/platform">Explore the platform</Link>
						</Button>
						<Button variant="outline" className="rounded-full px-6" asChild>
							<Link href={links.github.discussions} target="_blank" rel="noreferrer">
								Request an integration
								<ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
					</>
				}
				links={[
					{ href: links.docs.home, label: "Documentation", external: true },
					{ href: links.docs.ai, label: "AI & MCP", external: true },
					{ href: "/community", label: "Community" },
				]}
			/>

			<section aria-labelledby="integration-list" className="py-20 sm:py-24">
				<Container>
					<SectionHeading
						id="integration-list"
						title="Ways to connect Notploy"
						description="Each connector solves a concrete workflow; availability is documented per integration."
						align="left"
					/>

					<div className="mt-12 grid border-l border-t border-border/40 sm:grid-cols-2 lg:grid-cols-3">
						{integrations.map((integration) => (
							<div
								key={integration.title}
								className="flex flex-col border-b border-r border-border/40 px-6 py-7"
							>
								<h3 className="text-base font-semibold text-foreground">
									{integration.title}
								</h3>
								<p className="mt-2 text-base leading-relaxed text-muted-foreground">
									{integration.description}
								</p>
								<ul className="mt-4 flex flex-1 flex-wrap gap-2">
									{integration.items.map((item) => (
										<li
											key={item}
											className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
										>
											{item}
										</li>
									))}
								</ul>
								{integration.href && (
									<a
										href={integration.href}
										target="_blank"
										rel="noreferrer"
										className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
									>
										{integration.docsLabel}
										<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
									</a>
								)}
							</div>
						))}
					</div>
				</Container>
			</section>

			<ProcessRail
				id="integration-workflow"
				title="A concrete workflow"
				description="How a change reaches production on infrastructure you control."
				steps={workflow}
			/>

			<PageFaq
				id="integration-faqs"
				title="Integration questions"
				description="Availability, requests and network requirements."
				faqs={faqs}
			/>

			<FinalCta />
		</main>
	);
}
