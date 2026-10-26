import { House } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
	createNavigation,
	findActiveNavigation,
	isActiveRoute,
	isNavigationItemActive,
	type Navigation,
	type NavigationEnvironment,
	type NavigationItem,
	type NavigationSection,
	navigationSectionItems,
} from "@/components/layouts/navigation";

type NavigationOptions = Parameters<typeof createNavigation>[0];
type PermissionSet = NonNullable<NavigationOptions["permissions"]>;

function permissions(...grants: string[]): PermissionSet {
	const granted = new Set(grants);

	return new Proxy({} as PermissionSet, {
		get: (_target, resource) =>
			new Proxy({} as Record<string, boolean>, {
				get: (_actions, action) =>
					granted.has(`${String(resource)}.${String(action)}`),
			}),
	});
}

const ALL_PERMISSIONS = permissions(
	"certificate.read",
	"vaultProvider.create",
	"organization.update",
	"auditLog.read",
	"tag.read",
	"notification.read",
	"gitProviders.read",
	"registry.read",
	"dnsProvider.read",
	"objectStorage.read",
	"member.read",
	"api.read",
	"service.read",
	"deployment.read",
	"traffic.read",
	"server.read",
	"docker.read",
	"traefikFiles.read",
	"billing.read",
	"community.read",
);

function itemsOf(navigation: Navigation): NavigationItem[] {
	return navigation.sections.flatMap((section) =>
		navigationSectionItems(section),
	);
}

function itemIds(navigation: Navigation): string[] {
	return itemsOf(navigation).map((item) => item.id);
}

function findItem(navigation: Navigation, id: string): NavigationItem | undefined {
	return itemsOf(navigation).find((item) => item.id === id);
}

function groupIds(navigation: Navigation): string[] {
	return navigation.sections.flatMap(
		(section) => section.groups?.map((group) => group.id) ?? [],
	);
}

const CANONICAL_GROUPS: Record<string, readonly string[]> = {
	overview: ["workspace", "operations", "delivery"],
	infrastructure: [
		"compute-runtime",
		"networking-edge",
		"storage-data",
		"security-secrets",
		"integrations-providers",
	],
	organization: [
		"members-access",
		"governance",
		"usage-billing",
		"platform-operations",
		"account",
		"public-site",
	],
};

function create(
	environment: NavigationEnvironment,
	options: Partial<Omit<NavigationOptions, "environment">> = {},
): Navigation {
	return createNavigation({
		environment,
		permissions: ALL_PERMISSIONS,
		license: environment === "cloud" ? "enterprise" : null,
		...options,
	});
}

