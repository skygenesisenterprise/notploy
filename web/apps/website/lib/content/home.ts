/**
 * Homepage content.
 *
 * Copy follows the positioning decided in REDESIGN.md: Notploy is a platform
 * to deploy, operate and control services, run either on infrastructure you
 * control (Self) or as a managed platform (Cloud). European development is
 * stated as a fact about the team, not as a sovereignty guarantee.
 */

export interface LifecycleStep {
	step: string;
	title: string;
	description: string;
}

export const lifecycle: LifecycleStep[] = [
	{
		step: "01",
		title: "Infrastructure",
		description:
			"A Linux server, a homelab machine, a VPS or a Docker Swarm cluster — the machines you already run.",
	},
	{
		step: "02",
		title: "Platform",
		description:
			"Notploy installs on that infrastructure and becomes the control plane: deployments, routing, certificates, secrets, backups and monitoring.",
	},
	{
		step: "03",
		title: "Services",
		description:
			"Applications from Git or Docker, Compose stacks, databases and scheduled jobs — running where you decided they should run.",
	},
];

export interface AudiencePath {
	title: string;
	description: string;
	href: string;
	cta: string;
}

export const audiencePaths: AudiencePath[] = [
	{
		title: "Personal & homelab",
		description:
			"Host the applications and services you actually use, on hardware you already own. Start with one server and grow at your own pace.",
		href: "/self",
		cta: "Start with Self",
	},
	{
		title: "Developers & small teams",
		description:
			"Deploy from Git, keep logs, rollbacks and environments, and stop stitching five separate tools together.",
		href: "/platform",
		cta: "See the platform",
	},
	{
		title: "Businesses & organisations",
		description:
			"Repeatable deployments, access control, audit trails and support for teams that answer to someone.",
		href: "/enterprise",
		cta: "Notploy for teams",
	},
];

export interface EditionOption {
	name: string;
	operator: string;
	description: string;
	bullets: string[];
	cta: string;
	href: string;
}

export const editionOptions: EditionOption[] = [
	{
		name: "Notploy Self",
		operator: "You operate the platform",
		description:
			"Install Notploy on the servers you control. You decide the upgrades, the network boundaries, the backups and who has access.",
		bullets: [
			"Free and open source (Apache-2.0)",
			"Runs on any Linux server with Docker",
			"Data, secrets and backups stay in your boundary",
			"Start on one server, add nodes when you need them",
		],
		cta: "Install Notploy",
		href: "/self",
	},
	{
		name: "Notploy Cloud",
		operator: "Notploy operates the platform",
		description:
			"The control plane is hosted, monitored and upgraded by Notploy. Your workloads stay on the servers you connect.",
		bullets: [
			"Nothing to install to get started",
			"Upgrades and monitoring handled for you",
			"Your applications and data stay yours",
			"Same product as Self, different operating model",
		],
		cta: "Explore Notploy Cloud",
		href: "/cloud",
	},
];

export interface CapabilityGroup {
	title: string;
	description: string;
}

export const capabilityGroups: CapabilityGroup[] = [
	{
		title: "Workloads",
		description:
			"Applications from Git or Docker images, Docker Compose stacks, databases and scheduled jobs.",
	},
	{
		title: "Infrastructure",
		description:
			"One server or several, remote hosts over SSH, Docker Swarm clusters, volumes and registries.",
	},
	{
		title: "Operations",
		description:
			"Deployment history and rollback, logs, metrics, backups and restore workflows.",
	},
	{
		title: "Networking",
		description:
			"Domains, Traefik routing, TLS certificates and internal service networks.",
	},
	{
		title: "Access",
		description:
			"Organisations, roles, API keys, single sign-on and audit logs where available.",
	},
	{
		title: "Automation",
		description:
			"REST API, CLI, SDK, webhooks, MCP and CI integration for everything you do in the dashboard.",
	},
];

export interface Principle {
	title: string;
	description: string;
	href?: string;
	linkLabel?: string;
}

export const principles: Principle[] = [
	{
		title: "Self-hosting first",
		description:
			"The default is software you install and keep. Notploy Cloud is an option, not a requirement.",
	},
	{
		title: "Open source",
		description:
			"Apache-2.0. The source, the issues and the release notes are public.",
	},
	{
		title: "Control stays with you",
		description:
			"Data, backups, network boundaries and upgrade timing are your decisions.",
	},
	{
		title: "Transparent dependencies",
		description:
			"Docker, Compose, Traefik and Swarm — standard tools you can inspect, replace and take with you.",
	},
	{
		title: "European development",
		description:
			"Notploy is developed by a European team. We say what that means, and what it does not guarantee, instead of trading on the label.",
	},
];

export interface ResourceLink {
	label: string;
	description: string;
	href: string;
	external?: boolean;
}

export const resources: ResourceLink[] = [
	{
		label: "Documentation",
		description: "Installation, architecture and reference.",
		href: "https://docs.notploy.com/docs/core",
		external: true,
	},
	{
		label: "Installation guide",
		description: "Prerequisites and the one-command install.",
		href: "https://docs.notploy.com/docs/core/installation",
		external: true,
	},
	{
		label: "Source code",
		description: "Apache-2.0 repository, issues and releases.",
		href: "https://github.com/skygenesisenterprise/notploy",
		external: true,
	},
	{
		label: "Feature matrix",
		description: "What is available today, and what is not.",
		href: "https://docs.notploy.com/docs/core/feature-matrix",
		external: true,
	},
	{
		label: "Service status",
		description: "Availability of the hosted services.",
		href: "https://status.notploy.com",
		external: true,
	},
	{
		label: "Community",
		description: "Discussions, Discord and contribution guide.",
		href: "/community",
	},
];

export interface HomeFaq {
	question: string;
	answer: string;
}

export const homeFaqs: HomeFaq[] = [
	{
		question: "What is Notploy?",
		answer:
			"Notploy is a platform for deploying, operating and controlling application services. It runs on infrastructure you control with Notploy Self, or as a managed platform with Notploy Cloud.",
	},
	{
		question: "Is Notploy only for self-hosting?",
		answer:
			"No. Self-hosting is the default way to run Notploy, and Notploy Cloud is the managed option. Both use the same platform — what changes is who operates the control plane.",
	},
	{
		question: "What do I need to run Notploy Self?",
		answer:
			"A Linux server with Docker: a small VPS, a homelab machine or bare metal. Windows Server is supported through the PowerShell installer. The documentation lists prerequisites and supported environments.",
	},
	{
		question: "Do I need Kubernetes?",
		answer:
			"No. Notploy is built on Docker, with Docker Swarm for multi-node deployments and Traefik for routing and certificates.",
	},
	{
		question: "What can I deploy?",
		answer:
			"Applications built from a Git repository or a Docker image, Docker Compose projects, supported databases and scheduled jobs. Runtime and integration support is listed in the documentation.",
	},
	{
		question: "Can I start on one server and add more later?",
		answer:
			"Yes. Start with the local server, then add remote servers over SSH and group them into a Swarm cluster. Multi-node distributes workloads across nodes; it is not automatic high availability.",
	},
	{
		question: "Is Notploy free?",
		answer:
			"Notploy Self is free and open source under Apache-2.0, so you pay only for your infrastructure. Notploy Cloud is a paid managed service, and a commercial Enterprise offer adds governance features and support.",
	},
	{
		question: "How do I get started?",
		answer:
			"Run the install command above on a Linux or Windows Server host, or explore Notploy Cloud if you would rather not operate the control plane. The documentation walks through the first deployment.",
	},
];
