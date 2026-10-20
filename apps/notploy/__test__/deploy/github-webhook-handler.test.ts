import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	eq: vi.fn((field: string, value: unknown) => ({ field, value })),
	and: vi.fn((...conditions: Array<{ field: string; value: unknown }>) => ({
		conditions,
	})),
	githubFindFirst: vi.fn(),
	applicationsFindMany: vi.fn(),
	composeFindMany: vi.fn(),
	queueAdd: vi.fn(),
	verify: vi.fn(),
	shouldDeploy: vi.fn(),
	createPreviewDeployment: vi.fn(),
	findPreviewDeploymentByApplicationId: vi.fn(),
	claimDelivery: vi.fn(),
	completeDelivery: vi.fn(),
	readRawBody: vi.fn(),
	verifySignature: vi.fn(),
	updateSet: vi.fn(),
	updateWhere: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
	eq: mocks.eq,
	and: mocks.and,
}));

vi.mock("@/server/db/schema", () => ({
	applications: {
		sourceType: "application.sourceType",
		autoDeploy: "application.autoDeploy",
		triggerType: "application.triggerType",
		branch: "application.branch",
		repository: "application.repository",
		owner: "application.owner",
		githubId: "application.githubId",
		isPreviewDeploymentsActive: "application.isPreviewDeploymentsActive",
	},
	compose: {
		sourceType: "compose.sourceType",
		autoDeploy: "compose.autoDeploy",
		triggerType: "compose.triggerType",
		branch: "compose.branch",
		repository: "compose.repository",
		owner: "compose.owner",
		githubId: "compose.githubId",
	},
	github: {
		githubInstallationId: "github.githubInstallationId",
	},
}));

vi.mock("@notploy/server/db", () => ({
	db: {
		update: vi.fn(() => ({ set: mocks.updateSet })),
		query: {
			github: {
				findFirst: mocks.githubFindFirst,
			},
			applications: {
				findMany: mocks.applicationsFindMany,
			},
			compose: {
				findMany: mocks.composeFindMany,
			},
		},
	},
}));

vi.mock("@notploy/server", () => ({
	IS_CLOUD: false,
	shouldDeploy: mocks.shouldDeploy,
	checkUserRepositoryPermissions: vi.fn(),
	createPreviewDeployment: mocks.createPreviewDeployment,
	createSecurityBlockedComment: vi.fn(),
	findGithubById: vi.fn(),
	findPreviewDeploymentByApplicationId:
		mocks.findPreviewDeploymentByApplicationId,
	findPreviewDeploymentsByPullRequestId: vi.fn(),
	getBitbucketHeaders: vi.fn(() => ({})),
	removePreviewDeployment: vi.fn(),
}));

vi.mock("@/server/utils/github-webhook", () => ({
	GithubWebhookRequestError: class GithubWebhookRequestError extends Error {
		status: number;
		constructor(message: string, status: number) {
			super(message);
			this.status = status;
		}
	},
	claimGithubDelivery: mocks.claimDelivery,
	completeGithubDelivery: mocks.completeDelivery,
	readRawWebhookBody: mocks.readRawBody,
	verifyGithubSignature: mocks.verifySignature,
}));

vi.mock("@/server/queues/queueSetup", () => ({
	myQueue: {
		add: mocks.queueAdd,
	},
}));

vi.mock("@/server/utils/deploy", () => ({
	deploy: vi.fn(),
}));

import handler from "@/pages/api/deploy/github";

const getConditionValue = (
	where: { conditions?: Array<{ field: string; value: unknown }> } | undefined,
	field: string,
) => where?.conditions?.find((condition) => condition.field === field)?.value;

const createResponse = () => {
	const res = {
		status: vi.fn(),
		json: vi.fn(),
	} as unknown as NextApiResponse & {
		status: ReturnType<typeof vi.fn>;
		json: ReturnType<typeof vi.fn>;
	};

	res.status.mockImplementation(() => res);
	res.json.mockImplementation(() => res);

	return res;
};

/** Default webhook dependencies: signature valid, delivery newly claimed. */
const primeWebhook = () => {
	mocks.verifySignature.mockResolvedValue(true);
	mocks.claimDelivery.mockResolvedValue("claimed");
	mocks.completeDelivery.mockResolvedValue(undefined);
	mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
	mocks.updateWhere.mockResolvedValue([]);
};

/**
 * The route disables Next's body parser and reads the raw stream, so the request
 * is represented by the headers only; `readRawWebhookBody` is mocked to return
 * the serialized payload it would have read.
 */
const createRequest = (
	body: Record<string, unknown>,
	event = "push",
	headers: Record<string, string | undefined> = {},
) => {
	mocks.readRawBody.mockResolvedValue(JSON.stringify(body));

	return {
		headers: {
			"x-hub-signature-256": "sha256=test-signature",
			"x-github-event": event,
			"x-github-delivery": "delivery-1",
			...headers,
		},
	} as unknown as NextApiRequest;
};

