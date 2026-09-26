/**
 * Typed webhook events: a small discriminated union of the GitHub events
 * Notploy actually consumes. Unknown events are reported as "unsupported"
 * rather than forcing consumers to handle every GitHub event type.
 */

export type GitHubWebhookEventName =
	| "push"
	| "pull_request"
	| "installation"
	| "installation_repositories"
	| "repository"
	| "release"
	| "workflow_run";

export interface GitHubPushEvent {
	type: "push";
	ref: string;
	before: string;
	after: string;
	/** False when the whole repository was created/destroyed via push. */
	created: boolean;
	deleted: boolean;
	forced: boolean;
	repository: {
		id: number;
		name: string;
		fullName: string;
		owner: string;
		defaultBranch: string;
	};
	senderLogin?: string;
	/** Commits added by this push (newest last). */
	commits: Array<{
		id: string;
		message: string;
		modified: string[];
		added: string[];
		removed: string[];
	}>;
}

export type GitHubPullRequestAction =
	| "opened"
	| "closed"
	| "reopened"
	| "synchronize"
	| "edited"
	| "assigned"
	| "unassigned"
	| "labeled"
	| "unlabeled";

export interface GitHubPullRequestEvent {
	type: "pull_request";
	action: GitHubPullRequestAction;
	number: number;
	pullRequest: {
		id: number;
		title: string;
		state: "open" | "closed";
		draft: boolean;
		headRef: string;
		baseRef: string;
		headSha: string;
		htmlUrl: string;
		authorLogin?: string;
	};
	repository: {
		id: number;
		name: string;
		fullName: string;
		owner: string;
		defaultBranch: string;
	};
	senderLogin?: string;
}

export type GitHubInstallationAction =
	| "created"
	| "deleted"
	| "suspend"
	| "unsuspend"
	| "new_permissions_accepted";

export interface GitHubInstallationEvent {
	type: "installation";
	action: GitHubInstallationAction;
	installation: {
		id: number;
		accountLogin?: string;
		repositorySelection: string;
	};
	senderLogin?: string;
}

export interface GitHubInstallationRepositoriesEvent {
	type: "installation_repositories";
	action: "added" | "removed";
	installation: { id: number; accountLogin?: string };
	repositoriesAdded: Array<{ id: number; name: string; fullName: string }>;
	repositoriesRemoved: Array<{ id: number; name: string; fullName: string }>;
	repositorySelection: string;
	senderLogin?: string;
}

export interface GitHubRepositoryEvent {
	type: "repository";
	action:
		| "created"
		| "deleted"
		| "archived"
		| "unarchived"
		| "renamed"
		| "edited"
		| "transferred"
		| "publicized"
		| "privatized";
	repository: {
		id: number;
		name: string;
		fullName: string;
		owner: string;
		defaultBranch: string;
		private: boolean;
	};
	senderLogin?: string;
}

export interface GitHubReleaseEvent {
	type: "release";
	action:
		| "published"
		| "unpublished"
		| "created"
		| "edited"
		| "deleted"
		| "prereleased"
		| "released";
	release: {
		id: number;
		tagName: string;
		name?: string | null;
		draft: boolean;
		prerelease: boolean;
		htmlUrl: string;
	};
	repository: { id: number; name: string; fullName: string; owner: string };
	senderLogin?: string;
}

export interface GitHubWorkflowRunEvent {
	type: "workflow_run";
	action: "requested" | "in_progress" | "completed";
	workflowRun: {
		id: number;
		name?: string;
		headBranch: string;
		headSha: string;
		status?: string | null;
		conclusion?: string | null;
		htmlUrl: string;
	};
	repository: { id: number; name: string; fullName: string; owner: string };
	senderLogin?: string;
}

export type GitHubWebhookEvent =
	| GitHubPushEvent
	| GitHubPullRequestEvent
	| GitHubInstallationEvent
	| GitHubInstallationRepositoriesEvent
	| GitHubRepositoryEvent
	| GitHubReleaseEvent
	| GitHubWorkflowRunEvent;

export interface WebhookRepositoryInfo {
	id: number;
	name: string;
	full_name?: string;
	private?: boolean;
	default_branch?: string;
	owner?: { login?: string } | null;
}

type RawPayload = Record<string, unknown>;

const asRecord = (value: unknown): RawPayload =>
	(value && typeof value === "object" ? value : {}) as RawPayload;

const asString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

const asBool = (value: unknown, fallback = false): boolean =>
	typeof value === "boolean" ? value : fallback;

const asArray = (value: unknown): unknown[] =>
	Array.isArray(value) ? value : [];

const mapRepositoryInfo = (payload: RawPayload) => {
	const repository = asRecord(payload.repository);
	const owner = asRecord(repository.owner);
	const fullName =
		asString(repository.full_name) ??
		`${asString(owner.login) ?? "unknown"}/${asString(repository.name) ?? "unknown"}`;

	return {
		id: asNumber(repository.id) ?? 0,
		name: asString(repository.name) ?? "unknown",
		fullName,
		owner: asString(owner.login) ?? "unknown",
		defaultBranch: asString(repository.default_branch) ?? "main",
	};
};

const mapSender = (payload: RawPayload) => {
	const sender = asRecord(payload.sender);
	const login = asString(sender.login);
	return login ? { senderLogin: login } : {};
};

