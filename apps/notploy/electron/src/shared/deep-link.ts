/**
 * The `notploy://` deep-link convention, in one place.
 *
 * The main process receives these URLs from the operating system and the
 * renderer produces them for "copy a link to this view" and for restoring the
 * last view. Sharing the codec is what keeps the two from drifting: there is
 * exactly one parser and one formatter, and they round-trip.
 *
 * Shape:
 *
 * ```text
 * notploy://<section>[/<resource-path>]?instance=<name-or-id>
 * ```
 *
 * The resource path is read **relative to the section**, so it never repeats the
 * section name. Examples:
 *
 * ```text
 * notploy://overview?instance=production
 * notploy://projects/6541?instance=production
 * notploy://projects/6541/environments/9987?instance=production
 * notploy://applications/4231?instance=production
 * notploy://deployments/88213?instance=production
 * notploy://databases/postgres/5512?instance=production
 * notploy://infrastructure/servers/77?instance=production
 * notploy://ssh-keys?instance=production
 * notploy://connections
 * ```
 *
 * The instance is a **query parameter**, not the first path segment. Making it
 * the host would mean a connection named `projects` and the projects section
 * could not be told apart; keeping it in the query removes the ambiguity
 * entirely, and a URL with no `instance` simply means "whichever instance is
 * already active".
 *
 * This module must stay free of `node:` and `electron` imports — the renderer
 * imports it directly.
 */

import { DATABASE_ENGINES, type DatabaseEngine } from "./domain";

/** A sidebar section. Kept identical to the route ids in the renderer. */
export const DEEP_LINK_SECTIONS = [
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
	"connections",
	"settings",
] as const;

export type DeepLinkSection = (typeof DEEP_LINK_SECTIONS)[number];

const SECTION_SET: ReadonlySet<string> = new Set(DEEP_LINK_SECTIONS);

/**
 * A resource a link can point at.
 *
 * `database` carries its engine because the API identifies a database by
 * `(engine, id)`: `postgres.one` and `redis.one` are different routes, and
 * `id` alone would not say which one to call.
 */
export type DeepLinkResource =
	| { kind: "project"; id: string }
	| { kind: "environment"; projectId: string; id: string }
	| { kind: "application"; id: string }
	| { kind: "deployment"; id: string }
	| { kind: "database"; engine: DatabaseEngine; id: string }
	| { kind: "server"; id: string };

/**
 * The section each resource belongs to.
 *
 * A link's section is therefore *derived* from its resource rather than supplied
 * alongside it, which is what stops `notploy://monitoring/applications/1` from
 * existing as a link that parses but contradicts itself.
 */
const RESOURCE_SECTIONS: Record<DeepLinkResource["kind"], DeepLinkSection> = {
	project: "projects",
	environment: "projects",
	application: "applications",
	deployment: "deployments",
	database: "databases",
	server: "infrastructure",
};

/** The section a resource is shown in. */

export function sectionForResource(
	resource: DeepLinkResource,
): DeepLinkSection {
	return RESOURCE_SECTIONS[resource.kind];
}

export interface DeepLinkTarget {
	section: DeepLinkSection;
	resource?: DeepLinkResource;
	/** Connection name or id; absent means "the active instance". */
	instance?: string;
}

/** The scheme. `notploy:` and `notploy://` are both accepted on input. */
export const DEEP_LINK_SCHEME = "notploy";

function isDatabaseEngine(value: string): value is DatabaseEngine {
	return (DATABASE_ENGINES as readonly string[]).includes(value);
}

function decode(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

function encode(segment: string): string {
	return encodeURIComponent(segment);
}

/**
 * Parses a `notploy://` URL.
 *
 * Returns `undefined` for anything malformed instead of throwing: a deep link
 * arrives from outside the app, and an unparseable one must be ignored, not
 * crash the handler that received it.
 */
export function parseDeepLink(input: string): DeepLinkTarget | undefined {
	const trimmed = input.trim();
	if (!trimmed) return undefined;

	let url: URL;
	try {
		// `notploy:projects/42` is a valid single-slash form the OS can deliver;
		// normalising it here keeps the parser to one code path.
		url = new URL(trimmed.replace(/^notploy:(?!\/\/)/i, "notploy://"));
	} catch {
		return undefined;
	}

	if (url.protocol.toLowerCase() !== `${DEEP_LINK_SCHEME}:`) return undefined;

	const segments = [...url.hostname.split("/"), ...url.pathname.split("/")]
		.map((segment) => decode(segment))
		.filter(Boolean);
	if (segments.length === 0) return undefined;

	const [head, ...rest] = segments as [string, ...string[]];
	if (!SECTION_SET.has(head)) return undefined;
	const section = head as DeepLinkSection;

	const instance = url.searchParams.get("instance")?.trim() || undefined;
	const resource = parseResource(section, rest);
	if (rest.length > 0 && !resource) {
		// A link that names a resource we cannot represent is treated as a link
		// to the section rather than rejected outright — the section is still a
		// useful destination.
		return { section, instance };
	}

	return resource ? { section, resource, instance } : { section, instance };
}

/**
 * Reads the resource path of a link, relative to its section.
 *
 * A path that does not name a resource this section can show resolves to
 * `undefined`, and the caller falls back to the section itself — a useful
 * destination — rather than rejecting the whole link.
 */
function parseResource(
	section: DeepLinkSection,
	segments: string[],
): DeepLinkResource | undefined {
	switch (section) {
		case "projects": {
			const [projectId, nested, environmentId] = segments;
			if (!projectId) return undefined;
			if (nested === "environments" && environmentId) {
				return { kind: "environment", projectId, id: environmentId };
			}
			return { kind: "project", id: projectId };
		}
		case "applications": {
			const [id] = segments;
			return id ? { kind: "application", id } : undefined;
		}
		case "deployments": {
			const [id] = segments;
			return id ? { kind: "deployment", id } : undefined;
		}
		case "databases": {
			const [engine, id] = segments;
			if (!engine || !id || !isDatabaseEngine(engine)) return undefined;
			return { kind: "database", engine, id };
		}
		case "infrastructure": {
			const [nested, id] = segments;
			return nested === "servers" && id ? { kind: "server", id } : undefined;
		}
		default:
			return undefined;
	}
}

/**
 * Formats a target as a `notploy://` URL.
 *
 * When a resource is present, the section comes from the resource itself, so a
 * link can never name a section that does not show what it points at.
 * Round-trips with {@link parseDeepLink}.
 */
export function formatDeepLink(target: DeepLinkTarget): string {
	const segments: string[] = [
		target.resource ? RESOURCE_SECTIONS[target.resource.kind] : target.section,
	];
	const resource = target.resource;
	if (resource) {
		switch (resource.kind) {
			case "project":
				segments.push(encode(resource.id));
				break;
			case "environment":
				segments.push(
					encode(resource.projectId),
					"environments",
					encode(resource.id),
				);
				break;
			case "application":
				segments.push(encode(resource.id));
				break;
			case "deployment":
				segments.push(encode(resource.id));
				break;
			case "database":
				segments.push(resource.engine, encode(resource.id));
				break;
			case "server":
				segments.push("servers", encode(resource.id));
				break;
		}
	}

	const query = target.instance
		? `?instance=${encodeURIComponent(target.instance)}`
		: "";
	return `${DEEP_LINK_SCHEME}://${segments.join("/")}${query}`;
}

/** True when a string is a `notploy://` URL, cheaply, without parsing it. */
export function isDeepLink(value: string): boolean {
	return /^notploy:/i.test(value.trim());
}
