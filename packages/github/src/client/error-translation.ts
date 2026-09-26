/**
 * Error translation: Octokit `RequestError` -> structured Notploy GitHub errors.
 * Keeps useful metadata (status, docs/code, request id, rate limit) while
 * guaranteeing no token or private key ever lands in an error message.
 */

import { RequestError } from "octokit";
import {
	GitHubApiError,
	GitHubAuthenticationError,
	GitHubAuthorizationError,
	GitHubError,
	GitHubNotFoundError,
	GitHubRateLimitError,
	type GitHubRateLimitInfo,
	type GitHubRequestMeta,
} from "../errors/index.js";
import { extractRateLimit } from "../types/mappers.js";

const isRateLimitStatus = (status: number | undefined): boolean =>
	status === 403 || status === 429;

const isRequestError = (error: unknown): error is RequestError =>
	typeof error === "object" &&
	error !== null &&
	"status" in error &&
	(error instanceof RequestError ||
		(error as { name?: unknown }).name === "HttpError");

export const translateError = (error: unknown): GitHubError => {
	if (error instanceof GitHubError) {
		return error;
	}

	if (isRequestError(error)) {
		const status = typeof error.status === "number" ? error.status : undefined;
		const meta: GitHubRequestMeta = {
			...(status !== undefined ? { status } : {}),
			code: asDefinedString(error.name),
			requestId: extractRequestId(error),
			...(extractRateLimit(error.response)
				? { rateLimit: extractRateLimit(error.response) }
				: {}),
		};

		if (status === 401) {
			const wrapped = new GitHubAuthenticationError(
				"GitHub rejected the credentials (401). The token may be expired or revoked.",
			);
			wrapped.cause = error;
			return wrapped;
		}

		if (status === 403) {
			const rateLimit = meta.rateLimit;
			if (isRateLimitStatus(status) && rateLimit && rateLimit.remaining === 0) {
				return new GitHubRateLimitError(
					`GitHub rate limit exceeded. Resets at ${rateLimit.resetAt}.`,
					meta,
				);
			}
			return new GitHubAuthorizationError(
				"Not authorized to perform this GitHub operation (403).",
				meta,
			);
		}

		if (status === 404) {
			return new GitHubNotFoundError(
				"GitHub resource not found (404). Check owner/repository or installation access.",
				meta,
			);
		}

		if (isRateLimitStatus(status)) {
			return new GitHubRateLimitError("GitHub rate limit exceeded.", meta);
		}

		return new GitHubApiError(
			asDefinedString(error.message) ?? "GitHub API request failed",
			meta,
		);
	}

	if (error instanceof Error) {
		return new GitHubApiError(error.message, {});
	}

	return new GitHubApiError("Unknown GitHub API failure", {});
};

const asDefinedString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

const extractRequestId = (error: RequestError): string | undefined => {
	const headers = error.response?.headers as
		| Record<string, unknown>
		| undefined;
	const requestId = headers?.["x-github-request-id"];
	return typeof requestId === "string" && requestId.length > 0
		? requestId
		: undefined;
};

/**
 * Wraps an async Octokit call, translating any failure into a structured
 * `GitHubError`. Never logs; the caller decides what to report.
 */
export const withErrorTranslation = async <T>(
	operation: () => Promise<T>,
): Promise<T> => {
	try {
		return await operation();
	} catch (error) {
		throw translateError(error);
	}
};

export type { GitHubRateLimitInfo };
