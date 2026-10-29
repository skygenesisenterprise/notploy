import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ContainerCreateOptions, CreateServiceOptions } from "dockerode";
import { getGatewayErrorPageConfig } from "../gateway-errors/config";
import { getRemoteDocker } from "../utils/servers/remote-docker";

export const GATEWAY_ERRORS_RESOURCE_NAME = "notploy-gateway-errors";
export const GATEWAY_ERRORS_INTERNAL_PORT = 8080;
export const GATEWAY_ERRORS_NETWORK = "notploy-network";

const DEFAULT_IMAGE = "ghcr.io/skygenesisenterprise/notploy:latest";
const DEFAULT_VERSION_TAG = "latest";

type Docker = Awaited<ReturnType<typeof getRemoteDocker>>;
type TraefikMode = "standalone" | "service";

interface GatewayErrorsCommand {
	entrypoint: string[];
	args: string[];
	workingDir?: string;
}

export interface SetupGatewayErrorsOptions {
	serverId?: string;
	env?: Record<string, string | undefined>;
}

const arraysEqual = (left: string[], right: string[]): boolean =>
	left.length === right.length &&
	left.every((value, index) => value === right[index]);

const toStringArray = (value: string | string[] | undefined): string[] => {
	if (Array.isArray(value)) return value;
	return value ? [value] : [];
};

const hasImageTag = (image: string): boolean => {
	if (image.includes("@")) return true;
	return image.lastIndexOf(":") > image.lastIndexOf("/");
};

const resolveRunningImage = async (
	docker: Docker,
	serverId?: string,
): Promise<string | null> => {
	if (serverId) return null;
	try {
		const container = docker.getContainer(os.hostname());
		const inspect = await container.inspect();
		return inspect.Config?.Image?.trim() || null;
	} catch {
		return null;
	}
};

export const getGatewayErrorsImage = async (
	docker: Docker,
	serverId: string | undefined,
	env: Record<string, string | undefined>,
): Promise<string> => {
	const explicit = env.NOTPLOY_GATEWAY_ERRORS_IMAGE?.trim();
	if (explicit) return explicit;

	const runningImage = await resolveRunningImage(docker, serverId);
	if (runningImage) return runningImage;

	const configuredImage = env.NOTPLOY_IMAGE?.trim();
	if (configuredImage) {
		if (hasImageTag(configuredImage)) return configuredImage;
		const version =
			env.NOTPLOY_VERSION?.trim() ||
			env.NOTPLOY_VERSION_TAG?.trim() ||
			DEFAULT_VERSION_TAG;
		return `${configuredImage}:${version}`;
	}

	return DEFAULT_IMAGE;
};

export const buildGatewayErrorsEnv = (
	env: Record<string, string | undefined> = process.env,
): string[] => {
	const config = getGatewayErrorPageConfig(env);
	const values: Record<string, string> = {
		NOTPLOY_GATEWAY_BRAND_NAME: config.brandName,
		NOTPLOY_GATEWAY_LOCALE: config.locale,
		NOTPLOY_GATEWAY_PORT: String(GATEWAY_ERRORS_INTERNAL_PORT),
		IS_CLOUD: config.isCloud ? "true" : "false",
	};
	if (config.docsUrl) values.NOTPLOY_GATEWAY_DOCS_URL = config.docsUrl;
	if (config.statusUrl) values.NOTPLOY_GATEWAY_STATUS_URL = config.statusUrl;
	if (config.supportUrl) {
		values.NOTPLOY_GATEWAY_SUPPORT_URL = config.supportUrl;
	}
	return Object.entries(values).map(([key, value]) => `${key}=${value}`);
};

const readGatewayErrorsScript = (): string | null => {
	const candidates = [
		process.env.NOTPLOY_GATEWAY_ERRORS_SCRIPT_PATH,
		path.join(process.cwd(), "dist/gateway-errors-server.cjs"),
		path.join(process.cwd(), "apps/notploy/dist/gateway-errors-server.cjs"),
	].filter((candidate): candidate is string => Boolean(candidate));

	for (const candidate of candidates) {
		try {
			if (existsSync(candidate)) return readFileSync(candidate, "utf8");
		} catch {}
	}
	return null;
};

const resolveGatewayErrorsCommand = (
	env: Record<string, string | undefined>,
): GatewayErrorsCommand | null => {
	const customCommand = env.NOTPLOY_GATEWAY_ERRORS_COMMAND?.trim();
	if (customCommand) {
		return {
			entrypoint: ["/bin/sh", "-lc"],
			args: [customCommand],
			workingDir: env.NOTPLOY_GATEWAY_ERRORS_WORKDIR?.trim() || undefined,
		};
	}

	const script = readGatewayErrorsScript();
	if (!script) return null;

	return {
		entrypoint: ["node"],
		args: ["-e", script],
	};
};