const buildPushBody = (
	branch: string,
	owner: { login?: string; name?: string } = { login: "agentHits" },
) => ({
	installation: {
		id: 12345,
	},
	ref: `refs/heads/${branch}`,
	after: "abc123",
	head_commit: {
		message: "fix: trigger deployment",
	},
	commits: [
		{
			modified: ["src/index.ts"],
		},
	],
	repository: {
		name: "notploy",
		full_name: "agentHits/notploy",
		clone_url: "https://github.com/skygenesisenterprise/notploy.git",
		html_url: "https://github.com/skygenesisenterprise/notploy",
		owner,
	},
});

const createPushRequest = (
	branch: string,
	owner: { login?: string; name?: string } = { login: "agentHits" },
) => createRequest(buildPushBody(branch, owner));

const createTagRequest = (tagName: string) =>
	createRequest({
		...buildPushBody("main"),
		ref: `refs/tags/${tagName}`,
		head_commit: { message: `release: ${tagName}` },
	});

describe("GitHub app webhook auto-deploy", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.githubFindFirst.mockResolvedValue({
			githubId: "github-provider-id",
			githubInstallationId: 12345,
			githubWebhookSecret: "webhook-secret",
		});
		primeWebhook();
		mocks.shouldDeploy.mockReturnValue(true);
		mocks.composeFindMany.mockResolvedValue([]);
		mocks.queueAdd.mockResolvedValue({ id: "job-id" });

		mocks.applicationsFindMany.mockImplementation(({ where }) => {
			const matches =
				getConditionValue(where, "application.sourceType") === "github" &&
				getConditionValue(where, "application.autoDeploy") === true &&
				getConditionValue(where, "application.triggerType") === "push" &&
				getConditionValue(where, "application.branch") === "main" &&
				getConditionValue(where, "application.repository") === "notploy" &&
				getConditionValue(where, "application.owner") === "agentHits" &&
				getConditionValue(where, "application.githubId") ===
					"github-provider-id";

			return Promise.resolve(
				matches
					? [
							{
								applicationId: "application-id",
								serverId: null,
								watchPaths: null,
							},
						]
					: [],
			);
		});
	});

	it("matches push events using repository owner name when available", async () => {
		const res = createResponse();

		await handler(
			createPushRequest("main", {
				login: "agentHits-login",
				name: "agentHits",
			}),
			res,
		);

		expect(mocks.queueAdd).toHaveBeenCalledWith(
			"deployments",
			expect.objectContaining({
				applicationId: "application-id",
				applicationType: "application",
				type: "deploy",
			}),
			expect.objectContaining({
				removeOnComplete: true,
				removeOnFail: true,
			}),
		);
		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith({ message: "Deployed 1 apps" });
	});

	it("matches compose push events using repository owner login fallback", async () => {
		mocks.applicationsFindMany.mockResolvedValue([]);
		mocks.composeFindMany.mockImplementation(({ where }) => {
			const matches =
				getConditionValue(where, "compose.sourceType") === "github" &&
				getConditionValue(where, "compose.autoDeploy") === true &&
				getConditionValue(where, "compose.triggerType") === "push" &&
				getConditionValue(where, "compose.branch") === "main" &&
				getConditionValue(where, "compose.repository") === "notploy" &&
				getConditionValue(where, "compose.owner") === "agentHits" &&
				getConditionValue(where, "compose.githubId") === "github-provider-id";

			return Promise.resolve(
				matches
					? [
							{
								composeId: "compose-id",
								serverId: null,
								watchPaths: null,
							},
						]
					: [],
			);
		});
		const res = createResponse();

		await handler(createPushRequest("main"), res);

		expect(mocks.queueAdd).toHaveBeenCalledWith(
			"deployments",
			expect.objectContaining({
				applicationType: "compose",
				composeId: "compose-id",
				type: "deploy",
			}),
			expect.objectContaining({
				removeOnComplete: true,
				removeOnFail: true,
			}),
		);
		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith({ message: "Deployed 1 apps" });
	});

	it("matches tag events using repository owner login fallback", async () => {
		mocks.applicationsFindMany.mockImplementation(({ where }) => {
			const matches =
				getConditionValue(where, "application.sourceType") === "github" &&
				getConditionValue(where, "application.autoDeploy") === true &&
				getConditionValue(where, "application.triggerType") === "tag" &&
				getConditionValue(where, "application.repository") === "notploy" &&
				getConditionValue(where, "application.owner") === "agentHits" &&
				getConditionValue(where, "application.githubId") ===
					"github-provider-id";

			return Promise.resolve(
				matches
					? [
							{
								applicationId: "application-id",
								serverId: null,
							},
						]
					: [],
			);
		});
		const res = createResponse();

		await handler(createTagRequest("v1.0.0"), res);

		expect(mocks.queueAdd).toHaveBeenCalledWith(
			"deployments",
			expect.objectContaining({
				applicationId: "application-id",
				applicationType: "application",
				titleLog: "Tag created: v1.0.0",
				type: "deploy",
			}),
			expect.objectContaining({
				removeOnComplete: true,
				removeOnFail: true,
			}),
		);
		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith({
			message: "Deployed 1 apps based on tag v1.0.0",
		});
	});

	it("does not deploy when the pushed branch does not match", async () => {
		const res = createResponse();

		await handler(createPushRequest("feature"), res);

		expect(mocks.queueAdd).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith({ message: "No apps to deploy" });
	});
});

