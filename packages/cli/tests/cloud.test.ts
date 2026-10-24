import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
	CommandOptions,
	CommandResult,
	CommandRunner,
	FileCommandOptions,
} from "../src/cloud/docker.js";
import { detectInstallation } from "../src/cloud/environment.js";
import {
	acquireLock,
	assessLock,
	OperationJournal,
	releaseLock,
} from "../src/cloud/journal.js";
import { verifyDatabaseBackup } from "../src/cloud/preflight.js";
import {
	parseImageReference,
	resolveImageManifest,
} from "../src/cloud/registry.js";
import {
	checkCloudCompatibility,
	parseCloudReleaseTag,
} from "../src/cloud/release.js";
import {
	buildUpdatePlan,
	executeCloudRollback,
	executeCloudUpdate,
	type PlanOptions,
	planCloudRollback,
	UpdateFailure,
	type UpdatePlan,
} from "../src/cloud/update.js";
import { CliError, redactSecrets } from "../src/errors.js";
import { runInterruptHandler, setInterruptHandler } from "../src/interrupt.js";
import { createTempDir, removeTempDir } from "./helpers/cli.js";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const CLI_VERSION = "1.0.3";
const TARGET_TAG = "v1.2.0-cloud";
const CURRENT_TAG = "v1.1.5-cloud";

interface Call {
	command: string;
	args: string[];
}

type Handler = (command: string, args: string[]) => CommandResult | undefined;

class FakeRunner implements CommandRunner {
	readonly calls: Call[] = [];

	constructor(
		private readonly handler: Handler,
		private readonly backupContent = `PGDMP${"x".repeat(64)}`,
	) {}

	async run(
		command: string,
		args: string[],
		options: CommandOptions = {},
	): Promise<CommandResult> {
		this.calls.push({ command, args });
		const result = this.handler(command, args);
		if (!result) {
			throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
		}
		if (result.code !== 0 && !options.allowFailure) {
			throw new CliError(`'${command} ${args.join(" ")}' failed.`, {
				hint: result.stderr,
			});
		}
		return result;
	}

	async runToFile(
		command: string,
		args: string[],
		filePath: string,
		_options: FileCommandOptions = {},
	): Promise<CommandResult> {
		this.calls.push({ command, args });
		fs.writeFileSync(filePath, this.backupContent, { mode: 0o600 });
		return { code: 0, stdout: "", stderr: "" };
	}

	find(predicate: (call: Call) => boolean): Call | undefined {
		return this.calls.find(predicate);
	}
}

interface DockerFixtureOptions {
	product?: "cloud" | "self" | "console";
	installedVersion?: string;
	swarmState?: string;
	swarmControl?: string;
	configDir?: string;
	servicesHealthy?: boolean;
	image?: string;
	updateState?: string;
	desiredReplicas?: number;
	runningStates?: string[];
	compose?: boolean;
	composeFlavor?: string;
}

function serviceSpec(options: {
	image: string;
	releaseTag: string;
	configDir: string;
	replicas: number;
	updateState: string;
	publishedPort: number;
}): string {
	return JSON.stringify({
		Spec: {
			TaskTemplate: {
				ContainerSpec: {
					Image: options.image,
					Env: [
						`RELEASE_TAG=${options.releaseTag}`,
						"NOTPLOY_FLAVOR=cloud",
						"IS_CLOUD=true",
						"DATABASE_URL=postgres://notploy:super-secret@notploy-postgres:5432/notploy",
					],
					Mounts: [{ Source: options.configDir, Target: "/etc/notploy" }],
				},
			},
			Mode: { Replicated: { Replicas: options.replicas } },
		},
		Endpoint: { Ports: [{ PublishedPort: options.publishedPort }] },
		UpdateStatus: { State: options.updateState },
	});
}

