/**
 * The navigation model.
 *
 * Every route here maps to something the Notploy API can actually answer, and
 * `capability` records which router it depends on so a page can explain itself on
 * an instance that does not expose it (a trimmed-down self-hosted install) rather
 * than showing an empty page.
 *
 * Sections the API does not support are absent on purpose. Kubernetes has no
 * router, so there is no Kubernetes page; "Monitoring" covers the health and
 * disk-usage endpoints that do exist.
 */

import type { InstanceCapabilities } from "@/shared/domain";

export type RouteId =
	| "overview"
	| "infrastructure"
	| "projects"
	| "applications"
	| "deployments"
	| "monitoring"
	| "notifications"
	| "connections"
	| "settings";

export interface RouteDefinition {
	id: RouteId;
	title: string;
	description: string;
	/** Router the page needs; `undefined` for local pages. */
	capability?: keyof InstanceCapabilities;
	/** The router's name, for the "not available" explanation. */
	router?: string;
	/** Route requires a selected, working connection. */
	requiresConnection: boolean;
}

export const ROUTES: Record<RouteId, RouteDefinition> = {
	overview: {
		id: "overview",
		title: "Overview",
		description:
			"What the selected instance is running right now: counts, the latest deployments and anything that could not be read.",
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
	projects: {
		id: "projects",
		title: "Projects",
		description:
			"Projects and their environments, with the applications and Compose projects each one contains.",
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
	monitoring: {
		id: "monitoring",
		title: "Monitoring",
		description:
			"Container health per server and Docker disk usage. Disk usage is admin-only on the server and says so when it is not permitted.",
		capability: "docker",
		router: "docker",
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
			"Local application settings. They are stored on this machine and never sent to an instance.",
		requiresConnection: false,
	},
};

/** Order of the primary navigation. */
export const NAV_ORDER: RouteId[] = [
	"overview",
	"infrastructure",
	"projects",
	"applications",
	"deployments",
	"monitoring",
	"notifications",
];

/** Order of the secondary navigation, at the bottom of the sidebar. */
export const FOOTER_NAV_ORDER: RouteId[] = ["connections", "settings"];
