export interface NavItem {
	href: string;
	label: string;
	description?: string;
	external?: boolean;
}

export interface NavGroup {
	title: string;
	items: NavItem[];
}

export const EXTERNAL_LINKS = {
	docs: "https://docs.notploy.com/docs/core",
	docsArchitecture: "https://docs.notploy.com/docs/core/architecture",
	docsFeatures: "https://docs.notploy.com/docs/core/features",
	docsInstall: "https://docs.notploy.com/docs/core/installation",
	docsAi: "https://docs.notploy.com/docs/core/ai",
	docsDifferences: "https://docs.notploy.com/docs/core/differences",
	github: "https://github.com/skygenesisenterprise/notploy",
	githubDiscussions: "https://github.com/skygenesisenterprise/notploy/discussions",
	discord: "https://discord.gg/2tBnJ3jDJc",
	app: "https://app.notploy.com/",
	appRegister: "https://app.notploy.com/register",
} as const;

export const navGroups: NavGroup[] = [
	{
		title: "Product",
		items: [
			{
				href: "/platform",
				label: "Platform",
				description: "The capabilities behind the Notploy ecosystem",
			},
			{
				href: "/self",
				label: "Notploy Self",
				description: "Open-source and self-hosted on infrastructure you own",
			},
			{
				href: "/cloud",
				label: "Notploy Cloud",
				description: "A managed service operated by Notploy",
			},
			{
				href: "/pricing",
				label: "Pricing",
				description: "Self, Cloud and Enterprise plans",
			},
		],
	},
	{
		title: "Developers",
		items: [
			{
				href: "/integrations",
				label: "Integrations",
				description: "GitHub, VS Code, CLI, API, SDK and MCP",
			},
			{
				href: "/templates",
				label: "Templates",
				description: "Ready-to-deploy application templates",
			},
			{
				href: EXTERNAL_LINKS.docsAi,
				label: "AI & MCP",
				description: "Let AI agents work with your infrastructure",
				external: true,
			},
			{
				href: EXTERNAL_LINKS.docs,
				label: "Documentation",
				description: "Guides, architecture and reference",
				external: true,
			},
		],
	},
	{
		title: "Community",
		items: [
			{
				href: "/community",
				label: "Contributing",
				description: "Report, discuss, document and build with us",
			},
			{
				href: EXTERNAL_LINKS.github,
				label: "GitHub",
				description: "Source code, issues and releases",
				external: true,
			},
			{
				href: EXTERNAL_LINKS.githubDiscussions,
				label: "Discussions",
				description: "Ask questions and share ideas",
				external: true,
			},
		],
	},
	{
		title: "Resources",
		items: [
			{
				href: "/comparison",
				label: "Comparisons",
				description: "Notploy compared to similar tools",
			},
			{
				href: "/industries",
				label: "Industries",
				description: "Notploy for agencies, finance, government and more",
			},
			{
				href: "/blog",
				label: "Blog",
				description: "Guides, announcements and product updates",
			},
			{
				href: EXTERNAL_LINKS.docsArchitecture,
				label: "Architecture",
				description: "How Notploy's core components fit together",
				external: true,
			},
		],
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
			{ href: "/blog", label: "Blog" },
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
