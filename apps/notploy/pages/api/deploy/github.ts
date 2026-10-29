import {
	checkUserRepositoryPermissions,
	createPreviewDeployment,
	createSecurityBlockedComment,
	findGithubById,
	findPreviewDeploymentByApplicationId,
	findPreviewDeploymentsByPullRequestId,
	IS_CLOUD,
	removePreviewDeployment,
	shouldDeploy,
} from "@notploy/server";
import { db } from "@notploy/server/db";
import { and, eq } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";
import { applications, compose, github } from "@/server/db/schema";
import type { DeploymentJob } from "@/server/queues/queue-types";
import { myQueue } from "@/server/queues/queueSetup";
import { deploy } from "@/server/utils/deploy";
import {
	claimGithubDelivery,
	completeGithubDelivery,
	GithubWebhookRequestError,
	readRawWebhookBody,
	verifyGithubSignature,
} from "@/server/utils/github-webhook";
import {
	extractCommitMessage,
	extractHash,
	logWebhookError,
} from "./[refreshToken]";

const getGithubRepositoryOwner = (githubBody: any) =>
	githubBody?.repository?.owner?.name ?? githubBody?.repository?.owner?.login;

type GithubProviderRow = typeof github.$inferSelect;

/**
 * Installation lifecycle events.
 *
 * Suspension and deletion revoke the installation's ability to deploy. The row
 * is kept (deployments and providers reference it), only the access marker is
 * set, so historical deployments stay traceable.
 */
const applyInstallationEvent = async (
	event: string,
	githubBody: any,
	githubResult: GithubProviderRow,
): Promise<string> => {
	if (event === "installation_repositories") {
		// The accessible repository set is authoritative on GitHub and is re-read
		// on every deployment, so there is nothing to persist here.
		return "Installation repositories updated";
	}

	switch (githubBody?.action) {
		case "suspend":
			await db
				.update(github)
				.set({
					githubInstallationSuspendedAt: new Date().toISOString(),
				})
				.where(eq(github.githubId, githubResult.githubId));
			return "Installation suspended";

		case "deleted":
			await db
				.update(github)
				.set({
					githubInstallationSuspendedAt: new Date().toISOString(),
				})
				.where(eq(github.githubId, githubResult.githubId));
			return "Installation deleted";

		case "unsuspend":
		case "created":
		case "new_permissions_accepted":
			await db
				.update(github)
				.set({ githubInstallationSuspendedAt: null })
				.where(eq(github.githubId, githubResult.githubId));
			return `Installation ${githubBody.action}`;

		default:
			return "Installation event ignored";
	}
};

