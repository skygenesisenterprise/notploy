/**
 * Managed databases.
 *
 * Six engines (`postgres`, `mysql`, `mariadb`, `mongo`, `redis`, `libsql`) each
 * have their own router but the same procedure vocabulary, so this service is
 * one implementation parameterised by engine rather than six copies.
 *
 * Two API properties shape it:
 *
 * - **Capabilities are checked before calling.** An instance that does not
 *   expose `postgres.*` must produce a note, not a 404 the user has to decode.
 * - **LibSQL cannot be listed directly.** The API has no `libsql.search`, so its
 *   services are only visible through `environment.byProjectId`, which embeds
 *   every service of a project. That path is walked only when LibSQL is actually
 *   asked for, because it costs one request per project.
 */

import {
	DATABASE_ENGINES,
	type DatabaseEngine,
	type DatabaseSummary,
	databasesFromEnvironment,
	type EnvironmentSummary,
	type InstanceCapabilities,
} from "@/shared/domain";
import type {
	DatabaseActionRequest,
	DatabaseListResult,
	DatabaseQuery,
} from "@/shared/ipc";
import type { ConnectionManager } from "../connection/connection-manager";

export class DatabaseService {
	constructor(private readonly manager: ConnectionManager) {}

	/**
	 * Every database the credential can see, across the requested engines.
	 *
	 * Engines the instance does not expose are skipped with a note; LibSQL is
	 * resolved from the project tree. The two failure modes the UI must be able
	 * to tell apart — "none configured" and "could not be enumerated" — are
	 * therefore never conflated.
	 */
	async list(query: DatabaseQuery = {}): Promise<DatabaseListResult> {
		const client = await this.manager.authenticatedClient();
		const capabilities = await this.manager.activeCapabilities();
		const requested: DatabaseEngine[] = query.engine
			? [query.engine]
			: [...DATABASE_ENGINES];

		const notes: string[] = [];
		const databases: DatabaseSummary[] = [];

		const searchable = requested.filter(
			(engine) => engine !== "libsql" && engineExposed(engine, capabilities),
		);

		for (const engine of requested) {
			if (engine === "libsql") continue;
			if (!engineExposed(engine, capabilities)) {
				notes.push(
					`${engine}: this instance does not expose the ${engine} router.`,
				);
			}
		}

		const results = await Promise.all(
			searchable.map(async (engine) => {
				try {
					const items = await client.databasesOf(engine, {
						projectId: query.projectId,
						environmentId: query.environmentId,
						q: query.q,
					});
					return { engine, items: items ?? [] };
				} catch (error) {
					notes.push(`${engine}: not readable for this API key.`);
					void error;
					return { engine, items: [] as DatabaseSummary[] };
				}
			}),
		);
		for (const result of results) databases.push(...result.items);

		if (requested.includes("libsql")) {
			if (!engineExposed("libsql", capabilities)) {
				notes.push("libsql: this instance does not expose the libsql router.");
			} else {
				const libsql = await this.libsqlFromEnvironments(query).catch(
					() => undefined,
				);
				if (libsql) databases.push(...libsql);
				else
					notes.push("libsql: the project environment tree could not be read.");
			}
		}

		databases.sort(
			(left, right) =>
				left.engine.localeCompare(right.engine) ||
				left.name.localeCompare(right.name),
		);

		return { databases, notes };
	}

	/**
	 * LibSQL services, read out of the project environment tree.
	 *
	 * Scoped to a project when one was given. Unscoped, every project is walked —
	 * that is the only way the API allows enumerating all LibSQL services, and
	 * the cost is stated rather than hidden.
	 */
	private async libsqlFromEnvironments(
		query: DatabaseQuery,
	): Promise<DatabaseSummary[]> {
		const client = await this.manager.authenticatedClient();
		const projects = query.projectId
			? [{ projectId: query.projectId }]
			: await client.projects();

		const collected: DatabaseSummary[] = [];
		for (const project of projects) {
			let environments: EnvironmentSummary[];
			try {
				environments = await client.environments(project.projectId);
			} catch {
				continue;
			}
			for (const environment of environments) {
				if (
					query.environmentId &&
					environment.environmentId !== query.environmentId
				) {
					continue;
				}
				for (const database of databasesFromEnvironment(environment)) {
					collected.push({
						...database,
						projectId:
							database.projectId ??
							database.environment?.project?.projectId ??
							project.projectId,
					});
				}
			}
		}
		return collected;
	}

	/** One service, by engine and id. */
	async one(
		engine: DatabaseEngine,
		databaseId: string,
	): Promise<DatabaseSummary> {
		const client = await this.manager.authenticatedClient();
		return await client.database(engine, databaseId);
	}

	async action(request: DatabaseActionRequest): Promise<void> {
		const client = await this.manager.authenticatedClient();
		await client.databaseAction(
			request.engine,
			request.databaseId,
			request.action,
			request.appName,
		);
	}

	async logs(
		engine: DatabaseEngine,
		databaseId: string,
		tail?: number,
	): Promise<string> {
		const client = await this.manager.authenticatedClient();
		return await client.databaseLogs(engine, databaseId, tail);
	}

	async changePassword(
		engine: DatabaseEngine,
		databaseId: string,
		password: string,
	): Promise<void> {
		const client = await this.manager.authenticatedClient();
		await client.databaseChangePassword(engine, databaseId, password);
	}
}

/**
 * True when the instance exposes an engine's router.
 *
 * `undefined` capabilities mean the report has not been read yet, which is not
 * the same as "the router is missing": the call is allowed through so the
 * instance answers for itself instead of the client guessing.
 */
function engineExposed(
	engine: DatabaseEngine,
	capabilities: InstanceCapabilities | undefined,
): boolean {
	if (!capabilities) return true;
	return capabilities[engine];
}
