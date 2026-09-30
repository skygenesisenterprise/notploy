import type { inferRouterOutputs } from "@trpc/server";
import {
	Activity,
	BarChartHorizontalBigIcon,
	Bell,
	BlocksIcon,
	BookIcon,
	BotIcon,
	Boxes,
	CircleHelp,
	ClipboardList,
	Clock,
	CreditCard,
	Folder,
	Forward,
	GalleryVerticalEnd,
	GitBranch,
	Globe,
	HardDrive,
	HeartPulse,
	House,
	KeyRound,
	Layers,
	LayoutGrid,
	LogIn,
	type LucideIcon,
	Network,
	Package,
	Palette,
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

// The types of the queries we are going to use
type AuthQueryOutput = inferRouterOutputs<AppRouter>["user"]["get"];
type PermissionsOutput =
	inferRouterOutputs<AppRouter>["user"]["getPermissions"];

/**
 * Context handed to every visibility predicate of the navigation tree.
 * It carries exactly the same information the previous flat `MENU` used,
 * so gating rules can be reused verbatim.
 */
export type NavigationContext = {
	auth?: AuthQueryOutput;
	permissions?: PermissionsOutput;
	isCloud: boolean;
};

/**
 * A single destination in the sidebar.
 *
 * `activeTab` disambiguates entries that share the same technical route but
 * target a different tab of it (e.g. `/dashboard/docker` vs
 * `/dashboard/docker?tab=volumes`):
 * - `undefined` (default): plain pathname/prefix match, no query awareness.
 * - `string`: only highlighted when `?tab=` equals this value.
 * - `null`: only highlighted when no `?tab=` is present (the "hub" entry).
 */
export type NavigationItem = {
	label: string;
	href: string;
	icon: LucideIcon;
	activeTab?: string | null;
	isEnabled?: (opts: NavigationContext) => boolean;
};

/**
 * A top level concept of the platform. The section is what the user reads as
 * the "area" of Notploy they are working in, and it is also what the header
 * breadcrumb exposes as the first crumb.
 */
export type NavigationSection = {
	id: string;
	label: string;
	items: NavigationItem[];
	isEnabled?: (opts: NavigationContext) => boolean;
};

/** An entry pointing outside of the Notploy UI (docs, community, ...). */
export type ExternalNavigationItem = {
	label: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	isEnabled?: (opts: NavigationContext) => boolean;
};

export type Navigation = {
	sections: NavigationSection[];
	external: ExternalNavigationItem[];
};

/**
 * Self-hosted navigation — the control plane view of Notploy.
 *
 * Notploy manages infrastructure, runs workloads on top of it and operates
 * both, so the tree is organised by role (workload, infrastructure,
 * observability, security, integration, administration) instead of by
 * "settings bucket".
 *
 * Note: technical URLs are intentionally left untouched. `/dashboard/settings/*`
 * is the historical location of many pages, but it does not dictate where the
 * feature lives conceptually.
 */
const SELF_HOSTED_NAVIGATION: Navigation = {
	sections: [
		{
			id: "home",
			label: "Home",
			items: [
				{
					label: "Home",
					href: "/dashboard/home",
					icon: House,
				},
			],
		},
		{
			id: "workloads",
			label: "Workloads",
			items: [
				{
					label: "Projects",
					href: "/dashboard/projects",
					icon: Folder,
				},
				{
					// Applications, Compose stacks and managed databases all live
					// in the services overview.
					label: "Services",
					href: "/dashboard/overview",
					icon: LayoutGrid,
					activeTab: null,
					isEnabled: ({ permissions }) => !!permissions?.service.read,
				},
				{
					label: "Deployments",
					href: "/dashboard/overview?tab=deployments",
					icon: Rocket,
					activeTab: "deployments",
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
			items: [
				{
					label: "Servers",
					href: "/dashboard/settings/servers",
					icon: Server,
					isEnabled: ({ permissions }) => !!permissions?.server.read,
				},
				{
					label: "Docker",
					href: "/dashboard/docker",
					icon: BlocksIcon,
					activeTab: null,
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					label: "Containers",
					href: "/dashboard/docker?tab=containers",
					icon: Boxes,
					activeTab: "containers",
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					label: "Swarm",
					href: "/dashboard/docker?tab=swarm",
					icon: Waypoints,
					activeTab: "swarm",
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					label: "Images",
					href: "/dashboard/docker?tab=images",
					icon: Layers,
					activeTab: "images",
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					label: "Networks",
					href: "/dashboard/docker?tab=networks",
					icon: Network,
					activeTab: "networks",
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					label: "Storage",
					href: "/dashboard/docker?tab=volumes",
					icon: HardDrive,
					activeTab: "volumes",
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					label: "Health",
					href: "/dashboard/docker?tab=health",
					icon: HeartPulse,
					activeTab: "health",
					// Host-level diagnostics, same requirement as the docker page.
					isEnabled: ({ permissions }) =>
						!!(permissions?.docker.read && permissions?.server.read),
				},
				{
					label: "Traefik",
					href: "/dashboard/traefik",
					icon: GalleryVerticalEnd,
					isEnabled: ({ permissions }) => !!permissions?.traefikFiles.read,
				},
				{
					label: "DNS",
					href: "/dashboard/settings/dns",
					icon: Globe,
					isEnabled: ({ permissions }) => !!permissions?.dnsProvider.read,
				},
				{
					label: "Certificates",
					href: "/dashboard/settings/certificates",
					icon: ShieldCheck,
					isEnabled: ({ permissions }) => !!permissions?.certificate.read,
				},
			],
		},
		{
			id: "observability",
			label: "Observability",
			items: [
				{
					label: "Monitoring",
					href: "/dashboard/monitoring",
					icon: BarChartHorizontalBigIcon,
					isEnabled: ({ permissions, isCloud }) =>
						!!(permissions?.monitoring.read && !isCloud),
				},
				{
					label: "Requests",
					href: "/dashboard/requests",
					icon: Forward,
					isEnabled: ({ permissions, isCloud }) =>
						!!(permissions?.docker.read && !isCloud),
				},
			],
		},
		{
			id: "security",
			label: "Security",
			items: [
				{
					label: "Secrets",
					href: "/dashboard/settings/secrets",
					icon: Vault,
					isEnabled: ({ permissions }) => !!permissions?.vaultProvider.create,
				},
				{
					label: "SSH Keys",
					href: "/dashboard/settings/ssh-keys",
					icon: KeyRound,
					isEnabled: ({ permissions }) => !!permissions?.sshKeys.read,
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
					label: "Registries",
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
					label: "S3 Destinations",
					href: "/dashboard/settings/destinations",
					icon: HardDrive,
					isEnabled: ({ permissions }) => !!permissions?.destination.read,
				},
				{
					label: "Notifications",
					href: "/dashboard/settings/notifications",
					icon: Bell,
					isEnabled: ({ permissions }) => !!permissions?.notification.read,
				},
				{
					label: "AI",
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
					label: "Web Server",
					href: "/dashboard/settings/server",
					icon: Activity,
					isEnabled: ({ permissions, isCloud }) =>
						!!(permissions?.organization.update && !isCloud),
				},
				{
					// Also exposes invitations and the custom roles (RBAC) editor.
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
					label: "API Keys",
					href: "/dashboard/settings/api-keys",
					icon: KeyRound,
					// Owners and admins hold `api:read`; members never do, and the
					// `api.read` statement is also enforced by the user.apiKeys query.
					isEnabled: ({ permissions }) => !!permissions?.api.read,
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
					// Concurrent builds per server; self-hosted only.
					label: "Build Settings",
					href: "/dashboard/settings/deployments",
					icon: Rocket,
					isEnabled: ({ permissions, isCloud }) =>
						!!(permissions?.server.read && !isCloud),
				},
				{
					label: "Whitelabeling",
					href: "/dashboard/settings/whitelabeling",
					icon: Palette,
					isEnabled: ({ auth, isCloud }) =>
						!!(auth?.role === "owner" && !isCloud),
				},
			],
		},
	],
	external: [
		{
			label: "Documentation",
			href: "https://docs.notploy.com/docs/core",
			icon: BookIcon,
		},
		{
			label: "Support",
			href: "https://discord.gg/2tBnJ3jDJc",
			icon: CircleHelp,
		},
	],
};

/**
 * Cloud navigation.
 *
 * The hosted product still looks like a deployment-centric platform, so its
 * menu is left as-is on purpose: only its shape changed to fit the section
 * based renderer, not its content, order or gating.
 */
const CLOUD_NAVIGATION: Navigation = {
	sections: [
		{
			id: "home",
			label: "Home",
			items: [
				{ label: "Home", href: "/dashboard/home", icon: House },
				{ label: "Projects", href: "/dashboard/projects", icon: Folder },
				{
					label: "Overview",
					href: "/dashboard/overview",
					icon: LayoutGrid,
					isEnabled: ({ permissions }) => !!permissions?.service.read,
				},
				{
					label: "Monitoring",
					href: "/dashboard/monitoring",
					icon: BarChartHorizontalBigIcon,
					isEnabled: ({ isCloud, permissions }) =>
						!isCloud && !!permissions?.monitoring.read,
				},
				{
					label: "Schedules",
					href: "/dashboard/schedules",
					icon: Clock,
					isEnabled: ({ permissions }) => !!permissions?.organization.update,
				},
				{
					label: "Traefik File System",
					href: "/dashboard/traefik",
					icon: GalleryVerticalEnd,
					isEnabled: ({ permissions }) => !!permissions?.traefikFiles.read,
				},
				{
					label: "Docker",
					href: "/dashboard/docker",
					icon: BlocksIcon,
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					label: "Requests",
					href: "/dashboard/requests",
					icon: Forward,
					isEnabled: ({ permissions, isCloud }) =>
						!!(permissions?.docker.read && !isCloud),
				},
			],
		},
		{
			id: "settings",
			label: "Settings",
			items: [
				{
					label: "Web Server",
					href: "/dashboard/settings/server",
					icon: Activity,
					isEnabled: ({ permissions, isCloud }) =>
						!!(permissions?.organization.update && !isCloud),
				},
				{
					label: "Profile",
					href: "/dashboard/settings/profile",
					icon: User,
				},
				{
					label: "Sessions",
					href: "/dashboard/settings/sessions",
					icon: Smartphone,
				},
				{
					label: "API Keys",
					href: "/dashboard/settings/api-keys",
					icon: KeyRound,
					isEnabled: ({ permissions }) => !!permissions?.api.read,
				},
				{
					label: "Remote Servers",
					href: "/dashboard/settings/servers",
					icon: Server,
					isEnabled: ({ permissions }) => !!permissions?.server.read,
				},
				{
					label: "Deployments",
					href: "/dashboard/settings/deployments",
					icon: Boxes,
					isEnabled: ({ permissions, isCloud }) =>
						!!(permissions?.server.read && !isCloud),
				},
				{
					label: "Users",
					href: "/dashboard/settings/users",
					icon: Users,
					isEnabled: ({ permissions }) => !!permissions?.member.read,
				},
				{
					label: "Audit Logs",
					href: "/dashboard/settings/audit-logs",
					icon: ClipboardList,
					isEnabled: ({ permissions }) => !!permissions?.auditLog.read,
				},
				{
					label: "SSH Keys",
					href: "/dashboard/settings/ssh-keys",
					icon: KeyRound,
					isEnabled: ({ permissions }) => !!permissions?.sshKeys.read,
				},
				{
					label: "AI",
					href: "/dashboard/settings/ai",
					icon: BotIcon,
					isEnabled: ({ permissions }) => !!permissions?.organization.update,
				},
				{
					label: "Tags",
					href: "/dashboard/settings/tags",
					icon: Tags,
					isEnabled: ({ permissions }) => !!permissions?.tag.read,
				},
				{
					label: "Git",
					href: "/dashboard/settings/git-providers",
					icon: GitBranch,
					isEnabled: ({ permissions }) => !!permissions?.gitProviders.read,
				},
				{
					label: "Registry",
					href: "/dashboard/settings/registry",
					icon: Package,
					isEnabled: ({ permissions }) => !!permissions?.registry.read,
				},
				{
					label: "Secrets",
					href: "/dashboard/settings/secrets",
					icon: Vault,
					isEnabled: ({ permissions }) => !!permissions?.vaultProvider.create,
				},
				{
					label: "DNS Providers",
					href: "/dashboard/settings/dns",
					icon: Globe,
					isEnabled: ({ permissions }) => !!permissions?.dnsProvider.read,
				},
				{
					label: "S3 Destinations",
					href: "/dashboard/settings/destinations",
					icon: HardDrive,
					isEnabled: ({ permissions }) => !!permissions?.destination.read,
				},
				{
					label: "Certificates",
					href: "/dashboard/settings/certificates",
					icon: ShieldCheck,
					isEnabled: ({ permissions }) => !!permissions?.certificate.read,
				},
				{
					label: "Notifications",
					href: "/dashboard/settings/notifications",
					icon: Bell,
					isEnabled: ({ permissions }) => !!permissions?.notification.read,
				},
				{
					label: "Billing",
					href: "/dashboard/settings/billing",
					icon: CreditCard,
					isEnabled: ({ auth, isCloud }) =>
						!!(auth?.role === "owner" && isCloud),
				},
				{
					label: "SSO",
					href: "/dashboard/settings/sso",
					icon: LogIn,
					isEnabled: ({ permissions }) => !!permissions?.organization.update,
				},
				{
					label: "Whitelabeling",
					href: "/dashboard/settings/whitelabeling",
					icon: Palette,
					isEnabled: ({ auth, isCloud }) =>
						!!(auth?.role === "owner" && !isCloud),
				},
			],
		},
	],
	external: [
		{
			label: "Documentation",
			href: "https://docs.notploy.com/docs/core",
			icon: BookIcon,
		},
		{
			label: "Support",
			href: "https://discord.gg/2tBnJ3jDJc",
			icon: CircleHelp,
		},
	],
};

const NAVIGATIONS = {
	selfHosted: SELF_HOSTED_NAVIGATION,
	cloud: CLOUD_NAVIGATION,
} as const;

export type NavigationVariant = keyof typeof NAVIGATIONS;

/** Removes the query string, `/dashboard/docker?tab=volumes` -> `/dashboard/docker`. */
function toPathname(href: string): string {
	const queryIndex = href.indexOf("?");
	return queryIndex === -1 ? href : href.slice(0, queryIndex);
}

/**
 * Determines if a nav item matches the current location.
 *
 * The pathname comparison is the historical one (prefix aware, with the
 * `/dashboard/projects` <-> `/dashboard/project` singular/plural aliasing kept
 * so deep links inside a project keep highlighting the Projects entry).
 *
 * `activeTab` adds the tab awareness needed because several entries now point
 * at the same page with a different `?tab=`.
 */
export function isActiveRoute(opts: {
	itemUrl: string;
	pathname: string;
	/** `undefined` = ignore the query, `string` = require this tab, `null` = require no tab. */
	activeTab?: string | null;
	/** The `?tab=` value of the current location, if any. */
	currentTab?: string;
}): boolean {
	const { activeTab, currentTab } = opts;

	if (activeTab !== undefined) {
		if (activeTab === null) {
			if (currentTab) return false;
		} else if (currentTab !== activeTab) {
			return false;
		}
	}

	const normalizedItemUrl = toPathname(opts.itemUrl).replace(
		"/projects",
		"/project",
	);
	const normalizedPathname = opts.pathname?.replace("/projects", "/project");

	if (!normalizedPathname) return false;

	if (normalizedPathname === normalizedItemUrl) return true;

	if (normalizedPathname.startsWith(normalizedItemUrl)) {
		const nextChar = normalizedPathname.charAt(normalizedItemUrl.length);
		return nextChar === "/";
	}

	return false;
}

/** Filters a list of entries against the current user's role and permissions. */
function filterEnabled<
	T extends { isEnabled?: (o: NavigationContext) => boolean },
>(items: readonly T[], context: NavigationContext): T[] {
	return items.filter((item) =>
		item.isEnabled ? item.isEnabled(context) : true,
	);
}

/**
 * Builds the navigation visible to the current user: sections that still hold
 * at least one reachable entry, plus the external links (whitelabeling can
 * rewrite the docs/support targets).
 */
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
		}))
		// A section whose every entry is filtered out would render as an empty
		// heading, so it disappears entirely.
		.filter((section) => section.items.length > 0);

	return { sections, external };
}

/**
 * Locates the entry matching the current location.
 * @returns the section and item, or undefined when the route is not in the nav.
 */
export function findActiveNavigation(
	navigation: Navigation,
	location: { pathname: string; tab?: string },
): { section: NavigationSection; item: NavigationItem } | undefined {
	for (const section of navigation.sections) {
		const item = section.items.find((item) =>
			isActiveRoute({
				itemUrl: item.href,
				pathname: location.pathname,
				activeTab: item.activeTab,
				currentTab: location.tab,
			}),
		);
		if (item) return { section, item };
	}

	return undefined;
}