// GitHub signs the raw bytes of the request: a parsed, re-serialized body would
// produce a different HMAC, so the route reads the stream itself.
export const config = {
	api: {
		bodyParser: false,
	},
};

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	const signature = req.headers["x-hub-signature-256"];
	const event = req.headers["x-github-event"];
	const deliveryId = req.headers["x-github-delivery"];

	if (
		typeof signature !== "string" ||
		typeof event !== "string" ||
		typeof deliveryId !== "string"
	) {
		res.status(400).json({ message: "Missing GitHub webhook headers" });
		return;
	}

	let rawBody: string;
	try {
		rawBody = await readRawWebhookBody(req);
	} catch (error) {
		const status =
			error instanceof GithubWebhookRequestError ? error.status : 400;
		res.status(status).json({ message: "Invalid GitHub webhook request" });
		return;
	}

	let githubBody: any;
	try {
		githubBody = JSON.parse(rawBody);
	} catch {
		res.status(400).json({ message: "Invalid JSON payload" });
		return;
	}

	// The installation id is only used to select the secret that verifies this
	// delivery. Nothing else from the payload is trusted before the check below.
	const installationId = githubBody?.installation?.id;
	if (!installationId) {
		res.status(400).json({ message: "Github Installation not found" });
		return;
	}

	const githubResult = await db.query.github.findFirst({
		where: eq(github.githubInstallationId, String(installationId)),
	});

	// Unknown or unconfigured installations get the same answer as a bad
	// signature, so the endpoint does not disclose which installations exist.
	if (!githubResult?.githubWebhookSecret) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	const verified = await verifyGithubSignature({
		secret: githubResult.githubWebhookSecret,
		payload: rawBody,
		signature,
	});

	if (!verified) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	if (event === "ping") {
		res.status(200).json({ message: "Ping received, webhook is active" });
		return;
	}

	// Deduplicate before doing any work: GitHub redelivers events and retries
	// failed ones, and a redelivery must never create a second deployment.
	const claim = await claimGithubDelivery({
		githubId: githubResult.githubId,
		deliveryId,
		event,
	});

	if (claim === "duplicate") {
		res.status(200).json({ message: "Duplicate delivery ignored" });
		return;
	}

	/**
	 * Sends the response and records the delivery outcome. The write is awaited
	 * so a serverless runtime cannot freeze before the bookkeeping completes.
	 */
	const respond = async (status: number, body: Record<string, unknown>) => {
		const outcome =
			status >= 500 ? "failed" : status >= 400 ? "ignored" : "processed";
		try {
			await completeGithubDelivery({
				githubId: githubResult.githubId,
				deliveryId,
				status: outcome,
				...(outcome === "failed"
					? { errorMessage: "GitHub webhook processing failed" }
					: {}),
			});
		} catch (error) {
			// Bookkeeping must never mask the real response.
			logWebhookError("Error recording GitHub delivery:", error);
		}
		res.status(status).json(body);
	};

	if (event === "installation" || event === "installation_repositories") {
		const message = await applyInstallationEvent(
			event,
			githubBody,
			githubResult,
		);
		await respond(200, { message });
		return;
	}

	if (githubResult.githubInstallationSuspendedAt) {
		await respond(200, {
			message: "Installation suspended, deployment skipped",
		});
		return;
	}

	if (event !== "push" && event !== "pull_request") {
		await respond(200, {
			message: "Unsupported event, delivery ignored",
		});
		return;
	}

	// skip workflow runs use keywords
	// @link https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/skipping-workflow-runs
	if (
		[
			"[skip ci]",
			"[ci skip]",
			"[no ci]",
			"[skip actions]",
			"[actions skip]",
		].find((keyword) =>
			extractCommitMessage(req.headers, githubBody).includes(keyword),
		)
	) {
		await respond(200, {
			message: "Deployment skipped: commit message contains skip keyword",
		});
		return;
	}

	// Handle tag creation event
	if (
		req.headers["x-github-event"] === "push" &&
		githubBody?.ref?.startsWith("refs/tags/")
	) {
		try {
			const tagName = githubBody?.ref.replace("refs/tags/", "");
			const repository = githubBody?.repository?.name;
			const owner = getGithubRepositoryOwner(githubBody);
			const deploymentTitle = `Tag created: ${tagName}`;
			const deploymentHash = extractHash(req.headers, githubBody);

			// Find applications configured to deploy on tag
			const apps = await db.query.applications.findMany({
				where: and(
					eq(applications.sourceType, "github"),
					eq(applications.autoDeploy, true),
					eq(applications.triggerType, "tag"),
					eq(applications.repository, repository),
					eq(applications.owner, owner),
					eq(applications.githubId, githubResult.githubId),
				),
			});

			for (const app of apps) {
				const jobData: DeploymentJob = {
					applicationId: app.applicationId as string,
					titleLog: deploymentTitle,
					descriptionLog: `Hash: ${deploymentHash}`,
					type: "deploy",
					applicationType: "application",
					server: !!app.serverId,
				};

				if (IS_CLOUD && app.serverId) {
					jobData.serverId = app.serverId;
					deploy(jobData).catch((error) => {
						console.error("Background deployment failed:", error);
					});
					continue;
				}
				await myQueue.add(
					"deployments",
					{ ...jobData },
					{
						removeOnComplete: true,
						removeOnFail: true,
					},
				);
			}

			// Find compose apps configured to deploy on tag
			const composeApps = await db.query.compose.findMany({
				where: and(
					eq(compose.sourceType, "github"),
					eq(compose.autoDeploy, true),
					eq(compose.triggerType, "tag"),
					eq(compose.repository, repository),
					eq(compose.owner, owner),
					eq(compose.githubId, githubResult.githubId),
				),
			});

			for (const composeApp of composeApps) {
				const jobData: DeploymentJob = {
					composeId: composeApp.composeId as string,
					titleLog: deploymentTitle,
					type: "deploy",
					applicationType: "compose",
					descriptionLog: `Hash: ${deploymentHash}`,
					server: !!composeApp.serverId,
				};

				if (IS_CLOUD && composeApp.serverId) {
					jobData.serverId = composeApp.serverId;
					deploy(jobData).catch((error) => {
						console.error("Background deployment failed:", error);
					});
					continue;
				}

				await myQueue.add(
					"deployments",
					{ ...jobData },
					{
						removeOnComplete: true,
						removeOnFail: true,
					},
				);
			}

			const totalApps = apps.length + composeApps.length;

			if (totalApps === 0) {
				res
					.status(200)
					.json({ message: "No apps configured to deploy on tag" });
				return;
			}

			await respond(200, {
				message: `Deployed ${totalApps} apps based on tag ${tagName}`,
			});
			return;
		} catch (error) {
			logWebhookError("Error deploying applications on tag:", error);
			await respond(400, { message: "Error deploying applications on tag" });
			return;
		}
	}

	if (req.headers["x-github-event"] === "push") {
		try {
			const branchName = githubBody?.ref?.replace("refs/heads/", "");
			const repository = githubBody?.repository?.name;

			const deploymentTitle = extractCommitMessage(req.headers, githubBody);
			const deploymentHash = extractHash(req.headers, githubBody);
			const owner = getGithubRepositoryOwner(githubBody);
			const normalizedCommits = githubBody?.commits?.flatMap((commit: any) => [
				...(commit.added || []),
				...(commit.modified || []),
				...(commit.removed || []),
			]);

			const apps = await db.query.applications.findMany({
				where: and(
					eq(applications.sourceType, "github"),
					eq(applications.autoDeploy, true),
					eq(applications.triggerType, "push"),
					eq(applications.branch, branchName),
					eq(applications.repository, repository),
					eq(applications.owner, owner),
					eq(applications.githubId, githubResult.githubId),
				),
			});

			for (const app of apps) {
				const jobData: DeploymentJob = {
					applicationId: app.applicationId as string,
					titleLog: deploymentTitle,
					descriptionLog: `Hash: ${deploymentHash}`,
					type: "deploy",
					applicationType: "application",
					server: !!app.serverId,
				};

				const shouldDeployPaths = shouldDeploy(
					app.watchPaths,
					normalizedCommits,
				);

				if (!shouldDeployPaths) {
					continue;
				}

				if (IS_CLOUD && app.serverId) {
					jobData.serverId = app.serverId;
					deploy(jobData).catch((error) => {
						console.error("Background deployment failed:", error);
					});
					continue;
				}
				await myQueue.add(
					"deployments",
					{ ...jobData },
					{
						removeOnComplete: true,
						removeOnFail: true,
					},
				);
			}

			const composeApps = await db.query.compose.findMany({
				where: and(
					eq(compose.sourceType, "github"),
					eq(compose.autoDeploy, true),
					eq(compose.triggerType, "push"),
					eq(compose.branch, branchName),
					eq(compose.repository, repository),
					eq(compose.owner, owner),
					eq(compose.githubId, githubResult.githubId),
				),
			});

			for (const composeApp of composeApps) {
				const jobData: DeploymentJob = {
					composeId: composeApp.composeId as string,
					titleLog: deploymentTitle,
					type: "deploy",
					applicationType: "compose",
					descriptionLog: `Hash: ${deploymentHash}`,
					server: !!composeApp.serverId,
				};

				const shouldDeployPaths = shouldDeploy(
					composeApp.watchPaths,
					normalizedCommits,
				);

				if (!shouldDeployPaths) {
					continue;
				}
				if (IS_CLOUD && composeApp.serverId) {
					jobData.serverId = composeApp.serverId;
					deploy(jobData).catch((error) => {
						console.error("Background deployment failed:", error);
					});
					continue;
				}

				await myQueue.add(
					"deployments",
					{ ...jobData },
					{
						removeOnComplete: true,
						removeOnFail: true,
					},
				);
			}

			const totalApps = apps.length + composeApps.length;
			const emptyApps = totalApps === 0;

			if (emptyApps) {
				await respond(200, { message: "No apps to deploy" });
				return;
			}
			await respond(200, { message: `Deployed ${totalApps} apps` });
		} catch (error) {
			logWebhookError("Error deploying Application:", error);
			await respond(400, { message: "Error deploying Application" });
		}
	} else if (req.headers["x-github-event"] === "pull_request") {
		const prId = githubBody?.pull_request?.id;
		const action = githubBody?.action;

		if (action === "closed") {
			const previewDeploymentResult =
				await findPreviewDeploymentsByPullRequestId(prId);

			if (previewDeploymentResult.length > 0) {
				for (const previewDeployment of previewDeploymentResult) {
					try {
						await removePreviewDeployment(
							previewDeployment.previewDeploymentId,
						);
					} catch (error) {
						console.log(error);
					}
				}
			}
			await respond(200, { message: "Preview Deployment Closed" });
			return;
		}

		// opened or synchronize or reopened
		if (
			action === "opened" ||
			action === "synchronize" ||
			action === "reopened" ||
			action === "labeled" ||
			action === "unlabeled"
		) {
			const shouldCreateDeployment =
				action === "opened" ||
				action === "synchronize" ||
				action === "reopened" ||
				action === "labeled";

			const repository = githubBody?.repository?.name;
			const deploymentHash = githubBody?.pull_request?.head?.sha;
			const branch = githubBody?.pull_request?.base?.ref;
			const owner = getGithubRepositoryOwner(githubBody);
			const prAuthor = githubBody?.pull_request?.user?.login;

			// Validate PR author information is present
			if (!prAuthor) {
				console.warn(
					"⚠️ SECURITY: PR author information missing in webhook payload",
				);
				await respond(400, {
					message: "PR author information missing",
				});
				return;
			}

			const apps = await db.query.applications.findMany({
				where: and(
					eq(applications.sourceType, "github"),
					eq(applications.repository, repository),
					eq(applications.branch, branch),
					eq(applications.isPreviewDeploymentsActive, true),
					eq(applications.owner, owner),
					eq(applications.githubId, githubResult.githubId),
				),
				with: {
					previewDeployments: true,
				},
			});

			// SECURITY: Check collaborator permissions per application setting
			const secureApps: typeof apps = [];
			const blockedApps: string[] = [];
			let userPermission: string | null = null;

			for (const app of apps) {
				// If the app requires collaborator permissions, verify them
				if (app.previewRequireCollaboratorPermissions !== false) {
					try {
						const githubProvider = await findGithubById(githubResult.githubId);
						const { hasWriteAccess, permission } =
							await checkUserRepositoryPermissions(
								githubProvider,
								owner,
								repository,
								prAuthor,
							);

						userPermission = permission; // Store permission for comment

						if (!hasWriteAccess) {
							console.warn(
								`🚨 SECURITY: Blocked preview deployment for ${app.name} from unauthorized user ${prAuthor} on ${owner}/${repository}. Permission: ${permission || "none"}`,
							);
							blockedApps.push(app.name);
							continue;
						}

						console.log(
							`✅ SECURITY: Preview deployment authorized for ${app.name} from user ${prAuthor} on ${owner}/${repository}. Permission: ${permission}`,
						);
					} catch (error) {
						console.error(
							`Error validating PR author permissions for ${app.name}:`,
							error,
						);
						blockedApps.push(app.name);
						continue; // Skip this app on error
					}
				} else {
					console.warn(
						`⚠️  SECURITY: Preview deployment for ${app.name} allows deployment from any PR author (security check disabled)`,
					);
				}
				secureApps.push(app);
			}

			const prBranch = githubBody?.pull_request?.head?.ref;

			const prNumber = githubBody?.pull_request?.number;
			const prTitle = githubBody?.pull_request?.title;
			const prURL = githubBody?.pull_request?.html_url;

			// Create security notification comment if any apps were blocked
			if (blockedApps.length > 0) {
				await createSecurityBlockedComment({
					owner,
					repository,
					prNumber: Number.parseInt(prNumber, 10),
					prAuthor,
					permission: userPermission,
					githubId: githubResult.githubId,
				});
			}

			for (const app of secureApps) {
				// check for labels
				if (app?.previewLabels && app?.previewLabels?.length > 0) {
					let hasLabel = false;
					const labels = githubBody?.pull_request?.labels;
					for (const label of labels) {
						if (app?.previewLabels?.includes(label.name)) {
							hasLabel = true;
							break;
						}
					}
					if (!hasLabel) continue;
				}

				const previewDeploymentResult =
					await findPreviewDeploymentByApplicationId(app.applicationId, prId);

				let previewDeploymentId =
					previewDeploymentResult?.previewDeploymentId || "";

				if (!previewDeploymentResult && shouldCreateDeployment) {
					// The limit only applies to new previews, existing ones must
					// still be redeployed when the pull request is updated.
					const previewLimit = app?.previewLimit ?? 3;
					if ((app?.previewDeployments?.length ?? 0) >= previewLimit) {
						console.warn(
							`⚠️ Preview deployment limit (${previewLimit}) reached for ${app.name}, skipping preview for pull request #${prNumber}`,
						);
						continue;
					}
					const previewDeployment = await createPreviewDeployment({
						applicationId: app.applicationId as string,
						branch: prBranch,
						pullRequestId: prId,
						pullRequestNumber: prNumber,
						pullRequestTitle: prTitle,
						pullRequestURL: prURL,
					});
					previewDeploymentId = previewDeployment.previewDeploymentId;
				}

				const jobData: DeploymentJob = {
					applicationId: app.applicationId as string,
					titleLog: "Preview Deployment",
					descriptionLog: `Hash: ${deploymentHash}`,
					type: "deploy",
					applicationType: "application-preview",
					server: !!app.serverId,
					previewDeploymentId,
				};

				if (previewDeploymentId) {
					if (IS_CLOUD && app.serverId) {
						jobData.serverId = app.serverId;
						deploy(jobData).catch((error) => {
							console.error("Background deployment failed:", error);
						});
						continue;
					}
					await myQueue.add(
						"deployments",
						{ ...jobData },
						{
							removeOnComplete: true,
							removeOnFail: true,
						},
					);
				}
			}
			return await respond(200, { message: "Apps Deployed" });
		}
	}

	// A verified delivery that matched no supported action is acknowledged:
	// returning an error would make GitHub retry an event we chose to ignore.
	return await respond(200, { message: "No Actions matched" });
}