describe("navigation environments", () => {
	it("shows only self-hosted destinations in self", () => {
		const navigation = create("self");
		const ids = itemIds(navigation);

		expect(navigation.sections.map((section) => section.id)).toEqual([
			"overview",
			"infrastructure",
			"organization",
		]);
		expect(ids).toEqual(
			expect.arrayContaining([
				"home",
				"projects",
				"monitoring",
				"services",
				"deployments",
				"schedules",
				"servers",
				"docker",
				"swarm",
				"networks",
				"traefik",
				"certificates",
				"sso",
				"secrets",
				"gitProviders",
				"containerRegistries",
				"dnsProviders",
				"objectStorage",
				"aiProviders",
				"team",
				"sessions",
				"auditLogs",
				"tags",
				"notifications",
				"webServer",
			]),
		);
		expect(ids).not.toEqual(
			expect.arrayContaining([
				"incidents",
				"operations",
				"traffic",
				"workspaces",
				"runtime",
				"storage",
				"usage",
			]),
		);
	});

	it("shows only Cloud destinations in cloud", () => {
		const navigation = create("cloud");
		const ids = itemIds(navigation);

		expect(ids).toEqual(
			expect.arrayContaining([
				"home",
				"projects",
				"services",
				"deployments",
				"gitProviders",
				"containerRegistries",
				"dnsProviders",
				"objectStorage",
				"certificates",
				"secrets",
				"sso",
				"schedules",
				"auditLogs",
				"tags",
				"team",
				"apiKeys",
				"notifications",
				"billing",
				"profile",
				"sessions",
			]),
		);
		expect(ids).not.toEqual(
			expect.arrayContaining([
				"servers",
				"docker",
				"swarm",
				"networks",
				"traefik",
				"incidents",
				"workspaces",
			]),
		);
	});

	it("shows only operator destinations in console", () => {
		const navigation = create("console");
		const ids = itemIds(navigation);

		expect(ids).toEqual(
			expect.arrayContaining([
				"home",
				"incidents",
				"operations",
				"monitoring",
				"traffic",
				"deployments",
				"projects",
				"servers",
				"swarm",
				"runtime",
				"docker",
				"networks",
				"dnsProviders",
				"webServer",
				"certificates",
				"sso",
				"secrets",
				"gitProviders",
				"containerRegistries",
				"storage",
				"objectStorage",
				"workspaces",
				"applications",
				"domains",
				"usage",
				"capacity",
				"billing",
				"platformServices",
				"maintenance",
				"community",
				"blog",
				"careers",
			]),
		);
		expect(ids).not.toEqual(
			expect.arrayContaining([
				"schedules",
				"tags",
				"team",
				"auditLogs",
				"sessions",
				"aiProviders",
			]),
		);
	});

	it("keeps the exact self-hosted set and never leaks Cloud or Console entries", () => {
		expect(itemIds(create("self"))).toEqual([
			"home",
			"projects",
			"monitoring",
			"services",
			"deployments",
			"schedules",
			"servers",
			"docker",
			"swarm",
			"networks",
			"traefik",
			"dnsProviders",
			"webServer",
			"objectStorage",
			"certificates",
			"sso",
			"secrets",
			"gitProviders",
			"containerRegistries",
			"aiProviders",
			"team",
			"sessions",
			"auditLogs",
			"tags",
			"notifications",
		]);
	});

	it("keeps the exact Console set and never leaks Self or Cloud entries", () => {
		expect(itemIds(create("console"))).toEqual([
			"home",
			"projects",
			"incidents",
			"operations",
			"monitoring",
			"traffic",
			"deployments",
			"servers",
			"docker",
			"swarm",
			"runtime",
			"networks",
			"dnsProviders",
			"webServer",
			"storage",
			"objectStorage",
			"certificates",
			"sso",
			"secrets",
			"gitProviders",
			"containerRegistries",
			"workspaces",
			"applications",
			"domains",
			"usage",
			"capacity",
			"billing",
			"platformServices",
			"maintenance",
			"community",
			"blog",
			"careers",
		]);
	});
});

