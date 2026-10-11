/**
 * `pnpm seed [-- --slug notploy]`
 *
 * Creates the Notploy status page and its components (Notploy Cloud, API, MCP
 * Server, GitHub App, Website, Docs) from the shipped catalog. Idempotent: an
 * existing page or component is left untouched, so it is safe to re-run after
 * an upgrade or from a Make target.
 *
 * States are recorded afterwards through the integration API:
 *
 *   POST /api/v1/integration/pages/<slug>/components/<componentId>/state
 *   Authorization: Bearer <token with the `ingest` scope>
 *   { "observedStatus": "operational" | "degraded" | "outage" | "unknown" }
 */
import { loadConfig } from "../config";
import { NOTPLOY_STATUS_CATALOG } from "../core/catalog";
import { createStatusContext } from "../services/context";
import { seedCatalog } from "../services/seed";

const args = process.argv.slice(2);
const readFlag = (name: string): string | undefined => {
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
};

const config = loadConfig();
const ctx = createStatusContext({ config });
const lines: string[] = [];

try {
	const result = seedCatalog(
		ctx,
		NOTPLOY_STATUS_CATALOG,
		{
			slug: readFlag("slug"),
			name: readFlag("name"),
			description: readFlag("description"),
		},
		{ type: "system", id: null, label: "cli:seed" },
	);

	lines.push(
		`Status page "${result.page.name}" (/${result.page.slug}) — ${result.created.length} created, ${result.existing.length} already present.`,
	);
	for (const name of result.created) {
		lines.push(`  + ${name}`);
	}
	for (const name of result.existing) {
		lines.push(`  = ${name} (left untouched)`);
	}
	lines.push("");
	lines.push(`Public page: ${config.publicUrl}/p/${result.page.slug}`);
	lines.push(
		`Record states: POST ${config.publicUrl}/api/v1/integration/pages/${result.page.slug}/components/<componentId>/state`,
	);
} finally {
	ctx.db.close();
}

process.stdout.write(`${lines.join("\n")}\n`);
