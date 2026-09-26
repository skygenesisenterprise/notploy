import { describe, expect, it } from "vitest";
import { translateError } from "../../src/client/error-translation.js";
import {
	GitHubApiError,
	GitHubAuthenticationError,
	GitHubAuthorizationError,
	GitHubNotFoundError,
	GitHubRateLimitError,
} from "../../src/errors/index.js";

describe("error translation", () => {
	it("keeps structured GitHubError instances untouched", () => {
		const original = new GitHubAuthenticationError("bad credentials");
		const translated = translateError(original);
		expect(translated).toBe(original);
	});

	it("maps 401 to GitHubAuthenticationError", () => {
		const requestError = Object.assign(new Error("Bad credentials"), {
			name: "HttpError",
			status: 401,
		});
		const translated = translateError(requestError);
		expect(translated).toBeInstanceOf(GitHubAuthenticationError);
	});

	it("maps 403 with exhausted rate limit to GitHubRateLimitError", () => {
		const requestError = Object.assign(new Error("rate limit"), {
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
		const translated = translateError(requestError);
		expect(translated).toBeInstanceOf(GitHubRateLimitError);
	});

	it("maps plain 403 to GitHubAuthorizationError", () => {
		const requestError = Object.assign(new Error("forbidden"), {
			name: "HttpError",
			status: 403,
			response: { headers: {} },
		});
		const translated = translateError(requestError);
		expect(translated).toBeInstanceOf(GitHubAuthorizationError);
	});

	it("maps 404 to GitHubNotFoundError with request id", () => {
		const requestError = Object.assign(new Error("not found"), {
			name: "HttpError",
			status: 404,
			response: { headers: { "x-github-request-id": "ABC-123" } },
		});
		const translated = translateError(requestError);
		expect(translated).toBeInstanceOf(GitHubNotFoundError);
		expect((translated as GitHubNotFoundError).requestId).toBe("ABC-123");
	});

	it("wraps unknown errors in GitHubApiError without leaking secrets", () => {
		const translated = translateError(new Error("boom"));
		expect(translated).toBeInstanceOf(GitHubApiError);
		expect(translated.message).not.toContain("ghp_");
		expect(translated.message).not.toContain("BEGIN RSA PRIVATE KEY");
	});
});
