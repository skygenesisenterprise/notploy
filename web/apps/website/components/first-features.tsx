import Link from "next/link";
import {
	IconApi,
	IconArchive,
	IconCertificate,
	IconCloudDataConnection,
	IconDatabase,
	IconGitBranch,
	IconKey,
	IconLogs,
	IconNetwork,
	IconRocket,
	IconFileText,
	IconServer2,
	IconShieldLock,
	IconTemplate,
	IconTransformPoint,
} from "@tabler/icons-react";
import { Container } from "./Container";

const features = [
	{
		domain: "Deploy",
		title: "Application deployment",
		description:
			"Build from Nixpacks, Buildpacks, Railpack or your own Dockerfile — sourced from GitHub, GitLab, Gitea or Bitbucket.",
		icon: IconRocket,
	},
	{
		domain: "Deploy",
		title: "Docker Compose projects",
		description:
			"Run complex stacks natively: services, configuration, logs and deployments managed as one project.",
		icon: IconTemplate,
	},
	{
		domain: "Deploy",
		title: "Databases with backups",
		description:
			"PostgreSQL, MySQL, MariaDB, MongoDB and Redis — provisioned, scheduled and backed up from the same interface.",
		icon: IconDatabase,
	},
	{
		domain: "Infrastructure",
		title: "Servers & clusters",
		description:
			"Manage the local server or add remote servers over SSH — and scale into Docker Swarm clusters.",
		icon: IconServer2,
	},
	{
		domain: "Infrastructure",
		title: "Storage & object storage",
		description:
			"Volumes, mounts and S3-compatible object storage as backup and artifact destinations.",
		icon: IconArchive,
	},
	{
		domain: "Infrastructure",
		title: "One-click templates",
		description:
			"Deploy ready-made blueprints for popular open-source tools from the community gallery.",
		icon: IconTransformPoint,
	},
	{
		domain: "Networking",
		title: "Domains & TLS",
		description:
			"Custom domains per service, with automatic certificate issuance and renewal handled for you.",
		icon: IconCertificate,
	},
	{
		domain: "Networking",
		title: "Networks & routing",
		description:
			"Internal service networking, load balancing and traffic routing through Traefik.",
		icon: IconNetwork,
	},
	{
		domain: "Networking",
		title: "Container registries",
		description:
			"Connect private registries with stored credentials and deploy the images you already build.",
		icon: IconCloudDataConnection,
	},
	{
		domain: "Security",
		title: "Secrets & environments",
		description:
			"Per-environment variables and secrets, with a Vault provider for external secret management.",
		icon: IconKey,
	},
	{
		domain: "Security",
		title: "Access control & SSO",
		description:
			"Organizations, projects, roles, sessions, API keys and single sign-on for the whole team.",
		icon: IconShieldLock,
	},
	{
		domain: "Security",
		title: "Audit logs",
		description:
			"Track who changed what and when across your organization, for compliance and incident review.",
		icon: IconFileText,
	},
	{
		domain: "Operations",
		title: "Monitoring & logs",
		description:
			"Real-time CPU, memory and network metrics, container logs and request inspection.",
		icon: IconLogs,
	},
	{
		domain: "Operations",
		title: "Schedules & automation",
		description:
			"Cron jobs, webhooks, CI/CD triggers — plus a REST API, CLI and SDK for everything else.",
		icon: IconApi,
	},
	{
		domain: "Operations",
		title: "Deployments & rollbacks",
		description:
			"Full deployment history, preview deployments and instant rollbacks when a release goes wrong.",
		icon: IconGitBranch,
	},
];

export function FirstFeaturesSection() {
	return (
		<section
			aria-labelledby="capabilities"
			className="flex flex-col items-center justify-center px-4 pt-20 sm:pt-32"
		>
			<div className="mx-auto max-w-2xl text-center">
				<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
					Capabilities
				</p>
				<h2
					id="capabilities"
					className="font-display text-3xl tracking-tight text-primary sm:text-4xl"
				>
					What can Notploy manage?
				</h2>
				<p className="mt-4 text-lg tracking-tight text-muted-foreground">
					Grouped by operational domain: deploy applications, run
					infrastructure, route traffic, secure access and operate everything —
					on servers you own.
				</p>
			</div>

			<div className="mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
				{features.map((feature) => (
					<div
						key={feature.title}
						className="group relative flex flex-col rounded-xl border border-border/50 bg-card p-6 transition-colors hover:border-border"
					>
						<div className="mb-4 flex items-center justify-between">
							<div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/20 text-primary">
								<feature.icon className="h-5 w-5" />
							</div>
							<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								{feature.domain}
							</span>
						</div>
						<h3 className="text-base font-bold text-foreground transition-transform duration-200 group-hover:translate-x-1">
							{feature.title}
						</h3>
						<p className="mt-2 text-sm text-muted-foreground">
							{feature.description}
						</p>
					</div>
				))}
			</div>

			<div className="flex flex-wrap items-center justify-center gap-6 pb-4 text-sm">
				<Link
					href="/platform"
					className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
				>
					Explore the platform
				</Link>
				<Link
					href="https://docs.notploy.com/docs/core/features"
					target="_blank"
					className="font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
				>
					Full feature list in the docs
				</Link>
			</div>
		</section>
	);
}