function dockerHandler(
	options: DockerFixtureOptions = {},
	state: { image?: string } = {},
): Handler {
	const manifestDigestValue = manifestDigest(manifestBody());
	const configDir = options.configDir ?? "/tmp/notploy-test-install";
	const image =
		options.image ??
		`ghcr.io/skygenesisenterprise/notploy-cloud:${CURRENT_TAG}`;
	const releaseTag = options.installedVersion
		? `v${options.installedVersion}-cloud`
		: CURRENT_TAG;
	if (options.compose) {
		return (command, args) => {
			const joined = `${command} ${args.join(" ")}`;
			if (joined === "docker info --format {{.ServerVersion}}") {
				return { code: 0, stdout: "27.0.0\n", stderr: "" };
			}
			if (
				joined ===
				"docker info --format {{.Swarm.LocalNodeState}}|{{.Swarm.ControlAvailable}}"
			) {
				return { code: 0, stdout: "inactive|\n", stderr: "" };
			}
			if (
				joined.startsWith(
					"docker ps -a --filter label=com.docker.compose.service=notploy",
				)
			) {
				return {
					code: 0,
					stdout: `${JSON.stringify({
						ID: "compose-id",
						Image: "ghcr.io/skygenesisenterprise/notploy-cloud:v1.1.5-cloud",
					})}\n`,
					stderr: "",
				};
			}
			if (
				joined.startsWith(
					"docker inspect compose-id --format {{json .Config.Env}}",
				)
			) {
				return {
					code: 0,
					stdout: `${JSON.stringify([
						`NOTPLOY_FLAVOR=${options.composeFlavor ?? "cloud"}`,
					])}\n`,
					stderr: "",
				};
			}
			return undefined;
		};
	}

	return (command, args) => {
		if (command === "cosign") {
			return { code: 0, stdout: "Verified OK", stderr: "" };
		}
		const joined = `${command} ${args.join(" ")}`;
		if (joined === "docker info --format {{.ServerVersion}}") {
			return { code: 0, stdout: "27.0.0\n", stderr: "" };
		}
		if (
			joined ===
			"docker info --format {{.Swarm.LocalNodeState}}|{{.Swarm.ControlAvailable}}"
		) {
			return {
				code: 0,
				stdout: `${options.swarmState ?? "active"}|${options.swarmControl ?? "true"}\n`,
				stderr: "",
			};
		}
		if (joined === "docker service inspect notploy --format {{json .}}") {
			return {
				code: 0,
				stdout: `${serviceSpec({
					image,
					releaseTag,
					configDir,
					replicas: options.desiredReplicas ?? 1,
					updateState: options.updateState ?? "completed",
					publishedPort: 3000,
				})}\n`,
				stderr: "",
			};
		}
		if (
			args[0] === "service" &&
			args[1] === "inspect" &&
			args[2] === "notploy" &&
			args.includes(
				"{{.UpdateStatus.State}}|{{.Spec.Mode.Replicated.Replicas}}",
			)
		) {
			return {
				code: 0,
				stdout: `${options.updateState ?? "completed"}|${options.desiredReplicas ?? 1}\n`,
				stderr: "",
			};
		}
		if (
			args[0] === "service" &&
			args[1] === "inspect" &&
			args[2] === "notploy" &&
			args.some((arg) => arg.includes("ContainerSpec.Image"))
		) {
			return {
				code: 0,
				stdout: `${JSON.stringify(state.image ?? image)}|${JSON.stringify([
					`RELEASE_TAG=${TARGET_TAG}`,
				])}\n`,
				stderr: "",
			};
		}
		if (args[0] === "service" && args[1] === "ps" && args[2] === "notploy") {
			return {
				code: 0,
				stdout: `${(options.runningStates ?? ["Running 2 minutes ago"]).join("\n")}\n`,
				stderr: "",
			};
		}
		if (
			args[0] === "service" &&
			args[1] === "inspect" &&
			args[2] === "notploy-postgres"
		) {
			return {
				code: 0,
				stdout: `${serviceSpec({
					image: "postgres:16",
					releaseTag: "",
					configDir: "/tmp/pg",
					replicas: 1,
					updateState: "completed",
					publishedPort: 0,
				})}\n`,
				stderr: "",
			};
		}
		if (
			args[0] === "service" &&
			args[1] === "ps" &&
			args[2] === "notploy-postgres"
		) {
			return { code: 0, stdout: "Running 2 minutes ago\n", stderr: "" };
		}
		if (joined.startsWith("docker inspect notploy-traefik")) {
			return {
				code: 0,
				stdout: `${JSON.stringify({ Status: "running" })}|"traefik:v3.6.25"\n`,
				stderr: "",
			};
		}
		if (
			args[0] === "ps" &&
			args[1] === "--filter" &&
			args[2] === "name=notploy-postgres"
		) {
			return {
				code: 0,
				stdout: "pg-container|notploy-postgres.1.abc|running|postgres:16\n",
				stderr: "",
			};
		}
		if (
			args[0] === "image" &&
			args[1] === "inspect" &&
			args.some((arg) => arg.includes("RepoDigests"))
		) {
			return {
				code: 0,
				stdout: JSON.stringify([
					`ghcr.io/skygenesisenterprise/notploy-cloud@${manifestDigestValue}`,
				]),
				stderr: "",
			};
		}
		if (args[0] === "image" && args[1] === "inspect") {
			return { code: 1, stdout: "", stderr: "No such image" };
		}
		if (args[0] === "pull") {
			return { code: 0, stdout: "", stderr: "" };
		}
		if (args[0] === "service" && args[1] === "update") {
			state.image = args[args.indexOf("--image") + 1];
			return { code: 0, stdout: "updated\n", stderr: "" };
		}
		if (args[0] === "run") {
			return {
				code: 0,
				stdout: JSON.stringify({ count: 12, last: "0005_patch" }),
				stderr: "",
			};
		}
		if (args[0] === "exec" && args[2] === "psql") {
			return { code: 0, stdout: "10\n", stderr: "" };
		}
		return undefined;
	};
}

