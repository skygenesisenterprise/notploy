import type { inferRouterOutputs } from "@trpc/server";
import {
	Activity,
	AppWindow,
	BarChartHorizontalBigIcon,
	Bell,
	BlocksIcon,
	BookIcon,
	BotIcon,
	Boxes,
	Briefcase,
	Building2,
	ChartPie,
	CircleHelp,
	ClipboardList,
	Clock,
	CreditCard,
	Database,
	Folder,
	GalleryVerticalEnd,
	Gauge,
	GitBranch,
	Globe,
	HardDrive,
	HeartHandshake,
	House,
	KeyRound,
	Layers,
	LayoutGrid,
	Link2,
	LogIn,
	type LucideIcon,
	Network,
	Newspaper,
	Package,
	PanelsTopLeft,
	Rocket,
	Server,
	ShieldCheck,
	Smartphone,
	Tags,
	TrendingUp,
	TriangleAlert,
	User,
	Users,
	Vault,
	Waypoints,
	Wrench,
} from "lucide-react";
import type { AppRouter } from "@/server/api/root";

type AuthQueryOutput = inferRouterOutputs<AppRouter>["user"]["get"];
type PermissionsOutput =
	inferRouterOutputs<AppRouter>["user"]["getPermissions"];

/**
 * Deployment environments a navigation node can target.
 *
 * - `self`    self-hosted Notploy
 * - `cloud`   managed Notploy Cloud
 * - `console` platform operator console
 */
export type NavigationEnvironment = "self" | "cloud" | "console";

/**
 * Workspace licence tiers, from the free plan up to a managed Enterprise
 * agreement. Cloud resolves one per workspace; self-hosted instances are
 * unlicensed (`null`).
 */
export type LicenseTier = "free" | "pro" | "enterprise";

/** Ordered so a destination can require a *minimum* tier. */
const LICENSE_RANK: Record<LicenseTier, number> = {
	free: 0,
	pro: 1,
	enterprise: 2,
};

export type NavigationContext = {
	auth?: AuthQueryOutput;
	permissions?: PermissionsOutput;
	/** Current workspace licence tier. `null`/omitted means unlicensed. */
	license?: LicenseTier | null;
};

export type NavigationItem = {
	label: string;
	href: string;
	icon: LucideIcon;
	activeTab?: string | null;
	activeRoutes?: Array<{ href: string; activeTab?: string | null }>;
	/** Environments where the item is rendered. Omitted means every environment. */
	environments?: NavigationEnvironment[];
	/**
	 * Minimum licence tier required to render the item. Omitted means every
	 * tier, including unlicensed self-hosted instances.
	 */
	minLicense?: LicenseTier;
	isEnabled?: (opts: NavigationContext) => boolean;
};

export type NavigationGroup = {
	id: string;
	label: string;
	items: NavigationItem[];
	environments?: NavigationEnvironment[];
	minLicense?: LicenseTier;
	isEnabled?: (opts: NavigationContext) => boolean;
};

export type NavigationSection = {
	id: string;
	label: string;
	items: NavigationItem[];
	groups?: NavigationGroup[];
	environments?: NavigationEnvironment[];
	minLicense?: LicenseTier;
	isEnabled?: (opts: NavigationContext) => boolean;
};

export type ExternalNavigationItem = {
	label: string;
	href: string;
	icon: LucideIcon;
	environments?: NavigationEnvironment[];
	isEnabled?: (opts: NavigationContext) => boolean;
};

export type Navigation = {
	sections: NavigationSection[];
	external: ExternalNavigationItem[];
};

/**
 * Destinations shared across environments.
 */
