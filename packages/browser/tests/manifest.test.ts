import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
	fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
);

describe("manifest", () => {
	it("is MV3 with minimal base permissions", () => {
		expect(manifest.manifest_version).toBe(3);
		expect(manifest.permissions).toEqual(["storage"]);
		expect(manifest.host_permissions ?? []).not.toContain("<all_urls>");
		expect(manifest.permissions).not.toContain("<all_urls>");
	});

	it("declares per-instance optional host permissions", () => {
		expect(manifest.optional_host_permissions).toContain("https://*/*");
	});

	it("pins CSP to self", () => {
		const csp: string = manifest.content_security_policy.extension_pages;
		expect(csp).toContain("script-src 'self'");
		expect(csp).not.toContain("unsafe-eval");
	});

	it("ships icons and entry points", () => {
		expect(manifest.action.default_popup).toBe("popup.html");
		expect(manifest.options_page).toBe("options.html");
		expect(manifest.background.service_worker).toBe("background.js");
		for (const icon of Object.values(
			manifest.icons as Record<string, string>,
		)) {
			expect(
				fs.existsSync(path.join(root, "public/icons", path.basename(icon))),
			).toBe(true);
		}
		expect(fs.existsSync(path.join(root, "src/popup/popup.html"))).toBe(true);
		expect(fs.existsSync(path.join(root, "src/options/options.html"))).toBe(
			true,
		);
	});
});
