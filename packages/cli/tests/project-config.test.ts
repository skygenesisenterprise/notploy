import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	loadProjectConfig,
	parseYamlSubset,
	resolveProjectValue,
	validateProjectConfig,
} from "../src/project-config.js";
import { createTempDir, removeTempDir } from "./helpers/cli.js";

let dir: string;

beforeEach(() => {
	dir = createTempDir();
});

afterEach(() => {
	removeTempDir(dir);
});

describe("parseYamlSubset", () => {
	it("parses nested mappings, scalars and comments", () => {
		const parsed = parseYamlSubset(
			`# project manifest
version: 1
profile: staging
timeoutMs: 15000
environments:
  production:
    environmentId: env_prod
    applicationId: app_prod
  staging:
    environmentId: env_staging
`,
		);
		expect(parsed).toEqual({
			version: 1,
			profile: "staging",
			timeoutMs: 15000,
			environments: {
				production: {
					environmentId: "env_prod",
					applicationId: "app_prod",
				},
				staging: { environmentId: "env_staging" },
			},
		});
	});

	it("parses quoted strings, booleans, null and JSON flow collections", () => {
		const parsed = parseYamlSubset(
			`name: "a: b"
enabled: true
empty: null
list: ["a", "b"]
`,
		);
		expect(parsed).toEqual({
			name: "a: b",
			enabled: true,
			empty: null,
			list: ["a", "b"],
		});
	});

	it("rejects tabs, duplicate keys and unsupported anchors", () => {
		expect(() => parseYamlSubset("version:\n\t1\n")).toThrow(/tabs/);
		expect(() => parseYamlSubset("version: 1\nversion: 1\n")).toThrow(
			/duplicate key/,
		);
		expect(() => parseYamlSubset("version: &v 1\n")).toThrow(/anchors/);
	});
});

describe("validateProjectConfig", () => {
	it("accepts documented fields", () => {
		expect(
			validateProjectConfig({
				version: 1,
				profile: "local",
				projectId: "project_1",
				applicationId: "app_1",
				timeoutMs: 5000,
			}),
		).toMatchObject({
			version: 1,
			profile: "local",
			projectId: "project_1",
			applicationId: "app_1",
			timeoutMs: 5000,
		});
	});

	it("rejects unknown keys and secrets", () => {
		expect(() => validateProjectConfig({ version: 1, unknown: true })).toThrow(
			/unknown key/,
		);
		expect(() =>
			validateProjectConfig({ version: 1, apiKey: "secret" }),
		).toThrow(/looks like a secret/);
		expect(() =>
			validateProjectConfig({
				version: 1,
				environments: {
					production: { token: "secret" },
				},
			}),
		).toThrow(/looks like a secret/);
	});

	it("requires version 1 and valid environment references", () => {
		expect(() => validateProjectConfig({ version: 2 })).toThrow(
			/"version" must be 1/,
		);
		expect(() =>
			validateProjectConfig({
				version: 1,
				environment: "production",
			}),
		).toThrow(/not defined/);
	});
});

describe("loadProjectConfig", () => {
	it("returns null when the optional manifest is absent", () => {
		expect(loadProjectConfig({ cwd: dir, env: {} })).toBeNull();
	});

	it("overlays the selected environment", () => {
		fs.writeFileSync(
			path.join(dir, "notploy.yaml"),
			`version: 1
profile: staging
applicationId: app_default
environments:
  production:
    applicationId: app_prod
    environmentId: env_prod
  staging:
    applicationId: app_staging
`,
		);
		const loaded = loadProjectConfig({
			cwd: dir,
			env: { NOTPLOY_ENVIRONMENT: "production" },
		});
		expect(loaded?.config).toMatchObject({
			profile: "staging",
			environment: "production",
			applicationId: "app_prod",
			environmentId: "env_prod",
		});
	});

	it("fails when NOTPLOY_ENVIRONMENT selects an undefined environment", () => {
		fs.writeFileSync(
			path.join(dir, "notploy.yaml"),
			`version: 1
environments:
  production:
    applicationId: app_prod
`,
		);
		expect(() =>
			loadProjectConfig({
				cwd: dir,
				env: { NOTPLOY_ENVIRONMENT: "staging" },
			}),
		).toThrow(/not defined/);
	});

	it("rejects secrets written to the manifest", () => {
		fs.writeFileSync(
			path.join(dir, "notploy.yaml"),
			`version: 1
apiKey: super-secret
`,
		);
		expect(() => loadProjectConfig({ cwd: dir, env: {} })).toThrow(/secrets/);
	});
});

describe("resolveProjectValue", () => {
	const loaded = {
		path: "/tmp/notploy.yaml",
		raw: { version: 1 as const, applicationId: "app_manifest" },
		config: { version: 1 as const, applicationId: "app_manifest" },
	};

	it("prefers environment variables over the manifest", () => {
		expect(
			resolveProjectValue("applicationId", loaded, {
				NOTPLOY_APPLICATION_ID: "app_env",
			}),
		).toBe("app_env");
		expect(resolveProjectValue("applicationId", loaded, {})).toBe(
			"app_manifest",
		);
	});

	it("returns undefined when neither source defines the value", () => {
		expect(resolveProjectValue("environmentId", loaded, {})).toBeUndefined();
		expect(resolveProjectValue("applicationId", null, {})).toBeUndefined();
	});
});