const SHARED_ITEMS = {
	certificates: {
		label: "Certificates",
		href: "/dashboard/settings/certificates",
		icon: ShieldCheck,
		isEnabled: ({ permissions }) => !!permissions?.certificate.read,
	},
	secretsManager: {
		label: "Secrets Manager",
		href: "/dashboard/settings/secrets",
		icon: Vault,
		isEnabled: ({ permissions }) => !!permissions?.vaultProvider.create,
	},
	sso: {
		label: "SSO",
		href: "/dashboard/settings/sso",
		icon: LogIn,
		isEnabled: ({ permissions }) => !!permissions?.organization.update,
	},
	sessions: {
		label: "Sessions",
		href: "/dashboard/settings/sessions",
		icon: Smartphone,
	},
	auditLogs: {
		label: "Audit Logs",
		href: "/dashboard/settings/audit-logs",
		icon: ClipboardList,
		isEnabled: ({ permissions }) => !!permissions?.auditLog.read,
	},
	tags: {
		label: "Tags",
		href: "/dashboard/settings/tags",
		icon: Tags,
		isEnabled: ({ permissions }) => !!permissions?.tag.read,
	},
	schedules: {
		label: "Schedules",
		href: "/dashboard/schedules",
		icon: Clock,
		isEnabled: ({ permissions }) => !!permissions?.organization.update,
	},
	notifications: {
		label: "Notifications",
		href: "/dashboard/settings/notifications",
		icon: Bell,
		isEnabled: ({ permissions }) => !!permissions?.notification.read,
	},
	gitProviders: {
		label: "Git Providers",
		href: "/dashboard/settings/git-providers",
		icon: GitBranch,
		isEnabled: ({ permissions }) => !!permissions?.gitProviders.read,
	},
	containerRegistries: {
		label: "Container Registries",
		href: "/dashboard/settings/registry",
		icon: Package,
		isEnabled: ({ permissions }) => !!permissions?.registry.read,
	},
	dnsProviders: {
		label: "DNS Providers",
		href: "/dashboard/settings/dns",
		icon: Globe,
		isEnabled: ({ permissions }) => !!permissions?.dnsProvider.read,
	},
	objectStorage: {
		label: "Object Storage",
		href: "/dashboard/settings/destinations",
		icon: HardDrive,
		isEnabled: ({ permissions }) => !!permissions?.objectStorage.read,
	},
	teamAccess: {
		label: "Team & Access",
		href: "/dashboard/settings/users",
		icon: Users,
		isEnabled: ({ permissions }) => !!permissions?.member.read,
	},
	apiKeys: {
		label: "API Keys",
		href: "/dashboard/settings/api-keys",
		icon: KeyRound,
		isEnabled: ({ permissions }) => !!permissions?.api.read,
	},
} satisfies Record<string, NavigationItem>;

/**
 * Navigation tree organized into three sections: Overview, Infrastructure, Organization
 * with environment-specific items for self, cloud and console.
 */
