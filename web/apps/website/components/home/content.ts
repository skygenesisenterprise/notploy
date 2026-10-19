export interface Capability {
	domain: "Deploy" | "Infrastructure" | "Networking" | "Security" | "Operations";
	title: string;
	description: string;
	image?: string;
	imageAlt?: string;
}

export const capabilities: Capability[] = [
	{
		domain: "Deploy",
		title: "Application deployment",
		description:
			"Build from Nixpacks, Buildpacks, Railpack or your own Dockerfile — sourced from GitHub, GitLab, Gitea or Bitbucket.",
		image: "/dashboard.png",
		imageAlt: "Notploy dashboard listing applications and their deployments",
	},
	{
		domain: "Deploy",
		title: "Docker Compose projects",
		description:
			"Run complex stacks natively: services, configuration, logs and deployments managed as one project.",
		image: "/compose.png",
		imageAlt: "Notploy Docker Compose project view with services and logs",
	},
	{
		domain: "Deploy",
		title: "Databases with backups",
		description:
			"PostgreSQL, MySQL, MariaDB, MongoDB and Redis — provisioned, scheduled and backed up from the same interface.",
		image: "/backups.png",
		imageAlt: "Notploy backup configuration for a managed database",
	},
	{
		domain: "Infrastructure",
		title: "Servers & clusters",
		description:
			"Manage the local server or add remote servers over SSH — and scale into Docker Swarm clusters.",
		image: "/remote.png",
		imageAlt: "Notploy remote servers and Swarm cluster view",
	},
	{
		domain: "Infrastructure",
		title: "Storage & object storage",
		description:
			"Volumes, mounts and S3-compatible object storage as backup and artifact destinations.",
	},
	{
		domain: "Infrastructure",
		title: "One-click templates",
		description:
			"Deploy ready-made blueprints for popular open-source tools from the community gallery.",
	},
	{
		domain: "Networking",
		title: "Domains & TLS",
		description:
			"Custom domains per service, with automatic certificate issuance and renewal handled for you.",
		image: "/images/notploy-domains.png",
		imageAlt: "Notploy domain and TLS certificate settings",
	},
	{
		domain: "Networking",
		title: "Networks & routing",
		description:
			"Internal service networking, load balancing and traffic routing through Traefik.",
	},
	{
		domain: "Networking",
		title: "Container registries",
		description:
			"Connect private registries with stored credentials and deploy the images you already build.",
	},
	{
		domain: "Security",
		title: "Secrets & environments",
		description:
			"Per-environment variables and secrets, with a Vault provider for external secret management.",
	},
	{
		domain: "Security",
		title: "Access control & SSO",
		description:
			"Organizations, projects, roles, sessions, API keys and single sign-on for the whole team.",
	},
	{
		domain: "Security",
		title: "Audit logs",
		description:
			"Track who changed what and when across your organization, for compliance and incident review.",
	},
	{
		domain: "Operations",
		title: "Monitoring & logs",
		description:
			"Real-time CPU, memory and network metrics, container logs and request inspection.",
		image: "/primary/monitoring.png",
		imageAlt: "Notploy monitoring dashboard with container metrics",
	},
	{
		domain: "Operations",
		title: "Schedules & automation",
		description:
			"Cron jobs, webhooks, CI/CD triggers — plus a REST API, CLI and SDK for everything else.",
	},
	{
		domain: "Operations",
		title: "Deployments & rollbacks",
		description:
			"Full deployment history, preview deployments and instant rollbacks when a release goes wrong.",
	},
];

export const capabilityHighlights = capabilities.filter(
	(capability): capability is Capability & { image: string } =>
		Boolean(capability.image),
);

export const remainingCapabilities = capabilities.filter(
	(capability) => !capability.image,
);

export const problems = [
	{
		title: "Fragmented tooling",
		description:
			"Deployment here, DNS there, certificates somewhere else, backups in a fourth console. Teams assemble a stack of half-integrated tools and maintain the glue themselves.",
	},
	{
		title: "Ownership traded for convenience",
		description:
			"Managed platforms are easy to start but quietly take over your data, your runtimes and your pricing. Migrating away later is expensive — or impossible.",
	},
	{
		title: "Infrastructure too complex to touch",
		description:
			"Orchestration, proxies and load balancers are powerful, but they demand specialists. Simple workloads end up trapped behind a wall of YAML and tribal knowledge.",
	},
];

