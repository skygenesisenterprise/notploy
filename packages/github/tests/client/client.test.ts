import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as githubPackage from "../../src/index.js";
import { createGitHubClient } from "../../src/index.js";

const throwawayKey = (): string =>
	generateKeyPairSync("rsa", {
		modulusLength: 2048,
		privateKeyEncoding: { type: "pkcs1", format: "pem" },
		publicKeyEncoding: { type: "spki", format: "pem" },
	}).privateKey;

describe("createGitHubClient", () => {
	it("creates a client with all functional namespaces", () => {
		const github = createGitHubClient({
			auth: {
				app: { appId: 1, privateKey: throwawayKey() },
				installationId: 42,
			},
		});

		expect(github.repositories).toBeDefined();
		expect(github.branches).toBeDefined();
		expect(github.commits).toBeDefined();
		expect(github.pullRequests).toBeDefined();
		expect(github.deployments).toBeDefined();
		expect(github.checks).toBeDefined();
		expect(github.releases).toBeDefined();
		expect(github.installations).toBeDefined();
		expect(typeof github.rateLimit).toBe("function");
	});

	it("creates a client from a token", () => {
		const github = createGitHubClient({ auth: { token: "x" } });
		expect(github.octokit).toBeDefined();
	});

	it("rejects missing credentials", () => {
		expect(() => createGitHubClient({ auth: {} as never })).toThrow(
			/Provide either GitHub App credentials/,
		);
	});

	it("rejects both app credentials and token", () => {
		expect(() =>
			createGitHubClient({
				auth: {
					app: { appId: 1, privateKey: throwawayKey() },
					token: "x",
				},
			}),
		).toThrow(/not both/);
	});
});

describe("public API surface", () => {
	it("exports the client factory and auth helpers", () => {
		expect(typeof githubPackage.createGitHubClient).toBe("function");
		expect(typeof githubPackage.createGitHubAppAuth).toBe("function");
		expect(typeof githubPackage.createInstallationAuth).toBe("function");
		expect(typeof githubPackage.parseWebhookPayload).toBe("function");
	});

	it("exports the structured error classes", () => {
		expect(githubPackage.GitHubError).toBeDefined();
		expect(githubPackage.GitHubApiError).toBeDefined();
		expect(githubPackage.GitHubAuthenticationError).toBeDefined();
		expect(githubPackage.GitHubAuthorizationError).toBeDefined();
		expect(githubPackage.GitHubNotFoundError).toBeDefined();
		expect(githubPackage.GitHubRateLimitError).toBeDefined();
		expect(githubPackage.GitHubWebhookError).toBeDefined();
		expect(githubPackage.GitHubConfigurationError).toBeDefined();
	});

	it("does not leak internal helpers in the public surface", () => {
		const publicNames = Object.keys(githubPackage);
		expect(publicNames).not.toContain("mapRepository");
		expect(publicNames).not.toContain("translateError");
		expect(publicNames).not.toContain("RepositoriesNamespace");
	});
});