const NAVIGATION_SECTIONS: NavigationSection[] = [
	{
		id: "overview",
		label: "Overview",
		environments: ["self", "cloud", "console"],
		items: [
			// Self-hosted and Cloud keep their existing flat overview.
			{
				label: "Home",
				href: "/dashboard/home",
				icon: House,
				environments: ["self", "cloud"],
			},
			{
				label: "Projects",
				href: "/dashboard/projects",
				icon: Folder,
				environments: ["self", "cloud"],
			},
			{
				label: "Monitoring",
				href: "/dashboard/monitoring",
				icon: BarChartHorizontalBigIcon,
				environments: ["self"],
			},
			{
				label: "Services",
				href: "/dashboard/overview",
				icon: LayoutGrid,
				activeTab: null,
				environments: ["self", "cloud"],
				isEnabled: ({ permissions }) => !!permissions?.service.read,
			},
			{
				label: "Deployments",
				href: "/dashboard/deployments",
				icon: Rocket,
				activeTab: null,
				environments: ["self", "cloud"],
				isEnabled: ({ permissions }) => !!permissions?.deployment.read,
			},
			// Console overview follows a manager's scan: situation, exceptions,
			// live operations, trends, demand, changes, then the portfolio.
			{
				label: "Home",
				href: "/dashboard/home",
				icon: House,
				environments: ["console"],
			},
			{
				label: "Incidents",
				href: "/dashboard/incidents",
				icon: TriangleAlert,
				environments: ["console"],
			},
			{
				label: "Operations",
				href: "/dashboard/operations",
				icon: Activity,
				environments: ["console"],
			},
			{
				label: "Monitoring",
				href: "/dashboard/monitoring",
				icon: BarChartHorizontalBigIcon,
				environments: ["console"],
			},
			{
				label: "Traffic",
				href: "/dashboard/website/traffic",
				icon: TrendingUp,
				environments: ["console"],
				isEnabled: ({ permissions }) => !!permissions?.traffic.read,
			},
			{
				label: "Deployments",
				href: "/dashboard/deployments",
				icon: Rocket,
				activeTab: null,
				environments: ["console"],
				isEnabled: ({ permissions }) => !!permissions?.deployment.read,
			},
			{
				label: "Projects",
				href: "/dashboard/projects",
				icon: Folder,
				environments: ["console"],
			},
		],
	},
	{
		id: "infrastructure",
		label: "Infrastructure",
		environments: ["self", "cloud", "console"],
		items: [
			// Self-hosted fleet & runtime
			{
				label: "Servers",
				href: "/dashboard/settings/servers",
				icon: Server,
				environments: ["self"],
				isEnabled: ({ permissions }) => !!permissions?.server.read,
			},
			{
				label: "Docker",
				href: "/dashboard/docker",
				icon: BlocksIcon,
				activeTab: null,
				environments: ["self"],
				isEnabled: ({ permissions }) => !!permissions?.docker.read,
			},
			{
				label: "Swarm",
				href: "/dashboard/swarm",
				icon: Waypoints,
				environments: ["self"],
				isEnabled: ({ permissions }) => !!permissions?.docker.read,
			},
			{
				label: "Networks",
				href: "/dashboard/networks",
				icon: Network,
				environments: ["self"],
				isEnabled: ({ permissions }) => !!permissions?.docker.read,
			},
			{
				label: "Traefik Manager",
				href: "/dashboard/traefik",
				icon: GalleryVerticalEnd,
				environments: ["self"],
				isEnabled: ({ permissions }) => !!permissions?.traefikFiles.read,
			},
			{
				label: "AI Providers",
				href: "/dashboard/settings/ai",
				icon: BotIcon,
				environments: ["self"],
				isEnabled: ({ permissions }) => !!permissions?.organization.update,
			},
			// Self-hosted infrastructure
			{ ...SHARED_ITEMS.certificates, environments: ["self"] },
			{ ...SHARED_ITEMS.sso, environments: ["self"] },
			{ ...SHARED_ITEMS.secretsManager, environments: ["self"] },
			{ ...SHARED_ITEMS.gitProviders, environments: ["self"] },
			{ ...SHARED_ITEMS.containerRegistries, environments: ["self"] },
			{ ...SHARED_ITEMS.dnsProviders, environments: ["self"] },
			{ ...SHARED_ITEMS.objectStorage, environments: ["self"] },
			// Cloud infrastructure
			{ ...SHARED_ITEMS.gitProviders, environments: ["cloud"] },
			{ ...SHARED_ITEMS.containerRegistries, environments: ["cloud"], minLicense: "pro" },
			{ ...SHARED_ITEMS.dnsProviders, environments: ["cloud"] },
			{ ...SHARED_ITEMS.objectStorage, environments: ["cloud"], minLicense: "pro" },
			{ ...SHARED_ITEMS.certificates, environments: ["cloud"] },
			{ ...SHARED_ITEMS.secretsManager, environments: ["cloud"], minLicense: "pro" },
			{ ...SHARED_ITEMS.sso, environments: ["cloud"], minLicense: "enterprise" },
			{ ...SHARED_ITEMS.schedules, environments: ["cloud"], minLicense: "pro" },
			{ ...SHARED_ITEMS.auditLogs, environments: ["cloud"], minLicense: "enterprise" },
			// Console infrastructure reads like a manager's asset map: capacity,
			// availability, workloads, engines, network and edge, trust, supply
			// chain, then data.
			{
				label: "Servers",
				href: "/dashboard/settings/servers",
				icon: Server,
				environments: ["console"],
				isEnabled: ({ permissions }) => !!permissions?.server.read,
			},
			{
				label: "Clusters",
				href: "/dashboard/swarm",
				icon: Waypoints,
				environments: ["console"],
				isEnabled: ({ permissions }) => !!permissions?.docker.read,
			},
			{
				label: "Runtime",
				href: "/dashboard/containers",
				icon: Boxes,
				environments: ["console"],
				isEnabled: ({ permissions }) => !!permissions?.docker.read,
			},
			{
				label: "Compute",
				href: "/dashboard/docker",
				icon: BlocksIcon,
				activeTab: null,
				environments: ["console"],
				isEnabled: ({ permissions }) => !!permissions?.docker.read,
			},
			{
				label: "Networks",
				href: "/dashboard/networks",
				icon: Network,
				environments: ["console"],
				isEnabled: ({ permissions }) => !!permissions?.docker.read,
			},
			{ ...SHARED_ITEMS.dnsProviders, label: "DNS", environments: ["console"] },
			{
				label: "Web Server",
				href: "/dashboard/settings/server",
				icon: PanelsTopLeft,
				environments: ["console"],
				isEnabled: ({ permissions }) => !!permissions?.organization.update,
			},
			{ ...SHARED_ITEMS.certificates, environments: ["console"] },
			{ ...SHARED_ITEMS.sso, environments: ["console"] },
			{
				...SHARED_ITEMS.secretsManager,
				label: "Secrets",
				environments: ["console"],
			},
			{ ...SHARED_ITEMS.gitProviders, label: "Git", environments: ["console"] },
			{
				...SHARED_ITEMS.containerRegistries,
				label: "Registries",
				environments: ["console"],
			},
			{
				label: "Storage",
				href: "/dashboard/storage",
				icon: Database,
				environments: ["console"],
			},
			{ ...SHARED_ITEMS.objectStorage, environments: ["console"] },
		],
	},
	{
		id: "organization",
		label: "Organization",
		environments: ["self", "cloud", "console"],
		items: [
			// Self-hosted organization
			{
				label: "Users",
				href: "/dashboard/settings/users",
				icon: Users,
				environments: ["self"],
				isEnabled: ({ permissions }) => !!permissions?.member.read,
			},
			{ ...SHARED_ITEMS.sessions, environments: ["self"] },
			{ ...SHARED_ITEMS.auditLogs, environments: ["self"] },
			{ ...SHARED_ITEMS.tags, environments: ["self"] },
			{ ...SHARED_ITEMS.notifications, environments: ["self"] },
			{
				label: "Web Server",
				href: "/dashboard/settings/server",
				icon: PanelsTopLeft,
				environments: ["self"],
				isEnabled: ({ permissions }) => !!permissions?.organization.update,
			},
			// Cloud organization/settings
			{ ...SHARED_ITEMS.tags, label: "Workspace & Tags", environments: ["cloud"], minLicense: "pro" },
			{ ...SHARED_ITEMS.teamAccess, environments: ["cloud"], minLicense: "pro" },
			{ ...SHARED_ITEMS.apiKeys, environments: ["cloud"], minLicense: "pro" },
			{ ...SHARED_ITEMS.notifications, environments: ["cloud"] },
			{
				label: "Billing",
				href: "/dashboard/settings/billing",
				icon: CreditCard,
				environments: ["cloud"],
				isEnabled: ({ permissions }) => !!permissions?.billing?.read,
			},
			{
				label: "Profile",
				href: "/dashboard/settings/profile",
				icon: User,
				environments: ["cloud"],
			},
			{ ...SHARED_ITEMS.sessions, environments: ["cloud"] },
			// Console organization follows a manager's governance view: tenants
			// and applications, digital domains, consumption and capacity,
			// commercial health, shared operations, then the public site.
			{
				label: "Workspaces",
				href: "/dashboard/workspaces",
				icon: Building2,
				environments: ["console"],
			},
			{
				label: "Applications",
				href: "/dashboard/applications",
				icon: AppWindow,
				environments: ["console"],
			},
			{
				label: "Domains",
				href: "/dashboard/domains",
				icon: Link2,
				environments: ["console"],
			},
			{
				label: "Usage",
				href: "/dashboard/usage",
				icon: ChartPie,
				environments: ["console"],
			},
			{
				label: "Capacity",
				href: "/dashboard/capacity",
				icon: Gauge,
				environments: ["console"],
			},
			{
				label: "Billing",
				href: "/dashboard/settings/billing",
				icon: CreditCard,
				environments: ["console"],
				isEnabled: ({ permissions }) => !!permissions?.billing?.read,
			},
			{
				label: "Platform Services",
				href: "/dashboard/platform-services",
				icon: Layers,
				environments: ["console"],
			},
			{
				label: "Maintenance",
				href: "/dashboard/maintenance",
				icon: Wrench,
				environments: ["console"],
			},
			{
				label: "Community",
				href: "/dashboard/website/community",
				icon: HeartHandshake,
				environments: ["console"],
				isEnabled: ({ permissions }) => !!permissions?.community.read,
			},
			{
				label: "Blog",
				href: "/dashboard/website/blog",
				icon: Newspaper,
				environments: ["console"],
			},
			{
				label: "Careers",
				href: "/dashboard/website/careers",
				icon: Briefcase,
				environments: ["console"],
			},
		],
	},
];

