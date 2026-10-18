import { resolve } from "node:path";
import { kebabCase } from "./regions.mjs";

/**
 * Public tRPC namespaces, read from the router registration in root.ts. The
 * registration is the authoritative list: a router file that is not added to
 * `appRouter` is not reachable and is not documented.
 */
export function readRouterNamespaces(source) {
	return [
		...new Set(
			[
				...routerSection(source).matchAll(
					/^\s*([A-Za-z0-9_]+):\s*[A-Za-z0-9_]+,\s*$/gm,
				),
			].map((match) => match[1]),
		),
	].sort();
}

function routerSection(source) {
	const start = source.indexOf("createTRPCRouter({");
	if (start === -1) return "";
	const body = source.slice(start + "createTRPCRouter({".length);
	const end = body.indexOf("\n});");
	return end === -1 ? body : body.slice(0, end);
}

/**
 * Maps each registered namespace to the router module that implements it.
 * Imports are resolved relative to the router directory so a mapping entry in
 * docs-sync.json can point at the implementation file directly.
 */
export function readRouterRegistrations(source, routerDir) {
	const imports = new Map();
	for (const match of source.matchAll(
		/import\s*\{\s*([A-Za-z0-9_]+)\s*\}\s*from\s*"(\.[^"]+)"/g,
	)) {
		imports.set(match[1], match[2]);
	}

	const section = routerSection(source);
	const registrations = new Map();

	for (const match of section.matchAll(
		/^\s*([A-Za-z0-9_]+):\s*([A-Za-z0-9_]+),\s*$/gm,
	)) {
		const [, namespace, variable] = match;
		const specifier = imports.get(variable);
		if (!specifier) continue;
		registrations.set(
			namespace,
			routerDir ? resolve(routerDir, specifier) : specifier,
		);
	}
	return new Map([...registrations.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Namespaces implemented by the source files a core feature maps. `sources`
 * must be absolute paths, so resolution does not depend on the caller's cwd.
 */
export function namespacesForSources(registrations, sources) {
	const key = (path) => resolve(path).replace(/\.(?:ts|tsx|js|mjs)$/, "");
	const byFile = new Map(
		[...registrations.entries()].map(([namespace, path]) => [key(path), namespace]),
	);
	const namespaces = [];
	for (const source of sources ?? []) {
		const namespace = byFile.get(key(source));
		if (namespace) namespaces.push(namespace);
	}
	return [...new Set(namespaces)];
}

/** The hand-written guide page for an API namespace, with explicit overrides. */
export function apiGuideSlug(config, namespace) {
	const overrides = config?.api?.namespaceDocs ?? {};
	return overrides[namespace] ?? kebabCase(namespace);
}

