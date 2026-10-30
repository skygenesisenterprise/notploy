import { Container } from "@/components/Container";
import { FinalCta } from "@/components/marketing/FinalCta";
import { PageIntro } from "@/components/marketing/PageIntro";
import { PageFaq, SectionHeading } from "@/components/pages/PagePrimitives";
import { links } from "@/lib/content/links";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Capabilities",
	description:
		"What Notploy deploys, operates and controls — grouped by domain, with links to the authoritative feature matrix and limitations documentation.",
	alternates: { canonical: "https://notploy.com/capabilities" },
};

const domains = [
	{
		title: "Workloads",
		items: [
			"Applications built from GitHub, GitLab, Gitea or Bitbucket",
			"Images pulled from public or private container registries",
			"Docker Compose projects managed as one stack",
			"PostgreSQL, MySQL, MariaDB, MongoDB and Redis",
			"Scheduled jobs and one-off commands",
		],
	},
	{
		title: "Infrastructure",
		items: [
			"The local server Notploy is installed on",
			"Remote Linux servers added over SSH",
			"Docker Swarm clusters across nodes",
			"Volumes and bind mounts",
			"Build servers and registry credentials",
		],
	},
	{
		title: "Operations",
		items: [
			"Deployment history, logs and rollback",
			"Container and deployment logs",
			"CPU, memory and network metrics",
			"Database and volume backups to S3-compatible storage",
			"Health checks and maintenance commands",
		],
	},
	{
		title: "Networking",
		items: [
			"Custom domains per service",
			"Traefik routing and internal networks",
			"Automatic TLS certificates and renewal",
			"DNS provider integrations",
		],
	},
	{
		title: "Access & governance",
		items: [
			"Organisations, projects and environments",
			"Roles and permissions per resource",
			"API keys and SSH keys",
			"Single sign-on and SCIM provisioning where available",
			"Audit logs and white labeling on the commercial offer",
		],
	},
	{
		title: "Automation & integrations",
		items: [
			"REST API, CLI and TypeScript SDK",
			"Webhooks and CI/CD triggers",
			"MCP server for agent-driven operations",
			"Git provider, identity provider and DNS adapters",
		],
	},
];

const faqs = [
	{
		question: "Is every capability available in every edition?",
		answer:
			"No. Some governance and support capabilities belong to the commercial offer. The documentation feature matrix lists availability per edition; this page describes the domains, not a promise that every line is enabled for you.",
	},
	{
		question: "How do you decide what counts as available?",
		answer:
			"A capability is described as available when it is documented and present in the product. Work that is not shipped is either omitted or explicitly labelled as in development or planned — it is not presented as a selling point.",
	},
	{
		question: "Where are the limitations?",
		answer:
			"The documentation maintains a limitations page covering supported runtimes, environments and known gaps. It is linked from this page and from the platform overview.",
	},
];

export default function CapabilitiesPage() {
	return (
		<main>
			<PageIntro
				eyebrow="Capabilities"
				title="What Notploy does"
				highlight="today"
				description="Grouped by the job each capability does. For the authoritative status — including what is in development, planned or out of scope — the documentation feature matrix and limitations pages are the reference."
				links={[
					{ href: links.docs.featureMatrix, label: "Feature matrix", external: true },
					{ href: links.docs.limitations, label: "Limitations", external: true },
					{ href: "/platform", label: "Platform overview" },
				]}
			/>

			<section aria-labelledby="capability-domains" className="py-20 sm:py-24">
				<Container>
					<SectionHeading
						id="capability-domains"
						title="Capabilities by domain"
						description="Each domain is documented independently, so a limitation in one does not silently disappear behind a general claim."
						align="left"
					/>

					<div className="mt-12 grid gap-4 lg:grid-cols-2">
						{domains.map((domain) => (
							<div
								key={domain.title}
								className="rounded-xl border border-border/50 bg-card p-6"
							>
								<h3 className="font-display text-xl tracking-tight text-foreground">
									{domain.title}
								</h3>
								<ul className="mt-4 space-y-2.5">
									{domain.items.map((item) => (
										<li
											key={item}
											className="flex gap-3 text-base leading-relaxed text-muted-foreground"
										>
											<span
												className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary"
												aria-hidden="true"
											/>
											<span>{item}</span>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>

					<p className="mt-8 max-w-3xl border-l-2 border-primary pl-4 text-sm leading-relaxed text-muted-foreground">
						This page deliberately carries no status badges. Statuses change
						with every release, so they live in the documentation rather than in
						marketing copy that ages badly.{" "}
						<a
							href={links.docs.featureMatrix}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1 text-foreground underline underline-offset-4 hover:text-primary"
						>
							Open the feature matrix
							<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
						</a>
					</p>
				</Container>
			</section>

			<PageFaq
				id="capabilities-faqs"
				title="Capability questions"
				description="How to read this page without over-claiming."
				faqs={faqs}
			/>

			<FinalCta />
		</main>
	);
}
