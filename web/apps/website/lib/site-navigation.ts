import { links } from "@/lib/content/links";

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

/**
 * Notploy's information architecture.
 *
 * Three menus answer the visitor's questions — what the platform does, which
 * workloads fit, and how to run it — followed by the two resources that must
 * never be more than one click away: the documentation and the source code.
 */
export const navGroups: NavGroup[] = [
	{
		title: "Platform",
		columns: 2,
		items: [
			{
				href: "/platform",
				label: "Platform overview",
				description: "One control plane, from infrastructure to services",
			},
			{
				href: "/capabilities",
				label: "Capabilities",
				description: "What is documented as available today",
			},
			{
				href: "/features/application-deployment-platform",
				label: "Deployment",
				description: "Git, Docker, Compose and templates",
			},
			{
				href: "/features/database-management-tool",
				label: "Databases",
				description: "Provisioned, scheduled and backed up",
			},
			{
				href: "/features/container-server-monitoring",
				label: "Monitoring",
				description: "Metrics, logs and health checks",
			},
			{
				href: "/features/security",
				label: "Security & access",
				description: "Secrets, certificates, roles and audit logs",
			},
			{
				href: "/integrations",
				label: "Integrations",
				description: "Git providers, CLI, API, SDK and MCP",
			},
		],
	},
	{
		title: "Use cases",
		items: [
			{
				href: "/use-cases",
				label: "Use cases overview",
				description: "Personal, homelab, developer and business workloads",
			},
			{
				href: "/industries",
				label: "By industry",
				description: "Agencies, public sector, healthcare and more",
			},
			{
				href: "/self-hosted-paas",
				label: "Self-hosted PaaS",
				description: "Replace a hosted platform on your servers",
			},
			{
				href: "/deploy-ai",
				label: "AI-built applications",
				description: "Ship agent output inside a boundary",
			},
			{
				href: "/sandbox-software",
				label: "Sandboxes & internal tools",
				description: "Experiment without touching production",
			},
		],
	},
	{
		title: "Editions",
		items: [
			{
				href: "/self",
				label: "Notploy Self",
				description: "You operate the platform",
			},
			{
				href: "/cloud",
				label: "Notploy Cloud",
				description: "Notploy operates the control plane",
			},
			{
				href: "/enterprise",
				label: "For teams & organisations",
				description: "Governance, audit and support",
			},
			{
				href: "/comparison",
				label: "Compare editions",
				description: "Self, Cloud and Enterprise side by side",
			},
		],
	},
];

/** Documentation and source code, kept one click from anywhere. */
export const resourceNav: NavItem[] = [
	{ href: links.docs.home, label: "Docs", external: true },
	{ href: links.github.repo, label: "GitHub", external: true },
];

/**
 * Where every marketing call to action goes.
 *
 * Cloud CTAs point at the product page: the hosted sign-up endpoint could not be
 * verified, and a non-functional "create account" button is worse than a page
 * that explains the offer and routes to contact.
 */
export const cta = {
	install: { href: "/self", label: "Install Notploy" },
	cloud: { href: "/cloud", label: "Explore Notploy Cloud" },
	docs: { href: links.docs.home, label: "Read the documentation", external: true },
	github: { href: links.github.repo, label: "View the source", external: true },
	teams: { href: "/enterprise", label: "Notploy for teams" },
} as const;

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
			{ href: "/capabilities", label: "Capabilities" },
			{ href: "/integrations", label: "Integrations" },
			{ href: "/pricing", label: "Pricing" },
			{ href: "/self", label: "Notploy Self" },
			{ href: "/cloud", label: "Notploy Cloud" },
			{ href: "/enterprise", label: "For teams" },
		],
	},
	{
		title: "Use cases",
		ariaLabel: "Use cases",
		links: [
			{ href: "/industries", label: "By industry" },
			{ href: "/self-hosted-paas", label: "Self-hosted PaaS" },
			{ href: "/deploy-ai", label: "AI-built applications" },
			{ href: "/sandbox-software", label: "Sandboxes" },
			{ href: "/templates", label: "Templates" },
		],
	},
	{
		title: "Resources",
		ariaLabel: "Documentation and releases",
		links: [
			{ href: links.docs.home, label: "Documentation", external: true },
			{ href: links.docs.install, label: "Installation", external: true },
			{
				href: links.docs.featureMatrix,
				label: "Feature matrix",
				external: true,
			},
			{ href: links.docs.limitations, label: "Limitations", external: true },
			{ href: links.status, label: "Service status", external: true },
			{ href: links.github.releases, label: "Release notes", external: true },
		],
	},
	{
		title: "Community",
		ariaLabel: "Community and support",
		links: [
			{ href: links.github.repo, label: "GitHub", external: true },
			{ href: links.github.discussions, label: "Discussions", external: true },
			{ href: links.github.issues, label: "Issues", external: true },
			{ href: links.community.discord, label: "Discord", external: true },
			{ href: "/community", label: "Contributing" },
			{ href: "/contact", label: "Contact" },
		],
	},
	{
		title: "Company & legal",
		ariaLabel: "Company and legal",
		links: [
			{ href: "/partners", label: "Partners" },
			{ href: "/jobs", label: "Careers" },
			{ href: "/trust", label: "Trust & principles" },
			{ href: "/privacy", label: "Privacy policy" },
			{ href: "/terms-of-service", label: "Terms of service" },
			{
				href: links.docs.security,
				label: "Report a vulnerability",
				external: true,
			},
		],
	},
];

export const coreSitePages: { path: string; priority: number }[] = [
	{ path: "/platform", priority: 0.9 },
	{ path: "/capabilities", priority: 0.85 },
	{ path: "/use-cases", priority: 0.85 },
	{ path: "/trust", priority: 0.7 },
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
	{ path: "/jobs", priority: 0.5 },
];
