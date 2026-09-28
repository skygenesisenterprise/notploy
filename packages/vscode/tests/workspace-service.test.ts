import { describe, expect, it } from "vitest";
import {
	MANIFEST_FILENAMES,
	parseManifest,
	repositorySlug,
	stripCredentials,
} from "../src/services/workspace-service";

describe("MANIFEST_FILENAMES", () => {
	it("keeps the documented order so the first match wins", () => {
		expect(MANIFEST_FILENAMES[0]).toBe("notploy.yaml");
		expect([...MANIFEST_FILENAMES]).toEqual([
			"notploy.yaml",
			"notploy.yml",
			"notploy.json",
		]);
	});
});

describe("parseManifest", () => {
	it("reads a YAML manifest", () => {
		const manifest = parseManifest(
			[
				"version: 1",
				"instance: local",
				"project: marketing",
				"environment: production",
				"application: website",
			].join("\n"),
			"notploy.yaml",
		);
		expect(manifest).toEqual({
			version: 1,
			instance: "local",
			project: "marketing",
			environment: "production",
			application: "website",
		});
	});

	it("reads a JSON manifest", () => {
		const manifest = parseManifest(
			JSON.stringify({ version: 1, project: "api" }),
			"notploy.json",
		);
		expect(manifest?.project).toBe("api");
	});

	it("rejects invalid input without throwing", () => {
		expect(parseManifest("]not yaml[", "notploy.yaml")).toBeUndefined();
		expect(parseManifest("{", "notploy.json")).toBeUndefined();
		expect(parseManifest("- a\n- b", "notploy.yaml")).toBeUndefined();
		expect(parseManifest("version: 1", "notploy.yaml")).toBeUndefined();
		expect(parseManifest("project: ''", "notploy.yaml")).toBeUndefined();
	});
});

describe("repositorySlug", () => {
	it("parses https remotes", () => {
		expect(repositorySlug("https://github.com/acme/site.git")).toBe(
			"acme/site",
		);
		expect(repositorySlug("https://gitlab.example.com/team/api")).toBe(
			"team/api",
		);
	});

	it("parses ssh remotes", () => {
		expect(repositorySlug("git@github.com:acme/site.git")).toBe("acme/site");
	});

	it("parses self-hosted git servers without assuming GitHub", () => {
		expect(repositorySlug("ssh://git@git.internal:2222/team/site.git")).toBe(
			"team/site",
		);
	});

	it("returns undefined for nothing useful", () => {
		expect(repositorySlug(undefined)).toBeUndefined();
		expect(repositorySlug("not a url")).toBeUndefined();
	});
});

describe("stripCredentials", () => {
	it("removes the userinfo segment", () => {
		expect(stripCredentials("https://user:token@host/acme/site.git")).toBe(
			"https://host/acme/site.git",
		);
	});
});
