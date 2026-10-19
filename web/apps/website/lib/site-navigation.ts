export interface NavItem {
	href: string;
	label: string;
	description?: string;
	external?: boolean;
}

export interface NavGroup {
	title: string;
	items: NavItem[];
	/** Wide, two-column mega menu for groups with many destinations. */
	columns?: 2;
}

export const EXTERNAL_LINKS = {
	docs: "https://docs.notploy.com/docs/core",
	templates: "https://templates.notploy.com",
	docsArchitecture: "https://docs.notploy.com/docs/core/architecture",
	docsFeatures: "https://docs.notploy.com/docs/core/features",
	docsInstall: "https://docs.notploy.com/docs/core/installation",
	docsAi: "https://docs.notploy.com/docs/core/ai",
	docsDifferences: "https://docs.notploy.com/docs/core/differences",
	github: "https://github.com/skygenesisenterprise/notploy",
	githubDiscussions: "https://github.com/skygenesisenterprise/notploy/discussions",
	githubIssues: "https://github.com/skygenesisenterprise/notploy/issues",
	githubReleases: "https://github.com/skygenesisenterprise/notploy/releases",
	discord: "https://discord.gg/GUkDugVh34",
	app: "https://app.notploy.com/",
	appRegister: "https://app.notploy.com/register",
} as const;

/**
 * Notploy's information architecture.
 *
 * Organised around what a visitor is trying to decide: which edition to run,
 * which capabilities matter, which use case fits, and how to get help. The
 * edition names are Notploy's own (Self, Cloud, Enterprise) rather than the
 * generic "Product / Developers" taxonomy inherited from the Dokploy site.
 */
export const navGroups: NavGroup[] = [
	{
		title: "Editions",
		items: [
			{
				href: "/self",
				label: "Notploy Self",
				description: "Free and open source, on servers you own",
			},
			{
				href: "/cloud",
				label: "Notploy Cloud",
				description: "Managed control plane, your applications stay yours",
			},
			{
				href: "/enterprise",
				label: "Notploy Enterprise",
				description: "SSO, audit logs, RBAC and priority support",
			},
			{
				href: "/comparison",
				label: "Compare editions",
				description: "Side by side: Self, Cloud and Enterprise",
			},
		],
	},
	{
		title: "Capabilities",
		columns: 2,
		items: [
			{
				href: "/features/application-deployment-platform",
				label: "Application deployment",
				description: "Git, Docker, Compose and Buildpacks",
			},
			{
				href: "/features/application-management-software",
				label: "Application management",
				description: "Environments, domains, rollbacks and logs",
			},
			{
				href: "/features/database-management-tool",
				label: "Databases",
				description: "Postgres, MySQL, Mongo, Redis and MariaDB",
			},
			{
				href: "/features/container-server-monitoring",
				label: "Monitoring",
				description: "Metrics, health checks and server load",
			},
			{
				href: "/features/security",
				label: "Security",
				description: "Certificates, secrets and network isolation",
			},
			{
				href: "/features/role-based-access-control",
				label: "Role-based access",
				description: "Roles and permissions per resource",
			},
			{
				href: "/features/single-sign-on",
				label: "Single sign-on",
				description: "SSO, SAML and SCIM provisioning",
			},
			{
				href: "/features/audit-logs",
				label: "Audit logs",
				description: "A trace for every deployment and change",
			},
			{
				href: "/features/white-labeling",
				label: "White labeling",
				description: "Your brand on the platform your clients use",
			},
		],
	},
	{
		title: "Solutions",
		items: [
			{
				href: "/deploy-ai",
				label: "Deploy AI",
				description: "A governed sandbox for AI-built apps",
			},
			{
				href: "/sandbox-software",
				label: "Sandbox software",
				description: "Ship internal tools without touching production",
			},
			{
				href: "/self-hosted-paas",
				label: "Self-hosted PaaS",
				description: "Replace Heroku on your own infrastructure",
			},
			{
				href: "/industries",
				label: "By industry",
				description: "Agencies, finance, government, healthcare and more",
			},
			{
				href: EXTERNAL_LINKS.docsAi,
				label: "AI & MCP",
				description: "Let agents drive deployments over MCP",
				external: true,
			},
		],
	},
	{
		title: "Support",
		items: [
			{
				href: EXTERNAL_LINKS.docs,
				label: "Documentation",
				description: "Installation, architecture and reference",
				external: true,
			},
			{
				href: "/contact",
				label: "Contact us",
				description: "Sales, licensing and migration questions",
			},
			{
				href: EXTERNAL_LINKS.githubDiscussions,
				label: "Community discussions",
				description: "Ask questions and share setups",
				external: true,
			},
			{
				href: EXTERNAL_LINKS.githubIssues,
				label: "Report an issue",
				description: "Bugs and feature requests on GitHub",
				external: true,
			},
			{
				href: "/community",
				label: "Community & contributing",
				description: "Code, docs, templates and translations",
			},
		],
	},
];