describe("GitHub app webhook preview deployments", () => {
	const createApplication = (
		overrides: Record<string, unknown> = {},
	): Record<string, unknown> => ({
		applicationId: "application-id",
		name: "my-app",
		serverId: null,
		previewLabels: [],
		previewLimit: 3,
		previewDeployments: [],
		previewRequireCollaboratorPermissions: false,
		...overrides,
	});

	const createPreviewDeployments = (total: number) =>
		Array.from({ length: total }, (_, index) => ({
			previewDeploymentId: `existing-preview-${index}`,
		}));

	const createPullRequestRequest = (action: string) =>
		createRequest(
			{
				installation: {
					id: 12345,
				},
				action,
				pull_request: {
					id: 987,
					number: 42,
					title: "feat: add preview",
					html_url: "https://github.com/skygenesisenterprise/notploy/pull/42",
					labels: [],
					user: {
						login: "agentHits",
					},
					head: {
						ref: "feature",
						sha: "abc123",
					},
					base: {
						ref: "main",
					},
				},
				repository: {
					name: "notploy",
					owner: {
						login: "agentHits",
					},
				},
			},
			"pull_request",
		);

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.githubFindFirst.mockResolvedValue({
			githubId: "github-provider-id",
			githubInstallationId: 12345,
			githubWebhookSecret: "webhook-secret",
		});
		primeWebhook();
		mocks.queueAdd.mockResolvedValue({ id: "job-id" });
		mocks.createPreviewDeployment.mockResolvedValue({
			previewDeploymentId: "new-preview-id",
		});
		mocks.findPreviewDeploymentByApplicationId.mockResolvedValue(undefined);
	});

	it("redeploys an existing preview even when the limit is reached", async () => {
		mocks.applicationsFindMany.mockResolvedValue([
			createApplication({
				previewLimit: 2,
				previewDeployments: createPreviewDeployments(3),
			}),
		]);
		mocks.findPreviewDeploymentByApplicationId.mockResolvedValue({
			previewDeploymentId: "existing-preview-0",
		});
		const res = createResponse();

		await handler(createPullRequestRequest("synchronize"), res);

		expect(mocks.createPreviewDeployment).not.toHaveBeenCalled();
		expect(mocks.queueAdd).toHaveBeenCalledWith(
			"deployments",
			expect.objectContaining({
				applicationId: "application-id",
				applicationType: "application-preview",
				previewDeploymentId: "existing-preview-0",
				type: "deploy",
			}),
			expect.objectContaining({
				removeOnComplete: true,
				removeOnFail: true,
			}),
		);
		expect(res.status).toHaveBeenCalledWith(200);
	});

	it("does not create a new preview once the limit is reached", async () => {
		mocks.applicationsFindMany.mockResolvedValue([
			createApplication({
				previewLimit: 2,
				previewDeployments: createPreviewDeployments(2),
			}),
		]);
		const res = createResponse();

		await handler(createPullRequestRequest("opened"), res);

		expect(mocks.createPreviewDeployment).not.toHaveBeenCalled();
		expect(mocks.queueAdd).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(200);
	});

	it("falls back to the default limit when none is configured", async () => {
		mocks.applicationsFindMany.mockResolvedValue([
			createApplication({
				previewLimit: null,
				previewDeployments: createPreviewDeployments(2),
			}),
		]);
		const res = createResponse();

		await handler(createPullRequestRequest("opened"), res);

		expect(mocks.createPreviewDeployment).toHaveBeenCalledWith(
			expect.objectContaining({
				applicationId: "application-id",
				branch: "feature",
				pullRequestId: 987,
				pullRequestNumber: 42,
			}),
		);
		expect(mocks.queueAdd).toHaveBeenCalledWith(
			"deployments",
			expect.objectContaining({
				applicationId: "application-id",
				applicationType: "application-preview",
				previewDeploymentId: "new-preview-id",
				type: "deploy",
			}),
			expect.objectContaining({
				removeOnComplete: true,
				removeOnFail: true,
			}),
		);
		expect(res.status).toHaveBeenCalledWith(200);
	});
});

