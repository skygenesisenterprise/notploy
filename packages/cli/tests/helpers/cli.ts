import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..", "..");
export const CLI = path.join(ROOT, "dist", "index.js");

export interface RunResult {
	code: number;
	stdout: string;
	stderr: string;
}

export interface RunOptions {
	env?: Record<string, string | undefined>;
	cwd?: string;
	configDir?: string;
	timeoutMs?: number;
}

export function createTempDir(prefix = "notploy-cli-"): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeTempDir(dir: string): void {
	fs.rmSync(dir, { recursive: true, force: true });
}

function isolatedEnv(
	configDir: string,
	overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...process.env };
	for (const key of Object.keys(env)) {
		if (
			key.startsWith("NOTPLOY_") ||
			key === "CI" ||
			key === "NO_COLOR" ||
			key === "FORCE_COLOR"
		) {
			delete env[key];
		}
	}
	Object.assign(env, {
		CI: "true",
		NO_COLOR: "1",
		NOTPLOY_NO_DOTENV: "1",
		NOTPLOY_CONFIG_DIR: configDir,
		...overrides,
	});
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) delete env[key];
	}
	return env;
}

/**
 * Runs the built CLI in a child process with an isolated config directory.
 */
export async function runCli(
	args: string[],
	options: RunOptions = {},
): Promise<RunResult> {
	const ownsConfigDir = options.configDir === undefined;
	const configDir = options.configDir ?? createTempDir();
	const env = isolatedEnv(configDir, options.env);

	try {
		return await new Promise<RunResult>((resolve, reject) => {
			const child = spawn(process.execPath, [CLI, ...args], {
				cwd: options.cwd ?? ROOT,
				env,
				stdio: ["ignore", "pipe", "pipe"],
			});
			let stdout = "";
			let stderr = "";
			child.stdout.setEncoding("utf8");
			child.stderr.setEncoding("utf8");
			child.stdout.on("data", (chunk) => {
				stdout += chunk;
			});
			child.stderr.on("data", (chunk) => {
				stderr += chunk;
			});
			const timeout = setTimeout(() => {
				child.kill("SIGKILL");
			}, options.timeoutMs ?? 15_000);
			child.on("error", (error) => {
				clearTimeout(timeout);
				reject(error);
			});
			child.on("close", (code) => {
				clearTimeout(timeout);
				resolve({ code: code ?? -1, stdout, stderr });
			});
		});
	} finally {
		if (ownsConfigDir) removeTempDir(configDir);
	}
}

export function parseJson<T = unknown>(result: RunResult): T {
	return JSON.parse(result.stdout) as T;
}