const detectTraefikMode = async (docker: Docker): Promise<TraefikMode> => {
	try {
		await docker.getService("notploy-traefik").inspect();
		return "service";
	} catch {
		return "standalone";
	}
};

const ensureImage = async (docker: Docker, image: string): Promise<void> => {
	try {
		await docker.getImage(image).inspect();
		return;
	} catch {}

	await new Promise<void>((resolve, reject) => {
		docker.pull(image, (error: Error | null, stream: NodeJS.ReadableStream) => {
			if (error) {
				reject(error);
				return;
			}
			docker.modem.followProgress(
				stream,
				(progressError: Error | null) => {
					if (progressError) {
						reject(progressError);
						return;
					}
					resolve();
				},
			);
		});
	});
};

const upsertContainer = async (
	docker: Docker,
	image: string,
	command: GatewayErrorsCommand,
	env: string[],
): Promise<void> => {
	try {
		const existing = docker.getContainer(GATEWAY_ERRORS_RESOURCE_NAME);
		const inspect = await existing.inspect();
		const config = inspect.Config;
		const matches =
			config.Image === image &&
			arraysEqual(toStringArray(config.Entrypoint), command.entrypoint) &&
			arraysEqual(config.Cmd ?? [], command.args) &&
			arraysEqual(config.Env ?? [], env) &&
			(config.WorkingDir ?? "") === (command.workingDir ?? "");
		if (matches && inspect.State.Running) return;
		if (matches && !inspect.State.Running) {
			await existing.start();
			return;
		}
		await existing.remove({ force: true });
	} catch {}

	const settings: ContainerCreateOptions = {
		name: GATEWAY_ERRORS_RESOURCE_NAME,
		Image: image,
		Entrypoint: command.entrypoint,
		Cmd: command.args,
		WorkingDir: command.workingDir,
		Env: env,
		Labels: {
			"traefik.enable": "false",
			"notploy.gateway-errors": "true",
		},
		NetworkingConfig: {
			EndpointsConfig: {
				[GATEWAY_ERRORS_NETWORK]: {},
			},
		},
		HostConfig: {
			RestartPolicy: {
				Name: "always",
			},
		},
	};

	await docker.createContainer(settings);
	await docker.getContainer(GATEWAY_ERRORS_RESOURCE_NAME).start();
};

const upsertService = async (
	docker: Docker,
	image: string,
	command: GatewayErrorsCommand,
	env: string[],
): Promise<void> => {
	const settings: CreateServiceOptions = {
		Name: GATEWAY_ERRORS_RESOURCE_NAME,
		Labels: {
			"notploy.gateway-errors": "true",
		},
		TaskTemplate: {
			ContainerSpec: {
				Image: image,
				Command: command.entrypoint,
				Args: command.args,
				Dir: command.workingDir,
				Env: env,
			},
			Networks: [{ Target: GATEWAY_ERRORS_NETWORK }],
		},
		Mode: {
			Replicated: {
				Replicas: 1,
			},
		},
	};

	try {
		const service = docker.getService(GATEWAY_ERRORS_RESOURCE_NAME);
		const inspect = await service.inspect();
		const spec = inspect.Spec.TaskTemplate.ContainerSpec;
		const matches =
			spec.Image === image &&
			arraysEqual(spec.Command ?? [], command.entrypoint) &&
			arraysEqual(spec.Args ?? [], command.args) &&
			arraysEqual(spec.Env ?? [], env) &&
			(spec.Dir ?? "") === (command.workingDir ?? "");
		if (matches) return;

		await service.update({
			version: Number.parseInt(inspect.Version.Index, 10),
			...settings,
			TaskTemplate: {
				...settings.TaskTemplate,
				ForceUpdate: (inspect.Spec.TaskTemplate.ForceUpdate ?? 0) + 1,
			},
		});
	} catch (error) {
		const isMissing =
			error instanceof Error && /not found|404/i.test(error.message);
		if (!isMissing) throw error;
		await docker.createService(settings);
	}
};

export const setupGatewayErrors = async (
	options: SetupGatewayErrorsOptions = {},
): Promise<void> => {
	const env = options.env ?? process.env;
	const command = resolveGatewayErrorsCommand(env);
	if (!command) {
		console.warn(
			"[gateway-errors] no gateway error server script found; skipping setup",
		);
		return;
	}

	try {
		const docker = await getRemoteDocker(options.serverId);
		const image = await getGatewayErrorsImage(docker, options.serverId, env);
		const mode = await detectTraefikMode(docker);
		const environment = buildGatewayErrorsEnv(env);

		await ensureImage(docker, image);
		if (mode === "service") {
			await upsertService(docker, image, command, environment);
		} else {
			await upsertContainer(docker, image, command, environment);
		}
		console.log("[gateway-errors] gateway error service is ready");
	} catch (error) {
		console.error("[gateway-errors] failed to set up gateway error service", error);
	}
};