const EXTERNAL_LINKS: ExternalNavigationItem[] = [
	{
		label: "Documentation",
		href: "https://docs.notploy.com/docs/core",
		icon: BookIcon,
	},
	{
		label: "Support",
		href: "https://discord.gg/GUkDugVh34",
		icon: CircleHelp,
	},
];

function getRoute(href: string): { pathname: string; tab?: string } {
	const [pathname = "", query = ""] = href.split("?", 2);
	return {
		pathname,
		tab: new URLSearchParams(query).get("tab") ?? undefined,
	};
}

function normalizePathname(pathname: string): string {
	const normalized = pathname.replace(/\/+$/, "") || "/";
	if (
		normalized === "/dashboard/projects" ||
		normalized.startsWith("/dashboard/projects/")
	) {
		return normalized.replace(
			/^\/dashboard\/projects(?=\/|$)/,
			"/dashboard/project",
		);
	}
	return normalized;
}

function routeMatches(opts: {
	itemUrl: string;
	pathname: string;
	activeTab?: string | null;
	currentTab?: string;
}): boolean {
	const itemRoute = getRoute(opts.itemUrl);
	const currentPathname = normalizePathname(opts.pathname);
	const targetPathname = normalizePathname(itemRoute.pathname);
	if (
		currentPathname !== targetPathname &&
		!currentPathname.startsWith(`${targetPathname}/`)
	) {
		return false;
	}

	const expectedTab =
		opts.activeTab !== undefined ? opts.activeTab : itemRoute.tab;
	if (expectedTab === null) return opts.currentTab === undefined;
	if (expectedTab !== undefined) return opts.currentTab === expectedTab;
	return true;
}

