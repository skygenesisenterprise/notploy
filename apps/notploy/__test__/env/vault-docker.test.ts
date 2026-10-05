import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ping = vi.fn();
const listSecrets = vi.fn();
const listConfigs = vi.fn();

vi.mock("@notploy/server/constants", () => ({
	docker: {
		ping: (...args: unknown[]) => ping(...args),
		listSecrets: (...args: unknown[]) => listSecrets(...args),
		listConfigs: (...args: unknown[]) => listConfigs(...args),
	},
}));

import { dockerClient } from "@notploy/server/utils/vault/docker";

let mountPath: string;

const config = () => ({ providerType: "docker" as const, mountPath });

beforeEach(async () => {
	ping.mockReset().mockResolvedValue("OK");
	listSecrets.mockReset().mockResolvedValue([]);
	listConfigs.mockReset().mockResolvedValue([]);
	mountPath = await mkdtemp(join(tmpdir(), "notploy-docker-vault-"));
});

afterEach(async () => {
	await rm(mountPath, { recursive: true, force: true });
});

describe("docker vault client", () => {
	it("passes the connection test when the daemon and mount are reachable", async () => {
		await writeFile(join(mountPath, "db_password"), "s3cret\n");

		await expect(dockerClient.testConnection(config())).resolves.toBeUndefined();
		expect(ping).toHaveBeenCalledTimes(1);
	});

	it("fails with an actionable error when the Docker daemon is unreachable", async () => {
		ping.mockRejectedValue(new Error("connect ENOENT /var/run/docker.sock"));

		await expect(dockerClient.testConnection(config())).rejects.toThrow(
			/Docker daemon is unreachable/,
		);
	});

	it("passes the connection test when the mount is missing but the daemon is reachable", async () => {
		await expect(
			dockerClient.testConnection({
				providerType: "docker",
				mountPath: join(mountPath, "does-not-exist"),
			}),
		).resolves.toBeUndefined();
	});

	it("falls back to the cluster's secret names when the mount is missing", async () => {
		listSecrets.mockResolvedValue([{ Spec: { Name: "cluster_token" } }]);

		const names = await dockerClient.listSecretNames?.({
			providerType: "docker",
			mountPath: join(mountPath, "does-not-exist"),
		});

		expect(names).toEqual(["cluster_token"]);
	});

	it("returns no names when neither the directory nor the cluster expose secrets", async () => {
		const names = await dockerClient.listSecretNames?.({
			providerType: "docker",
			mountPath: join(mountPath, "does-not-exist"),
		});

		expect(names).toEqual([]);
	});

	it("reports the mount problem when a value is resolved without the directory", async () => {
		await expect(
			dockerClient.getSecrets(
				{ providerType: "docker", mountPath: join(mountPath, "does-not-exist") },
				["db_password"],
			),
		).rejects.toThrow(/cannot read/);
	});

	it("reads a mounted secret and drops the trailing newline", async () => {
		await writeFile(join(mountPath, "db_password"), "s3cret\n");

		await expect(
			dockerClient.getSecrets(config(), ["db_password"]),
		).resolves.toEqual({ db_password: "s3cret" });
	});

	it("rejects a secret name that escapes the mount path", async () => {
		await expect(
			dockerClient.getSecrets(config(), ["../evil"]),
		).rejects.toThrow(/invalid secret name/);
	});

	it("explains when a Swarm secret exists but is not mounted", async () => {
		listSecrets.mockResolvedValue([{ Spec: { Name: "cluster_token" } }]);

		await expect(
			dockerClient.getSecrets(config(), ["cluster_token"]),
		).rejects.toThrow(/exists in the Swarm but is not mounted/);
	});

	it("lists mounted files together with the cluster's secret names", async () => {
		await writeFile(join(mountPath, "local"), "x");
		listSecrets.mockResolvedValue([{ Spec: { Name: "shared" } }, { Spec: {} }]);
		listConfigs.mockResolvedValue([{ Spec: { Name: "app_config" } }]);

		const names = await dockerClient.listSecretNames?.(config());

		expect(names).toEqual(["app_config", "local", "shared"]);
	});
});
