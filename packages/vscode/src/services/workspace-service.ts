import * as vscode from "vscode";
import { parse as parseYaml } from "yaml";
import { STORAGE } from "../core/constants";
import type { Logger } from "../core/logger";

/**
 * Workspace integration.
 *
 * Two things live here:
 *
 * 1. **Manifest detection** — Notploy has no project manifest format of its
 *    own (there is no `notploy.yaml` anywhere in the repository or the API), so
 *    the extension defines a deliberately tiny one for *binding a workspace to
 *    an existing Notploy project*. It is optional; everything also works
 *    without it.
 *
 *    ```yaml
 *    # notploy.yaml
 *    version: 1
 *    instance: local          # instance id or name
 *    project: marketing       # project id or name
 *    environment: production  # optional
 *    application: website     # optional
 *    ```
 *
 * 2. **Git context** — repository, branch and commit are read through the
 *    built-in Git extension. GitHub is never required.
 */

export const MANIFEST_FILENAMES = [
	"notploy.yaml",
	"notploy.yml",
	"notploy.json",
] as const;

/** Files that only hint that the folder is deployable. */
export const DEPLOY_HINT_FILENAMES = [
	"Dockerfile",
	"docker-compose.yml",
	"docker-compose.yaml",
	"compose.yml",
	"compose.yaml",
	"package.json",
] as const;

export interface NotployManifest {
	version?: number;
	instance?: string;
	project?: string;
	environment?: string;
	application?: string;
}

export interface ManifestLocation {
	path: string;
	/** Path relative to the workspace folder, for display. */
	relativePath: string;
	manifest: NotployManifest;
}

export interface GitContext {
	repositoryRoot: string;
	/** Remote URL with credentials stripped, when one is configured. */
	remoteUrl?: string;
	/** `owner/repo` parsed from the remote, when it can be derived. */
	slug?: string;
	branch?: string;
	commit?: string;
}

export interface WorkspaceBinding {
	instanceId?: string;
	projectId?: string;
	projectName?: string;
	environmentId?: string;
	environmentName?: string;
	applicationId?: string;
	applicationName?: string;
	source: "manifest" | "user";
	manifestPath?: string;
}

export interface WorkspaceSnapshot {
	root?: string;
	manifest?: ManifestLocation;
	deployHints: string[];
	git?: GitContext;
	binding?: WorkspaceBinding;
}