export function isActiveRoute(opts: {
	itemUrl: string;
	pathname: string;
	activeTab?: string | null;
	currentTab?: string;
}): boolean {
	return routeMatches(opts);
}

/**
 * Environment visibility pass. Distinct from `filterEnabled` (access control).
 */
function isInEnvironment(
	environments: NavigationEnvironment[] | undefined,
	environment: NavigationEnvironment,
): boolean {
	return !environments || environments.includes(environment);
}

function filterEnabled<
	T extends { isEnabled?: (o: NavigationContext) => boolean },
>(items: readonly T[], context: NavigationContext): T[] {
	return items.filter((item) =>
		item.isEnabled ? item.isEnabled(context) : true,
	);
}

function filterItemsByEnvironment(
	items: readonly NavigationItem[],
	environment: NavigationEnvironment,
): NavigationItem[] {
	return items.filter((item) =>
		isInEnvironment(item.environments, environment),
	);
}

/**
 * Licence visibility pass. A destination declaring `minLicense` is only
 * rendered when the workspace tier is at least that high; an unlicensed
 * (self-hosted) context never satisfies a tiered requirement.
 */
function filterByLicense<T extends { minLicense?: LicenseTier }>(
	items: readonly T[],
	context: NavigationContext,
): T[] {
	const tier = context.license ?? null;
	return items.filter((item) => {
		if (!item.minLicense) return true;
		if (tier === null) return false;
		return LICENSE_RANK[tier] >= LICENSE_RANK[item.minLicense];
	});
}

