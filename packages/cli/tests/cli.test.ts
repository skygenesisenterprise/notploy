import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTempDir,
	parseJson,
	ROOT,
	type RunResult,
	removeTempDir,
	runCli,
} from "./helpers/cli.js";
import { type MockServer, startMockServer } from "./helpers/mock-server.js";

const packageJson = JSON.parse(
	fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
) as { version: string };

let server: MockServer;

beforeAll(async () => {
	server = await startMockServer();
});

afterAll(async () => {
	await server.close();
});

async function authenticatedConfigDir(): Promise<string> {
	const dir = createTempDir();
	try {
		const result = await runCli(
			["auth", "-u", server.url, "-t", "valid-key", "--no-verify", "--json"],
			{ configDir: dir },
		);
		expect(result.code).toBe(0);
		return dir;
	} catch (error) {
		removeTempDir(dir);
		throw error;
	}
}

function expectJsonError(result: RunResult, code: number): void {
	const payload = parseJson<{
		error: { code: number; type: string; message: string };
	}>(result);
	expect(payload.error.code).toBe(code);
	expect(result.stdout.trim().startsWith("{")).toBe(true);
}

describe("CLI surface", () => {
	it("shows help with --help", async () => {
		const result = await runCli(["--help"]);
		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Notploy CLI");
		expect(result.stdout).toContain("auth");
		expect(result.stdout).toContain("profile");
		expect(result.stdout).toContain("doctor");
		expect(result.stdout).toContain("application");
		expect(result.stdout).toContain("project");
	});

	it("shows the package version", async () => {
		const result = await runCli(["--version"]);
		expect(result.code).toBe(0);
		expect(result.stdout.trim()).toBe(packageJson.version);
	});

	it("shows subcommands and required options", async () => {
		const application = await runCli(["application", "--help"]);
		expect(application.stdout).toContain("create");
		expect(application.stdout).toContain("deploy");
		expect(application.stdout).toContain("delete");

		const create = await runCli(["application", "create", "--help"]);
		expect(create.stdout).toContain("--name");
		expect(create.stdout).toContain("--environmentId");
		expect(create.stdout).toContain("[required]");

		const auth = await runCli(["auth", "--help"]);
		expect(auth.stdout).toContain("--url");
		expect(auth.stdout).toContain("--token");
	});

	it("exits 0 and shows usage when no arguments are provided", async () => {
		const result = await runCli([]);
		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Usage:");
	});
});

describe("JSON and exit-code contract", () => {
	it("keeps stdout as a single JSON document and diagnostics on stderr", async () => {
		const configDir = await authenticatedConfigDir();
		try {
			const result = await runCli(["project", "all", "--json"], {
				configDir,
			});
			expect(result.code).toBe(0);
			expect(result.stderr).toBe("");
			expect(parseJson(result)).toEqual([{ id: "project_1", name: "Demo" }]);
		} finally {
			removeTempDir(configDir);
		}
	});

	it("accepts --json before the command", async () => {
		const configDir = await authenticatedConfigDir();
		try {
			const result = await runCli(["--json", "project", "all"], {
				configDir,
			});
			expect(result.code).toBe(0);
			expect(parseJson(result)).toEqual([{ id: "project_1", name: "Demo" }]);
		} finally {
			removeTempDir(configDir);
		}
	});

	it("returns exit code 2 with a JSON error when configuration is missing", async () => {
		const result = await runCli(["project", "all", "--json"]);
		expect(result.code).toBe(2);
		expectJsonError(result, 2);
		expect(result.stdout).toContain("Not authenticated");
		expect(result.stderr).toBe("");
	});

	it("returns exit code 3 for authentication failures without leaking keys", async () => {
		const configDir = createTempDir();
		try {
			const result = await runCli(
				["auth", "-u", server.url, "-t", "invalid-key", "--json"],
				{ configDir },
			);
			expect(result.code).toBe(3);
			expectJsonError(result, 3);
			expect(result.stdout).not.toContain("invalid-key");
			expect(result.stderr).not.toContain("invalid-key");
		} finally {
			removeTempDir(configDir);
		}
	});

	it("returns exit code 4 for server failures", async () => {
		const configDir = await authenticatedConfigDir();
		try {
			const result = await runCli(
				[
					"server",
					"get-server-metrics",
					"--url",
					"https://example.com",
					"--token",
					"metric-token",
					"--dataPoints",
					"10",
					"--json",
				],
				{ configDir },
			);
			expect(result.code).toBe(4);
			expectJsonError(result, 4);
			expect(result.stdout).not.toContain("metric-token");
		} finally {
			removeTempDir(configDir);
		}
	});

	it("returns exit code 5 on timeouts", async () => {
		const slow = await startMockServer({ delayMs: 1500 });
		try {
			const result = await runCli(
				["project", "all", "--timeout", "1000", "--json"],
				{
					env: {
						NOTPLOY_URL: slow.url,
						NOTPLOY_API_KEY: "valid-key",
					},
				},
			);
			expect(result.code).toBe(5);
			expectJsonError(result, 5);
		} finally {
			await slow.close();
		}
	});

	it("returns a parseable JSON usage error for unknown options", async () => {
		const result = await runCli(["application", "create", "--bogus", "--json"]);
		expect(result.code).toBe(2);
		expectJsonError(result, 2);
	});

	it("never prompts in non-interactive mode", async () => {
		const result = await runCli(["auth", "--no-input", "--json"]);
		expect(result.code).toBe(2);
		expectJsonError(result, 2);
		expect(result.stdout).not.toContain("Notploy server URL");
	});
});