async function createInstallation(
	options: DockerFixtureOptions = {},
	state: { image?: string } = {},
) {
	const configDir =
		options.configDir ?? createTempDir("notploy-cloud-install-");
	options.configDir = configDir;
	fs.mkdirSync(path.join(configDir, "identity"), { recursive: true });
	fs.writeFileSync(
		path.join(configDir, "identity", "identity.json"),
		JSON.stringify({
			product: options.product ?? "cloud",
			instanceId: "instance-1",
		}),
	);
	const runner = new FakeRunner(dockerHandler(options, state));
	const installation = await detectInstallation({
		runner,
		uid: 1000,
		env: {},
		now: () => new Date("2026-10-24T12:00:00.000Z"),
	});
	return { installation, runner, configDir };
}

const RELEASE_PAYLOAD = [
	{
		tag_name: TARGET_TAG,
		html_url: `https://github.com/skygenesisenterprise/notploy/releases/tag/${TARGET_TAG}`,
		published_at: "2026-10-20T00:00:00Z",
		draft: false,
		prerelease: false,
		assets: [{ name: "install.sh" }, { name: "install.ps1" }],
	},
	{
		tag_name: CURRENT_TAG,
		html_url: `https://github.com/skygenesisenterprise/notploy/releases/tag/${CURRENT_TAG}`,
		published_at: "2026-10-10T00:00:00Z",
		draft: false,
		prerelease: false,
		assets: [{ name: "install.sh" }, { name: "install.ps1" }],
	},
];

function manifestBody(): string {
	return JSON.stringify({
		schemaVersion: 2,
		mediaType: "application/vnd.oci.image.manifest.v1+json",
		config: { size: 500 },
		layers: [{ size: 1024 }, { size: 2048 }],
	});
}

function manifestDigest(body: string): string {
	return `sha256:${createHash("sha256").update(Buffer.from(body)).digest("hex")}`;
}

interface FetchFixtureOptions {
	releases?: unknown[];
	body?: string;
	digestOverride?: string;
	healthStatus?: number;
	failReleases?: boolean;
}

