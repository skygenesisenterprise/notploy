/**
 * The navigation model.
 *
 * A route is a **section** plus an optional **resource**, and it is the same
 * shape as a deep link (`@/shared/deep-link`). That is deliberate: the sidebar,
 * the command palette, the native View menu, the tray and a `notploy://` URL all
 * describe a destination the same way, so there is one navigation model instead
 * of four that have to be kept in step.
 *
 * ```text
 * Instance            Project
 * ├── Overview        ├── Overview
 * ├── Databases       ├── Environments
 * ├── Projects  ──────┼── Applications
 * ├── Applications    └── Deployments
 * ├── Deployments
 * ├── Infrastructure  (servers, containers, images, volumes, networks, swarm)
 * ├── Monitoring
 * ├── Tags · Certificates · SSH keys · Registries · Destinations
 * └── Notifications
 *   Connections · Settings        (local, not instance-scoped)
 * ```
 *
 * Every section maps to something the Notploy API can actually answer, and
 * `capability` records which router it depends on, so a page can explain itself
 * on an instance that does not expose it rather than showing an empty page.
 *
 * Sections the API does not support are absent on purpose. Kubernetes has no
 * router, so there is no Kubernetes page.
 */

import {
	type DeepLinkResource,
	type DeepLinkSection,
	type DeepLinkTarget,
	formatDeepLink,
} from "@/shared/deep-link";
import type { InstanceCapabilities } from "@/shared/domain";

export type { DeepLinkResource, DeepLinkSection };

export interface RouteState {
	section: DeepLinkSection;
	resource?: DeepLinkResource;
}

export interface SectionDefinition {
	id: DeepLinkSection;
	title: string;
	description: string;
	/** Capability the section needs; `undefined` for local sections. */
	capability?: keyof InstanceCapabilities;
	/** The router's name, for the "not available" explanation. */
	router?: string;
	/** The section requires a selected, working connection. */
	requiresConnection: boolean;
}

export const SECTIONS: Record<DeepLinkSection, SectionDefinition> = {
	overview: {
		id: "overview",
		title: "Overview",
		description:
			"What the selected instance is running right now: counts, the latest deployments and anything that could not be read.",
		requiresConnection: true,
	},
	databases: {
		id: "databases",
		title: "Databases",
		description:
			"Managed database services — PostgreSQL, MySQL, MariaDB, MongoDB, Redis and LibSQL — with their lifecycle actions and logs.",
		capability: "databases",
		router: "postgres / mysql / mariadb / mongo / redis / libsql",
		requiresConnection: true,
	},
	projects: {
		id: "projects",
		title: "Projects",
		description:
			"Projects and their environments, with the applications, Compose projects and databases each environment contains.",
		capability: "deployments",
		router: "project",
		requiresConnection: true,
	},
	applications: {
		id: "applications",
		title: "Applications",
		description:
			"Every application the API key can see, with its deploy, restart, start and stop actions.",
		capability: "deployments",
		router: "application",
		requiresConnection: true,
	},
	deployments: {
		id: "deployments",
		title: "Deployments",
		description:
			"Deployment history across the instance, the deploy queue, and the build log of any deployment.",
		capability: "logs",
		router: "deployment",
		requiresConnection: true,
	},
	infrastructure: {
		id: "infrastructure",
		title: "Infrastructure",
		description:
			"Servers, Docker containers, images, volumes, networks and Docker Swarm nodes managed by this instance.",
		capability: "docker",
		router: "docker",
		requiresConnection: true,
	},
	monitoring: {
		id: "monitoring",
		title: "Monitoring",
		description:
			"Container health per server and Docker disk usage. Disk usage is admin-only on the server and says so when it is not permitted.",
		capability: "docker",
		router: "docker",
		requiresConnection: true,
	},
	tags: {
		id: "tags",
		title: "Tags",
		description:
			"Labels defined on the instance, with the colour each one carries. Tags are assigned to projects from the dashboard.",
		capability: "tags",
		router: "tag",
		requiresConnection: true,
	},
	certificates: {
		id: "certificates",
		title: "Certificates",
		description:
			"TLS certificates stored on the instance: the path they are written to and whether they renew automatically. Private keys stay on the server.",
		capability: "certificates",
		router: "certificates",
		requiresConnection: true,
	},
	"ssh-keys": {
		id: "ssh-keys",
		title: "SSH keys",
		description:
			"Key pairs the instance uses to reach servers and repositories. Public keys can be copied from here; private keys never leave the instance.",
		capability: "sshKeys",
		router: "sshKey",
		requiresConnection: true,
	},
	registries: {
		id: "registries",
		title: "Registries",
		description:
			"Container registries deployments pull from and push to, with the URL, the account and the image prefix in use.",
		capability: "registries",
		router: "registry",
		requiresConnection: true,
	},
	destinations: {
		id: "destinations",
		title: "Destinations",
		description:
			"Object-storage destinations backups are written to. Access keys stay on the instance; only the bucket and endpoint are shown.",
		capability: "destinations",
		router: "destination",
		requiresConnection: true,
	},
	notifications: {
		id: "notifications",
		title: "Notifications",
		description:
			"Notification providers configured on the instance, as returned by the notification router.",
		capability: "notifications",
		router: "notification",
		requiresConnection: true,
	},
	connections: {
		id: "connections",
		title: "Connections",
		description:
			"Every Notploy instance this app can talk to. API keys are stored in the operating system keychain, never in a file.",
		requiresConnection: false,
	},
	settings: {
		id: "settings",
		title: "Settings",
		description:
			"Local application settings, including the native behaviours. They are stored on this machine and never sent to an instance.",
		requiresConnection: false,
	},
};

/** Order of the primary navigation. */
export const NAV_ORDER: DeepLinkSection[] = [
	"overview",
	"databases",
	"projects",
	"applications",
	"deployments",
	"infrastructure",
	"monitoring",
	"tags",
	"certificates",
	"ssh-keys",
	"registries",
	"destinations",
	"notifications",
];

/** Order of the secondary navigation, at the bottom of the sidebar. */
export const FOOTER_NAV_ORDER: DeepLinkSection[] = ["connections", "settings"];

export const DEFAULT_ROUTE: RouteState = { section: "overview" };

/** The section definition for a route. */
export function sectionOf(route: RouteState): SectionDefinition {
	return SECTIONS[route.section];
}

/** A deep link for a route, optionally pinned to a connection. */
export function routeToDeepLink(route: RouteState, instance?: string): string {
	return formatDeepLink({
		section: route.section,
		resource: route.resource,
		instance,
	});
}

/** A route from a deep-link target (or any `notploy://` link). */
export function routeFromTarget(target: DeepLinkTarget): RouteState {
	return { section: target.section, resource: target.resource };
}

/**
 * True when two routes point at the same place.
 *
 * Used to decide whether a deep link should replace the current view or be
 * ignored, and to keep the `aria-current` of the sidebar honest when a resource
 * is open.
 */
export function sameRoute(left: RouteState, right: RouteState): boolean {
	return (
		left.section === right.section &&
		JSON.stringify(left.resource ?? null) ===
			JSON.stringify(right.resource ?? null)
	);
}