describe("navigation licences", () => {
	it("keeps self-hosted destinations independent from Cloud licences", () => {
		const unlicensed = create("self", { license: null });
		const enterprise = create("self", { license: "enterprise" });

		expect(itemIds(unlicensed)).toEqual(itemIds(enterprise));
		expect(itemIds(unlicensed)).toContain("servers");
		expect(itemIds(unlicensed)).toContain("certificates");
	});

	it("expands the Cloud menu at each licence tier", () => {
		expect(itemIds(create("cloud", { license: "free" }))).toEqual([
			"home",
			"projects",
			"services",
			"deployments",
			"dnsProviders",
			"certificates",
			"gitProviders",
			"sessions",
			"billing",
			"notifications",
			"profile",
		]);

		expect(itemIds(create("cloud", { license: "pro" }))).toEqual([
			"home",
			"projects",
			"services",
			"deployments",
			"schedules",
			"dnsProviders",
			"objectStorage",
			"certificates",
			"secrets",
			"gitProviders",
			"containerRegistries",
			"team",
			"apiKeys",
			"sessions",
			"tags",
			"billing",
			"notifications",
			"profile",
		]);

		expect(itemIds(create("cloud", { license: "enterprise" }))).toEqual([
			"home",
			"projects",
			"services",
			"deployments",
			"schedules",
			"dnsProviders",
			"objectStorage",
			"certificates",
			"sso",
			"secrets",
			"gitProviders",
			"containerRegistries",
			"team",
			"apiKeys",
			"sessions",
			"auditLogs",
			"tags",
			"billing",
			"notifications",
			"profile",
		]);
	});

	it("hides Pro and Enterprise destinations on Cloud Free", () => {
		const ids = itemIds(create("cloud", { license: "free" }));

		expect(ids).not.toEqual(
			expect.arrayContaining([
				"containerRegistries",
				"objectStorage",
				"secrets",
				"sso",
				"schedules",
				"auditLogs",
				"tags",
				"team",
				"apiKeys",
			]),
		);
		expect(ids).toEqual(
			expect.arrayContaining([
				"gitProviders",
				"dnsProviders",
				"certificates",
				"notifications",
				"billing",
				"profile",
				"sessions",
			]),
		);
	});

	it("shows Pro and Free destinations on Cloud Pro but not Enterprise ones", () => {
		const ids = itemIds(create("cloud", { license: "pro" }));

		expect(ids).toEqual(
			expect.arrayContaining([
				"containerRegistries",
				"objectStorage",
				"secrets",
				"schedules",
				"tags",
				"team",
				"apiKeys",
			]),
		);
		expect(ids).not.toEqual(
			expect.arrayContaining(["sso", "auditLogs"]),
		);
	});

	it("shows every Cloud destination on Enterprise", () => {
		const ids = itemIds(create("cloud", { license: "enterprise" }));

		expect(ids).toEqual(
			expect.arrayContaining([
				"containerRegistries",
				"objectStorage",
				"secrets",
				"sso",
				"schedules",
				"auditLogs",
				"tags",
				"team",
				"apiKeys",
			]),
		);
	});

	it("never grants a tiered destination without a licence", () => {
		const ids = itemIds(create("cloud", { license: null }));

		expect(ids).not.toEqual(
			expect.arrayContaining([
				"containerRegistries",
				"objectStorage",
				"secrets",
				"sso",
				"schedules",
				"auditLogs",
				"tags",
				"team",
				"apiKeys",
			]),
		);
	});

	it("treats an unlicensed Cloud context as the Free baseline", () => {
		const free = itemIds(create("cloud", { license: "free" }));
		const unlicensed = itemIds(create("cloud", { license: null }));

		expect(unlicensed).toEqual(free);
	});

	it("never applies Cloud entitlements to Self or Console", () => {
		for (const environment of ["self", "console"] as const) {
			const baseline = itemIds(create(environment, { license: null }));

			for (const license of ["free", "pro", "enterprise"] as const) {
				expect(itemIds(create(environment, { license }))).toEqual(baseline);
			}
		}
	});

	it("never renders a Cloud entry above the active licence tier", () => {
		const rank = { free: 0, pro: 1, enterprise: 2 } as const;

		for (const license of ["free", "pro", "enterprise"] as const) {
			for (const item of itemsOf(create("cloud", { license }))) {
				if (!item.minLicense) continue;
				expect(rank[license]).toBeGreaterThanOrEqual(rank[item.minLicense]);
			}
		}
	});

	it("applies licences inside groups and removes empty groups", () => {
		const free = create("cloud", { license: "free" });
		const pro = create("cloud", { license: "pro" });
		const enterprise = create("cloud", { license: "enterprise" });

		const governance = (navigation: Navigation) =>
			navigation.sections
				.find((section) => section.id === "organization")
				?.groups?.find((group) => group.id === "governance");

		expect(groupIds(free)).not.toContain("governance");
		expect(governance(pro)?.items.map((item) => item.id)).toEqual(["tags"]);
		expect(governance(enterprise)?.items.map((item) => item.id)).toEqual([
			"auditLogs",
			"tags",
		]);
	});
});

