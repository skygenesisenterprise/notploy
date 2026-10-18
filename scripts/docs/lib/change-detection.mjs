/**
 * Changes to shared tooling, the spec or the workspace invalidate every
 * check, so they return `null` (meaning full validation). Everything else
 * maps to the smallest set of checks that can catch drift.
 */

const SHARED_PATHS = [
	"scripts/docs/",
	"web/apps/docs/scripts/",
	"web/apps/docs/generate-docs.mjs",
	"web/apps/docs/source.config.ts",
	"web/apps/docs/next.config.mjs",
	"web/apps/docs/package.json",
	"web/apps/docs/mdx-components.tsx",
	"web/apps/docs/app/",
	"web/apps/docs/components/",
	"web/apps/docs/lib/",
	"docs-sync.json",
	"package.json",
	"pnpm-lock.yaml",
	".github/workflows/docs.yml",
];

export function groupsForChangedFiles(files) {
	if (!files) return null;
	const groups = new Set(["config"]);
	for (const file of files) {
		if (SHARED_PATHS.some((path) => file === path || file.startsWith(path))) {
			return null;
		}
		if (file === "openapi.json" || /\/openapi\.json$/.test(file)) {
			for (const group of ["spec", "api-reference", "regions", "mapping"]) {
				groups.add(group);
			}
		}
		if (file.startsWith("apps/notploy/server/api/")) {
			groups.add("spec");
			groups.add("api-reference");
			groups.add("regions");
			groups.add("mapping");
		}
		if (file.startsWith("packages/cli/")) groups.add("cli");
		if (file.startsWith("templates/")) {
			groups.add("templates");
			groups.add("regions");
		}
		if (file.startsWith("web/apps/docs/content/docs/")) {
			groups.add("links");
			groups.add("regions");
			if (file.includes("/content/docs/core/")) groups.add("mapping");
			if (file.includes("/content/docs/api/")) {
				groups.add("api-reference");
				groups.add("mapping");
			}
			if (file.includes("/content/docs/cli/")) groups.add("cli");
			if (file.includes("/content/docs/templates/")) groups.add("templates");
		}
	}
	return groups;
}