/** Flat links rendered next to the dropdowns: the two most common destinations. */
export const primaryNav: NavItem[] = [
	{
		href: "/platform",
		label: "Platform",
		description: "How Notploy deploys and operates applications",
	},
	{
		href: "/pricing",
		label: "Pricing",
		description: "Self, Cloud and Enterprise plans",
	},
];

export const footerSections: {
	title: string;
	ariaLabel: string;
	links: NavItem[];
}[] = [
	{
		title: "Product",
		ariaLabel: "Product and editions",
		links: [
			{ href: "/platform", label: "Platform" },
			{ href: "/self", label: "Notploy Self" },
			{ href: "/cloud", label: "Notploy Cloud" },
			{ href: "/pricing", label: "Pricing" },
			{ href: "/enterprise", label: "Enterprise" },
			{ href: "/contact", label: "Contact" },
		],
	},
	{
		title: "Capabilities",
		ariaLabel: "Platform capabilities",
		links: [
			{
				href: "/features/application-deployment-platform",
				label: "Application Deployment",
			},
			{ href: "/features/database-management-tool", label: "Databases" },
			{
				href: "/features/application-management-software",
				label: "Application Management",
			},
			{ href: "/features/container-server-monitoring", label: "Monitoring" },
			{ href: "/features/security", label: "Security" },
			{ href: "/features/role-based-access-control", label: "RBAC" },
			{ href: "/features/single-sign-on", label: "SSO" },
			{ href: "/features/audit-logs", label: "Audit Logs" },
			{ href: "/features/white-labeling", label: "White Labeling" },
		],
	},
	{
		title: "Developers",
		ariaLabel: "Developer resources",
		links: [
			{ href: EXTERNAL_LINKS.docs, label: "Documentation", external: true },
			{ href: "/integrations", label: "Integrations" },
			{ href: "/templates", label: "Templates" },
			{
				href: EXTERNAL_LINKS.templates,
				label: "Template Gallery",
				external: true,
			},
			{ href: "/deploy-ai", label: "Deploy AI" },
			{ href: "/sandbox-software", label: "Sandbox Software" },
			{ href: "/self-hosted-paas", label: "Self-Hosted PaaS" },
		],
	},
	{
		title: "Resources",
		ariaLabel: "Guides, comparisons and news",
		links: [
			{ href: "/comparison", label: "Comparisons" },
			{ href: "/notploy-vs-coolify", label: "Notploy vs. Coolify" },
			{ href: "/notploy-vs-portainer", label: "Notploy vs. Portainer" },
			{ href: "/notploy-vs-vercel", label: "Notploy vs. Vercel" },
			{ href: "/industries", label: "Industries" },
			{ href: "/partners", label: "Partners" },
			{ href: "/jobs", label: "Careers" },
		],
	},
	{
		title: "Company",
		ariaLabel: "Company and legal",
		links: [
			{ href: EXTERNAL_LINKS.github, label: "GitHub", external: true },
			{ href: EXTERNAL_LINKS.discord, label: "Discord", external: true },
			{ href: "/terms-of-service", label: "Terms of Service" },
			{ href: "/privacy", label: "Privacy Policy" },
		],
	},
];

export const coreSitePages: { path: string; priority: number }[] = [
	{ path: "/platform", priority: 0.9 },
	{ path: "/self", priority: 0.9 },
	{ path: "/cloud", priority: 0.9 },
	{ path: "/integrations", priority: 0.8 },
	{ path: "/community", priority: 0.7 },
	{ path: "/pricing", priority: 0.9 },
	{ path: "/enterprise", priority: 0.8 },
	{ path: "/deploy-ai", priority: 0.7 },
	{ path: "/self-hosted-paas", priority: 0.7 },
	{ path: "/sandbox-software", priority: 0.7 },
	{ path: "/contact", priority: 0.7 },
	{ path: "/partners", priority: 0.6 },
];
