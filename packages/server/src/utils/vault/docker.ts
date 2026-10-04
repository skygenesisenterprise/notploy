import type { dockerVaultConfigSchema } from "@notploy/server/db/schema";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { z } from "zod";
import type { VaultClient } from "./types";

type DockerConfig = z.infer<typeof dockerVaultConfigSchema>;

const mountPath = (config: DockerConfig) => resolve(config.mountPath);

const secretFile = (config: DockerConfig, ref: string) => {
	if (!/^[A-Za-z0-9._-]+$/.test(ref) || ref.includes("..")) {
		throw new Error(`Docker secrets: invalid secret name "${ref}"`);
	}
	const mount = mountPath(config);
	const target = resolve(join(mount, ref));
	if (target !== mount && !target.startsWith(`${mount}${sep}`)) {
		throw new Error(`Docker secrets: "${ref}" escapes the mount path`);
	}
	return target;
};

const listFiles = async (config: DockerConfig) => {
	const mount = mountPath(config);
	try {
		const entries = await readdir(mount, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile() && !entry.name.startsWith("."))
			.map((entry) => entry.name)
			.sort();
	} catch (error) {
		throw new Error(
			`Docker secrets: cannot read "${mount}" (${error instanceof Error ? error.message : "unknown error"})`,
		);
	}
};

/**
 * Reads Docker/Swarm secrets (or any directory of secret files, such as a
 * bind-mounted folder of Docker configs) directly from the agent filesystem.
 */
export const dockerClient: VaultClient<DockerConfig> = {
	async getSecrets(config, refs) {
		const result: Record<string, string> = {};
		for (const ref of refs) {
			const file = secretFile(config, ref);
			let content: string;
			try {
				content = await readFile(file, "utf8");
			} catch {
				throw new Error(
					`Docker secrets: secret "${ref}" not found in ${config.mountPath}`,
				);
			}
			// Docker stores the raw bytes of the secret; only a trailing newline
			// introduced by common `echo secret > file` flows is dropped.
			result[ref] = content.replace(/\r?\n$/, "");
		}
		return result;
	},

	async testConnection(config) {
		await listFiles(config);
	},

	async listSecretNames(config) {
		return await listFiles(config);
	},
};