describe("GitHub webhook security and delivery handling", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.githubFindFirst.mockResolvedValue({
			githubId: "github-provider-id",
			githubInstallationId: 12345,
			githubWebhookSecret: "webhook-secret",
			githubInstallationSuspendedAt: null,
		});
		mocks.applicationsFindMany.mockResolvedValue([]);
		mocks.composeFindMany.mockResolvedValue([]);
		mocks.queueAdd.mockResolvedValue({ id: "job-id" });
		primeWebhook();
	});

	it("rejects a delivery without a signature header", async () => {
		const req = createPushRequest("main") as unknown as {
			headers: Record<string, string | undefined>;
		};
		delete req.headers["x-hub-signature-256"];
		const res = createResponse();

		await handler(req as never, res);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(mocks.claimDelivery).not.toHaveBeenCalled();
		expect(mocks.queueAdd).not.toHaveBeenCalled();
	});

	it("rejects a delivery without a delivery id", async () => {
		const req = createPushRequest("main") as unknown as {
			headers: Record<string, string | undefined>;
		};
		delete req.headers["x-github-delivery"];
		const res = createResponse();

		await handler(req as never, res);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(mocks.queueAdd).not.toHaveBeenCalled();
	});

	it("never processes an unverified signature", async () => {
		mocks.verifySignature.mockResolvedValue(false);
		const res = createResponse();

		await handler(createPushRequest("main"), res);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(mocks.claimDelivery).not.toHaveBeenCalled();
		expect(mocks.queueAdd).not.toHaveBeenCalled();
	});

	it("does not disclose whether an installation exists", async () => {
		mocks.githubFindFirst.mockResolvedValue(undefined);
		const res = createResponse();

		await handler(createPushRequest("main"), res);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(mocks.queueAdd).not.toHaveBeenCalled();
	});

	it("acknowledges a duplicate delivery without enqueueing work", async () => {
		mocks.claimDelivery.mockResolvedValue("duplicate");
		const res = createResponse();

		await handler(createPushRequest("main"), res);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith({
			message: "Duplicate delivery ignored",
		});
		expect(mocks.queueAdd).not.toHaveBeenCalled();
		expect(mocks.completeDelivery).not.toHaveBeenCalled();
	});

	it("records the delivery outcome after processing", async () => {
		const res = createResponse();

		await handler(createPushRequest("main"), res);

		expect(mocks.completeDelivery).toHaveBeenCalledWith(
			expect.objectContaining({
				githubId: "github-provider-id",
				deliveryId: "delivery-1",
				status: "processed",
			}),
		);
	});

	it("refuses to deploy from a suspended installation", async () => {
		mocks.githubFindFirst.mockResolvedValue({
			githubId: "github-provider-id",
			githubInstallationId: 12345,
			githubWebhookSecret: "webhook-secret",
			githubInstallationSuspendedAt: new Date().toISOString(),
		});
		const res = createResponse();

		await handler(createPushRequest("main"), res);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith({
			message: "Installation suspended, deployment skipped",
		});
		expect(mocks.queueAdd).not.toHaveBeenCalled();
	});

	it("marks the installation suspended on a suspend event", async () => {
		const res = createResponse();

		await handler(
			createRequest(
				{ action: "suspend", installation: { id: 12345 } },
				"installation",
			),
			res,
		);

		expect(mocks.updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				githubInstallationSuspendedAt: expect.any(String),
			}),
		);
		expect(res.status).toHaveBeenCalledWith(200);
		expect(mocks.queueAdd).not.toHaveBeenCalled();
	});

	it("clears the suspension on an unsuspend event", async () => {
		const res = createResponse();

		await handler(
			createRequest(
				{ action: "unsuspend", installation: { id: 12345 } },
				"installation",
			),
			res,
		);

		expect(mocks.updateSet).toHaveBeenCalledWith({
			githubInstallationSuspendedAt: null,
		});
		expect(res.status).toHaveBeenCalledWith(200);
	});

	it("acknowledges installation repository changes", async () => {
		const res = createResponse();

		await handler(
			createRequest(
				{
					action: "added",
					installation: { id: 12345 },
					repositories_added: [{ id: 1, name: "a", full_name: "acme/a" }],
				},
				"installation_repositories",
			),
			res,
		);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith({
			message: "Installation repositories updated",
		});
	});

	it("acknowledges unsupported events instead of failing the delivery", async () => {
		const res = createResponse();

		await handler(
			createRequest(
				{
					zen: "Keep it logically awesome.",
					installation: { id: 12345 },
				},
				"issues",
			),
			res,
		);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(mocks.queueAdd).not.toHaveBeenCalled();
	});
});
