import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root, derived from this file's location (scripts/docs/lib). */
export const REPO_ROOT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../..",
);

export const DOCS_ROOT = join(REPO_ROOT, "web/apps/docs");
export const CONTENT_ROOT = join(DOCS_ROOT, "content/docs");
export const CONFIG_PATH = join(REPO_ROOT, "docs-sync.json");

export function fromRepo(...parts) {
	return join(REPO_ROOT, ...parts);
}

/** Repository-relative POSIX path, used in diagnostics so output is stable. */
export function repoPath(absolutePath) {
	return relative(REPO_ROOT, absolutePath).split(sep).join("/");
}