describe("navigation permissions", () => {
	it("filters permission-guarded entries", () => {
		const navigation = create("self", { permissions: undefined });

		expect(itemIds(navigation)).toEqual([
			"home",
			"projects",
			"monitoring",
			"sessions",
		]);
	});

	it("keeps entries that are not permission-guarded", () => {
		const navigation = create("cloud", { permissions: undefined });

		expect(itemIds(navigation)).toEqual([
			"home",
			"projects",
			"sessions",
			"profile",
		]);
	});

	it("never lets a licence bypass permission checks", () => {
		const navigation = create("cloud", {
			license: "enterprise",
			permissions: permissions(),
		});

		expect(itemIds(navigation)).toEqual([
			"home",
			"projects",
			"sessions",
			"profile",
		]);
	});

	it("keeps the same rules for direct items and grouped items", () => {
		const navigation = create("self", {
			permissions: permissions("server.read"),
		});
		const infrastructure = navigation.sections.find(
			(section) => section.id === "infrastructure",
		);

		expect(infrastructure?.groups?.map((group) => group.id)).toEqual([
			"compute-runtime",
		]);
		expect(infrastructure?.groups?.[0]?.items.map((item) => item.id)).toEqual([
			"servers",
		]);
	});

	it("removes a group when every entry is filtered out", () => {
		const navigation = create("self", {
			permissions: permissions("docker.read"),
		});
		const infrastructure = navigation.sections.find(
			(section) => section.id === "infrastructure",
		);

		expect(infrastructure?.groups?.map((group) => group.id)).toEqual([
			"compute-runtime",
			"networking-edge",
		]);
		expect(
			infrastructure?.groups?.find((group) => group.id === "security-secrets"),
		).toBeUndefined();
	});
});

