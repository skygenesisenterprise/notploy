import { Container } from "@/components/Container";
import { FinalCta } from "@/components/marketing/FinalCta";
import { PageIntro } from "@/components/marketing/PageIntro";
import { PageFaq, SectionHeading } from "@/components/pages/PagePrimitives";
import { links } from "@/lib/content/links";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Use cases",
	description:
		"Personal applications, homelab services, developer tools, team applications and specialised workloads — what Notploy takes care of and what stays your responsibility.",
	alternates: { canonical: "https://notploy.com/use-cases" },
};

const useCases = [
	{
		id: "personal",
		title: "Personal applications & websites",
		description:
			"Run the sites, dashboards and small tools you build, on a server you already pay for.",
		value: [
			"Deploy from a Git repository or a Docker image",
			"Attach a domain and a certificate without editing a proxy config",
			"Keep logs and rollbacks for the day something breaks",
		],
		prerequisites: "A Linux server with Docker, and a domain if it should be public.",
		limits:
			"One machine is a single point of failure. Redundancy is your design decision, not a default.",
	},
	{
		id: "homelab",
		title: "Homelab services",
		description:
			"Give the services on your NAS or home server a consistent way to deploy and restart.",
		value: [
			"Templates and Compose stacks for common self-hosted tools",
			"Remote hosts over SSH when one machine is not enough",
			"Volumes and backups you control, on storage you choose",
		],
		prerequisites:
			"Hardware you can reach, Docker, and a plan for DNS and inbound access.",
		limits:
			"Power, network and disk are yours. Notploy does not make consumer hardware highly available.",
	},
	{
		id: "developers",
		title: "Developer tools & internal services",
		description:
			"Ship the internal services and preview environments a small team needs, without assembling a platform.",
		value: [
			"Deploy on push and keep a deployment history",
			"Environments and per-environment variables",
			"Logs, metrics and rollback in the same place",
		],
		prerequisites: "A Git provider, and a server or cluster the platform can reach.",
		limits:
			"Preview and environment behaviour depends on how your repository is configured.",
	},
	{
		id: "business",
		title: "Team & business applications",
		description:
			"Operate customer-facing or internal applications with access control and a trace of changes.",
		value: [
			"Organisations, projects and role-based access",
			"Single sign-on and SCIM where the commercial offer includes them",
			"Audit logs and backup workflows for internal oversight",
		],
		prerequisites:
			"An identity provider if you enable SSO, and a backup destination you control.",
		limits:
			"Compliance obligations stay with your organisation. Notploy provides controls, not certification.",
	},
	{
		id: "specialised",
		title: "Data services, game servers & specialised workloads",
		description:
			"Run stateful or long-lived services where the runtime and the platform support them.",
		value: [
			"Databases with scheduled backups",
			"Persistent volumes for stateful services",
			"Resource limits and scheduled jobs",
		],
		prerequisites:
			"Check the documented runtime and storage requirements before promising production use.",
		limits:
			"Not every workload type is supported. Running a container is not by itself evidence of production readiness.",
	},
];

const faqs = [
	{
		question: "Are these separate products?",
		answer:
			"No. They are examples of workloads the same platform can host. Nothing in Notploy is hard-coded per industry or per use case.",
	},
	{
		question: "Can I mix several of these on one installation?",
		answer:
			"Yes. Projects, environments and access rules let you keep personal services, internal tools and business applications on the same control plane without sharing everything.",
	},
	{
		question: "Does a use case guarantee production readiness?",
		answer:
			"No. Production readiness depends on your architecture, backups, monitoring and operational process. The documentation lists the supported runtimes and the known limitations.",
	},
];

export default function UseCasesPage() {
	return (
		<main>
			<PageIntro
				eyebrow="Use cases"
				title="One platform,"
				highlight="many kinds of services"
				description="From a personal site to a team application, the work is the same: deploy, operate, observe and keep control. What changes is the infrastructure you put behind it."
				links={[
					{ href: "/industries", label: "By industry" },
					{ href: "/self-hosted-paas", label: "Self-hosted PaaS" },
					{ href: links.docs.limitations, label: "Limitations", external: true },
				]}
			/>

			<section aria-labelledby="use-case-list" className="py-20 sm:py-24">
				<Container>
					<SectionHeading
						id="use-case-list"
						title="Examples, not silos"
						description="Each example explains the operational value, what it requires and where the platform stops."
						align="left"
					/>

					<div className="mt-12 border-t border-border/40">
						{useCases.map((useCase) => (
							<article
								key={useCase.id}
								id={useCase.id}
								className="grid gap-6 border-b border-border/40 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
							>
								<div>
									<h3 className="font-display text-2xl tracking-tight text-foreground">
										{useCase.title}
									</h3>
									<p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
										{useCase.description}
									</p>
								</div>

								<div className="grid gap-5 sm:grid-cols-2">
									<div>
										<h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
											What you get
										</h4>
										<ul className="mt-3 space-y-2">
											{useCase.value.map((item) => (
												<li
													key={item}
													className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
												>
													<span
														className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary"
														aria-hidden="true"
													/>
													<span>{item}</span>
												</li>
											))}
										</ul>
									</div>
									<div className="space-y-4">
										<div>
											<h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
												Prerequisites
											</h4>
											<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
												{useCase.prerequisites}
											</p>
										</div>
										<div>
											<h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
												Limits
											</h4>
											<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
												{useCase.limits}
											</p>
										</div>
									</div>
								</div>
							</article>
						))}
					</div>

					<div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
						<Link
							href="/self"
							className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-primary"
						>
							Start with Notploy Self
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</Link>
						<Link
							href="/enterprise"
							className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
						>
							Notploy for teams
						</Link>
					</div>
				</Container>
			</section>

			<PageFaq
				id="use-case-faqs"
				title="Use case questions"
				description="What these examples do and do not promise."
				faqs={faqs}
			/>

			<FinalCta />
		</main>
	);
}
