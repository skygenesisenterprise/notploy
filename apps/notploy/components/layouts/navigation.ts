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
	/** Stable destination identifier, independent from its label and href. */
	id: string;
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

/**
 * A logical grouping inside a section.
 *
 * Groups are **structural only**: `SidebarNavigation` renders one flat list per
 * section, so group labels are not displayed. They exist to keep the shared
 * model readable, to scope environment/licence rules, and to preserve a stable
 * ordering that both the sidebar and the breadcrumb consume.
 */
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
	id: string;
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

type ActiveRoute = {
	href: string;
	activeTab?: string | null;
};

/**
 * Intrinsic properties of a destination: its identity, where it lives and how
 * it is reached. Presentation concerns (section, group, order, label overrides
 * and environment-specific licence) belong to the layouts below.
 */
type NavigationDestination = {
	label: string;
	href: string;
	icon: LucideIcon;
	activeTab?: string | null;
	activeRoutes?: readonly ActiveRoute[];
	environments?: readonly NavigationEnvironment[];
	isEnabled?: (opts: NavigationContext) => boolean;
};

/**
 * Every page reachable from the sidebar, declared once. The object key is the
 * stable destination id used by layouts and rendered as `NavigationItem.id`.
 */
const NAVIGATION_DESTINATIONS = {
	home: {
		label: "Home",
		href: "/dashboard/home",
		icon: House,
	},
	projects: {
		label: "Projects",
		href: "/dashboard/projects",
		icon: Folder,
	},
	monitoring: {
		label: "Monitoring",
		href: "/dashboard/monitoring",
		icon: BarChartHorizontalBigIcon,
	},
	services: {
		label: "Services",
		href: "/dashboard/overview",
		icon: LayoutGrid,
		activeTab: null,
		isEnabled: ({ permissions }) => !!permissions?.service.read,
	},
	deployments: {
		label: "Deployments",
		href: "/dashboard/deployments",
		icon: Rocket,
		activeTab: null,
		isEnabled: ({ permissions }) => !!permissions?.deployment.read,
	},
	schedules: {
		label: "Schedules",
		href: "/dashboard/schedules",
		icon: Clock,
		isEnabled: ({ permissions }) => !!permissions?.organization.update,
	},
	incidents: {
		label: "Incidents",
		href: "/dashboard/incidents",
		icon: TriangleAlert,
	},
	operations: {
		label: "Operations",
		href: "/dashboard/operations",
		icon: Activity,
	},
	traffic: {
		label: "Traffic",
		href: "/dashboard/website/traffic",
		icon: TrendingUp,
		isEnabled: ({ permissions }) => !!permissions?.traffic.read,
	},
	servers: {
		label: "Servers",
		href: "/dashboard/settings/servers",
		icon: Server,
		isEnabled: ({ permissions }) => !!permissions?.server.read,
	},
	docker: {
		label: "Docker",
		href: "/dashboard/docker",
		icon: BlocksIcon,
		activeTab: null,
		isEnabled: ({ permissions }) => !!permissions?.docker.read,
	},
	swarm: {
		label: "Swarm",
		href: "/dashboard/swarm",
		icon: Waypoints,
		isEnabled: ({ permissions }) => !!permissions?.docker.read,
	},
	runtime: {
		label: "Runtime",
		href: "/dashboard/containers",
		icon: Boxes,
		isEnabled: ({ permissions }) => !!permissions?.docker.read,
	},
	networks: {
		label: "Networks",
		href: "/dashboard/networks",
		icon: Network,
		isEnabled: ({ permissions }) => !!permissions?.docker.read,
	},
	traefik: {
		label: "Traefik Manager",
		href: "/dashboard/traefik",
		icon: GalleryVerticalEnd,
		isEnabled: ({ permissions }) => !!permissions?.traefikFiles.read,
	},
	certificates: {
		label: "Certificates",
		href: "/dashboard/settings/certificates",
		icon: ShieldCheck,
		isEnabled: ({ permissions }) => !!permissions?.certificate.read,
	},
	sso: {
		label: "SSO",
		href: "/dashboard/settings/sso",
		icon: LogIn,
		isEnabled: ({ permissions }) => !!permissions?.organization.update,
	},
	secrets: {
		label: "Secrets Manager",
		href: "/dashboard/settings/secrets",
		icon: Vault,
		isEnabled: ({ permissions }) => !!permissions?.vaultProvider.create,
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
	aiProviders: {
		label: "AI Providers",
		href: "/dashboard/settings/ai",
		icon: BotIcon,
		isEnabled: ({ permissions }) => !!permissions?.organization.update,
	},
	webServer: {
		label: "Web Server",
		href: "/dashboard/settings/server",
		icon: PanelsTopLeft,
		isEnabled: ({ permissions }) => !!permissions?.organization.update,
	},
	storage: {
		label: "Storage",
		href: "/dashboard/storage",
		icon: Database,
	},
	team: {
		label: "Team & Access",
		href: "/dashboard/settings/users",
		icon: Users,
		isEnabled: ({ permissions }) => !!permissions?.member.read,
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
	notifications: {
		label: "Notifications",
		href: "/dashboard/settings/notifications",
		icon: Bell,
		isEnabled: ({ permissions }) => !!permissions?.notification.read,
	},
	apiKeys: {
		label: "API Keys",
		href: "/dashboard/settings/api-keys",
		icon: KeyRound,
		isEnabled: ({ permissions }) => !!permissions?.api.read,
	},
	billing: {
		label: "Billing",
		href: "/dashboard/settings/billing",
		icon: CreditCard,
		isEnabled: ({ permissions }) => !!permissions?.billing?.read,
	},
	profile: {
		label: "Profile",
		href: "/dashboard/settings/profile",
		icon: User,
	},
	workspaces: {
		label: "Workspaces",
		href: "/dashboard/workspaces",
		icon: Building2,
	},
	applications: {
		label: "Applications",
		href: "/dashboard/applications",
		icon: AppWindow,
	},
	domains: {
		label: "Domains",
		href: "/dashboard/domains",
		icon: Link2,
	},
	usage: {
		label: "Usage",
		href: "/dashboard/usage",
		icon: ChartPie,
	},
	capacity: {
		label: "Capacity",
		href: "/dashboard/capacity",
		icon: Gauge,
	},
	platformServices: {
		label: "Platform Services",
		href: "/dashboard/platform-services",
		icon: Layers,
	},
	maintenance: {
		label: "Maintenance",
		href: "/dashboard/maintenance",
		icon: Wrench,
	},
	community: {
		label: "Community",
		href: "/dashboard/website/community",
		icon: HeartHandshake,
		isEnabled: ({ permissions }) => !!permissions?.community.read,
	},
	blog: {
		label: "Blog",
		href: "/dashboard/website/blog",
		icon: Newspaper,
	},
	careers: {
		label: "Careers",
		href: "/dashboard/website/careers",
		icon: Briefcase,
	},
} satisfies Record<string, NavigationDestination>;

type NavigationDestinationId = keyof typeof NAVIGATION_DESTINATIONS;

/**
 * Cloud entitlement matrix: the minimum workspace licence required for each
 * destination. Keeping every destination in one exhaustive table makes the
 * Free → Pro → Enterprise expansion explicit and forces newly added pages to
 * declare their tier instead of silently defaulting to "available to everyone".
 *
 * Scope and semantics:
 * - Only the `cloud` product is gated. Self-hosted instances are unlicensed and
 *   Console is an internal operator surface, so neither reads this table.
 * - `free` is the Cloud baseline (no paid subscription); it is not a gate, so a
 *   missing licence still exposes Free destinations.
 * - `pro` corresponds to the marketed Startup plan and `enterprise` to the
 *   Enterprise plan. The licence tier is resolved by the sidebar from the
 *   active organization's subscription, not from this file.
 * - This table controls navigation visibility only. Server-side authorization
 *   and plan limits remain authoritative for direct URL access and mutations.
 */
const CLOUD_DESTINATION_MIN_LICENSE = {
	home: "free",
	projects: "free",
	monitoring: "free",
	services: "free",
	deployments: "free",
	schedules: "pro",
	incidents: "free",
	operations: "free",
	traffic: "free",
	servers: "free",
	docker: "free",
	swarm: "free",
	runtime: "free",
	networks: "free",
	traefik: "free",
	certificates: "free",
	sso: "enterprise",
	secrets: "pro",
	gitProviders: "free",
	containerRegistries: "pro",
	dnsProviders: "free",
	objectStorage: "pro",
	aiProviders: "free",
	webServer: "free",
	storage: "free",
	team: "pro",
	sessions: "free",
	auditLogs: "enterprise",
	tags: "pro",
	notifications: "free",
	apiKeys: "pro",
	billing: "free",
	profile: "free",
	workspaces: "free",
	applications: "free",
	domains: "free",
	usage: "free",
	capacity: "free",
	platformServices: "free",
	maintenance: "free",
	community: "free",
	blog: "free",
	careers: "free",
} satisfies Record<NavigationDestinationId, LicenseTier>;

/**
 * A destination as it appears in the shared navigation tree. Every environment
 * reads the same sections and groups; a placement only declares which
 * environments render it, plus any environment-specific label or licence.
 *
 * Cloud licence requirements normally come from
 * `CLOUD_DESTINATION_MIN_LICENSE`. `minLicense` remains available for the rare
 * placement that needs to override the shared entitlement.
 */
type NavigationPlacement = {
	destination: NavigationDestinationId;
	environments?: readonly NavigationEnvironment[];
	/** A string applies to every environment; a map overrides per environment. */
	label?: string | Partial<Record<NavigationEnvironment, string>>;
	/** A tier applies to every environment; a map overrides per environment. */
	minLicense?:
		| LicenseTier
		| Partial<Record<NavigationEnvironment, LicenseTier>>;
};

type NavigationGroupDefinition = {
	id: string;
	label: string;
	items: readonly NavigationPlacement[];
	environments?: readonly NavigationEnvironment[];
	minLicense?: LicenseTier;
	isEnabled?: (opts: NavigationContext) => boolean;
};

type NavigationSectionId = "overview" | "infrastructure" | "organization";

/**
 * One shared section model across Self, Cloud and Console. Sections and groups
 * keep the same identity, labels and order in every environment; destinations
 * simply appear where they are needed. Empty groups and sections are removed
 * after filtering.
 */
type NavigationSectionDefinition = {
	id: NavigationSectionId;
	label: string;
	items?: readonly NavigationPlacement[];
	groups?: readonly NavigationGroupDefinition[];
	environments?: readonly NavigationEnvironment[];
	minLicense?: LicenseTier;
	isEnabled?: (opts: NavigationContext) => boolean;
};

const NAVIGATION_SECTIONS: readonly NavigationSectionDefinition[] = [
	{
		id: "overview",
		label: "Overview",
		groups: [
			{
				id: "workspace",
				label: "Workspace",
				items: [{ destination: "home" }, { destination: "projects" }],
			},
			{
				id: "operations",
				label: "Operations",
				items: [
					{ destination: "incidents", environments: ["console"] },
					{ destination: "operations", environments: ["console"] },
					{
						destination: "monitoring",
						environments: ["self", "console"],
					},
					{ destination: "traffic", environments: ["console"] },
				],
			},
			{
				id: "delivery",
				label: "Delivery",
				items: [
					{ destination: "services", environments: ["self", "cloud"] },
					{ destination: "deployments" },
					{
						destination: "schedules",
						environments: ["self", "cloud"],
					},
				],
			},
		],
	},
	{
		id: "infrastructure",
		label: "Infrastructure",
		groups: [
			{
				id: "compute-runtime",
				label: "Compute & Runtime",
				items: [
					{ destination: "servers", environments: ["self", "cloud", "console"] },
					{
						destination: "docker",
						environments: ["self", "cloud", "console"],
						label: { self: "Docker", console: "Compute", cloud: "Docker" },
					},
					{
						destination: "swarm",
						environments: ["self", "cloud", "console"],
						label: { self: "Swarm", console: "Clusters", cloud: "Swarm" },
					},
					{ destination: "runtime", environments: ["console"] },
				],
			},
			{
				id: "networking-edge",
				label: "Networking & Edge",
				items: [
					{ destination: "networks", environments: ["self", "cloud", "console"] },
					{ destination: "traefik", environments: ["self", "cloud"] },
					{
						destination: "dnsProviders",
						label: { console: "DNS" },
					},
					{ destination: "webServer", environments: ["self", "console"] },
				],
			},
			{
				id: "storage-data",
				label: "Storage & Data",
				items: [
					{ destination: "storage", environments: ["console"] },
					{ destination: "objectStorage" },
				],
			},
			{
				id: "security-secrets",
				label: "Security & Secrets",
				items: [
					{ destination: "certificates" },
					{ destination: "sso" },
					{
						destination: "secrets",
						label: { console: "Secrets" },
					},
				],
			},
			{
				id: "integrations-providers",
				label: "Integrations & Providers",
				items: [
					{
						destination: "gitProviders",
						label: { console: "Git" },
					},
					{
						destination: "containerRegistries",
						label: { console: "Registries" },
					},
					{ destination: "aiProviders", environments: ["self", "cloud"] },
				],
			},
		],
	},
	{
		id: "organization",
		label: "Organization",
		groups: [
			{
				id: "members-access",
				label: "Members & Access",
				items: [
					{
						destination: "team",
						environments: ["self", "cloud"],
						label: { self: "Users" },
					},
					{
						destination: "apiKeys",
						environments: ["cloud"],
					},
					{
						destination: "sessions",
						environments: ["self", "cloud"],
					},
				],
			},
			{
				id: "governance",
				label: "Governance",
				items: [
					{ destination: "workspaces", environments: ["console"] },
					{ destination: "applications", environments: ["console"] },
					{ destination: "domains", environments: ["console"] },
					{
						destination: "auditLogs",
						environments: ["self", "cloud"],
					},
					{
						destination: "tags",
						environments: ["self", "cloud"],
						label: { cloud: "Workspace & Tags" },
					},
				],
			},
			{
				id: "usage-billing",
				label: "Usage & Billing",
				items: [
					{ destination: "usage", environments: ["console"] },
					{ destination: "capacity", environments: ["console"] },
					{
						destination: "billing",
						environments: ["cloud", "console"],
					},
				],
			},
			{
				id: "platform-operations",
				label: "Platform Operations",
				items: [
					{
						destination: "platformServices",
						environments: ["console"],
					},
					{ destination: "maintenance", environments: ["console"] },
				],
			},
			{
				id: "account",
				label: "Account",
				items: [
					{
						destination: "notifications",
						environments: ["self", "cloud"],
					},
					{ destination: "profile", environments: ["cloud"] },
				],
			},
			{
				id: "public-site",
				label: "Public Site",
				items: [
					{ destination: "community", environments: ["console"] },
					{ destination: "blog", environments: ["console"] },
					{ destination: "careers", environments: ["console"] },
				],
			},
		],
	},
];

type ExternalNavigationDestination = {
	label: string;
	href: string;
	icon: LucideIcon;
	environments?: readonly NavigationEnvironment[];
	isEnabled?: (opts: NavigationContext) => boolean;
};

const EXTERNAL_DESTINATIONS = {
	documentation: {
		label: "Documentation",
		href: "https://docs.notploy.com/docs/core",
		icon: BookIcon,
	},
	support: {
		label: "Support",
		href: "https://discord.gg/GUkDugVh34",
		icon: CircleHelp,
	},
} satisfies Record<string, ExternalNavigationDestination>;

type ExternalDestinationId = keyof typeof EXTERNAL_DESTINATIONS;

/** Externally hosted destinations, in rendered order. */
const EXTERNAL_LINKS: readonly {
	destination: ExternalDestinationId;
}[] = [{ destination: "documentation" }, { destination: "support" }];

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
 * Environment visibility pass. Distinct from `isEnabled` (access control).
 * An omitted list means every environment; an empty list matches none.
 */
function isInEnvironment(
	environments: readonly NavigationEnvironment[] | undefined,
	environment: NavigationEnvironment,
): boolean {
	return !environments || environments.includes(environment);
}

/**
 * Licence visibility pass. A node declaring `minLicense` is only rendered when
 * the workspace tier is at least that high; an unlicensed context never
 * satisfies a tiered requirement.
 */
function passesLicense(
	minLicense: LicenseTier | undefined,
	license: LicenseTier | null,
): boolean {
	if (!minLicense) return true;
	if (license === null) return false;
	return LICENSE_RANK[license] >= LICENSE_RANK[minLicense];
}

type VisibilityRules = {
	environments?: readonly NavigationEnvironment[];
	minLicense?: LicenseTier;
	isEnabled?: (opts: NavigationContext) => boolean;
};

/**
 * Single visibility pass shared by sections, groups and destinations, so the
 * same rules apply whether an entry is rendered directly or inside a group.
 */
function isVisible(
	node: VisibilityRules,
	context: NavigationContext,
	environment: NavigationEnvironment,
): boolean {
	return (
		isInEnvironment(node.environments, environment) &&
		passesLicense(node.minLicense, context.license ?? null) &&
		(node.isEnabled?.(context) ?? true)
	);
}

function labelForEnvironment(
	label: NavigationPlacement["label"],
	fallback: string,
	environment: NavigationEnvironment,
): string {
	if (!label) return fallback;
	if (typeof label === "string") return label;
	return label[environment] ?? fallback;
}

function minLicenseForEnvironment(
	minLicense: NavigationPlacement["minLicense"],
	environment: NavigationEnvironment,
): LicenseTier | undefined {
	if (!minLicense) return undefined;
	if (typeof minLicense === "string") return minLicense;
	return minLicense[environment];
}

/**
 * Licence required for a placement in a given environment. Cloud reads the
 * shared entitlement matrix; Self and Console stay unlicensed unless a
 * placement explicitly opts into a tier.
 *
 * `free` is the baseline, so it resolves to no minimum rather than requiring a
 * non-null licence. This keeps an unlicensed Cloud context (for example while
 * subscription data is unavailable) on the Free menu instead of blanking it.
 */
function requiredLicenseForPlacement(
	placement: NavigationPlacement,
	environment: NavigationEnvironment,
): LicenseTier | undefined {
	const override = minLicenseForEnvironment(placement.minLicense, environment);
	if (override) return override;
	if (environment !== "cloud") return undefined;
	const entitlement = CLOUD_DESTINATION_MIN_LICENSE[placement.destination];
	return entitlement === "free" ? undefined : entitlement;
}

function resolvePlacement(
	placement: NavigationPlacement,
	context: NavigationContext,
	environment: NavigationEnvironment,
): NavigationItem | undefined {
	const destination: NavigationDestination =
		NAVIGATION_DESTINATIONS[placement.destination];

	if (!isInEnvironment(placement.environments, environment)) return undefined;
	if (!isVisible(destination, context, environment)) return undefined;

	const minLicense = requiredLicenseForPlacement(placement, environment);
	if (!passesLicense(minLicense, context.license ?? null)) return undefined;

	return {
		id: placement.destination,
		label: labelForEnvironment(placement.label, destination.label, environment),
		href: destination.href,
		icon: destination.icon,
		activeTab: destination.activeTab,
		activeRoutes: destination.activeRoutes
			? [...destination.activeRoutes]
			: undefined,
		minLicense,
		isEnabled: destination.isEnabled,
	};
}

function resolveItems(
	placements: readonly NavigationPlacement[],
	context: NavigationContext,
	environment: NavigationEnvironment,
): NavigationItem[] {
	const items: NavigationItem[] = [];
	for (const placement of placements) {
		const item = resolvePlacement(placement, context, environment);
		if (item) items.push(item);
	}
	return items;
}

function resolveSection(
	section: NavigationSectionDefinition,
	context: NavigationContext,
	environment: NavigationEnvironment,
): NavigationSection | undefined {
	if (!isVisible(section, context, environment)) return undefined;

	const items = resolveItems(section.items ?? [], context, environment);
	const groups: NavigationGroup[] = [];

	for (const group of section.groups ?? []) {
		if (!isVisible(group, context, environment)) continue;
		const groupItems = resolveItems(group.items, context, environment);
		if (groupItems.length === 0) continue;
		groups.push({
			id: group.id,
			label: group.label,
			items: groupItems,
			minLicense: group.minLicense,
			isEnabled: group.isEnabled,
		});
	}

	if (items.length === 0 && groups.length === 0) return undefined;

	return {
		id: section.id,
		label: section.label,
		items,
		groups: groups.length > 0 ? groups : undefined,
		minLicense: section.minLicense,
		isEnabled: section.isEnabled,
	};
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

	const external: ExternalNavigationItem[] = [];
	for (const { destination: id } of EXTERNAL_LINKS) {
		const destination: ExternalNavigationDestination =
			EXTERNAL_DESTINATIONS[id];
		if (!isVisible(destination, context, opts.environment)) continue;

		// Whitelabeling is matched by stable id rather than by mutable label.
		const href =
			id === "documentation" && opts.whitelabeling?.docsUrl
				? opts.whitelabeling.docsUrl
				: id === "support" && opts.whitelabeling?.supportUrl
					? opts.whitelabeling.supportUrl
					: destination.href;

		external.push({
			id,
			label: destination.label,
			href,
			icon: destination.icon,
			environments: destination.environments
				? [...destination.environments]
				: undefined,
			isEnabled: destination.isEnabled,
		});
	}

	const sections: NavigationSection[] = [];
	for (const section of NAVIGATION_SECTIONS) {
		const resolved = resolveSection(section, context, opts.environment);
		if (resolved) sections.push(resolved);
	}

	return { sections, external };
}

/**
 * Flat rendering order of a section: direct items first, then each group in
 * declaration order. The sidebar and the breadcrumb both use this helper so
 * they can never disagree about which entry comes first.
 */
export function navigationSectionItems(
	section: NavigationSection,
): NavigationItem[] {
	return [
		...section.items,
		...(section.groups?.flatMap((group) => group.items) ?? []),
	];
}

/**
 * Single source of truth for whether a rendered navigation entry is active.
 * It accounts for the item's primary route, its optional `activeRoutes`, the
 * `activeTab` overrides and the `?tab=` query parameter.
 */
export function isNavigationItemActive(
	item: NavigationItem,
	location: { pathname: string; tab?: string },
): boolean {
	return [
		{ href: item.href, activeTab: item.activeTab },
		...(item.activeRoutes ?? []),
	].some((route) =>
		isActiveRoute({
			itemUrl: route.href,
			pathname: location.pathname,
			activeTab: route.activeTab,
			currentTab: location.tab,
		}),
	);
}

export function findActiveNavigation(
	navigation: Navigation,
	location: { pathname: string; tab?: string },
): { section: NavigationSection; item: NavigationItem } | undefined {
	for (const section of navigation.sections) {
		const item = navigationSectionItems(section).find((candidate) =>
			isNavigationItemActive(candidate, location),
		);
		if (item) return { section, item };
	}

	return undefined;
}
