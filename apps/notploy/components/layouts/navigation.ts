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
	Database,
	Folder,
	GalleryVerticalEnd,
	GitBranch,
	Globe,
	House,
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

export type NavigationContext = {
	auth?: AuthQueryOutput;
	permissions?: PermissionsOutput;
	isCloud: boolean;
};

export type NavigationItem = {
	label: string;
	href: string;
	icon: LucideIcon;
	activeTab?: string | null;
	activeRoutes?: Array<{ href: string; activeTab?: string | null }>;
	isEnabled?: (opts: NavigationContext) => boolean;
};

export type NavigationGroup = {
	id: string;
	label: string;
	items: NavigationItem[];
	isEnabled?: (opts: NavigationContext) => boolean;
};

export type NavigationSection = {
	id: string;
	label: string;
	items: NavigationItem[];
	groups?: NavigationGroup[];
	isEnabled?: (opts: NavigationContext) => boolean;
};

export type ExternalNavigationItem = {
	label: string;
	href: string;
	icon: LucideIcon;
	isEnabled?: (opts: NavigationContext) => boolean;
};

export type Navigation = {
	sections: NavigationSection[];
	external: ExternalNavigationItem[];
};

/**
 * Self-hosted navigation exposes the infrastructure control plane directly.
 */
const SELF_HOSTED_SECTIONS: NavigationSection[] = [
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
				isEnabled: ({ permissions, isCloud }) =>
					!!(permissions?.monitoring.read && !isCloud),
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
			{
				label: "Schedules",
				href: "/dashboard/schedules",
				icon: Clock,
				isEnabled: ({ permissions }) => !!permissions?.organization.update,
			},
		],
	},
	{
		id: "infrastructure",
		label: "Infrastructure",
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
						isEnabled: ({ permissions, isCloud }) =>
							!!(permissions?.docker.read && !isCloud),
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
						isEnabled: ({ permissions, isCloud }) =>
							!!(permissions?.docker.read && !isCloud),
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
				items: [
					{
						label: "Certificates",
						href: "/dashboard/settings/certificates",
						icon: ShieldCheck,
						isEnabled: ({ permissions }) => !!permissions?.certificate.read,
					},
				],
			},
		],
	},
	{
		id: "integrations",
		label: "Integrations",
		items: [
			{
				label: "Git Providers",
				href: "/dashboard/settings/git-providers",
				icon: GitBranch,
				isEnabled: ({ permissions }) => !!permissions?.gitProviders.read,
			},
			{
				label: "Container Registries",
				href: "/dashboard/settings/registry",
				icon: Package,
				isEnabled: ({ permissions }) => !!permissions?.registry.read,
			},
			{
				label: "DNS Providers",
				href: "/dashboard/settings/dns",
				icon: Globe,
				isEnabled: ({ permissions }) => !!permissions?.dnsProvider.read,
			},
			{
				label: "SSO",
				href: "/dashboard/settings/sso",
				icon: LogIn,
				isEnabled: ({ permissions }) => !!permissions?.organization.update,
			},
			{
				label: "S3 Destinations",
				href: "/dashboard/settings/destinations",
				icon: Database,
				isEnabled: ({ permissions }) => !!permissions?.destination.read,
			},
			{
				label: "Notifications",
				href: "/dashboard/settings/notifications",
				icon: Bell,
				isEnabled: ({ permissions }) => !!permissions?.notification.read,
			},
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
		items: [
			{
				label: "Users",
				href: "/dashboard/settings/users",
				icon: Users,
				isEnabled: ({ permissions }) => !!permissions?.member.read,
			},
			{
				label: "Sessions",
				href: "/dashboard/settings/sessions",
				icon: Smartphone,
			},
			{
				label: "Secrets Manager",
				href: "/dashboard/settings/secrets",
				icon: Vault,
				isEnabled: ({ permissions }) => !!permissions?.vaultProvider.create,
			},
			{
				label: "Audit Logs",
				href: "/dashboard/settings/audit-logs",
				icon: ClipboardList,
				isEnabled: ({ permissions }) => !!permissions?.auditLog.read,
			},
			{
				label: "Tags",
				href: "/dashboard/settings/tags",
				icon: Tags,
				isEnabled: ({ permissions }) => !!permissions?.tag.read,
			},
			{
				label: "Web Server",
				href: "/dashboard/settings/server",
				icon: PanelsTopLeft,
				isEnabled: ({ permissions, isCloud }) =>
					!!(permissions?.organization.update && !isCloud),
			},
		],
	},
];

/**
 * Cloud navigation presents managed services and account-level capabilities,
 * without exposing self-hosted host/runtime controls as cloud features.
 */
