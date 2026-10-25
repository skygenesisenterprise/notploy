import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const errors = [];

if (manifest.manifest_version !== 3) errors.push("manifest_version must be 3");
if (!manifest.action?.default_popup)
	errors.push("action.default_popup missing");

const permissions = manifest.permissions ?? [];
for (const permission of permissions) {
	if (permission === "storage") continue;
	errors.push(
		`unexpected permission "${permission}": keep the base manifest to storage only`,
	);
}
if (
	permissions.includes("<all_urls>") ||
	(manifest.host_permissions ?? []).includes("<all_urls>")
) {
	errors.push(
		"<all_urls> is not allowed in the MVP: use optional_host_permissions per instance",
	);
}

const csp = manifest.content_security_policy?.extension_pages ?? "";
if (!csp.includes("script-src 'self'"))
	errors.push("CSP must pin script-src 'self'");
if (/unsafe-|http:|^https:|\*/.test(csp.replace("script-src 'self'", ""))) {
	errors.push(`CSP allows more than 'self': ${csp}`);
}

const background = manifest.background?.service_worker;
if (!background) errors.push("background.service_worker missing");

for (const icon of Object.values(manifest.icons ?? {})) {
	const full = path.join(
		root,
		String(icon)
			.replace(/^dist\//, "")
			.replace(/^\//, ""),
	);
	// Source icons live in public/icons; dist icons are copied at build time.
	const source = path.join(root, "public/icons", path.basename(String(icon)));
	if (!fs.existsSync(source) && !fs.existsSync(full))
		errors.push(`missing icon ${icon}`);
}

if (errors.length > 0) {
	console.error(errors.map((error) => ` - ${error}`).join("\n"));
	process.exit(1);
}
console.log("manifest OK: MV3, storage-only base permissions, pinned CSP");
