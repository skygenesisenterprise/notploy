import type { inferRouterOutputs } from "@trpc/server";
import {
	BarChartHorizontalBigIcon,
	Bell,
	BlocksIcon,
	BookIcon,
	BotIcon,
	CircleHelp,
	ClipboardList,
	Clock,
	CreditCard,
	Folder,
	GalleryVerticalEnd,
	GitBranch,
	Globe,
	HardDrive,
	House,
	KeyRound,
	LayoutGrid,
	LogIn,
	type LucideIcon,
	Network,
	Package,
	PanelsTopLeft,
	Rocket,
	Server,
	ShieldCheck,
	Smartphone,
	Tags,
	User,
	Users,
	Vault,
	Waypoints,
} from "lucide-react";
import type { AppRouter } from "@/server/api/root";

type AuthQueryOutput = inferRouterOutputs<AppRouter>["user"]["get"];
type PermissionsOutput =
	inferRouterOutputs<AppRouter>["user"]["getPermissions"];

/**
 * Deployment environments a navigation node can target.
 *
 * - `self`    self-hosted Notploy, exposing the infrastructure control plane.
 * - `cloud`   managed Notploy Cloud, presenting managed services.
 * - `console` platform operator console (reserved). Enabling it only requires
 *             passing `environment: "console"` to `createNavigation`.
 */
export type NavigationEnvironment = "self" | "cloud" | "console";

/**
 * Dynamic data consumed by `isEnabled` predicates (permissions, roles, ...).
 *
 * Environment visibility is deliberately absent here: it is declared on each
 * node through `environments`, so *where a destination exists* (functional
 * visibility) stays separate from *whether the current user may see it*
 * (access control).
 */
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
 * Destinations that appear under different headings depending on the
 * environment are declared once here and reused, so their href, icon and
 * permission gate are never duplicated across sections.
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
 * Single source of truth for every environment. The tree is authored once and
 * the same definition is filtered twice, in two independent passes:
 *
 *   1. environment visibility (`environments` on sections, groups and items);
 *   2. access control (`isEnabled` reading permissions/roles).
 *
 * A node without `environments` is visible everywhere; a node with an empty
 * `items` array can still contribute `groups`.
 */