function fakeFetch(options: FetchFixtureOptions = {}) {
	const body = options.body ?? manifestBody();
	const calls: string[] = [];
	const impl = async (input: string | URL | Request): Promise<Response> => {
		const url = String(input);
		calls.push(url);
		if (url.includes("api.github.com")) {
			if (options.failReleases) {
				return new Response("rate limited", { status: 403 });
			}
			return new Response(JSON.stringify(options.releases ?? RELEASE_PAYLOAD), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		if (url.includes("/token")) {
			return new Response(JSON.stringify({ token: "test-token" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		if (url.includes("/manifests/")) {
			return new Response(body, {
				status: 200,
				headers: {
					"Content-Type": "application/vnd.oci.image.manifest.v1+json",
					"docker-content-digest":
						options.digestOverride ?? manifestDigest(body),
				},
			});
		}
		if (url.includes("settings.health")) {
			return new Response("ok", { status: options.healthStatus ?? 200 });
		}
		return new Response("not found", { status: 404 });
	};
	return { impl, calls };
}

const LARGE_FS = () => ({ bavail: 8_000_000, bsize: 4096 });
const SMALL_FS = () => ({ bavail: 100, bsize: 4096 });

function basePlanOptions(
	runner: FakeRunner,
	installation: Awaited<ReturnType<typeof createInstallation>>["installation"],
	stateDir: string,
	fetchImpl: ReturnType<typeof fakeFetch>["impl"],
	overrides: Partial<PlanOptions> = {},
): PlanOptions {
	return {
		installation,
		runner,
		cliVersion: CLI_VERSION,
		stateDir,
		mode: "apply",
		fetchImpl,
		env: {},
		statfs: LARGE_FS,
		now: () => new Date("2026-10-24T12:00:00.000Z"),
		...overrides,
	};
}

let stateDir: string;

beforeEach(() => {
	stateDir = createTempDir("notploy-cloud-state-");
});

afterEach(() => {
	removeTempDir(stateDir);
});

/* -------------------------------------------------------------------------- */
/* Environment detection                                                       */
/* -------------------------------------------------------------------------- */

describe("Cloud installation detection", () => {
	it("detects a Cloud Swarm installation and reads its version", async () => {
		const { installation } = await createInstallation({
			installedVersion: "1.1.5",
		});
		try {
			expect(installation.detected).toBe(true);
			expect(installation.product).toBe("cloud");
			expect(installation.deployment).toBe("swarm");
			expect(installation.installedVersion).toBe("1.1.5");
			expect(installation.releaseTag).toBe(CURRENT_TAG);
			expect(installation.image).toContain("notploy-cloud");
			expect(installation.capabilities.update).toBe(true);
			expect(installation.services.map((service) => service.name)).toEqual([
				"notploy",
				"notploy-postgres",
				"notploy-traefik",
			]);
			expect(installation.issues).toEqual([]);
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("does not report a Self installation as updatable Cloud", async () => {
		const { installation } = await createInstallation({ product: "self" });
		try {
			expect(installation.product).toBe("self");
			expect(installation.capabilities.update).toBe(false);
			expect(installation.capabilities.reasons.update).toContain("not Cloud");
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("detects a Compose deployment read-only and refuses updates", async () => {
		const configDir = createTempDir("notploy-cloud-compose-");
		try {
			const runner = new FakeRunner(
				dockerHandler({ compose: true, configDir }),
			);
			const installation = await detectInstallation({
				runner,
				uid: 1000,
				env: {},
			});
			expect(installation.product).toBe("cloud");
			expect(installation.deployment).toBe("compose");
			expect(installation.capabilities.update).toBe(false);
			await expect(
				buildUpdatePlan(
					basePlanOptions(runner, installation, stateDir, fakeFetch().impl),
				),
			).rejects.toMatchObject({ code: 2 });
		} finally {
			removeTempDir(configDir);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* Release resolution and compatibility                                        */
/* -------------------------------------------------------------------------- */

describe("Cloud release resolution", () => {
	it("parses only the -cloud release line", () => {
		expect(parseCloudReleaseTag("v1.2.3-cloud")?.version).toBe("1.2.3");
		expect(parseCloudReleaseTag("v1.2.3-app")).toBeNull();
		expect(parseCloudReleaseTag("latest")).toBeNull();
	});

	it("reports no update when the newest release is already installed", async () => {
		const { installation, runner } = await createInstallation({
			installedVersion: "1.1.5",
		});
		try {
			const fetch = fakeFetch({
				releases: [RELEASE_PAYLOAD[1]],
			});
			const plan = await buildUpdatePlan(
				basePlanOptions(runner, installation, stateDir, fetch.impl, {
					mode: "check",
				}),
			);
			expect(plan.updateAvailable).toBe(false);
			expect(plan.targetVersion).toBe("1.1.5");
			expect(plan.blockers).toEqual([]);
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("refuses a cross-major update unless explicitly allowed", () => {
		const blocked = checkCloudCompatibility({
			currentVersion: "1.1.5",
			targetVersion: "2.0.0",
		});
		expect(blocked.compatible).toBe(false);
		expect(blocked.blockers.join(" ")).toContain("Cross-major");

		const allowed = checkCloudCompatibility({
			currentVersion: "1.1.5",
			targetVersion: "2.0.0",
			allowMajor: true,
		});
		expect(allowed.compatible).toBe(true);
		expect(allowed.warnings.join(" ")).toContain("Cross-major");
	});

	it("refuses a downgrade and an unknown installed version", () => {
		expect(
			checkCloudCompatibility({
				currentVersion: "1.2.0",
				targetVersion: "1.1.0",
			}).compatible,
		).toBe(false);
		expect(
			checkCloudCompatibility({
				currentVersion: null,
				targetVersion: "1.2.0",
			}).compatible,
		).toBe(false);
	});
});

/* -------------------------------------------------------------------------- */
/* Artifact integrity                                                          */
/* -------------------------------------------------------------------------- */

describe("artifact integrity", () => {
	it("rejects a digest that does not match the returned manifest bytes", async () => {
		const fetch = fakeFetch({ digestOverride: `sha256:${"0".repeat(64)}` });
		await expect(
			resolveImageManifest(
				"ghcr.io/skygenesisenterprise/notploy-cloud:v1.2.0-cloud",
				{ fetchImpl: fetch.impl, env: {} },
			),
		).rejects.toMatchObject({ code: 4 });
	});

	it("validates image references against path traversal", () => {
		expect(() =>
			parseImageReference("ghcr.io/skygenesisenterprise/../notploy-cloud:tag"),
		).toThrow();
		expect(() => parseImageReference("ghcr.io/repo:tag;rm -rf /")).toThrow();
	});

	it("plans a valid update with a pinned digest", async () => {
		const { installation, runner } = await createInstallation({
			installedVersion: "1.1.5",
		});
		try {
			const fetch = fakeFetch();
			const plan = await buildUpdatePlan(
				basePlanOptions(runner, installation, stateDir, fetch.impl, {
					mode: "dry-run",
				}),
			);
			expect(plan.updateAvailable).toBe(true);
			expect(plan.canProceed).toBe(true);
			expect(plan.digest).toBe(manifestDigest(manifestBody()));
			expect(plan.reference).toContain(`@${plan.digest}`);
			expect(plan.migrations?.status).toBe("unknown");
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("blocks the update when free disk space is insufficient", async () => {
		const { installation, runner } = await createInstallation({
			installedVersion: "1.1.5",
		});
		try {
			const plan = await buildUpdatePlan(
				basePlanOptions(runner, installation, stateDir, fakeFetch().impl, {
					mode: "dry-run",
					statfs: SMALL_FS,
				}),
			);
			expect(plan.canProceed).toBe(false);
			expect(plan.blockers.join(" ")).toContain("Free");
		} finally {
			removeTempDir(installation.configDir);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* Backup verification                                                         */
/* -------------------------------------------------------------------------- */

describe("database backups", () => {
	it("accepts a PostgreSQL custom-format dump and rejects anything else", () => {
		const valid = path.join(stateDir, "valid.dump");
		fs.writeFileSync(valid, `PGDMP${"y".repeat(64)}`);
		expect(verifyDatabaseBackup(valid).valid).toBe(true);

		const invalid = path.join(stateDir, "invalid.dump");
		fs.writeFileSync(invalid, "this is not a PostgreSQL dump");
		const result = verifyDatabaseBackup(invalid);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("custom-format");

		expect(
			verifyDatabaseBackup(path.join(stateDir, "missing.dump")).valid,
		).toBe(false);
	});

	it("aborts before pulling when the backup cannot be verified", async () => {
		const { installation, runner } = await createInstallation({
			installedVersion: "1.1.5",
		});
		try {
			const fetch = fakeFetch();
			const plan = await buildUpdatePlan(
				basePlanOptions(runner, installation, stateDir, fetch.impl),
			);
			const broken = new FakeRunner(
				dockerHandler({ installedVersion: "1.1.5" }),
				"not-a-dump",
			);
			await expect(
				executeCloudUpdate({
					plan,
					runner: broken,
					installation,
					stateDir,
					fetchImpl: fetch.impl,
					env: {},
					now: () => new Date("2026-10-24T12:00:00.000Z"),
				}),
			).rejects.toBeInstanceOf(UpdateFailure);
			expect(broken.calls.some((call) => call.args[0] === "pull")).toBe(false);
			const latest = OperationJournal.latest(stateDir);
			expect(latest?.status).toBe("failed");
			expect(latest?.steps.find((step) => step.name === "backup")?.status).toBe(
				"failed",
			);
		} finally {
			removeTempDir(installation.configDir);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* Update execution                                                            */
/* -------------------------------------------------------------------------- */

async function preparedUpdate() {
	const { installation, runner } = await createInstallation({
		installedVersion: "1.1.5",
	});
	const fetch = fakeFetch();
	const plan = await buildUpdatePlan(
		basePlanOptions(runner, installation, stateDir, fetch.impl),
	);
	return { installation, runner, fetch, plan };
}

describe("Cloud update execution", () => {
	it("runs the deterministic update and reports success", async () => {
		const { installation, runner, fetch, plan } = await preparedUpdate();
		try {
			const outcome = await executeCloudUpdate({
				plan,
				runner,
				installation,
				stateDir,
				fetchImpl: fetch.impl,
				env: {},
				now: () => new Date("2026-10-24T12:00:00.000Z"),
			});
			expect(outcome.status).toBe("succeeded");
			expect(outcome.toVersion).toBe("1.2.0");
			expect(outcome.backupPath).toBeTruthy();
			expect(fs.existsSync(outcome.backupPath as string)).toBe(true);

			const updateCall = runner.find(
				(call) => call.args[0] === "service" && call.args[1] === "update",
			);
			expect(updateCall?.args).toContain(`RELEASE_TAG=${TARGET_TAG}`);
			expect(updateCall?.args).toContain(plan.reference);

			const journal = OperationJournal.latest(stateDir);
			expect(journal?.status).toBe("succeeded");
			expect(
				journal?.steps.every((step) =>
					["succeeded", "skipped"].includes(step.status),
				),
			).toBe(true);
			expect(assessLock(stateDir).lock).toBeNull();
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("fails at the download step without touching the service", async () => {
		const { installation, runner, fetch, plan } = await preparedUpdate();
		const failing = new FakeRunner((command, args) => {
			const joined = `${command} ${args.join(" ")}`;
			if (args[0] === "pull") {
				return { code: 1, stdout: "", stderr: "denied" };
			}
			return (
				dockerHandler({ installedVersion: "1.1.5" })(command, args) ??
				(joined.includes("image inspect")
					? { code: 1, stdout: "", stderr: "none" }
					: undefined)
			);
		});
		try {
			await expect(
				executeCloudUpdate({
					plan,
					runner: failing,
					installation,
					stateDir,
					fetchImpl: fetch.impl,
					env: {},
				}),
			).rejects.toBeInstanceOf(UpdateFailure);
			expect(
				failing.calls.some(
					(call) => call.args[0] === "service" && call.args[1] === "update",
				),
			).toBe(false);
			const latest = OperationJournal.latest(stateDir);
			expect(latest?.status).toBe("failed");
			expect(latest?.steps.find((step) => step.name === "pull")?.status).toBe(
				"failed",
			);
			expect(assessLock(stateDir).lock).toBeNull();
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("refuses when cosign is unavailable and allows an explicit waiver", async () => {
		const { installation, runner, fetch, plan } = await preparedUpdate();
		const docker = dockerHandler({ installedVersion: "1.1.5" });
		const noCosign = new FakeRunner((command, args) => {
			if (command === "cosign") {
				return { code: 127, stdout: "", stderr: "cosign: not found" };
			}
			return docker(command, args);
		});
		try {
			await expect(
				executeCloudUpdate({
					plan,
					runner: noCosign,
					installation,
					stateDir,
					fetchImpl: fetch.impl,
					env: {},
				}),
			).rejects.toMatchObject({ outcome: { status: "failed" } });
			expect(
				noCosign.calls.some(
					(call) => call.args[0] === "service" && call.args[1] === "update",
				),
			).toBe(false);

			const waived = await executeCloudUpdate({
				plan,
				runner: noCosign,
				installation,
				stateDir,
				fetchImpl: fetch.impl,
				env: {},
				allowUnsignedArtifact: true,
			});
			expect(waived.status).toBe("succeeded");
			const journal = OperationJournal.latest(stateDir);
			const verify = journal?.steps.find(
				(step) => step.name === "verify-artifact",
			);
			expect(verify?.detail).toContain("explicitly allowed");
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("fails when Swarm reports a rollback during convergence", async () => {
		const { installation, runner, fetch, plan } = await preparedUpdate();
		const docker = dockerHandler({ installedVersion: "1.1.5" });
		const rollingBack = new FakeRunner((command, args) => {
			if (
				args.includes(
					"{{.UpdateStatus.State}}|{{.Spec.Mode.Replicated.Replicas}}",
				)
			) {
				return { code: 0, stdout: "rollback_started|1\n", stderr: "" };
			}
			return docker(command, args);
		});
		try {
			await expect(
				executeCloudUpdate({
					plan,
					runner: rollingBack,
					installation,
					stateDir,
					fetchImpl: fetch.impl,
					env: {},
					waitTimeoutMs: 100,
				}),
			).rejects.toBeInstanceOf(UpdateFailure);
			const latest = OperationJournal.latest(stateDir);
			expect(
				latest?.steps.find((step) => step.name === "converge")?.status,
			).toBe("failed");
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("fails when the service never restarts", async () => {
		const { installation, runner, fetch, plan } = await preparedUpdate();
		const docker = dockerHandler({ installedVersion: "1.1.5" });
		const notRunning = new FakeRunner((command, args) => {
			if (args[0] === "service" && args[1] === "ps" && args[2] === "notploy") {
				return { code: 0, stdout: "Starting 1 second ago\n", stderr: "" };
			}
			return docker(command, args);
		});
		try {
			await expect(
				executeCloudUpdate({
					plan,
					runner: notRunning,
					installation,
					stateDir,
					fetchImpl: fetch.impl,
					env: {},
					waitTimeoutMs: 30,
					sleepImpl: async () => {},
				}),
			).rejects.toBeInstanceOf(UpdateFailure);
			const latest = OperationJournal.latest(stateDir);
			expect(
				latest?.steps.find((step) => step.name === "converge")?.status,
			).toBe("failed");
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("fails a negative post-update health check", async () => {
		const { installation, runner } = await createInstallation({
			installedVersion: "1.1.5",
		});
		const fetch = fakeFetch({ healthStatus: 500 });
		try {
			const plan = await buildUpdatePlan(
				basePlanOptions(runner, installation, stateDir, fetch.impl),
			);
			await expect(
				executeCloudUpdate({
					plan,
					runner,
					installation,
					stateDir,
					fetchImpl: fetch.impl,
					env: {},
					healthTimeoutMs: 1,
				}),
			).rejects.toBeInstanceOf(UpdateFailure);
			const latest = OperationJournal.latest(stateDir);
			expect(latest?.steps.find((step) => step.name === "health")?.status).toBe(
				"failed",
			);
			expect(latest?.error).toContain("Health check");
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("refuses a concurrent maintenance operation", async () => {
		const { installation, runner, fetch, plan } = await preparedUpdate();
		acquireLock(stateDir, {
			operation: "test",
			pid: process.pid,
			host: os.hostname(),
		});
		try {
			await expect(
				executeCloudUpdate({
					plan,
					runner,
					installation,
					stateDir,
					fetchImpl: fetch.impl,
					env: {},
				}),
			).rejects.toMatchObject({ outcome: { status: "failed" } });
			const latest = OperationJournal.latest(stateDir);
			expect(latest?.error).toContain("already running");
		} finally {
			releaseLock(stateDir, { pid: process.pid, host: os.hostname() });
			removeTempDir(installation.configDir);
		}
	});

	it("rejects an update plan with blocking preconditions", async () => {
		const { installation, runner, fetch, plan } = await preparedUpdate();
		try {
			await expect(
				executeCloudUpdate({
					plan: { ...plan, canProceed: false, blockers: ["disk full"] },
					runner,
					installation,
					stateDir,
					fetchImpl: fetch.impl,
					env: {},
				}),
			).rejects.toMatchObject({ code: 2 });
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("masks database credentials in errors and journals", () => {
		const text =
			"failed: postgres://notploy:super-secret@notploy-postgres:5432/notploy";
		expect(redactSecrets(text)).not.toContain("super-secret");
		expect(redactSecrets(text)).toContain("[REDACTED]");
	});
});

/* -------------------------------------------------------------------------- */
/* Journal, locks and interruption                                             */
/* -------------------------------------------------------------------------- */

describe("journal and lock", () => {
	it("reports and clears a stale lock only with force", () => {
		acquireLock(stateDir, {
			operation: "old",
			pid: 999_999,
			host: os.hostname(),
			now: () => new Date("2026-01-01T00:00:00Z"),
		});
		const assessment = assessLock(stateDir);
		expect(assessment.stale).toBe(true);
		expect(() =>
			acquireLock(stateDir, { operation: "new", force: false }),
		).toThrowError(/stale/i);
		expect(() =>
			acquireLock(stateDir, { operation: "new", force: true }),
		).not.toThrow();
		releaseLock(stateDir);
	});

	it("marks an interrupted operation and releases the lock hook", () => {
		const journal = OperationJournal.create(stateDir, {
			kind: "update",
			fromVersion: "1.1.5",
			toVersion: "1.2.0",
			toTag: TARGET_TAG,
			toDigest: null,
			steps: ["backup", "switch"],
			env: {},
		});
		journal.stepStarted("backup");
		setInterruptHandler(() => {
			journal.markRunningStepsFailed("interrupted");
			journal.finish("interrupted", "interrupted by SIGINT");
		});
		runInterruptHandler();
		const latest = OperationJournal.latest(stateDir);
		expect(latest?.status).toBe("interrupted");
		expect(latest?.steps.find((step) => step.name === "backup")?.status).toBe(
			"failed",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* Rollback                                                                    */
/* -------------------------------------------------------------------------- */

function journalSuccessfulUpdate(options: {
	before: number | null;
	after: number | null;
	toVersion?: string;
}) {
	const journal = OperationJournal.create(stateDir, {
		kind: "update",
		fromVersion: "1.1.5",
		toVersion: options.toVersion ?? "1.2.0",
		toTag: TARGET_TAG,
		toDigest: manifestDigest(manifestBody()),
		previousImage: `ghcr.io/skygenesisenterprise/notploy-cloud:${CURRENT_TAG}`,
		previousTag: CURRENT_TAG,
		steps: ["preflight"],
		env: {},
	});
	journal.setBackup(path.join(stateDir, "fake.dump"));
	journal.setMigrationCounts(options.before, options.after);
	journal.stepStarted("preflight");
	journal.stepFinished("preflight", "succeeded");
	journal.finish("succeeded");
}

describe("rollback assessment", () => {
	it("refuses an image rollback after migrations were applied", async () => {
		const { installation } = await createInstallation({
			installedVersion: "1.2.0",
		});
		try {
			journalSuccessfulUpdate({ before: 10, after: 12 });
			const plan = planCloudRollback({ installation, stateDir });
			expect(plan.possible).toBe(false);
			expect(plan.reason).toContain("migration");
			expect(plan.manualRestore.join(" ")).toContain("pg_restore");
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("refuses when migration counts are unknown", async () => {
		const { installation } = await createInstallation({
			installedVersion: "1.2.0",
		});
		try {
			journalSuccessfulUpdate({ before: null, after: null });
			const plan = planCloudRollback({ installation, stateDir });
			expect(plan.possible).toBe(false);
			expect(plan.reason).toContain("unknown");
		} finally {
			removeTempDir(installation.configDir);
		}
	});

	it("allows an image rollback when no migrations were applied", async () => {
		const { installation, runner } = await createInstallation({
			installedVersion: "1.2.0",
		});
		try {
			journalSuccessfulUpdate({ before: 10, after: 10 });
			const plan = planCloudRollback({ installation, stateDir });
			expect(plan.possible).toBe(true);
			expect(plan.previousVersion).toBe("1.1.5");
			expect(plan.previousImage).toContain(CURRENT_TAG);

			await expect(
				executeCloudRollback({
					installation,
					plan,
					runner,
					confirmVersion: "1.0.0",
					stateDir,
					env: {},
				}),
			).rejects.toMatchObject({ code: 2 });
		} finally {
			removeTempDir(installation.configDir);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* Plan serialization                                                          */
/* -------------------------------------------------------------------------- */

describe("plan output", () => {
	it("serializes without credentials or raw docker state", async () => {
		const { installation, runner, configDir } = await createInstallation({
			installedVersion: "1.1.5",
		});
		try {
			const plan: UpdatePlan = await buildUpdatePlan(
				basePlanOptions(runner, installation, stateDir, fakeFetch().impl, {
					mode: "check",
				}),
			);
			const json = JSON.stringify(plan);
			expect(json).not.toContain("super-secret");
			expect(json).not.toContain("DATABASE_URL");
			expect(json).not.toContain(os.hostname());
		} finally {
			removeTempDir(configDir);
		}
	});
});