const CLOUD_SECTIONS: NavigationSection[] = [
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
				// The existing overview combines application and other service types.
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
			{
				label: "Schedules",
				href: "/dashboard/schedules",
				icon: Clock,
				isEnabled: ({ permissions }) => !!permissions?.organization.update,
			},
		],
	},
	{
		id: "resources",
		label: "Resources",
		items: [
			{
				label: "Certificates",
				href: "/dashboard/settings/certificates",
				icon: ShieldCheck,
				isEnabled: ({ permissions }) => !!permissions?.certificate.read,
			},
		],
	},
	{
		id: "security",
		label: "Security",
		items: [
			{
				label: "Secrets Manager",
				href: "/dashboard/settings/secrets",
				icon: Vault,
				isEnabled: ({ permissions }) => !!permissions?.vaultProvider.create,
			},
			{
				label: "SSO",
				href: "/dashboard/settings/sso",
				icon: LogIn,
				isEnabled: ({ permissions }) => !!permissions?.organization.update,
			},
		],
	},
	{
		id: "integrations",
		label: "Integrations",
		items: [
			{
				label: "Git Providers",
				href: "/dashboard/settings/git-providers",
				icon: GitBranch,
				isEnabled: ({ permissions }) => !!permissions?.gitProviders.read,
			},
			{
				label: "Container Registries",
				href: "/dashboard/settings/registry",
				icon: Package,
				isEnabled: ({ permissions }) => !!permissions?.registry.read,
			},
			{
				label: "DNS Providers",
				href: "/dashboard/settings/dns",
				icon: Globe,
				isEnabled: ({ permissions }) => !!permissions?.dnsProvider.read,
			},
			{
				label: "S3",
				href: "/dashboard/settings/destinations",
				icon: Database,
				isEnabled: ({ permissions }) => !!permissions?.destination.read,
			},
			{
				label: "Notifications",
				href: "/dashboard/settings/notifications",
				icon: Bell,
				isEnabled: ({ permissions }) => !!permissions?.notification.read,
			},
			{
				label: "AI Providers",
				href: "/dashboard/settings/ai",
				icon: BotIcon,
				isEnabled: ({ permissions }) => !!permissions?.organization.update,
			},
		],
	},
	{
		id: "account",
		label: "Account",
		items: [
			{
				label: "Team",
				href: "/dashboard/settings/users",
				icon: Users,
				isEnabled: ({ permissions }) => !!permissions?.member.read,
			},
			{
				label: "Sessions",
				href: "/dashboard/settings/sessions",
				icon: Smartphone,
			},
			{
				label: "Audit Logs",
				href: "/dashboard/settings/audit-logs",
				icon: ClipboardList,
				isEnabled: ({ permissions }) => !!permissions?.auditLog.read,
			},
			{
				label: "Tags",
				href: "/dashboard/settings/tags",
				icon: Tags,
				isEnabled: ({ permissions }) => !!permissions?.tag.read,
			},
			{ label: "Profile", href: "/dashboard/settings/profile", icon: User },
			{
				label: "Billing",
				href: "/dashboard/settings/billing",
				icon: CreditCard,
				isEnabled: ({ auth }) => auth?.role === "owner",
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

const NAVIGATIONS: Record<NavigationVariant, Navigation> = {
	selfHosted: { sections: SELF_HOSTED_SECTIONS, external: EXTERNAL_LINKS },
	cloud: { sections: CLOUD_SECTIONS, external: EXTERNAL_LINKS },
};

export type NavigationVariant = "selfHosted" | "cloud";

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

function filterEnabled<
	T extends { isEnabled?: (o: NavigationContext) => boolean },
>(items: readonly T[], context: NavigationContext): T[] {
	return items.filter((item) =>
		item.isEnabled ? item.isEnabled(context) : true,
	);
}

export function createNavigation(opts: {
	variant: NavigationVariant;
	auth?: AuthQueryOutput;
	permissions?: PermissionsOutput;
	isCloud: boolean;
	whitelabeling?: {
		docsUrl?: string | null;
		supportUrl?: string | null;
	} | null;
}): Navigation {
	const context: NavigationContext = {
		auth: opts.auth,
		permissions: opts.permissions,
		isCloud: opts.isCloud,
	};

	const external = filterEnabled(
		NAVIGATIONS[opts.variant].external,
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

	const sections = NAVIGATIONS[opts.variant].sections
		.filter((section) =>
			section.isEnabled ? section.isEnabled(context) : true,
		)
		.map((section) => ({
			...section,
			items: filterEnabled(section.items, context),
			groups: section.groups
				?.filter((group) => (group.isEnabled ? group.isEnabled(context) : true))
				.map((group) => ({
					...group,
					items: filterEnabled(group.items, context),
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