const NAVIGATION_SECTIONS: NavigationSection[] = [
	{
		id: "home",
		label: "Overview",
		items: [
			{ label: "Home", href: "/dashboard/home", icon: House },
			{
				label: "Projects",
				href: "/dashboard/projects",
				icon: Folder,
			},
			{
				label: "Monitoring",
				href: "/dashboard/monitoring",
				icon: BarChartHorizontalBigIcon,
				isEnabled: ({ permissions }) => !!permissions?.monitoring.read,
			},
			{
				// Applications, Compose stacks and managed databases share this view.
				label: "Services",
				href: "/dashboard/overview",
				icon: LayoutGrid,
				activeTab: null,
				isEnabled: ({ permissions }) => !!permissions?.service.read,
			},
			{
				label: "Deployments",
				href: "/dashboard/deployments",
				icon: Rocket,
				activeTab: null,
				isEnabled: ({ permissions }) => !!permissions?.deployment.read,
			},
			// Cloud surfaces Schedules under its Infrastructure pole instead.
			{ ...SHARED_ITEMS.schedules, environments: ["self"] },
		],
	},
	{
		id: "infrastructure",
		label: "Infrastructure",
		environments: ["self"],
		items: [],
		groups: [
			{
				id: "fleet",
				label: "Fleet",
				items: [
					{
						label: "Servers",
						href: "/dashboard/settings/servers",
						icon: Server,
						isEnabled: ({ permissions }) => !!permissions?.server.read,
					},
				],
			},
			{
				id: "compute",
				label: "Compute",
				items: [
					{
						label: "Docker",
						href: "/dashboard/docker",
						icon: BlocksIcon,
						activeTab: null,
						isEnabled: ({ permissions }) => !!permissions?.docker.read,
					},
					{
						label: "Swarm",
						href: "/dashboard/swarm",
						icon: Waypoints,
						isEnabled: ({ permissions }) => !!permissions?.docker.read,
					},
				],
			},
			{
				id: "networking",
				label: "Networking",
				items: [
					{
						label: "Networks",
						href: "/dashboard/networks",
						icon: Network,
						isEnabled: ({ permissions }) => !!permissions?.docker.read,
					},
					{
						label: "Traefik Manager",
						href: "/dashboard/traefik",
						icon: GalleryVerticalEnd,
						isEnabled: ({ permissions }) => !!permissions?.traefikFiles.read,
					},
				],
			},
			{
				id: "platform-security",
				label: "Platform security",
				items: [SHARED_ITEMS.certificates],
			},
		],
	},
	// Cloud groups its destinations under Infrastructure and Settings, which
	// complete the shared Overview (`home`) section above.
	{
		id: "cloud-infrastructure",
		label: "Infrastructure",
		environments: ["cloud"],
		items: [
			SHARED_ITEMS.gitProviders,
			{ ...SHARED_ITEMS.containerRegistries, minLicense: "pro" },
			SHARED_ITEMS.dnsProviders,
			{ ...SHARED_ITEMS.objectStorage, minLicense: "pro" },
			SHARED_ITEMS.certificates,
			{ ...SHARED_ITEMS.secretsManager, minLicense: "pro" },
			{ ...SHARED_ITEMS.sso, minLicense: "enterprise" },
			{ ...SHARED_ITEMS.auditLogs, minLicense: "enterprise" },
			{ ...SHARED_ITEMS.schedules, minLicense: "pro" },
			SHARED_ITEMS.notifications,
		],
	},
	{
		id: "cloud-settings",
		label: "Settings",
		environments: ["cloud"],
		items: [
			{ ...SHARED_ITEMS.tags, label: "Workspace & Tags", minLicense: "pro" },
			{ ...SHARED_ITEMS.teamAccess, minLicense: "pro" },
			{ ...SHARED_ITEMS.apiKeys, minLicense: "pro" },
			{
				label: "Billing",
				href: "/dashboard/settings/billing",
				icon: CreditCard,
				isEnabled: ({ permissions }) => !!permissions?.billing?.read,
			},
			{ label: "Profile", href: "/dashboard/settings/profile", icon: User },
			SHARED_ITEMS.sessions,
		],
	},
	// Self-hosted keeps a full Integrations section; cloud distributes these
	// providers across its Infrastructure and Settings poles.
	{
		id: "integrations",
		label: "Integrations",
		environments: ["self"],
		items: [
			SHARED_ITEMS.gitProviders,
			SHARED_ITEMS.containerRegistries,
			SHARED_ITEMS.dnsProviders,
			// Self-hosted keeps SSO under Integrations, cloud surfaces it under
			// Infrastructure, so the shared item is scoped to `self` here.
			SHARED_ITEMS.sso,
			SHARED_ITEMS.objectStorage,
			SHARED_ITEMS.notifications,
			{
				label: "AI Providers",
				href: "/dashboard/settings/ai",
				icon: BotIcon,
				isEnabled: ({ permissions }) => !!permissions?.organization.update,
			},
		],
	},
	{
		id: "administration",
		label: "Administration",
		environments: ["self"],
		items: [
			{
				label: "Users",
				href: "/dashboard/settings/users",
				icon: Users,
				isEnabled: ({ permissions }) => !!permissions?.member.read,
			},
			SHARED_ITEMS.sessions,
			SHARED_ITEMS.secretsManager,
			SHARED_ITEMS.auditLogs,
			SHARED_ITEMS.tags,
			{
				label: "Web Server",
				href: "/dashboard/settings/server",
				icon: PanelsTopLeft,
				isEnabled: ({ permissions }) => !!permissions?.organization.update,
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
		href: "https://support.skygenesisenterprise.com/",
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
