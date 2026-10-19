/**
 * Builds the marketing site as a static export for GitHub Pages / Cloudflare
 * Pages.
 *
 * Three route handlers need a Node server and cannot be exported:
 *   app/api/contact         POST — the contact form
 *   app/api/github-stars    reads ?owner=&repo= from the request
 *   app/api/og              renders an image from request query params
 *
 * They are moved aside for the duration of the build and restored afterwards,
 * so `next build` (the Docker/server build) keeps them untouched. The exported
 * site uses `NEXT_PUBLIC_CONTACT_ENDPOINT` for the form when configured; see
 * the Pages workflow.
 *
 * A static export also has no runtime server, so the template catalog must be
 * available up front: the blueprints committed under `templates/blueprints`
 * are the source of truth and their logo assets are copied into `public/` for
 * the duration of the build (the page data itself is read from the same folder
 * by lib/templates.server.ts).
 *
 * Usage: node scripts/build-static.mjs [--out <dir>]
 */

import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const APP_ROOT = resolve(import.meta.dirname, "..");
const BACKUP_ROOT = join(APP_ROOT, ".static-export-disabled");
const PUBLIC_ASSET_ROOT = join(APP_ROOT, "public", "blueprints");
const SERVER_ROUTES = [
	"app/api/contact",
	"app/api/github-stars",
	"app/api/og",
];

function resolveTemplatesRoot() {
	if (process.env.TEMPLATES_DIR) {
		const root = resolve(process.env.TEMPLATES_DIR);
		if (!existsSync(join(root, "blueprints"))) {
			throw new Error(
				`TEMPLATES_DIR points at ${root}, which has no blueprints directory.`,
			);
		}
		return root;
	}

	const candidates = [
		resolve(APP_ROOT, "../../../templates"),
		resolve(APP_ROOT, "../../templates"),
		resolve(APP_ROOT, "../templates"),
		resolve(APP_ROOT, "templates"),
	];

	for (const root of candidates) {
		if (existsSync(join(root, "blueprints"))) return root;
	}

	throw new Error(
		"Unable to find the templates/blueprints directory. Run the static build from the monorepo.",
	);
}

/**
 * Copies every logo referenced by a blueprint's meta.json into
 * `public/blueprints/<id>/<logo>` so the exported pages serve them locally
 * (the templates host is not a build dependency). Returns the number of files
 * copied.
 */
function copyBlueprintAssets(templatesRoot) {
	const blueprintsDir = join(templatesRoot, "blueprints");
	const entries = readdirSync(blueprintsDir, { withFileTypes: true });
	let copied = 0;

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const metaPath = join(blueprintsDir, entry.name, "meta.json");
		if (!existsSync(metaPath)) continue;

		const meta = JSON.parse(readFileSync(metaPath, "utf8"));
		if (!meta.logo) continue;

		const source = join(blueprintsDir, entry.name, meta.logo);
		if (!existsSync(source)) {
			console.warn(
				`[build-static] ${entry.name}/meta.json references a missing logo: ${meta.logo}`,
			);
			continue;
		}

		const destination = join(PUBLIC_ASSET_ROOT, entry.name, meta.logo);
		mkdirSync(dirname(destination), { recursive: true });
		cpSync(source, destination);
		copied += 1;
	}

	if (copied === 0) {
		throw new Error(
			`No template logo assets were found under ${blueprintsDir}. The static export needs the committed blueprints to generate /templates/[id].`,
		);
	}

	return copied;
}

const templatesRoot = resolveTemplatesRoot();
const hadAssetRoot = existsSync(PUBLIC_ASSET_ROOT);
const moved = [];
let status = 1;

try {
	for (const route of SERVER_ROUTES) {
		const from = join(APP_ROOT, route);
		if (!existsSync(from)) continue;
		const to = join(BACKUP_ROOT, route);
		mkdirSync(dirname(from), { recursive: true });
		mkdirSync(dirname(to), { recursive: true });
		renameSync(from, to);
		moved.push({ from, to });
	}

	const copiedAssets = copyBlueprintAssets(templatesRoot);
	console.log(`Copied ${copiedAssets} template logo(s) from ${templatesRoot}`);

	// Keep prerendered and hydrated logo URLs identical: the client bundle
	// inlines NEXT_PUBLIC_TEMPLATE_ASSET_BASE at build time, so it must match
	// what the export actually serves.
	const basePath = process.env.NEXT_BASE_PATH ?? "";
	const result = spawnSync("pnpm", ["exec", "next", "build", "--webpack"], {
		cwd: APP_ROOT,
		stdio: "inherit",
		env: {
			...process.env,
			NEXT_OUTPUT: "export",
			NEXT_PUBLIC_TEMPLATE_ASSET_BASE: `${basePath}/blueprints`,
		},
	});
	status = result.status ?? 1;
} finally {
	for (const { from, to } of moved) {
		mkdirSync(dirname(from), { recursive: true });
		renameSync(to, from);
	}
	rmSync(BACKUP_ROOT, { recursive: true, force: true });
	if (!hadAssetRoot) {
		rmSync(PUBLIC_ASSET_ROOT, { recursive: true, force: true });
	}
}

process.exitCode = status;