export function createNavigation(opts: {
	environment: NavigationEnvironment;
	auth?: AuthQueryOutput;
	permissions?: PermissionsOutput;
	license?: LicenseTier | null;
	whitelabeling?: {
		docsUrl?: string | null;
		supportUrl?: string | null;
	} | null;
}): Navigation {
	const context: NavigationContext = {
		auth: opts.auth,
		permissions: opts.permissions,
		license: opts.license ?? null,
	};

	const external = filterEnabled(
		EXTERNAL_LINKS.filter((item) =>
			isInEnvironment(item.environments, opts.environment),
		),
		context,
	).map((item) => {
		if (opts.whitelabeling?.docsUrl && item.label === "Documentation") {
			return { ...item, href: opts.whitelabeling.docsUrl };
		}
		if (opts.whitelabeling?.supportUrl && item.label === "Support") {
			return { ...item, href: opts.whitelabeling.supportUrl };
		}
		return item;
	});

	const sections = NAVIGATION_SECTIONS.filter((section) =>
		isInEnvironment(section.environments, opts.environment),
	)
		.filter((section) =>
			section.isEnabled ? section.isEnabled(context) : true,
		)
		.map((section) => ({
			...section,
			items: filterByLicense(
				filterEnabled(
					filterItemsByEnvironment(section.items, opts.environment),
					context,
				),
				context,
			),
			groups: section.groups
				?.filter((group) =>
					isInEnvironment(group.environments, opts.environment),
				)
				.filter((group) => (group.isEnabled ? group.isEnabled(context) : true))
				.map((group) => ({
					...group,
					items: filterByLicense(
						filterEnabled(
							filterItemsByEnvironment(group.items, opts.environment),
							context,
						),
						context,
					),
				}))
				.filter((group) => group.items.length > 0),
		}))
		.filter((section) => section.items.length > 0 || !!section.groups?.length);

	return { sections, external };
}

export function findActiveNavigation(
	navigation: Navigation,
	location: { pathname: string; tab?: string },
): { section: NavigationSection; item: NavigationItem } | undefined {
	for (const section of navigation.sections) {
		const items = [
			...section.items,
			...(section.groups?.flatMap((group) => group.items) ?? []),
		];
		const item = items.find((item) =>
			[
				{ href: item.href, activeTab: item.activeTab },
				...(item.activeRoutes ?? []),
			].some((route) =>
				isActiveRoute({
					itemUrl: route.href,
					pathname: location.pathname,
					activeTab: route.activeTab,
					currentTab: location.tab,
				}),
			),
		);
		if (item) return { section, item };
	}

	return undefined;
}
