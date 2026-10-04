import {
	createDeployment,
	IS_CLOUD,
	QUEUED_GITHUB_STATUS,
	findCicdDeploymentByDeploymentId,
	findCicdDeploymentByExternalId,
	getCicdDeploymentView,
	readDeploymentLogs,
	resolveCicdTarget,
	toGithubDeploymentStatus,
} from "@notploy/server";
import { db } from "@notploy/server/db";
import {
	apiCicdDeploy,
	apiCicdDeploymentId,
	apiCicdDeploymentLogs,
	apiCicdList,
	apiCicdResolve,
	apiCreateCicdToken,
	applications,
	apikey,
	cicdDeployments,
	deployments,
	environments,
	projects,
} from "@notploy/server/db/schema";
import {
	type CicdAction,
	type CicdTokenScope,
	assertCicdTarget,
	buildCicdApiKeyMetadata,
	parseCicdTokenScope,
	resolveCicdActions,
} from "@notploy/server/lib/cicd-scope";
import { findApplicationById } from "@notploy/server/services/application";
import { findDeploymentById } from "@notploy/server/services/deployment";
import {
	type PermissionCtx,
	checkPermission,
	checkServicePermissionAndAccess,
	findMemberByUserId,
} from "@notploy/server/services/permission";
import { createApiKey } from "@notploy/server/services/user";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { cleanQueuesByApplication, myQueue } from "@/server/queues/queueSetup";
import { deploy } from "@/server/utils/deploy";
import { createTRPCRouter, protectedProcedure, withCicdAction } from "../trpc";

/**
 * CI/CD API.
 *
 * Two audiences share this router:
 *
 * - `resolve`, `deploy`, `status`, `logs`, `cancel` and `redeploy` are the
 *   machine-facing surface used by GitHub Actions (or any CI). They authenticate
 *   with a CI/CD token through `cicdProcedure`, never with a dashboard session,
 *   and are the only part exposed in the OpenAPI document.
 * - `tokens`, `createToken`, `revokeToken` and `projectDeployments` back the
 *   dashboard page. They are session-only and excluded from OpenAPI because a
 *   secret can only be handed to a human from a browser.
 *
 * Authorization is layered, and every layer is checked server-side:
 * 1. `cicdProcedure` → the credential is a CI/CD token of the caller's org.
 * 2. `withCicdAction` → the token grants this action.
 * 3. `assertCicdTarget` → the target is inside the token's project (and inside
 *    its environment/application/repository restrictions when set).
 * 4. `checkServicePermissionAndAccess` → the token's user still has the
 *    underlying Notploy permission, so revoking a member's access immediately
 *    stops their workflows from deploying.
 */

/** Deep link of a deployment's logs on the CI/CD API. */
const logsUrl = (deploymentId: string) =>
	`/api/v1/cicd/deployments/${deploymentId}/logs`;

/**
 * Loads a deployment's CI/CD metadata and checks the token may act on it.
 *
 * The scope is matched against the *stored* project/environment/application of
 * the deployment, never against request input, so a `deploymentId` belonging to
 * another project is indistinguishable from one that does not exist.
 */
const authorizeCicdDeployment = async (
	ctx: PermissionCtx & { cicd: { scope: CicdTokenScope } },
	input: { deploymentId: string; action: CicdAction },
) => {
	const metadata = await findCicdDeploymentByDeploymentId(input.deploymentId);

	if (
		!metadata ||
		metadata.organizationId !== ctx.session.activeOrganizationId
	) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Deployment not found",
		});
	}

	assertCicdTarget(ctx.cicd.scope, input.action, {
		projectId: metadata.projectId,
		environmentId: metadata.environmentId,
		applicationId: metadata.applicationId,
	});

	if (metadata.applicationId) {
		await checkServicePermissionAndAccess(ctx, metadata.applicationId, {
			deployment: [input.action === "cancel" ? "cancel" : "read"],
		});
	}

	return metadata;
};

/**
 * Dashboard access to a project.
 *
 * Members are additionally limited to the projects they were granted access to,
 * so a CI/CD page cannot become a way around that. The role is read from the
 * member record rather than the session so a role change takes effect on the
 * next call.
 */
