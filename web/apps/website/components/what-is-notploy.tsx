import {
	IconActivity,
	IconApi,
	IconArchive,
	IconNetwork,
	IconRocket,
	IconServer2,
	IconShieldLock,
} from "@tabler/icons-react";
import Link from "next/link";
import { Container } from "./Container";

const layers = [
	{
		layer: "Your side",
		title: "Git, CI and your teams",
		description:
			"Push code, open pull requests, trigger builds — Notploy picks it up from there.",
	},
	{
		layer: "Notploy",
		title: "The operational layer",
		description:
			"A control plane (web UI, REST API and background workers) you install in one command.",
	},
	{
		layer: "Your side",
		title: "Servers, Docker and providers",
		description:
			"Docker hosts or Swarm clusters, DNS providers, object storage and registries you already own.",
	},
];

const concepts = [
	{
		title: "Deploy",
		description: "Applications, databases and Compose projects.",
		icon: IconRocket,
	},
	{
		title: "Infrastructure",
		description: "Servers, clusters, templates and volumes.",
		icon: IconServer2,
	},
	{
		title: "Networking",
		description: "Routing, domains, certificates and registries.",
		icon: IconNetwork,
	},
	{
		title: "Security",
		description: "Secrets, access control, SSO and audit logs.",
		icon: IconShieldLock,
	},
	{
		title: "Operations",
		description: "Monitoring, logs, deployments and rollbacks.",
		icon: IconActivity,
	},
	{
		title: "Storage",
		description: "Volumes, backups and S3-compatible object storage.",
		icon: IconArchive,
	},
	{
		title: "Automation",
		description: "Schedules, webhooks, API, CLI and SDK.",
		icon: IconApi,
	},
];

export function WhatIsNotploy() {
	return (
		<section
			aria-labelledby="what-is-notploy"
			className="border-b border-border/30 bg-background py-20 sm:py-32"
		>
			<Container>
				<div className="mx-auto max-w-2xl text-center">
					<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
						What is Notploy?
					</p>
					<h2
						id="what-is-notploy"
						className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
					>
						One control plane between your code and your infrastructure
					</h2>
					<p className="mt-4 text-lg tracking-tight text-muted-foreground">
						You install Notploy once on a Docker host. It becomes the layer
						through which you deploy applications and operate everything around
						them — without replacing your servers, your DNS provider or your
						workflow.
					</p>
				</div>

				<div className="mx-auto mt-14 grid max-w-5xl gap-4">
					{layers.map((item) => (
						<div
							key={item.title}
							className="flex flex-col gap-1 rounded-xl border border-border/50 bg-card p-5 sm:flex-row sm:items-baseline sm:gap-6"
						>
							<p className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-primary">
								{item.layer}
							</p>
							<div>
								<h3 className="text-base font-semibold">{item.title}</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									{item.description}
								</p>
							</div>
						</div>
					))}
				</div>

				<h3 className="mx-auto mt-14 max-w-2xl text-center font-display text-xl tracking-tight text-foreground">
					What you manage from it, grouped by concept
				</h3>
				<div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{concepts.map((concept) => (
						<div
							key={concept.title}
							className="rounded-xl border border-border/50 bg-card p-4"
						>
							<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
								<concept.icon className="h-4.5 w-4.5" />
							</div>
							<h4 className="mt-3 text-sm font-semibold">{concept.title}</h4>
							<p className="mt-1 text-sm text-muted-foreground">
								{concept.description}
							</p>
						</div>
					))}
				</div>

				<div className="mt-10 text-center">
					<Link
						href="/platform"
						className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
					>
						See the full platform
					</Link>
				</div>
			</Container>
		</section>
	);
}