describe("profiles and auth", () => {
	it("stores profiles with restrictive permissions and redacts inspection output", async () => {
		const configDir = createTempDir();
		try {
			const auth = await runCli(
				[
					"auth",
					"-u",
					server.url,
					"-t",
					"valid-key",
					"--profile",
					"alpha",
					"--no-verify",
					"--json",
				],
				{ configDir },
			);
			expect(auth.code).toBe(0);

			const configPath = path.join(configDir, "config.json");
			if (process.platform !== "win32") {
				expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);
			}

			const status = await runCli(["auth", "status", "--json"], {
				configDir,
			});
			expect(status.code).toBe(0);
			expect(status.stdout).toContain("[REDACTED]");
			expect(status.stdout).not.toContain("valid-key");

			const listed = await runCli(["profile", "list", "--json"], {
				configDir,
			});
			expect(listed.code).toBe(0);
			const data = parseJson<{
				currentProfile: string;
				profiles: Array<{ name: string; token: string }>;
			}>(listed);
			expect(data.currentProfile).toBe("alpha");
			expect(data.profiles[0]).toMatchObject({
				name: "alpha",
				token: "[REDACTED]",
			});
			expect(listed.stdout).not.toContain("valid-key");
		} finally {
			removeTempDir(configDir);
		}
	});

	it("keeps credentials isolated between profiles", async () => {
		const configDir = createTempDir();
		try {
			await runCli(
				[
					"profile",
					"add",
					"alpha",
					"-u",
					server.url,
					"-t",
					"valid-key",
					"--no-verify",
					"--json",
				],
				{ configDir },
			);
			await runCli(
				[
					"profile",
					"add",
					"beta",
					"-u",
					server.url,
					"-t",
					"invalid-key",
					"--no-verify",
					"--json",
				],
				{ configDir },
			);

			const alpha = await runCli(
				["project", "all", "--profile", "alpha", "--json"],
				{ configDir },
			);
			expect(alpha.code).toBe(0);

			const beta = await runCli(
				["project", "all", "--profile", "beta", "--json"],
				{ configDir },
			);
			expect(beta.code).toBe(3);
			expect(beta.stdout).not.toContain("invalid-key");
			expect(beta.stderr).not.toContain("invalid-key");

			const use = await runCli(["profile", "use", "alpha", "--json"], {
				configDir,
			});
			expect(use.code).toBe(0);
			const selected = await runCli(["project", "all", "--json"], {
				configDir,
			});
			expect(selected.code).toBe(0);
		} finally {
			removeTempDir(configDir);
		}
	});
});

describe("schema coercion", () => {
	it("coerces arrays, nullable strings, booleans and numbers before sending", async () => {
		const configDir = await authenticatedConfigDir();
		try {
			const result = await runCli(
				[
					"application",
					"update",
					"--applicationId",
					"app_1",
					"--networkIds",
					'["network_1","network_2"]',
					"--previewPort",
					"3000",
					"--previewHttps",
					"false",
					"--detachNotployNetwork",
					"--description",
					"null",
					"--json",
				],
				{ configDir },
			);
			expect(result.code).toBe(0);
			const payload = parseJson<{
				ok: boolean;
				received: Record<string, unknown>;
			}>(result);
			expect(payload.received).toMatchObject({
				applicationId: "app_1",
				networkIds: ["network_1", "network_2"],
				previewPort: 3000,
				previewHttps: false,
				detachNotployNetwork: true,
				description: null,
			});
		} finally {
			removeTempDir(configDir);
		}
	});

	it("rejects invalid JSON arrays and enum values before making a request", async () => {
		const configDir = await authenticatedConfigDir();
		try {
			const badJson = await runCli(
				[
					"application",
					"update",
					"--applicationId",
					"app_1",
					"--networkIds",
					"not-json",
					"--json",
				],
				{ configDir },
			);
			expect(badJson.code).toBe(2);
			expectJsonError(badJson, 2);
			expect(badJson.stdout).toContain("Invalid JSON");

			const badEnum = await runCli(
				[
					"application",
					"create",
					"--name",
					"app",
					"--environmentId",
					"env_1",
					"--sourceType",
					"not-a-source",
					"--json",
				],
				{ configDir },
			);
			expect(badEnum.code).toBe(2);
			expect(badEnum.stdout).toContain("Allowed values");
		} finally {
			removeTempDir(configDir);
		}
	});
});