const assertProjectAccess = async (
	ctx: PermissionCtx,
	projectId: string,
) => {
	const project = await db.query.projects.findFirst({
		where: eq(projects.projectId, projectId),
		columns: { projectId: true, organizationId: true },
	});

	if (!project || project.organizationId !== ctx.session.activeOrganizationId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Project not found",
		});
	}

	const member = await findMemberByUserId(ctx.user.id, {
		organizationId: ctx.session.activeOrganizationId,
	});

	if (
		member.role !== "owner" &&
		member.role !== "admin" &&
		!member.accessedProjects.includes(projectId)
	) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You don't have access to this project",
		});
	}
};

/** CI/CD tokens of a project, newest first. */
const listCicdTokens = async (organizationId: string, projectId: string) => {
	// `metadata` is a text column holding JSON, so the rows are narrowed with a
	// LIKE prefilter and then parsed properly: a token is only listed when its
	// scope really belongs to this organization and project.
	const rows = await db.query.apikey.findMany({
		where: like(apikey.metadata, '%"cicd"%'),
		columns: {
			id: true,
			name: true,
			prefix: true,
			enabled: true,
			expiresAt: true,
			createdAt: true,
			lastRequest: true,
			metadata: true,
			referenceId: true,
		},
	});

	return rows
		.map((row) => {
			const parsed: unknown = row.metadata ? JSON.parse(row.metadata) : null;
			const organizationIdFromKey =
				parsed && typeof parsed === "object"
					? (parsed as { organizationId?: unknown }).organizationId
					: undefined;
			const scope = parseCicdTokenScope(row.metadata);
			return { row, scope, organizationIdFromKey };
		})
		.filter(
			({ scope, organizationIdFromKey }) =>
				scope?.projectId === projectId &&
				organizationIdFromKey === organizationId,
		)
		.map(({ row, scope }) => ({
			id: row.id,
			name: row.name,
			prefix: row.prefix,
			enabled: row.enabled ?? true,
			expiresAt: row.expiresAt,
			createdAt: row.createdAt,
			lastUsedAt: row.lastRequest,
			actions: scope?.actions ?? [],
			environmentIds: scope?.environmentIds ?? [],
			applicationIds: scope?.applicationIds ?? [],
			provider: scope?.provider ?? null,
			repository: scope?.repository ?? null,
		}))
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export const cicdRouter = createTRPCRouter({
	/**
	 * Dry run: validates the token and the project / environment / application
	 * names a workflow was configured with, without triggering a build.
	 *
	 * Worth exposing separately because a typo in `application` is the most
	 * common CI misconfiguration, and catching it before the build saves a run.
	 */
	resolve: withCicdAction("resolve")
		.input(apiCicdResolve)
		.meta({
			openapi: {
				method: "POST",
				path: "/cicd/resolve",
				override: true,
				tags: ["cicd"],
				summary: "Resolve a CI target",
				description:
					"Checks that the token is allowed to deploy the given application and returns the resolved project, environment and application.",
			},
		})
		.mutation(async ({ ctx, input }) => {
			const target = await resolveCicdTarget({
				organizationId: ctx.session.activeOrganizationId,
				projectId: ctx.cicd.scope.projectId,
				project: input.project,
				environment: input.environment,
				application: input.application,
			});

			assertCicdTarget(ctx.cicd.scope, "resolve", {
				projectId: target.projectId,
				environmentId: target.environmentId,
				applicationId: target.applicationId,
			});

			await checkServicePermissionAndAccess(ctx, target.applicationId, {
				deployment: ["read"],
			});

			return {
				projectId: target.projectId,
				projectName: target.projectName,
				environmentId: target.environmentId,
				environmentName: target.environmentName,
				applicationId: target.applicationId,
				applicationName: target.applicationName,
				appName: target.appName,
				applicationStatus: target.applicationStatus,
				sourceType: target.sourceType,
				repository: target.repository,
				branch: target.branch,
				buildServerId: target.serverId,
				applicationUrl: target.dashboardUrl,
				environmentUrl: target.environmentUrl,
			};
		}),

	/**
	 * Requests a build of an exact commit.
	 *
	 * The deployment row is created *before* the job is queued so the response
	 * already carries a `deploymentId` the workflow can poll from its first step.
	 * The worker then reuses that row instead of creating a second one.
	 *
	 * Idempotent on `(project, application, idempotencyKey|runId)`: a re-run or a
	 * retried HTTP call returns the original deployment with `idempotent: true`.
	 */
	deploy: withCicdAction("deploy")
		.input(apiCicdDeploy)
		.meta({
			openapi: {
				method: "POST",
				path: "/cicd/deploy",
				override: true,
				tags: ["cicd"],
				summary: "Deploy a commit",
				description:
					"Queues a deployment for an exact commit sha and returns the Notploy deployment id, which can be polled with the status endpoint.",
			},
		})
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.session.activeOrganizationId;

			const target = await resolveCicdTarget({
				organizationId,
				projectId: ctx.cicd.scope.projectId,
				project: input.project,
				environment: input.environment,
				application: input.application,
			});

			assertCicdTarget(ctx.cicd.scope, "deploy", {
				projectId: target.projectId,
				environmentId: target.environmentId,
				applicationId: target.applicationId,
				provider: input.source.provider,
				repository: input.source.repository,
			});

			await checkServicePermissionAndAccess(ctx, target.applicationId, {
				deployment: ["create"],
			});

			const branch = input.source.ref ?? target.branch;
			const title =
				input.title ??
				`${target.appName}: ${input.source.repository}@${input.source.commitSha.slice(0, 7)}`;
			const description =
				input.description ??
				[
					`${input.source.workflow ?? "CI/CD"} requested a deployment of ${input.source.commitSha}`,
					input.source.runNumber ? `run #${input.source.runNumber}` : null,
					input.source.actor ? `by ${input.source.actor}` : null,
				]
					.filter(Boolean)
					.join(" ");

			// Scoped by project and application: the same CI run id can legitimately
			// appear twice in a monorepo (one per app), and each app must get its
			// own deployment.
			const externalId = [
				target.projectId,
				target.applicationId,
				input.idempotencyKey ?? input.source.runId ?? nanoid(),
			].join(":");

			const known = await findCicdDeploymentByExternalId(
				input.source.provider,
				externalId,
			);

			if (known) {
				return {
					...(await getCicdDeploymentView(known.deploymentId)),
					idempotent: true,
					message:
						"This request was already recorded, returning the existing deployment",
				};
			}

			const application = await findApplicationById(target.applicationId);

			const deploymentId = await createDeploymentId({
				applicationId: target.applicationId,
				appName: application.appName,
				titleLog: title,
				descriptionLog: description,
			});

			if (!deploymentId) {
				// `createDeployment` stores the failure as a deployment of its own,
				// so report that instead of failing the workflow with no context.
				const failed = await latestDeploymentOf(target.applicationId);
				return {
					idempotent: false,
					deployment: failed?.deploymentId ?? null,
					commitSha: input.source.commitSha,
					status: failed?.status ?? "error",
					githubStatus: toGithubDeploymentStatus("error"),
					logsUrl: failed ? logsUrl(failed.deploymentId) : null,
					deploymentUrl: target.dashboardUrl,
					applicationUrl: target.dashboardUrl,
					environmentUrl: target.environmentUrl,
					message: "Notploy could not start the deployment",
				};
			}

			await db.insert(cicdDeployments).values({
				deploymentId,
				organizationId,
				projectId: target.projectId,
				environmentId: target.environmentId,
				applicationId: target.applicationId,
				provider: input.source.provider,
				repository: input.source.repository,
				commitSha: input.source.commitSha,
				ref: branch,
				workflow: input.source.workflow,
				workflowRunId: input.source.runId,
				workflowRunUrl: input.source.runUrl,
				runNumber: input.source.runNumber,
				actor: input.source.actor,
				externalDeploymentId: input.source.deploymentId,
				externalId,
				environmentUrl: target.environmentUrl,
			});

			const job = {
				applicationId: target.applicationId,
				titleLog: title,
				descriptionLog: description,
				type: "deploy" as const,
				applicationType: "application" as const,
				deploymentId,
				commitSha: input.source.commitSha,
			};

			// In the cloud the build runs on the customer's server through the
			// server API, self-hosted through the local queue.
			if (IS_CLOUD && target.serverId) {
				await deploy(job);
			} else {
				await myQueue.add("deployments", job);
			}

			await audit(ctx, {
				action: "create",
				resourceType: "deployment",
				resourceId: deploymentId,
				resourceName: title,
			});

			return {
				...(await getCicdDeploymentView(deploymentId)),
				idempotent: false,
				message: `Deployment queued for ${input.source.commitSha.slice(0, 7)}`,
			};
		}),

	status: withCicdAction("status")
		.input(apiCicdDeploymentId)
		.meta({
			openapi: {
				method: "GET",
				path: "/cicd/deployments/{deploymentId}",
				override: true,
				tags: ["cicd"],
				summary: "Get a deployment status",
				description:
					"Returns the Notploy status, the GitHub Deployments state to publish, and the links to the deployment and its logs.",
			},
		})
		.query(async ({ ctx, input }) => {
			await authorizeCicdDeployment(ctx, { ...input, action: "status" });
			return getCicdDeploymentView(input.deploymentId);
		}),

	logs: withCicdAction("logs")
		.input(apiCicdDeploymentLogs)
		.meta({
			openapi: {
				method: "GET",
				path: "/cicd/deployments/{deploymentId}/logs",
				override: true,
				tags: ["cicd"],
				summary: "Read deployment logs",
				description:
					"Returns the last lines of the build log, so a workflow can surface a failing build without asking the user to open Notploy.",
			},
		})
		.query(async ({ ctx, input }) => {
			await authorizeCicdDeployment(ctx, { ...input, action: "logs" });
			const deployment = await findDeploymentById(input.deploymentId);
			const logs = await readDeploymentLogs(deployment, input.tail);

			return {
				deploymentId: deployment.deploymentId,
				status: deployment.status,
				logs,
				lineCount: logs ? logs.split("\n").length : 0,
				tail: input.tail,
				truncated: logs ? logs.split("\n").length >= input.tail : false,
			};
		}),

	cancel: withCicdAction("cancel")
		.input(apiCicdDeploymentId)
		.meta({
			openapi: {
				method: "POST",
				path: "/cicd/deployments/{deploymentId}/cancel",
				override: true,
				tags: ["cicd"],
				summary: "Cancel a deployment",
				description:
					"Cancels a queued or running deployment. A queued deployment is removed from the queue so the application is never left waiting on it.",
			},
		})
		.mutation(async ({ ctx, input }) => {
			const metadata = await authorizeCicdDeployment(ctx, {
				...input,
				action: "cancel",
			});
			const deployment = await findDeploymentById(input.deploymentId);

			if (deployment.status !== "queued" && deployment.status !== "running") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Cannot cancel a deployment with status "${deployment.status}"`,
				});
			}

			if (deployment.applicationId) {
				await cleanQueuesByApplication(deployment.applicationId);
				await db
					.update(applications)
					.set({ status: "idle" })
					.where(eq(applications.applicationId, deployment.applicationId));
			}

			await db
				.update(deployments)
				.set({ status: "cancelled", finishedAt: new Date() })
				.where(eq(deployments.deploymentId, input.deploymentId));

			await audit(ctx, {
				action: "stop",
				resourceType: "deployment",
				resourceId: input.deploymentId,
			});

			return {
				deployment: input.deploymentId,
				commitSha: metadata.commitSha,
				status: "cancelled",
				githubStatus: toGithubDeploymentStatus("cancelled"),
				logsUrl: logsUrl(input.deploymentId),
				message: "Deployment cancelled",
			};
		}),

	/**
	 * Replays a previous deployment for the exact same commit.
	 *
	 * Deliberately not a "deploy the branch tip" endpoint: a redeploy triggered by
	 * a status check must reproduce the artifact that failed, otherwise the
	 * behaviour of `redeploy` would depend on when it was called.
	 */
	redeploy: withCicdAction("redeploy")
		.input(apiCicdDeploymentId)
		.meta({
			openapi: {
				method: "POST",
				path: "/cicd/deployments/{deploymentId}/redeploy",
				override: true,
				tags: ["cicd"],
				summary: "Redeploy the same commit",
				description:
					"Queues a new deployment for the commit of the given deployment.",
			},
		})
		.mutation(async ({ ctx, input }) => {
			const source = await authorizeCicdDeployment(ctx, {
				...input,
				action: "redeploy",
			});

			if (!source.applicationId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only application deployments can be redeployed",
				});
			}

			const application = await findApplicationById(source.applicationId);
			const title = `${application.appName}: redeploy of ${source.commitSha.slice(0, 7)}`;
			const description = `Redeploy of ${source.commitSha} from ${source.repository}`;

			const deploymentId = await createDeploymentId({
				applicationId: source.applicationId,
				appName: application.appName,
				titleLog: title,
				descriptionLog: description,
			});

			if (!deploymentId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Notploy could not start the redeployment",
				});
			}

			await db.insert(cicdDeployments).values({
				deploymentId,
				organizationId: ctx.session.activeOrganizationId,
				projectId: source.projectId,
				environmentId: source.environmentId,
				applicationId: source.applicationId,
				provider: source.provider,
				repository: source.repository,
				commitSha: source.commitSha,
				ref: source.ref,
				workflow: source.workflow,
				workflowRunId: source.workflowRunId,
				workflowRunUrl: source.workflowRunUrl,
				runNumber: source.runNumber,
				actor: source.actor,
				externalDeploymentId: source.externalDeploymentId,
				externalId: nanoid(),
				environmentUrl: source.environmentUrl,
			});

			const job = {
				applicationId: source.applicationId,
				titleLog: title,
				descriptionLog: description,
				type: "redeploy" as const,
				applicationType: "application" as const,
				deploymentId,
				commitSha: source.commitSha,
			};

			if (IS_CLOUD && application.serverId) {
				await deploy(job);
			} else {
				await myQueue.add("deployments", job);
			}

			await audit(ctx, {
				action: "create",
				resourceType: "deployment",
				resourceId: deploymentId,
				resourceName: title,
			});

			return {
				deployment: deploymentId,
				commitSha: source.commitSha,
				status: QUEUED_GITHUB_STATUS,
				githubStatus: QUEUED_GITHUB_STATUS,
				logsUrl: logsUrl(deploymentId),
				message: `Redeploy queued for ${source.commitSha.slice(0, 7)}`,
			};
		}),

	/** Recent CI/CD deployments of the token's project. */
	list: withCicdAction("status")
		.input(apiCicdList)
		.meta({
			openapi: {
				method: "GET",
				path: "/cicd/deployments",
				override: true,
				tags: ["cicd"],
				summary: "List recent deployments",
			},
		})
		.query(async ({ ctx, input }) => {
			const rows = await db
				.select({ deploymentId: cicdDeployments.deploymentId })
				.from(cicdDeployments)
				.where(
					and(
						eq(cicdDeployments.projectId, ctx.cicd.scope.projectId),
						eq(
							cicdDeployments.organizationId,
							ctx.session.activeOrganizationId,
						),
					),
				)
				.orderBy(desc(cicdDeployments.createdAt))
				.limit(input.limit);

			return Promise.all(
				rows.map((row) => getCicdDeploymentView(row.deploymentId)),
			);
		}),

	/**
	 * Dashboard: CI/CD deployments of a project, with their GitHub metadata.
	 */
	projectDeployments: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				limit: z.coerce.number().int().min(1).max(100).default(25),
			}),
		)
		.meta({ openapi: { enabled: false } })
		.query(async ({ ctx, input }) => {
			await assertProjectAccess(ctx, input.projectId);

			const rows = await db
				.select({ deploymentId: cicdDeployments.deploymentId })
				.from(cicdDeployments)
				.where(
					and(
						eq(cicdDeployments.projectId, input.projectId),
						eq(
							cicdDeployments.organizationId,
							ctx.session.activeOrganizationId,
						),
					),
				)
				.orderBy(desc(cicdDeployments.createdAt))
				.limit(input.limit);

			return Promise.all(
				rows.map((row) => getCicdDeploymentView(row.deploymentId)),
			);
		}),

	/** Dashboard: CI/CD tokens of a project. */
	tokens: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.meta({ openapi: { enabled: false } })
		.query(async ({ ctx, input }) => {
			await assertProjectAccess(ctx, input.projectId);
			return listCicdTokens(ctx.session.activeOrganizationId, input.projectId);
		}),

	/**
	 * Dashboard: creates a CI/CD token.
	 *
	 * The secret is returned exactly once, here, and stored hashed; only the
	 * prefix is kept afterwards. Tokens are therefore created from a browser
	 * session and pasted into the CI provider's secret store.
	 */
	createToken: protectedProcedure
		.input(apiCreateCicdToken)
		.meta({ openapi: { enabled: false } })
		.mutation(async ({ ctx, input }) => {
			await assertProjectAccess(ctx, input.projectId);
			await checkPermission(ctx, { api: ["read"] });

			const project = await db.query.projects.findFirst({
				where: eq(projects.projectId, input.projectId),
				columns: { projectId: true, organizationId: true },
			});
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}

			if (input.environmentIds?.length) {
				const found = await db
					.select({ environmentId: environments.environmentId })
					.from(environments)
					.where(
						and(
							eq(
								environments.organizationId,
								ctx.session.activeOrganizationId,
							),
							inArray(environments.environmentId, input.environmentIds),
						),
					);
				if (found.length !== input.environmentIds.length) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "One or more environments are not in this organization",
					});
				}
			}

			if (input.applicationIds?.length) {
				const found = await db
					.select({ applicationId: applications.applicationId })
					.from(applications)
					.where(
						and(
							eq(
								applications.organizationId,
								ctx.session.activeOrganizationId,
							),
							inArray(applications.applicationId, input.applicationIds),
						),
					);
				if (found.length !== input.applicationIds.length) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "One or more applications are not in this organization",
					});
				}
			}

			const created = await createApiKey(ctx.user.id, {
				name: input.name,
				expiresIn: input.expiresIn,
				metadata: {
					organizationId: ctx.session.activeOrganizationId,
					cicd: {
						projectId: input.projectId,
						actions: input.actions,
						environmentIds: input.environmentIds,
						applicationIds: input.applicationIds,
						provider: input.provider,
						repository: input.repository,
					},
				},
			});

			// `createApiKey` writes the metadata it is given; re-asserting it here
			// through the shared builder keeps one serialization of the scope, so a
			// token can never be created with metadata this module cannot parse.
			await db
				.update(apikey)
				.set({
					metadata: buildCicdApiKeyMetadata({
						organizationId: ctx.session.activeOrganizationId,
						scope: {
							projectId: input.projectId,
							actions: input.actions,
							environmentIds: input.environmentIds,
							applicationIds: input.applicationIds,
							provider: input.provider,
							repository: input.repository,
						},
					}),
				})
				.where(eq(apikey.id, created.id));

			await audit(ctx, {
				action: "create",
				resourceType: "user",
				resourceId: created.id,
				resourceName: input.name,
			});

			return {
				id: created.id,
				name: created.name,
				prefix: created.prefix,
				// Shown once: better-auth returns the plaintext key here and never
				// stores it.
				key: created.key,
				actions: resolveCicdActions({
					projectId: input.projectId,
					actions: input.actions,
				}),
			};
		}),

	revokeToken: protectedProcedure
		.input(z.object({ apiKeyId: z.string().min(1) }))
		.meta({ openapi: { enabled: false } })
		.mutation(async ({ ctx, input }) => {
			const record = await db.query.apikey.findFirst({
				where: eq(apikey.id, input.apiKeyId),
			});
			const scope = parseCicdTokenScope(record?.metadata);

			if (!record || !scope) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "API key not found in this organization",
				});
			}

			await assertProjectAccess(ctx, scope.projectId);
			await checkPermission(ctx, { api: ["read"] });

			await db.delete(apikey).where(eq(apikey.id, input.apiKeyId));
			await audit(ctx, {
				action: "delete",
				resourceType: "user",
				resourceId: input.apiKeyId,
				resourceName: record.name ?? undefined,
			});

			return true;
		}),
});

/**
 * Creates the deployment row the worker will later adopt.
 *
 * `createDeployment` throws after recording the failure, which is the right
 * behaviour for the dashboard but hides the deployment id from a CI client, so
 * the id is resolved here instead: `undefined` means the failure row is the
 * deployment to report back.
 */
const createDeploymentId = async (input: {
	applicationId: string;
	appName: string;
	titleLog: string;
	descriptionLog: string;
}) => {
	try {
		const deployment = await createDeployment({
			applicationId: input.applicationId,
			titleLog: input.titleLog,
			descriptionLog: input.descriptionLog,
			appName: input.appName,
			type: "deploy",
			applicationType: "application",
		});
		return deployment.deploymentId;
	} catch {
		return undefined;
	}
};

/** Most recent deployment of an application, used to report a failed start. */
const latestDeploymentOf = async (applicationId: string) =>
	db.query.deployments.findFirst({
		where: eq(deployments.applicationId, applicationId),
		orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
	});

export default cicdRouter;