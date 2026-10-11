/**
 * The bridge between a `notploy://` deep-link target and the **real routes of
 * the Notploy web application** (`apps/notploy/pages/dashboard`).
 *
 * The desktop window no longer ships its own pages: it loads the application
 * itself — a self-hosted instance, Notploy Cloud, or the local dev server.
 * A deep link or a menu item therefore has to become a URL on that instance,
 * and this module is the one place that knows the mapping. It is pure (no
 * Electron, no `node:`) so it can be unit-tested, and it derives the section
 * from the resource the same way `@/shared/deep-link` does, so a link can never
 * name a section that does not show what it points at.
 *
 * Sections with no single page in the web app resolve to the closest useful
 * destination rather than being dropped:
 *
 * - `databases` → the Services view (`/dashboard/overview`), which lists the
 *   managed databases alongside applications and Compose stacks; the API
 *   identifies a database by `(engine, id)` **inside an environment**, so a
 *   bare id cannot name a page.
 * - `ssh-keys` → the Servers settings, where SSH keys are managed.
 * - `connections` → the local connection gate, which is desktop-native
 *   configuration and deliberately has no web counterpart.
 */

import type { DeepLinkSection, DeepLinkTarget } from "./deep-link";

/** Where the window should navigate for one deep-link section. */
const SECTION_PATHS: Record<DeepLinkSection, string> = {
	overview: "/dashboard/home",
	databases: "/dashboard/overview",
	projects: "/dashboard/projects",
	applications: "/dashboard/applications",
	deployments: "/dashboard/deployments",
	infrastructure: "/dashboard/docker",
	monitoring: "/dashboard/monitoring",
	tags: "/dashboard/settings/tags",
	certificates: "/dashboard/settings/certificates",
	"ssh-keys": "/dashboard/settings/servers",
	registries: "/dashboard/settings/registry",
	destinations: "/dashboard/settings/destinations",
	notifications: "/dashboard/settings/notifications",
	// Handled as a special case by {@link appTargetForDeepLink}.
	connections: "",
	settings: "/dashboard/settings/profile",
};

/**
 * A navigation destination inside the window.
 *
 * `gate` is the app's own local page (a `file://` document) — the connection
 * manager shown when no instance is configured yet. Everything else is a path
 * on the active instance, which the window prefixes with the instance URL.
 */
export type AppTarget = { kind: "gate" } | { kind: "page"; path: string };

function page(path: string): AppTarget {
	return { kind: "page", path };
}

function segment(value: string): string {
	return encodeURIComponent(value);
}

/**
 * Resolves a parsed deep-link target to a window destination.
 *
 * A resource wins over the section (the section is derived from it by the
 * parser), and a section without a resource resolves to that section's page.
 */
export function appTargetForDeepLink(target: DeepLinkTarget): AppTarget {
	// Connection management is a desktop-native concern: it edits local state
	// (the connection list and the OS keychain), not the instance's data.
	if (target.section === "connections") return { kind: "gate" };

	const resource = target.resource;
	if (resource) {
		switch (resource.kind) {
			case "project":
				return page(`/dashboard/project/${segment(resource.id)}`);
			case "environment":
				return page(
					`/dashboard/project/${segment(resource.projectId)}/environment/${segment(resource.id)}`,
				);
			case "application":
				// The web app addresses applications through their environment's
				// services view; a bare application id cannot name one page.
				return page(SECTION_PATHS.applications);
			case "deployment":
				return page(SECTION_PATHS.deployments);
			case "database":
				// `(engine, id)` is scoped to an environment in the web app; the
				// Services view is the closest page that lists every database.
				return page(SECTION_PATHS.databases);
			case "server":
				return page("/dashboard/settings/servers");
		}
	}

	return page(SECTION_PATHS[target.section]);
}

/**
 * The full URL the window loads for a target on one instance.
 *
 * `instanceUrl` is a connection's normalized origin (no trailing slash), as
 * stored by `ConnectionStore`.
 */
export function instanceUrlForDeepLink(
	instanceUrl: string,
	target: DeepLinkTarget,
): string {
	const resolved = appTargetForDeepLink(target);
	if (resolved.kind !== "page") return instanceUrl;
	return `${instanceUrl.replace(/\/+$/, "")}${resolved.path}`;
}

/** The URL of an instance's dashboard home. */
export function dashboardUrlFor(instanceUrl: string): string {
	return `${instanceUrl.replace(/\/+$/, "")}/dashboard/home`;
}
