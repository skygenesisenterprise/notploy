import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
	TEMPLATES_BASE_URL,
	type Template,
	type TemplateFiles,
} from "./templates";

const REVALIDATE_SECONDS = 3600;

// The blueprints committed under `templates/blueprints` are what the templates
// host is generated from, so they are preferred over the HTTP API: the static
// export (Cloudflare Pages, GitHub Pages) prerenders every /templates/[id]
// route at build time and must not depend on a host being reachable from the
// build runner. The templates host stays as a fallback for builds that happen
// outside the monorepo.
function templatesRootCandidates(): string[] {
	if (process.env.TEMPLATES_DIR) {
		return [path.resolve(process.env.TEMPLATES_DIR)];
	}
	const cwd = process.cwd();
	return [
		path.resolve(cwd, "../../../templates"),
		path.resolve(cwd, "../../templates"),
		path.resolve(cwd, "../templates"),
		path.resolve(cwd, "templates"),
	];
}

let cachedBlueprintsDir: string | null | undefined;

async function findBlueprintsDir(): Promise<string | null> {
	if (cachedBlueprintsDir !== undefined) return cachedBlueprintsDir;
	for (const root of templatesRootCandidates()) {
		const blueprintsDir = path.join(root, "blueprints");
		try {
			const entries = await readdir(blueprintsDir);
			if (entries.length > 0) {
				cachedBlueprintsDir = blueprintsDir;
				return blueprintsDir;
			}
		} catch {
			// Not this candidate, keep looking.
		}
	}
	cachedBlueprintsDir = null;
	return null;
}

let cachedLocalTemplates: Template[] | null = null;

async function loadLocalTemplates(): Promise<Template[] | null> {
	if (cachedLocalTemplates) return cachedLocalTemplates;

	const blueprintsDir = await findBlueprintsDir();
	if (!blueprintsDir) return null;

	const entries = await readdir(blueprintsDir, { withFileTypes: true });
	const templates: Template[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const metaPath = path.join(blueprintsDir, entry.name, "meta.json");
		let meta: Template;
		try {
			meta = JSON.parse(await readFile(metaPath, "utf8")) as Template;
		} catch (error) {
			// Malformed blueprints must fail the build, not silently drop a page.
			throw new Error(`Unable to read template metadata at ${metaPath}`, {
				cause: error,
			});
		}
		if (!meta?.id || !meta.name) {
			throw new Error(`Invalid template metadata at ${metaPath}`);
		}
		templates.push(meta);
	}

	templates.sort((a, b) => a.name.localeCompare(b.name));
	cachedLocalTemplates = templates;
	return templates;
}

async function fetchRemoteTemplates(): Promise<Template[] | null> {
	const url = `${TEMPLATES_BASE_URL}/meta.json`;
	try {
		const response = await fetch(url, {
			next: { revalidate: REVALIDATE_SECONDS },
		});
		if (!response.ok) {
			console.error(
				`[templates] ${url} responded with ${response.status} ${response.statusText}`,
			);
			return null;
		}
		const templates = (await response.json()) as Template[];
		if (!Array.isArray(templates) || templates.length === 0) {
			console.error(`[templates] ${url} did not return any templates`);
			return null;
		}
		return templates.sort((a, b) => a.name.localeCompare(b.name));
	} catch (error) {
		console.error(`[templates] Failed to fetch ${url}`, error);
		return null;
	}
}

export async function getTemplates(): Promise<Template[]> {
	const local = await loadLocalTemplates();
	if (local && local.length > 0) return local;

	const remote = await fetchRemoteTemplates();
	if (remote && remote.length > 0) return remote;

	throw new Error(
		"No templates were found. Expected either the monorepo `templates/blueprints` directory or a reachable templates host, and the /templates/[id] routes need at least one template to be generated.",
	);
}

export async function getTemplate(id: string): Promise<Template | null> {
	const templates = await getTemplates();
	return templates.find((template) => template.id === id) ?? null;
}

async function readOptionalFile(filePath: string): Promise<string | null> {
	try {
		const contents = await readFile(filePath, "utf8");
		return contents.trim() || null;
	} catch {
		return null;
	}
}

async function loadLocalTemplateFiles(
	id: string,
): Promise<TemplateFiles | null> {
	const blueprintsDir = await findBlueprintsDir();
	if (!blueprintsDir) return null;

	const blueprintDir = path.join(blueprintsDir, id);
	try {
		await readdir(blueprintDir);
	} catch {
		// Unknown template locally: fall back to the templates host.
		return null;
	}

	const [dockerCompose, templateToml, instructions] = await Promise.all([
		readOptionalFile(path.join(blueprintDir, "docker-compose.yml")),
		readOptionalFile(path.join(blueprintDir, "template.toml")),
		readOptionalFile(path.join(blueprintDir, "instructions.md")),
	]);
	return { dockerCompose, templateToml, instructions };
}

async function fetchRemoteTemplateFile(
	id: string,
	fileName: string,
): Promise<string | null> {
	const url = `${TEMPLATES_BASE_URL}/blueprints/${id}/${fileName}`;
	try {
		const response = await fetch(url, {
			next: { revalidate: REVALIDATE_SECONDS },
		});
		if (!response.ok) {
			console.error(
				`[templates] ${url} responded with ${response.status} ${response.statusText}`,
			);
			return null;
		}
		const text = await response.text();
		// The templates host serves the SPA's index.html for missing files
		if (/^\s*(<!doctype|<html\b)/i.test(text)) return null;
		return text.trim() || null;
	} catch (error) {
		console.error(`[templates] Failed to fetch ${url}`, error);
		return null;
	}
}

export async function getTemplateFiles(id: string): Promise<TemplateFiles> {
	const local = await loadLocalTemplateFiles(id);
	if (local) return local;

	const [dockerCompose, templateToml, instructions] = await Promise.all([
		fetchRemoteTemplateFile(id, "docker-compose.yml"),
		fetchRemoteTemplateFile(id, "template.toml"),
		fetchRemoteTemplateFile(id, "instructions.md"),
	]);
	return { dockerCompose, templateToml, instructions };
}