describe("navigation structure", () => {
	it.each<NavigationEnvironment>(["self", "cloud", "console"])(
		"keeps section order and removes empty containers in %s",
		(environment) => {
			const navigation = create(environment);

			expect(navigation.sections.map((section) => section.id)).toEqual([
				"overview",
				"infrastructure",
				"organization",
			]);
			expect(
				navigation.sections.map((section) => section.label),
			).toEqual(["Overview", "Infrastructure", "Organization"]);

			for (const section of navigation.sections) {
				expect(section.items.length + (section.groups?.length ?? 0)).toBeGreaterThan(
					0,
				);
				for (const group of section.groups ?? []) {
					expect(group.items.length).toBeGreaterThan(0);
					expect(group.label.length).toBeGreaterThan(0);
				}
			}
		},
	);

	it.each<NavigationEnvironment>(["self", "cloud", "console"])(
		"keeps the same group logic in %s",
		(environment) => {
			const navigation = create(environment);

			for (const section of navigation.sections) {
				const groups = section.groups?.map((group) => group.id) ?? [];
				const canonical = CANONICAL_GROUPS[section.id] ?? [];
				expect(groups).toEqual(
					canonical.filter((group) => groups.includes(group)),
				);
			}
		},
	);

	it("flattens groups in rendered order because groups are structural only", () => {
		const item = (id: string, href: string): NavigationItem => ({
			id,
			label: id,
			href,
			icon: House,
		});
		const section: NavigationSection = {
			id: "overview",
			label: "Overview",
			items: [item("direct", "/dashboard/home")],
			groups: [
				{
					id: "first",
					label: "First",
					items: [
						item("group-a", "/dashboard/projects"),
						item("group-b", "/dashboard/deployments"),
					],
				},
				{
					id: "second",
					label: "Second",
					items: [item("group-c", "/dashboard/schedules")],
				},
			],
		};

		expect(navigationSectionItems(section).map((entry) => entry.id)).toEqual([
			"direct",
			"group-a",
			"group-b",
			"group-c",
		]);
	});

	it.each<NavigationEnvironment>(["self", "cloud", "console"])(
		"keeps groups nested instead of promoting them to sections in %s",
		(environment) => {
			const navigation = create(environment);
			const sectionIds = navigation.sections.map((section) => section.id);
			const groupIds = navigation.sections.flatMap((section) =>
				section.groups?.map((group) => group.id) ?? [],
			);

			expect(sectionIds).toEqual(["overview", "infrastructure", "organization"]);
			for (const groupId of groupIds) {
				expect(sectionIds).not.toContain(groupId);
			}
		},
	);

	it.each<NavigationEnvironment>(["self", "cloud", "console"])(
		"uses stable destination ids without duplicates in %s",
		(environment) => {
			const navigation = create(environment);
			const ids = itemIds(navigation);

			expect(new Set(ids).size).toBe(ids.length);

			for (const section of navigation.sections) {
				const groups = section.groups?.map((group) => group.id) ?? [];
				expect(new Set(groups).size).toBe(groups.length);
			}
		},
	);

	it("keeps environment-specific labels on shared destinations", () => {
		const self = create("self");
		const cloud = create("cloud");
		const console = create("console");

		expect(findItem(self, "swarm")?.label).toBe("Swarm");
		expect(findItem(console, "swarm")?.label).toBe("Clusters");
		expect(findItem(self, "docker")?.label).toBe("Docker");
		expect(findItem(console, "docker")?.label).toBe("Compute");
		expect(findItem(self, "tags")?.label).toBe("Tags");
		expect(findItem(cloud, "tags")?.label).toBe("Workspace & Tags");
		expect(findItem(self, "team")?.label).toBe("Users");
		expect(findItem(cloud, "team")?.label).toBe("Team & Access");
		expect(findItem(self, "secrets")?.label).toBe("Secrets Manager");
		expect(findItem(console, "secrets")?.label).toBe("Secrets");
		expect(findItem(self, "containerRegistries")?.label).toBe(
			"Container Registries",
		);
		expect(findItem(console, "containerRegistries")?.label).toBe("Registries");
	});
});

