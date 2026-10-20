import { describe, expect, it } from "vitest";
import {
	buildDeploymentIdempotencyKey,
	isDeploymentOrigin,
	parseGitRef,
	repositoryFullName,
} from "../../src/contract/index.js";

const repository = { owner: "SkyGenesisEnterprise", name: "Notploy" };

describe("parseGitRef", () => {
	it("classifies branches and strips the prefix", () => {
		expect(parseGitRef("refs/heads/main")).toEqual({
			kind: "branch",
			name: "main",
			ref: "refs/heads/main",
		});
	});

	it("keeps the branch name intact for nested branch names", () => {
		expect(parseGitRef("refs/heads/feat/github/app")?.name).toBe(
			"feat/github/app",
		);
	});

	it("classifies tags", () => {
		expect(parseGitRef("refs/tags/v1.2.3")).toMatchObject({
			kind: "tag",
			name: "v1.2.3",
		});
	});

	it("classifies raw commit SHAs", () => {
		expect(parseGitRef("ABCDEF1234567")).toMatchObject({
			kind: "commit",
			name: "abcdef1234567",
		});
	});

	it("rejects pull-request refs and empty values", () => {
		expect(parseGitRef("refs/pull/42/merge")).toBeNull();
		expect(parseGitRef("refs/heads/")).toBeNull();
		expect(parseGitRef("")).toBeNull();
		expect(parseGitRef(undefined)).toBeNull();
	});
});

describe("repositoryFullName", () => {
	it("joins owner and name", () => {
		expect(repositoryFullName(repository)).toBe("SkyGenesisEnterprise/Notploy");
	});
});

describe("isDeploymentOrigin", () => {
	it("accepts documented origins only", () => {
		expect(isDeploymentOrigin("github_app")).toBe(true);
		expect(isDeploymentOrigin("github_actions")).toBe(true);
		expect(isDeploymentOrigin("webhook")).toBe(false);
		expect(isDeploymentOrigin(42)).toBe(false);
	});
});

describe("buildDeploymentIdempotencyKey", () => {
	const commitSha = "ABC1234def567890abc1234def567890abc12345";

	it("is stable for the same delivery and normalizes casing", () => {
		const first = buildDeploymentIdempotencyKey({
			origin: "github_app",
			repository,
			commitSha,
			environment: "Production",
			deliveryId: "delivery-1",
		});
		const second = buildDeploymentIdempotencyKey({
			origin: "github_app",
			repository: { owner: "skygenesisenterprise", name: "notploy" },
			commitSha: commitSha.toLowerCase(),
			environment: "production",
			deliveryId: "delivery-1",
		});

		expect(first).toBe(second);
	});

	it("differs between two deliveries of the same commit", () => {
		const first = buildDeploymentIdempotencyKey({
			origin: "github_app",
			repository,
			commitSha,
			deliveryId: "delivery-1",
		});
		const second = buildDeploymentIdempotencyKey({
			origin: "github_app",
			repository,
			commitSha,
			deliveryId: "delivery-2",
		});

		expect(first).not.toBe(second);
	});

	it("separates environments", () => {
		const staging = buildDeploymentIdempotencyKey({
			origin: "github_app",
			repository,
			commitSha,
			environment: "staging",
			deliveryId: "delivery-1",
		});
		const production = buildDeploymentIdempotencyKey({
			origin: "github_app",
			repository,
			commitSha,
			environment: "production",
			deliveryId: "delivery-1",
		});

		expect(staging).not.toBe(production);
	});

	it("uses the workflow run for Actions-triggered deployments", () => {
		const key = buildDeploymentIdempotencyKey({
			origin: "github_actions",
			repository,
			commitSha,
			workflowRunId: "123",
		});

		expect(key).toContain("github_actions");
		expect(key).toContain("123");
	});

	it("returns undefined without a discriminator", () => {
		expect(
			buildDeploymentIdempotencyKey({
				origin: "github_app",
				repository,
				commitSha,
			}),
		).toBeUndefined();
		expect(
			buildDeploymentIdempotencyKey({
				origin: "github_actions",
				repository,
				commitSha,
			}),
		).toBeUndefined();
	});

	it("never invents a key for manual deployments", () => {
		expect(
			buildDeploymentIdempotencyKey({
				origin: "manual",
				repository,
				commitSha,
				deliveryId: "delivery-1",
			}),
		).toBeUndefined();
	});

	it("rejects a non-hex commit sha", () => {
		expect(
			buildDeploymentIdempotencyKey({
				origin: "github_app",
				repository,
				commitSha: "main",
				deliveryId: "delivery-1",
			}),
		).toBeUndefined();
	});
});