export class WorkspaceService {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly logger: Logger,
	) {}

	workspaceRoot(): string | undefined {
		const folder = vscode.workspace.workspaceFolders?.[0];
		return folder?.uri.fsPath;
	}

	/** Reads `notploy.yaml`, `notploy.yml` or `notploy.json`, first match wins. */
	async detectManifest(): Promise<ManifestLocation | undefined> {
		const folder = vscode.workspace.workspaceFolders?.[0];
		if (!folder) return undefined;

		for (const filename of MANIFEST_FILENAMES) {
			const uri = vscode.Uri.joinPath(folder.uri, filename);
			let text: string;
			try {
				const bytes = await vscode.workspace.fs.readFile(uri);
				text = Buffer.from(bytes).toString("utf8");
			} catch {
				continue;
			}
			const manifest = parseManifest(text, filename);
			if (manifest) {
				return { path: uri.fsPath, relativePath: filename, manifest };
			}
			this.logger.warn(
				`Ignoring malformed ${filename}: expected a Notploy manifest object.`,
			);
		}
		return undefined;
	}

	/** Cheap check that the folder looks like something Notploy could deploy. */
	async detectDeployHints(): Promise<string[]> {
		const folder = vscode.workspace.workspaceFolders?.[0];
		if (!folder) return [];
		const found: string[] = [];
		for (const filename of DEPLOY_HINT_FILENAMES) {
			try {
				await vscode.workspace.fs.stat(
					vscode.Uri.joinPath(folder.uri, filename),
				);
				found.push(filename);
			} catch {
				// Not present.
			}
		}
		return found;
	}

	/** Repository/branch/commit, via the built-in Git extension only. */
	async detectGitContext(): Promise<GitContext | undefined> {
		const gitExtension =
			vscode.extensions.getExtension<GitExtension>("vscode.git");
		if (!gitExtension) return undefined;
		try {
			const exports = gitExtension.isActive
				? gitExtension.exports
				: await gitExtension.activate();
			const api = exports?.getAPI?.(1);
			const repository =
				api?.repositories?.find((repo) =>
					vscode.workspace.workspaceFolders?.some((folder) =>
						repo.rootUri.fsPath.startsWith(folder.uri.fsPath),
					),
				) ?? api?.repositories?.[0];
			if (!repository) return undefined;

			const remoteUrl = repository.state.remotes[0]?.fetchUrl ?? undefined;
			return {
				repositoryRoot: repository.rootUri.fsPath,
				remoteUrl: stripCredentials(remoteUrl),
				slug: repositorySlug(remoteUrl),
				branch: repository.state.HEAD?.name,
				commit: repository.state.HEAD?.commit,
			};
		} catch (error) {
			this.logger.debug("Could not read Git context", error);
			return undefined;
		}
	}

	/** The binding stored for this workspace, if any. */
	storedBinding(): WorkspaceBinding | undefined {
		const bindings = this.context.workspaceState.get<
			Record<string, WorkspaceBinding>
		>(STORAGE.workspaceBindings, {});
		const key = this.bindingKey();
		return key ? bindings[key] : undefined;
	}

	async setBinding(binding: WorkspaceBinding): Promise<void> {
		const key = this.bindingKey();
		if (!key) return;
		const bindings = this.context.workspaceState.get<
			Record<string, WorkspaceBinding>
		>(STORAGE.workspaceBindings, {});
		await this.context.workspaceState.update(STORAGE.workspaceBindings, {
			...bindings,
			[key]: binding,
		});
	}

	async clearBinding(): Promise<void> {
		const key = this.bindingKey();
		if (!key) return;
		const bindings = this.context.workspaceState.get<
			Record<string, WorkspaceBinding>
		>(STORAGE.workspaceBindings, {});
		delete bindings[key];
		await this.context.workspaceState.update(
			STORAGE.workspaceBindings,
			bindings,
		);
	}

	private bindingKey(): string | undefined {
		return this.workspaceRoot();
	}

	/**
	 * Full workspace snapshot. A manifest always wins over a stored binding, so
	 * the file stays the source of truth when it is present.
	 */
	async snapshot(): Promise<WorkspaceSnapshot> {
		const [manifest, deployHints, git] = await Promise.all([
			this.detectManifest(),
			this.detectDeployHints(),
			this.detectGitContext(),
		]);

		let binding = this.storedBinding();
		if (manifest) {
			binding = {
				instanceId: manifest.manifest.instance,
				projectId: manifest.manifest.project,
				projectName: manifest.manifest.project,
				environmentId: manifest.manifest.environment,
				environmentName: manifest.manifest.environment,
				applicationId: manifest.manifest.application,
				applicationName: manifest.manifest.application,
				source: "manifest",
				manifestPath: manifest.path,
			};
		}

		return {
			root: this.workspaceRoot(),
			manifest,
			deployHints,
			git,
			binding,
		};
	}
}

/** Parses a manifest, returning `undefined` when it is not a plain object. */
export function parseManifest(
	text: string,
	filename: string,
): NotployManifest | undefined {
	let parsed: unknown;
	try {
		parsed = filename.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
	} catch {
		return undefined;
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return undefined;
	}
	const record = parsed as Record<string, unknown>;
	const readString = (key: string): string | undefined => {
		const value = record[key];
		return typeof value === "string" && value.trim() ? value.trim() : undefined;
	};
	const manifest: NotployManifest = {
		instance: readString("instance"),
		project: readString("project"),
		environment: readString("environment"),
		application: readString("application"),
	};
	const version = record.version;
	if (typeof version === "number") manifest.version = version;
	if (
		!manifest.instance &&
		!manifest.project &&
		!manifest.environment &&
		!manifest.application
	) {
		return undefined;
	}
	return manifest;
}

/** `git@github.com:acme/site.git` / `https://host/acme/site.git` → `acme/site`. */
export function repositorySlug(
	remoteUrl: string | undefined,
): string | undefined {
	if (!remoteUrl) return undefined;
	const cleaned = stripCredentials(remoteUrl)?.replace(/\.git$/, "");
	if (!cleaned) return undefined;
	const sshMatch = /^[^@]+@[^:]+:(.+)$/.exec(cleaned);
	if (sshMatch?.[1]) return sshMatch[1];
	try {
		const url = new URL(cleaned);
		const path = url.pathname.replace(/^\/+/, "");
		return path || undefined;
	} catch {
		return undefined;
	}
}

/** Removes `user:password@` from a remote URL so it can be displayed. */
export function stripCredentials(
	remoteUrl: string | undefined,
): string | undefined {
	if (!remoteUrl) return undefined;
	return remoteUrl.replace(/\/\/[^/@]*@/, "//");
}

/** Minimal structural types for the built-in Git extension API. */
interface GitExtension {
	getAPI(version: 1): GitApi | undefined;
}

interface GitApi {
	repositories: GitRepository[];
}

interface GitRepository {
	rootUri: vscode.Uri;
	state: {
		HEAD?: { name?: string; commit?: string };
		remotes: Array<{ name: string; fetchUrl?: string; pushUrl?: string }>;
	};
}