export const principles = [
	{
		title: "Easy by default",
		description:
			"Deploy an application without first learning Docker, Traefik and Swarm end to end.",
	},
	{
		title: "Transparent by design",
		description:
			"Open source, standard technologies, no black boxes — the machinery stays visible and inspectable.",
	},
	{
		title: "Ownership stays yours",
		description:
			"The infrastructure, the data and the decisions remain under your control, on Self or with Cloud.",
	},
	{
		title: "No proprietary cloud required",
		description:
			"Notploy runs on your servers, your homelab or any provider you choose — never only on ours.",
	},
	{
		title: "One operational surface",
		description:
			"Deployment, networking, secrets, backups and monitoring converge in a single control plane instead of half-integrated tools.",
	},
	{
		title: "Start simple, go deeper",
		description:
			"Begin with the guided UI, then move to the CLI, API, SDK and full infrastructure controls when you need them.",
	},
];

export const layers = [
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

export interface ReleaseField {
	title: string;
	clause: string;
	body: string;
	status: string;
	statusClass: string;
	progress: string;
}

export const releaseFields: ReleaseField[] = [
	{
		title: "A push lands",
		clause: "First, a commit reaches Notploy.",
		body: "GitHub, GitLab, Gitea or Bitbucket notifies the control plane through a webhook.",
		status: "Queued",
		statusClass: "bg-secondary text-secondary-foreground",
		progress: "18%",
	},
	{
		title: "Notploy plans the release",
		clause: "Then it resolves what should run.",
		body: "Configuration, environments and secrets are read, and the release is planned before anything is built.",
		status: "Planning",
		statusClass: "bg-secondary text-secondary-foreground",
		progress: "42%",
	},
	{
		title: "It builds and schedules",
		clause: "Next, the release becomes containers.",
		body: "Nixpacks, Buildpacks, Railpack or your Dockerfile builds the image. Swarm schedules it across your servers.",
		status: "Deploying",
		statusClass: "bg-primary/20 text-primary",
		progress: "74%",
	},
	{
		title: "It serves, and you operate it",
		clause: "Finally, traffic moves — and stays visible.",
		body: "Routing, DNS and TLS update automatically. Logs, metrics, backups and rollbacks stay in the same control plane.",
		status: "Live",
		statusClass: "bg-primary text-primary-foreground",
		progress: "100%",
	},
];

export const surfaces = [
	{
		title: "Web",
		description:
			"The full control plane in your browser: projects, deployments, databases, domains and monitoring.",
	},
	{
		title: "Desktop",
		description:
			"A dedicated desktop surface for day-to-day operations, quick actions and notifications.",
	},
	{
		title: "CLI",
		description:
			"Deploy, inspect and script from your terminal — locally, in CI or over SSH.",
	},
	{
		title: "API & SDK",
		description:
			"Every dashboard operation is exposed through a REST API and a TypeScript SDK.",
	},
	{
		title: "MCP",
		description:
			"AI agents operate your infrastructure through a controlled, permission-aware interface.",
	},
	{
		title: "VS Code",
		description:
			"Drive deployments from the editor where your team already spends its day.",
	},
];

export const showcases = [
	{
		title: "Applications & Databases",
		description:
			"Centralize control of your applications and databases for enhanced security and efficiency, simplifying access and management across your infrastructure.",
		image: "/dashboard.png",
		alt: "Notploy dashboard showing applications and databases",
	},
	{
		title: "Docker Compose",
		description:
			"Native Docker Compose support so you can manage complex applications and services with ease.",
		image: "/compose.png",
		alt: "Notploy Docker Compose project editor",
	},
	{
		title: "Multiserver",
		description:
			"Deploy applications to multiple servers without the extra effort.",
		image: "/remote.png",
		alt: "Notploy remote server management view",
	},
	{
		title: "Logs",
		description:
			"Monitor and manage your applications' logs with ease, ensuring efficient troubleshooting and optimal performance.",
		image: "/logs.png",
		alt: "Notploy container log viewer",
	},
	{
		title: "Monitoring",
		description:
			"Monitor your systems' performance and health in real time, ensuring continuous and uninterrupted operation.",
		image: "/primary/monitoring.png",
		alt: "Notploy real-time monitoring dashboard",
	},
	{
		title: "Backups",
		description:
			"Implement automatic and secure backup solutions to protect your critical data and restore it quickly when necessary.",
		image: "/backups.png",
		alt: "Notploy backup schedule and restore view",
	},
	{
		title: "Traefik",
		description:
			"Manage Traefik via File Editor to configure your own domain names, certificates, and more.",
		image: "/traefik.png",
		alt: "Notploy Traefik configuration editor",
	},
	{
		title: "Templates",
		description: "Deploy open source templates with one click.",
		image: "/templates.png",
		alt: "Notploy template gallery",
	},
];

export const editions = [
	{
		name: "Notploy Self",
		tagline: "You operate the platform",
		description:
			"Install Notploy on the servers you already own. You are responsible for the environment — and you keep every lever that comes with it.",
		bullets: [
			"You own the infrastructure and the data, end to end",
			"You install, administer and upgrade Notploy itself",
			"You decide backups, network boundaries and security policy",
			"You can modify and extend the installation (Apache-2.0)",
		],
		href: "/self",
		cta: "Explore Self",
		external: false,
	},
	{
		name: "Notploy Cloud",
		tagline: "Notploy Enterprise operates it for you",
		description:
			"Notploy Enterprise provides the service, runs the control plane and owns its availability — while your workloads keep running on infrastructure you control.",
		bullets: [
			"Notploy provides and operates the hosted service",
			"Availability, upgrades and monitoring are handled for you",
			"Always on a supported release, with support commitments",
			"Same platform capabilities as Self — not a reduced edition",
		],
		href: "https://app.notploy.com/register",
		cta: "Get started",
		external: true,
	},
];

export const depths = [
	{
		level: "First contact",
		audience: "Beginners and self-hosters",
		tool: "Guided web UI",
		description:
			"Deploy from templates and sensible defaults — no terminal required to get something running.",
	},
	{
		level: "Building",
		audience: "Developers and teams",
		tool: "CLI, API and SDK",
		description:
			"Script deployments, wire Notploy into CI/CD pipelines and manage everything programmatically.",
	},
	{
		level: "Operating",
		audience: "DevOps and administrators",
		tool: "Full infrastructure controls",
		description:
			"Manage servers, clusters, networking, security policies, access control and audits.",
	},
];

export const audiences = [
	{
		title: "Solo developers",
		description: "Ship side projects and client work without a platform team.",
	},
	{
		title: "Development teams",
		description:
			"Preview, deploy and rollback together, with shared environments.",
	},
	{
		title: "DevOps & infrastructure teams",
		description:
			"Standardize how the whole organization deploys and operates.",
	},
	{
		title: "Small and medium businesses",
		description:
			"One platform instead of a stack of half-integrated tools.",
	},
	{
		title: "Enterprise & regulated organizations",
		description:
			"Self-host inside your own boundary, with SSO, roles and audit logs.",
	},
	{
		title: "Public-sector organizations",
		description: "Keep data and operations on infrastructure you control.",
	},
	{
		title: "Hosting providers",
		description:
			"Offer deployment platforms on top of your own infrastructure.",
	},
];

export const contributionWays = [
	{
		title: "Code",
		description: "Fix bugs, ship features, review pull requests.",
	},
	{
		title: "Documentation",
		description: "Clearer guides, missing examples, corrected steps.",
	},
	{
		title: "Templates",
		description: "Publish blueprints to the templates gallery.",
	},
	{
		title: "Bug reports",
		description: "Issues with reproduction steps that make fixes faster.",
	},
	{
		title: "Testing",
		description: "Try releases, report regressions, verify fixes.",
	},
	{
		title: "UX feedback",
		description: "Tell us where the workflow confuses or slows you down.",
	},
	{
		title: "Translations",
		description: "Make Notploy accessible beyond English.",
	},
	{
		title: "Support",
		description:
			"Answer questions from new users in Discussions or Discord.",
	},
	{
		title: "Discussions",
		description: "Share deployment stories, ideas and trade-offs.",
	},
	{
		title: "RFCs",
		description: "Propose larger changes before code is written.",
	},
];

export const communityLinks = [
	{
		href: "https://github.com/skygenesisenterprise/notploy",
		label: "Code & releases",
		external: true,
	},
	{
		href: "https://github.com/skygenesisenterprise/notploy/issues",
		label: "Issues & roadmap",
		external: true,
	},
	{
		href: "https://github.com/skygenesisenterprise/notploy/discussions",
		label: "Discussions",
		external: true,
	},
	{
		href: "/community",
		label: "Contributing guide",
		external: false,
	},
];

export const faqs = [
	{
		question: "What is Notploy?",
		answer:
			"Notploy is an open-source infrastructure platform. It gives you one control plane to deploy applications, databases and Docker Compose projects, manage servers and clusters, and handle routing, certificates, backups and monitoring — on infrastructure you own.",
	},
	{
		question: "Is Notploy really open source?",
		answer:
			"Yes. The platform is public on GitHub under the Apache-2.0 license — you can read the source, audit it, modify it and redistribute it. The core capabilities, including deployment, clustering and backups, live in the open-source repository rather than behind a paid license.",
	},
	{
		question: "What is the difference between Notploy Self and Notploy Cloud?",
		answer:
			"Notploy Self is the free, Apache-2.0 licensed edition you install and operate yourself. Notploy Cloud is the managed service operated by Notploy: the control plane is hosted, upgraded and supported for you. Both run the same platform capabilities.",
	},
	{
		question: "Is Notploy free?",
		answer:
			"Yes. Notploy Self is free and open source under Apache-2.0 — no platform fees and no per-seat charges, you pay only for your infrastructure. Notploy Cloud is a paid managed service, and a commercial Enterprise edition adds premium features and support.",
	},
	{
		question: "Do I need Kubernetes?",
		answer:
			"No. Notploy is built on Docker with Docker Swarm for clustering and Traefik for routing and certificates. You get multi-node deployments and load balancing without operating a Kubernetes stack.",
	},
	{
		question: "What do I need to run Notploy?",
		answer:
			"Any Linux server with Docker — a small VPS, bare metal, a homelab machine or a server from your existing provider. The installer sets up the rest, and remote servers are added later over SSH.",
	},
	{
		question: "Can I manage multiple servers?",
		answer:
			"Yes. Start with the local server, then add remote servers over SSH and group them into Docker Swarm clusters. Workloads can be scheduled across nodes, all managed from the same control plane.",
	},
	{
		question: "Do my data stay with me on Notploy Self?",
		answer:
			"Yes. With Self, everything — the control plane, your database, your application data and your backups — runs on infrastructure you own. Notploy has no access to it, and the platform works in air-gapped environments without phoning home.",
	},
	{
		question: "Can I use Docker Compose?",
		answer:
			"Yes. Docker Compose projects are first-class: services, configuration, logs and deployments are managed as one project, alongside individual applications and databases.",
	},
	{
		question: "What can I deploy with Notploy?",
		answer:
			"Applications built with Nixpacks, Buildpacks, Railpack or your own Dockerfile — sourced from GitHub, GitLab, Gitea or Bitbucket — Docker Compose stacks, databases (PostgreSQL, MySQL, MariaDB, MongoDB, Redis) and ready-made templates.",
	},
	{
		question: "Will I get locked in?",
		answer:
			"No. The platform is open source, uses standard technologies (Docker, Compose, Traefik) and exposes a full API and CLI. Your data lives on your infrastructure, and your workloads can be migrated away at any time.",
	},
	{
		question: "Who is Notploy for?",
		answer:
			"Individual developers and self-hosters, small teams, infrastructure and platform teams, companies, public-sector organizations and hosting providers — anyone who wants a simple deployment workflow without giving up control of the infrastructure.",
	},
	{
		question: "Can I use Notploy in a regulated organization?",
		answer:
			"Notploy Self keeps your data, traffic and backups inside your own boundary, with SSO, role-based access control and audit logs for internal oversight. Compliance obligations stay yours — Notploy gives you the controls and the deployment model to operate within them.",
	},
	{
		question: "How do I automate deployments?",
		answer:
			"Everything the dashboard does is available through the REST API, CLI, TypeScript SDK and MCP server, plus webhooks and CI/CD triggers — so Notploy fits into your pipelines instead of replacing them.",
	},
	{
		question: "How can I contribute to the project?",
		answer:
			"Beyond code: documentation, templates, translations, bug reports, testing, UX feedback, support in Discussions and RFCs for larger changes. The contributing guide on the community page lists every path, and the roadmap is tracked in public issues.",
	},
	{
		question: "How do I get started?",
		answer:
			"Install Notploy Self with one command from the Self page, or create a Notploy Cloud account to start without provisioning anything. The documentation walks you through your first deployment step by step.",
	},
];

export const ctaPaths = [
	{
		href: "/self",
		label: "Get started with Notploy Self",
		description: "Free, open source, on your servers",
		external: false,
	},
	{
		href: "https://app.notploy.com/register",
		label: "Explore Notploy Cloud",
		description: "Managed by Notploy, ready in minutes",
		external: true,
	},
	{
		href: "https://docs.notploy.com/docs/core",
		label: "Read the documentation",
		description: "Guides, installation, architecture and reference",
		external: true,
	},
	{
		href: "https://github.com/skygenesisenterprise/notploy",
		label: "View GitHub",
		description: "Source code, issues and releases",
		external: true,
	},
];

export const statsContent = [
	{
		key: "stars" as const,
		label: "GitHub Stars",
		description:
			"Notploy is developed in the open on GitHub. Follow the repository to track releases, issues and roadmap work.",
	},
	{
		key: "contributors" as const,
		label: "Community Contributors",
		description:
			"Built with the community: contributors have helped with code, documentation, integrations and translations.",
	},
	{
		key: "license" as const,
		label: "License",
		description:
			"Notploy is open source under the Apache-2.0 license. Audit it, self-host it and modify it.",
	},
	{
		key: "hosting" as const,
		label: "Self-hosted",
		description:
			"Run Notploy on your servers, your network and your database — or use Notploy Cloud if you would rather not manage the control plane.",
	},
];
