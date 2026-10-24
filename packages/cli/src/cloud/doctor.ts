import * as fs from "node:fs";
import * as path from "node:path";
import { ExitCode } from "../errors.js";
import type { CommandRunner } from "./docker.js";
import { Docker } from "./docker.js";
import type { Installation } from "./environment.js";
import { configDirWritable } from "./environment.js";
import {
	assessLock,
	findUnfinishedOperation,
	getCloudStateDir,
	OperationJournal,
	type OperationRecord,
} from "./journal.js";
import {
	checkDiskSpace,
	findPostgresContainer,
	listDatabaseBackups,
	type StatFs,
	verifyDatabaseBackup,
} from "./preflight.js";
import { resolveImageManifest } from "./registry.js";
import {
	checkCloudCompatibility,
	type FetchLike,
	fetchCloudReleases,
	normalizeCloudVersion,
	parseCloudReleaseTag,
	resolveCloudTarget,
} from "./release.js";

export type CheckStatus = "ok" | "warn" | "fail";

export interface CloudCheck {
	id: string;
	status: CheckStatus;
	message: string;
	hint?: string;
}

export interface CloudStatusReport {
	cliVersion: string;
	detected: boolean;
	product: string;
	deployment: string;
	configDir: string;
	configDirWritable: boolean;
	healthUrl: string;
	image: string | null;
	installedVersion: string | null;
	releaseTag: string | null;
	services: Installation["services"];
	identity: Installation["identity"];
	capabilities: Installation["capabilities"];
	issues: string[];
	disk: {
		path: string;
		freeBytes: number;
		ok: boolean;
	};
	lock: {
		active: boolean;
		stale: boolean;
		detail: string | null;
	};
	lastOperation: OperationRecord | null;
	latestRelease: {
		tag: string;
		version: string;
		releaseUrl: string | null;
		publishedAt: string | null;
	} | null;
	updateAvailable: boolean | null;
	updateCheckError: string | null;
	checkedAt: string;
}

export interface CloudStatusOptions {
	installation: Installation;
	runner: CommandRunner;
	cliVersion: string;
	env?: NodeJS.ProcessEnv;
	stateDir?: string;
	check?: boolean;
	fetchImpl?: FetchLike;
	statfs?: StatFs;
	now?: () => Date;
}

export async function getCloudStatus(
	options: CloudStatusOptions,
): Promise<CloudStatusReport> {
	const env = options.env ?? process.env;
	const stateDir = options.stateDir ?? getCloudStateDir(env);
	const now = options.now ?? (() => new Date());
	const installation = options.installation;

	let latestRelease: CloudStatusReport["latestRelease"] = null;
	let updateAvailable: boolean | null = null;
	let updateCheckError: string | null = null;

	if (options.check && installation.detected) {
		try {
			const releases = await fetchCloudReleases({
				fetchImpl: options.fetchImpl,
				env,
			});
			const newest = releases[0] ?? null;
			if (newest) {
				latestRelease = {
					tag: newest.tag,
					version: newest.version,
					releaseUrl: newest.releaseUrl,
					publishedAt: newest.publishedAt,
				};
			}
			const resolved = resolveCloudTarget({
				currentVersion: installation.installedVersion,
				releases,
			});
			updateAvailable = resolved.release !== null;
		} catch (error) {
			updateCheckError = error instanceof Error ? error.message : String(error);
		}
	}

	const lock = assessLock(stateDir, { now: now().getTime() });
	const lastOperation = OperationJournal.latest(stateDir);
	const disk = checkDiskSpace({ path: stateDir, statfs: options.statfs });

	return {
		cliVersion: options.cliVersion,
		detected: installation.detected,
		product: installation.product,
		deployment: installation.deployment,
		configDir: installation.configDir,
		configDirWritable: configDirWritable(installation.configDir),
		healthUrl: installation.healthUrl,
		image: installation.image,
		installedVersion: installation.installedVersion,
		releaseTag: installation.releaseTag,
		services: installation.services,
		identity: installation.identity,
		capabilities: installation.capabilities,
		issues: installation.issues,
		disk: {
			path: disk.path,
			freeBytes: disk.freeBytes,
			ok: disk.ok,
		},
		lock: {
			active: Boolean(lock.lock && !lock.stale),
			stale: Boolean(lock.lock && lock.stale),
			detail: lock.lock
				? `pid ${lock.lock.pid} on ${lock.lock.host}, started ${lock.lock.startedAt}`
				: null,
		},
		lastOperation,
		latestRelease,
		updateAvailable,
		updateCheckError,
		checkedAt: now().toISOString(),
	};
}