describe("navigation routes", () => {
	it("matches exact routes", () => {
		expect(
			isActiveRoute({ itemUrl: "/dashboard/home", pathname: "/dashboard/home" }),
		).toBe(true);
	});

	it("matches nested routes", () => {
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/home",
				pathname: "/dashboard/home/details",
			}),
		).toBe(true);
	});

	it("matches paths with or without a trailing slash", () => {
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/home/",
				pathname: "/dashboard/home",
			}),
		).toBe(true);
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/home",
				pathname: "/dashboard/home/",
			}),
		).toBe(true);
	});

	it("keeps the projects/project normalisation", () => {
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/projects",
				pathname: "/dashboard/project/abc",
			}),
		).toBe(true);
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/projects",
				pathname: "/dashboard/projects/abc",
			}),
		).toBe(true);
	});

	it("reads a tab from the item url", () => {
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/docker?tab=logs",
				pathname: "/dashboard/docker",
				currentTab: "logs",
			}),
		).toBe(true);
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/docker?tab=logs",
				pathname: "/dashboard/docker",
				currentTab: "metrics",
			}),
		).toBe(false);
	});

	it("only activates an activeTab null entry when no tab is selected", () => {
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/overview",
				pathname: "/dashboard/overview",
				activeTab: null,
			}),
		).toBe(true);
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/overview",
				pathname: "/dashboard/overview",
				activeTab: null,
				currentTab: "services",
			}),
		).toBe(false);
	});

	it("matches an explicit active tab", () => {
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/docker",
				pathname: "/dashboard/docker",
				activeTab: "logs",
				currentTab: "logs",
			}),
		).toBe(true);
	});

	it("does not treat a longer sibling path as a prefix match", () => {
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/settings/server",
				pathname: "/dashboard/settings/servers",
			}),
		).toBe(false);
	});

	it("finds the active destination in a group", () => {
		const navigation = create("self");
		const active = findActiveNavigation(navigation, {
			pathname: "/dashboard/settings/certificates",
		});

		expect(active?.section.id).toBe("infrastructure");
		expect(active?.item.id).toBe("certificates");
	});

	it("finds the active destination on console", () => {
		const navigation = create("console");
		const active = findActiveNavigation(navigation, {
			pathname: "/dashboard/settings/billing",
		});

		expect(active?.section.id).toBe("organization");
		expect(active?.item.id).toBe("billing");
	});

	it("navigates nested project pages to Projects", () => {
		const navigation = create("self");
		const active = findActiveNavigation(navigation, {
			pathname: "/dashboard/project/abc/environment/def",
		});

		expect(active?.section.id).toBe("overview");
		expect(active?.item.id).toBe("projects");
	});

	it("respects activeTab null when finding the active destination", () => {
		const navigation = create("self");

		expect(
			findActiveNavigation(navigation, { pathname: "/dashboard/docker" })?.item
				.id,
		).toBe("docker");
		expect(
			findActiveNavigation(navigation, {
				pathname: "/dashboard/docker",
				tab: "logs",
			}),
		).toBeUndefined();
	});

	it("uses the same active-item helper as the breadcrumb", () => {
		const navigation = create("self");
		const locations = [
			{ pathname: "/dashboard/home" },
			{ pathname: "/dashboard/settings/certificates" },
			{ pathname: "/dashboard/project/abc/environment/def" },
			{ pathname: "/dashboard/docker" },
			{ pathname: "/dashboard/docker", tab: "logs" },
			{ pathname: "/dashboard/unknown" },
		];

		for (const location of locations) {
			const fromBreadcrumb = findActiveNavigation(navigation, location);
			const fromSidebar = itemsOf(navigation).find((item) =>
				isNavigationItemActive(item, location),
			);

			expect(fromSidebar?.id).toBe(fromBreadcrumb?.item.id);
		}
	});

	it("recognises custom activeRoutes through the shared helper", () => {
		const item: NavigationItem = {
			id: "custom",
			label: "Custom",
			href: "/dashboard/home",
			icon: House,
			activeRoutes: [{ href: "/dashboard/projects" }],
		};

		expect(
			isNavigationItemActive(item, { pathname: "/dashboard/projects" }),
		).toBe(true);
		expect(
			isNavigationItemActive(item, { pathname: "/dashboard/deployments" }),
		).toBe(false);
	});

	it("supports destinations with custom activeRoutes", () => {
		const navigation: Navigation = {
			sections: [
				{
					id: "overview",
					label: "Overview",
					items: [
						{
							id: "custom",
							label: "Custom",
							href: "/dashboard/home",
							icon: House,
							activeRoutes: [{ href: "/dashboard/projects" }],
						},
					],
				},
			],
			external: [],
		};

		const active = findActiveNavigation(navigation, {
			pathname: "/dashboard/projects",
		});

		expect(active?.item.id).toBe("custom");
	});
});

describe("external navigation", () => {
	it("keeps documentation and support destinations", () => {
		const navigation = create("self");

		expect(navigation.external.map((item) => item.id)).toEqual([
			"documentation",
			"support",
		]);
		expect(navigation.external.map((item) => item.href)).toEqual([
			"https://docs.notploy.com/docs/core",
			"https://discord.gg/GUkDugVh34",
		]);
	});

	it("applies whitelabeling overrides by destination id", () => {
		const navigation = create("self", {
			whitelabeling: {
				docsUrl: "https://example.com/docs",
				supportUrl: "https://example.com/support",
			},
		});

		expect(navigation.external).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "documentation",
					href: "https://example.com/docs",
				}),
				expect.objectContaining({
					id: "support",
					href: "https://example.com/support",
				}),
			]),
		);
	});
});