const mapPullRequest = (payload: RawPayload) => {
	const pr = asRecord(payload.pull_request);
	const user = asRecord(pr.user);
	const head = asRecord(pr.head);
	const base = asRecord(pr.base);

	return {
		id: asNumber(pr.id) ?? 0,
		title: asString(pr.title) ?? "",
		state: pr.state === "closed" ? ("closed" as const) : ("open" as const),
		draft: asBool(pr.draft),
		headRef: asString(head.ref) ?? "",
		baseRef: asString(base.ref) ?? "",
		headSha: asString(head.sha) ?? "",
		htmlUrl: asString(pr.html_url) ?? "",
		...(asString(user.login) ? { authorLogin: asString(user.login) } : {}),
	};
};

const mapInstallation = (payload: RawPayload) => {
	const installation = asRecord(payload.installation);
	const account = asRecord(installation.account);

	return {
		id: asNumber(installation.id) ?? 0,
		...(asString(account.login)
			? { accountLogin: asString(account.login) }
			: {}),
		repositorySelection:
			asString(installation.repository_selection) ?? "selected",
	};
};

const mapCommitItem = (item: unknown) => {
	const commit = asRecord(item);
	return {
		id: asString(commit.id) ?? "",
		message: asString(commit.message) ?? "",
		modified: asArray(commit.modified).filter(
			(v): v is string => typeof v === "string",
		),
		added: asArray(commit.added).filter(
			(v): v is string => typeof v === "string",
		),
		removed: asArray(commit.removed).filter(
			(v): v is string => typeof v === "string",
		),
	};
};

/**
 * Maps a raw webhook payload to a typed Notploy event.
 * Returns `null` for event names Notploy does not consume, or payloads
 * missing the discriminator fields.
 */
export const parseWebhookPayload = (input: {
	eventName: string;
	payload: unknown;
	deliveryId?: string;
}): GitHubWebhookEvent | null => {
	const payload = asRecord(input.payload);
	const action = asString(payload.action);

	switch (input.eventName) {
		case "push": {
			const repository = mapRepositoryInfo(payload);
			if (!repository.id && !repository.name) {
				return null;
			}
			return {
				type: "push",
				ref: asString(payload.ref) ?? "",
				before: asString(payload.before) ?? "",
				after: asString(payload.after) ?? "",
				created: asBool(payload.created),
				deleted: asBool(payload.deleted),
				forced: asBool(payload.forced),
				repository,
				commits: asArray(payload.commits).map(mapCommitItem),
				...mapSender(payload),
			};
		}

		case "pull_request": {
			if (!action) {
				return null;
			}
			// GitHub places `number` at the payload root; fall back to the PR object.
			const pullRequest = asRecord(payload.pull_request);
			return {
				type: "pull_request",
				action: action as GitHubPullRequestAction,
				number: asNumber(payload.number) ?? asNumber(pullRequest.number) ?? 0,
				pullRequest: mapPullRequest(payload),
				repository: mapRepositoryInfo(payload),
				...mapSender(payload),
			};
		}

		case "installation": {
			if (!action) {
				return null;
			}
			return {
				type: "installation",
				action: action as GitHubInstallationAction,
				installation: mapInstallation(payload),
				...mapSender(payload),
			};
		}

		case "installation_repositories": {
			if (!action) {
				return null;
			}
			return {
				type: "installation_repositories",
				action: action === "removed" ? "removed" : "added",
				installation: mapInstallation(payload),
				repositoriesAdded: asArray(payload.repositories_added).map((repo) => {
					const record = asRecord(repo);
					return {
						id: asNumber(record.id) ?? 0,
						name: asString(record.name) ?? "",
						fullName: asString(record.full_name) ?? "",
					};
				}),
				repositoriesRemoved: asArray(payload.repositories_removed).map(
					(repo) => {
						const record = asRecord(repo);
						return {
							id: asNumber(record.id) ?? 0,
							name: asString(record.name) ?? "",
							fullName: asString(record.full_name) ?? "",
						};
					},
				),
				repositorySelection:
					asString(payload.repository_selection) ?? "selected",
				...mapSender(payload),
			};
		}

		case "repository": {
			if (!action) {
				return null;
			}
			const repository = mapRepositoryInfo(payload);
			return {
				type: "repository",
				action: action as GitHubRepositoryEvent["action"],
				repository: {
					...repository,
					private: asBool(asRecord(payload.repository).private),
				},
				...mapSender(payload),
			};
		}

		case "release": {
			if (!action) {
				return null;
			}
			const release = asRecord(payload.release);
			return {
				type: "release",
				action: action as GitHubReleaseEvent["action"],
				release: {
					id: asNumber(release.id) ?? 0,
					tagName: asString(release.tag_name) ?? "",
					name:
						(typeof release.name === "string" ? release.name : null) ?? null,
					draft: asBool(release.draft),
					prerelease: asBool(release.prerelease),
					htmlUrl: asString(release.html_url) ?? "",
				},
				repository: mapRepositoryInfo(payload),
				...mapSender(payload),
			};
		}

		case "workflow_run": {
			if (!action) {
				return null;
			}
			const run = asRecord(payload.workflow_run);
			return {
				type: "workflow_run",
				action: action as GitHubWorkflowRunEvent["action"],
				workflowRun: {
					id: asNumber(run.id) ?? 0,
					...(asString(run.name) ? { name: asString(run.name) } : {}),
					headBranch: asString(run.head_branch) ?? "",
					headSha: asString(run.head_sha) ?? "",
					status: typeof run.status === "string" ? run.status : null,
					conclusion:
						typeof run.conclusion === "string" ? run.conclusion : null,
					htmlUrl: asString(run.html_url) ?? "",
				},
				repository: mapRepositoryInfo(payload),
				...mapSender(payload),
			};
		}

		default:
			return null;
	}
};