export interface CloudDoctorOptions {
	installation: Installation;
	runner: CommandRunner;
	cliVersion: string;
	env?: NodeJS.ProcessEnv;
	stateDir?: string;
	offline?: boolean;
	fetchImpl?: FetchLike;
	statfs?: StatFs;
	now?: () => Date;
	probeHealth?: (
		url: string,
	) => Promise<{ ok: boolean; status: number | null; message?: string }>;
}

export interface CloudDoctorReport {
	ok: boolean;
	exitCode: number;
	cliVersion: string;
	product: string;
	deployment: string;
	installedVersion: string | null;
	checks: CloudCheck[];
}

function permissionMode(file: string): number | null {
	try {
		return fs.statSync(file).mode & 0o777;
	} catch {
		return null;
	}
}

function checkConfigPermissions(configDir: string): CloudCheck[] {
	const checks: CloudCheck[] = [];
	const dirMode = permissionMode(configDir);
	if (dirMode === null) {
		checks.push({
			id: "config-permissions",
			status: "fail",
			message: `The installation directory ${configDir} is not readable by this account.`,
			hint: "Run the command as root or as the account that owns the installation.",
		});
		return checks;
	}
	if ((dirMode & 0o007) !== 0) {
		checks.push({
			id: "config-permissions",
			status: "fail",
			message: `${configDir} is accessible by other users (mode ${dirMode.toString(8)}). It contains instance private keys.`,
			hint: `Set the mode back to 700 (or 750 with NOTPLOY_CONFIG_GROUP): chmod 700 ${configDir}`,
		});
	} else {
		checks.push({
			id: "config-permissions",
			status: "ok",
			message: `${configDir} mode ${dirMode.toString(8)}.`,
		});
	}

	for (const name of ["instance.key", "ca.key"]) {
		const file = path.join(configDir, "identity", name);
		const mode = permissionMode(file);
		if (mode === null) continue;
		if ((mode & 0o077) !== 0) {
			checks.push({
				id: "identity-key-permissions",
				status: "fail",
				message: `${file} is accessible by group or other users (mode ${mode.toString(8)}).`,
				hint: `chmod 600 ${file}`,
			});
		}
	}
	return checks;
}

async function dockerCliAvailable(runner: CommandRunner): Promise<CloudCheck> {
	let result: Awaited<ReturnType<CommandRunner["run"]>>;
	try {
		result = await runner.run("docker", ["--version"], {
			allowFailure: true,
			timeoutMs: 10_000,
		});
	} catch (error) {
		return {
			id: "docker-cli",
			status: "fail",
			message:
				error instanceof Error
					? error.message
					: "The Docker CLI is not available.",
			hint: "Install Docker Engine on the Cloud host.",
		};
	}
	return result.code === 0
		? {
				id: "docker-cli",
				status: "ok",
				message: result.stdout.trim(),
			}
		: {
				id: "docker-cli",
				status: "fail",
				message: "The Docker CLI is not available.",
				hint: "Install Docker Engine on the Cloud host.",
			};
}

