import { describe, expect, it } from "vitest";
import { RepositoriesNamespace } from "../../src/client/namespaces/repositories.js";
import {
	GitHubNotFoundError,
	GitHubRateLimitError,
} from "../../src/errors/index.js";

/** Minimal fake Octokit covering the routes the namespace uses. */
const buildFakeOctokit = (overrides: {
	reposGet?: () => Promise<{ data: unknown }>;
	listRepos?: () => Promise<{ data: unknown }>;
	collaborator?: () => Promise<{ data: unknown }>;
}) => {
	return {
		rest: {
			repos: {
				get: overrides.reposGet ?? (async () => ({ data: {} })),
				listForUser: overrides.listRepos ?? (async () => ({ data: [] })),
				getCollaboratorPermissionLevel:
					overrides.collaborator ?? (async () => ({ data: {} })),
			},
			apps: {
				listReposAccessibleToInstallation:
					overrides.listRepos ?? (async () => ({ data: { repositories: [] } })),
			},
		},
	} as never;
};

describe("repositories namespace", () => {
	it("maps a GitHub repository response to the Notploy model", async () => {
		const octokit = buildFakeOctokit({
			reposGet: async () => ({
				data: {
					id: 503873119,
					name: "notploy",
					full_name: "skygenesisenterprise/notploy",
					private: false,
					visibility: "public",
					description: "Deploy anything",
					html_url: "https://github.com/skygenesisenterprise/notploy",
					clone_url: "https://github.com/skygenesisenterprise/notploy.git",
					default_branch: "master",
					language: "TypeScript",
					archived: false,
					disabled: false,
					fork: false,
					owner: { login: "skygenesisenterprise", type: "Organization" },
				},
			}),
		});

		const repositories = new RepositoriesNamespace(octokit);
		const repository = await repositories.get({
			owner: "skygenesisenterprise",
			repository: "notploy",
		});

		expect(repository).toMatchObject({
			id: 503873119,
			name: "notploy",
			fullName: "skygenesisenterprise/notploy",
			owner: "skygenesisenterprise",
			private: false,
			visibility: "public",
			defaultBranch: "master",
		});
	});

	it("defaults missing fields safely", async () => {
		const octokit = buildFakeOctokit({
			reposGet: async () => ({
				data: { id: 1, name: "x", owner: { login: "acme" } },
			}),
		});
		const repositories = new RepositoriesNamespace(octokit);
		const repository = await repositories.get({
			owner: "acme",
			repository: "x",
		});
		expect(repository.defaultBranch).toBe("main");
		expect(repository.private).toBe(false);
		expect(repository.archived).toBe(false);
	});

	it("lists installation repositories", async () => {
		const octokit = buildFakeOctokit({
			listRepos: async () => ({
				data: {
					repositories: [
						{ id: 1, name: "a", full_name: "acme/a", owner: { login: "acme" } },
						{ id: 2, name: "b", full_name: "acme/b", owner: { login: "acme" } },
					],
				},
			}),
		});
		const repositories = new RepositoriesNamespace(octokit);
		const list = await repositories.listForAuthenticatedInstallation();
		expect(list).toHaveLength(2);
		expect(list[0]?.fullName).toBe("acme/a");
	});

	it("maps collaborator permission levels", async () => {
		const octokit = buildFakeOctokit({
			collaborator: async () => ({ data: { permission: "write" } }),
		});
		const repositories = new RepositoriesNamespace(octokit);
		const result = await repositories.getPermissions({
			owner: "acme",
			repository: "a",
			username: "alice",
		});
		expect(result.permission).toBe("write");
	});

	it("translates 404 into GitHubNotFoundError", async () => {
		const octokit = buildFakeOctokit({
			reposGet: async () => {
				const error = Object.assign(new Error("Not Found"), {
					name: "HttpError",
					status: 404,
					response: { headers: {} },
				});
				throw error;
			},
		});
		const repositories = new RepositoriesNamespace(octokit);
		await expect(
			repositories.get({ owner: "acme", repository: "ghost" }),
		).rejects.toBeInstanceOf(GitHubNotFoundError);
	});

	it("translates exhausted rate limit into GitHubRateLimitError", async () => {
		const octokit = buildFakeOctokit({
			reposGet: async () => {
				const error = Object.assign(new Error("rate limit"), {
					name: "HttpError",
					status: 403,
					response: {
						headers: {
							"x-ratelimit-limit": "5000",
							"x-ratelimit-remaining": "0",
							"x-ratelimit-reset": "4102444800",
						},
					},
				});
				throw error;
			},
		});
		const repositories = new RepositoriesNamespace(octokit);
		try {
			await repositories.get({ owner: "acme", repository: "a" });
			expect.unreachable("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(GitHubRateLimitError);
			const rateLimitError = error as GitHubRateLimitError;
			expect(rateLimitError.rateLimit?.remaining).toBe(0);
		}
	});
});