describe("notploy.yaml", () => {
	it("fills missing identifiers and lets environment variables override them", async () => {
		const configDir = await authenticatedConfigDir();
		const projectDir = createTempDir();
		try {
			fs.writeFileSync(
				path.join(projectDir, "notploy.yaml"),
				`version: 1
applicationId: app_manifest
`,
			);
			const fromManifest = await runCli(["application", "deploy", "--json"], {
				configDir,
				cwd: projectDir,
			});
			expect(fromManifest.code).toBe(0);
			expect(
				parseJson<{ received: Record<string, unknown> }>(fromManifest).received
					.applicationId,
			).toBe("app_manifest");

			const fromEnv = await runCli(["application", "deploy", "--json"], {
				configDir,
				cwd: projectDir,
				env: { NOTPLOY_APPLICATION_ID: "app_env" },
			});
			expect(
				parseJson<{ received: Record<string, unknown> }>(fromEnv).received
					.applicationId,
			).toBe("app_env");
		} finally {
			removeTempDir(projectDir);
			removeTempDir(configDir);
		}
	});

	it("fails diagnostics when the manifest contains secrets", async () => {
		const configDir = await authenticatedConfigDir();
		const projectDir = createTempDir();
		try {
			fs.writeFileSync(
				path.join(projectDir, "notploy.yaml"),
				`version: 1
apiKey: super-secret
`,
			);
			const result = await runCli(["doctor", "--json"], {
				configDir,
				cwd: projectDir,
			});
			expect(result.code).toBe(2);
			expect(result.stdout).toContain("secrets");
			expect(result.stdout).not.toContain("super-secret");
		} finally {
			removeTempDir(projectDir);
			removeTempDir(configDir);
		}
	});
});

describe("doctor and server info", () => {
	it("reports a healthy instance without printing secrets", async () => {
		const configDir = await authenticatedConfigDir();
		try {
			const result = await runCli(["doctor", "--json"], { configDir });
			expect(result.code).toBe(0);
			const report = parseJson<{
				ok: boolean;
				apiSpecVersion: string;
				checks: Array<{ id: string; status: string }>;
			}>(result);
			expect(report.ok).toBe(true);
			expect(report.apiSpecVersion).toBe("1.0.0");
			expect(
				report.checks.find((check) => check.id === "connectivity")?.status,
			).toBe("ok");
			expect(result.stdout).not.toContain("valid-key");
		} finally {
			removeTempDir(configDir);
		}
	});

	it("returns exit code 3 when the stored key is rejected", async () => {
		const configDir = createTempDir();
		try {
			await runCli(
				[
					"profile",
					"add",
					"broken",
					"-u",
					server.url,
					"-t",
					"invalid-key",
					"--no-verify",
					"--json",
				],
				{ configDir },
			);
			const result = await runCli(["doctor", "--profile", "broken", "--json"], {
				configDir,
			});
			expect(result.code).toBe(3);
			const report = parseJson<{
				ok: boolean;
				exitCode: number;
			}>(result);
			expect(report.ok).toBe(false);
			expect(report.exitCode).toBe(3);
			expect(result.stdout).not.toContain("invalid-key");
		} finally {
			removeTempDir(configDir);
		}
	});

	it("skips network checks in offline mode", async () => {
		const configDir = await authenticatedConfigDir();
		try {
			const result = await runCli(["doctor", "--offline", "--json"], {
				configDir,
			});
			expect(result.code).toBe(0);
			const report = parseJson<{
				ok: boolean;
				offline: boolean;
				checks: Array<{ id: string; status: string }>;
			}>(result);
			expect(report.offline).toBe(true);
			expect(
				report.checks.find((check) => check.id === "connectivity")?.status,
			).toBe("warn");
		} finally {
			removeTempDir(configDir);
		}
	});

	it("shows server identity and clock information", async () => {
		const configDir = await authenticatedConfigDir();
		try {
			const result = await runCli(["server", "info", "--json"], {
				configDir,
			});
			expect(result.code).toBe(0);
			const report = parseJson<{
				apiSpecVersion: string;
				user: { email: string };
				serverTime: string;
			}>(result);
			expect(report.apiSpecVersion).toBe("1.0.0");
			expect(report.user.email).toBe("dev@example.com");
			expect(report.serverTime).toBe("2026-10-17T12:00:00.000Z");
			expect(result.stdout).not.toContain("valid-key");
		} finally {
			removeTempDir(configDir);
		}
	});
});