export async function runCloudDoctor(
	options: CloudDoctorOptions,
): Promise<CloudDoctorReport> {
	const env = options.env ?? process.env;
	const stateDir = options.stateDir ?? getCloudStateDir(env);
	const installation = options.installation;
	const now = options.now ?? (() => new Date());
	const checks: CloudCheck[] = [];

	checks.push(await dockerCliAvailable(options.runner));

	checks.push(
		installation.docker.available
			? {
					id: "docker-daemon",
					status: "ok",
					message: `Docker ${installation.docker.serverVersion ?? "(version unknown)"}${
						installation.docker.useSudo ? ", via sudo -n" : ""
					}.`,
				}
			: {
					id: "docker-daemon",
					status: "fail",
					message:
						installation.docker.error ?? "The Docker daemon is not reachable.",
					hint: "Start Docker, or grant this account access to /var/run/docker.sock. The CLI never requires root by default.",
				},
	);

	checks.push(
		installation.detected
			? {
					id: "installation",
					status: "ok",
					message: `Detected a ${installation.deployment} installation at ${installation.configDir}.`,
				}
			: {
					id: "installation",
					status: "fail",
					message:
						installation.issues[0] ??
						"No Notploy installation was detected on this host.",
					hint: "Run the command on the Cloud host, or check the Docker context.",
				},
	);

	checks.push(
		installation.product === "cloud"
			? {
					id: "product",
					status: "ok",
					message: "The installation identifies as Notploy Cloud.",
				}
			: {
					id: "product",
					status: installation.detected ? "fail" : "warn",
					message: `The detected product is '${installation.product}', not Cloud.`,
					hint: "Cloud administration commands only mutate Cloud installations.",
				},
	);

	checks.push(
		installation.deployment === "swarm"
			? {
					id: "deployment",
					status: "ok",
					message:
						"Docker Swarm deployment (the mode supported by install.sh).",
				}
			: {
					id: "deployment",
					status: installation.detected ? "warn" : "fail",
					message: `Deployment mode: ${installation.deployment}.`,
					hint:
						installation.deployment === "compose"
							? "Compose stacks are reported read-only; update them with 'docker compose'."
							: undefined,
				},
	);

	checks.push(
		installation.installedVersion
			? {
					id: "version",
					status: "ok",
					message: `Installed Cloud ${installation.installedVersion} (release tag: ${installation.releaseTag ?? "unknown"}).`,
				}
			: {
					id: "version",
					status: "fail",
					message: "The installed Cloud version cannot be determined.",
					hint: "Check RELEASE_TAG on the 'notploy' service and the image tag.",
				},
	);

	checks.push(
		installation.identity.present
			? {
					id: "identity",
					status: "ok",
					message: `Instance identity ${installation.identity.instanceId ?? "(id unavailable)"} at ${installation.identity.path}.`,
				}
			: {
					id: "identity",
					status: "fail",
					message: "The instance identity is missing.",
					hint: "Re-run the installer's identity bootstrap; do not regenerate it casually, dependent services trust it.",
				},
	);
	if (installation.identity.issue) {
		checks.push({
			id: "identity-integrity",
			status: "warn",
			message: installation.identity.issue,
		});
	}

	checks.push(...checkConfigPermissions(installation.configDir));

	if (installation.detected && installation.deployment === "swarm") {
		const notploy = installation.services.find(
			(service) => service.name === "notploy",
		);
		checks.push(
			notploy?.healthy
				? {
						id: "service-notploy",
						status: "ok",
						message: `${notploy.runningReplicas}/${notploy.desiredReplicas} replicas running.`,
					}
				: {
						id: "service-notploy",
						status: "fail",
						message: notploy
							? `The 'notploy' service is not healthy (${notploy.runningReplicas ?? "?"}/${notploy.desiredReplicas ?? "?"} running${notploy.state ? `, update state ${notploy.state}` : ""}).`
							: "The 'notploy' service was not found.",
						hint: "Inspect 'docker service ps notploy --no-trunc' and 'docker service logs notploy'.",
					},
		);

		const postgres = installation.services.find(
			(service) => service.name === "notploy-postgres",
		);
		checks.push(
			postgres?.healthy
				? {
						id: "service-postgres",
						status: "ok",
						message: `${postgres.runningReplicas}/${postgres.desiredReplicas} replicas running.`,
					}
				: {
						id: "service-postgres",
						status: "fail",
						message: "The PostgreSQL service is missing or not running.",
						hint: "Without PostgreSQL, updates and backups are refused.",
					},
		);

		const traefik = installation.services.find(
			(service) => service.name === "notploy-traefik",
		);
		checks.push(
			traefik?.healthy
				? {
						id: "service-traefik",
						status: "ok",
						message: "Traefik is running.",
					}
				: {
						id: "service-traefik",
						status: "warn",
						message: "The 'notploy-traefik' container is not running.",
						hint: "Published applications may be unreachable. Restarting Traefik is independent from updating Notploy.",
					},
		);
	}

	if (options.offline) {
		checks.push({
			id: "release-source",
			status: "warn",
			message: "Skipped release and registry checks (--offline).",
		});
		checks.push({
			id: "health",
			status: "warn",
			message: "Skipped health probe (--offline).",
		});
	} else {
		try {
			const releases = await fetchCloudReleases({
				fetchImpl: options.fetchImpl,
				env,
			});
			const newest = releases[0] ?? null;
			const target = resolveCloudTarget({
				currentVersion: installation.installedVersion,
				releases,
			});
			if (!newest) {
				checks.push({
					id: "release-source",
					status: "warn",
					message: "No Cloud release is published.",
				});
			} else {
				const compatibility = checkCloudCompatibility({
					currentVersion: installation.installedVersion,
					targetVersion: newest.version,
				});
				const missingAssets = ["install.sh", "install.ps1"].filter(
					(asset) => !newest.assets.includes(asset),
				);
				checks.push({
					id: "release-source",
					status: "ok",
					message: target.release
						? `Cloud ${newest.version} is available (${newest.tag}).`
						: `Cloud ${newest.version} is published; the installation is up to date.`,
				});
				if (missingAssets.length > 0) {
					checks.push({
						id: "release-assets",
						status: "warn",
						message: `The ${newest.tag} release is missing ${missingAssets.join(", ")}.`,
						hint: "The container image may still be usable, but the release publication looks incomplete. Verify before updating.",
					});
				}
				for (const blocker of compatibility.blockers) {
					checks.push({
						id: "compatibility",
						status: "warn",
						message: blocker,
					});
				}

				const digest = await resolveImageManifest(
					`ghcr.io/skygenesisenterprise/notploy-cloud:${newest.tag}`,
					{ fetchImpl: options.fetchImpl, env },
				);
				checks.push({
					id: "artifact",
					status: "ok",
					message: `Image digest ${digest.digest} resolved from the registry${
						digest.sizeBytes
							? ` (${(digest.sizeBytes / 1024 ** 2).toFixed(0)} MiB compressed)`
							: ""
					}.`,
				});
			}
		} catch (error) {
			checks.push({
				id: "release-source",
				status: "warn",
				message: `Could not verify the release source: ${
					error instanceof Error ? error.message : String(error)
				}`,
				hint: "The local installation may still be healthy. Retry when GitHub and the registry are reachable.",
			});
		}

		if (installation.detected) {
			try {
				const probe = options.probeHealth
					? await options.probeHealth(installation.healthUrl)
					: await probeHealthDefault(installation.healthUrl);
				checks.push(
					probe.ok
						? {
								id: "health",
								status: "ok",
								message: `Health endpoint answered (HTTP ${probe.status ?? 200}).`,
							}
						: {
								id: "health",
								status: "fail",
								message:
									probe.message ??
									`Health endpoint answered with HTTP ${probe.status ?? "error"}.`,
								hint: "Inspect 'docker service logs notploy' before starting any update.",
							},
				);
			} catch (error) {
				checks.push({
					id: "health",
					status: "fail",
					message: `Health probe failed: ${
						error instanceof Error ? error.message : String(error)
					}`,
					hint: "The port may not be published on this host.",
				});
			}
		}
	}

	const docker = new Docker(options.runner, installation.docker);
	if (installation.detected && installation.docker.available) {
		const postgres = await findPostgresContainer(docker);
		checks.push(
			postgres
				? {
						id: "backup-capability",
						status: "ok",
						message: `pg_dump can run in container '${postgres.name}'.`,
					}
				: {
						id: "backup-capability",
						status: "fail",
						message:
							"The PostgreSQL container is not reachable for a pre-update backup.",
						hint: "Updates are refused without a verified backup.",
					},
		);

		const backups = listDatabaseBackups(stateDir);
		const usable = backups.filter(
			(backup) => verifyDatabaseBackup(backup.path).valid,
		);
		checks.push(
			backups.length === 0
				? {
						id: "backups",
						status: "warn",
						message: "No CLI-managed database backup exists yet.",
						hint: "A verified backup is created automatically before the first update.",
					}
				: {
						id: "backups",
						status: usable.length === backups.length ? "ok" : "warn",
						message: `${usable.length}/${backups.length} recorded backup(s) are readable; newest ${backups[0]?.createdAt ?? "unknown"}.`,
					},
		);
	}

	const disk = checkDiskSpace({ path: stateDir, statfs: options.statfs });
	checks.push({
		id: "disk",
		status: disk.ok ? "ok" : "fail",
		message: disk.ok
			? `${(disk.freeBytes / 1024 ** 3).toFixed(1)} GiB free at ${disk.path}.`
			: (disk.hint ?? "Insufficient free disk space."),
		hint: disk.hint,
	});

	checks.push(
		configDirWritable(stateDir)
			? {
					id: "state-dir",
					status: "ok",
					message: `${stateDir} is writable for journals and backups.`,
				}
			: {
					id: "state-dir",
					status: "warn",
					message: `${stateDir} is not writable by this account.`,
					hint: "Mutating operations require write access (run with sudo, or set NOTPLOY_CLOUD_STATE_DIR).",
				},
	);

	const lock = assessLock(stateDir, { now: now().getTime() });
	if (lock.lock) {
		checks.push({
			id: "maintenance-lock",
			status: lock.stale ? "warn" : "warn",
			message: lock.stale
				? `A stale maintenance lock exists (${lock.reason}).`
				: `A maintenance operation is running (pid ${lock.lock.pid} since ${lock.lock.startedAt}).`,
			hint: lock.stale
				? "Confirm nothing is running, then pass --force-unlock to the next update."
				: "Wait for it to finish before starting another operation.",
		});
	} else {
		checks.push({
			id: "maintenance-lock",
			status: "ok",
			message: "No maintenance operation is running.",
		});
	}

	const unfinished = findUnfinishedOperation(stateDir);
	if (unfinished) {
		checks.push({
			id: "last-operation",
			status: unfinished.status === "running" ? "fail" : "warn",
			message: `Operation ${unfinished.id} is ${unfinished.status}${
				unfinished.error ? `: ${unfinished.error}` : ""
			}.`,
			hint: `Inspect it with 'notploy cloud logs --operation ${unfinished.id}'. A failed update is not retried automatically.`,
		});
	}

	const criticalFailure = checks.some((check) => check.status === "fail");
	return {
		ok: !criticalFailure,
		exitCode: criticalFailure ? ExitCode.General : ExitCode.Success,
		cliVersion: options.cliVersion,
		product: installation.product,
		deployment: installation.deployment,
		installedVersion: installation.installedVersion,
		checks,
	};
}

async function probeHealthDefault(
	url: string,
): Promise<{ ok: boolean; status: number | null; message?: string }> {
	const response = await fetch(
		`${url.replace(/\/$/, "")}/api/trpc/settings.health`,
		{
			headers: { "User-Agent": "notploy-cli" },
			signal: AbortSignal.timeout(5_000),
		},
	);
	if (!response.ok) {
		return {
			ok: false,
			status: response.status,
			message: `Health endpoint answered with HTTP ${response.status}.`,
		};
	}
	return { ok: true, status: response.status };
}

/**
 * Parses a release tag safely for reporting without throwing.
 */
export function describeReleaseTag(
	tag: string | null,
): { tag: string; version: string } | null {
	if (!tag) return null;
	const parsed = parseCloudReleaseTag(tag);
	if (parsed) return { tag: parsed.tag, version: parsed.version };
	const normalized = normalizeCloudVersion(tag);
	return normalized ? { tag, version: normalized } : null;
}
