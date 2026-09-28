import { describe, expect, it } from "vitest";
import {
	NotployError,
	notConfigured,
	redact,
	toNotployError,
	unsupported,
} from "../src/core/errors";

const context = { operation: "GET /project.all", instanceName: "Local" };

describe("toNotployError", () => {
	it("maps an unreachable server to a connection error", () => {
		const cause = Object.assign(new TypeError("fetch failed"), {
			cause: Object.assign(new Error("connect ECONNREFUSED"), {
				code: "ECONNREFUSED",
			}),
		});
		const error = toNotployError(cause, context);
		expect(error.code).toBe("connection");
		expect(error.isRetryable).toBe(true);
		expect(error.userMessage).toContain("Unable to reach");
	});

	it("maps 401 to a credential error with an actionable message", () => {
		const error = toNotployError(
			{ message: "Unauthorized", status: 401 },
			context,
		);
		expect(error.code).toBe("unauthorized");
		expect(error.userMessage).toMatch(/rejected the credentials/i);
	});

	it("maps tRPC error codes from the OpenAPI error body", () => {
		expect(
			toNotployError({ code: "NOT_FOUND", message: "nope" }, context).code,
		).toBe("not-found");
		expect(
			toNotployError(
				{ code: "INTERNAL_SERVER_ERROR", message: "boom" },
				context,
			).code,
		).toBe("server-error");
		expect(toNotployError({ code: "BAD_REQUEST" }, context).code).toBe(
			"bad-request",
		);
	});

	it("treats an AbortSignal timeout as a timeout and an abort as cancelled", () => {
		const timeout = Object.assign(new Error("timeout"), {
			name: "TimeoutError",
		});
		expect(toNotployError(timeout, context).code).toBe("timeout");

		const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
		expect(toNotployError(aborted, context).code).toBe("cancelled");
		expect(toNotployError(aborted, context).isRetryable).toBe(false);
	});

	it("prefers the API message only when it is safe", () => {
		const safe = toNotployError(
			{ code: "NOT_FOUND", message: "Project not found" },
			context,
		);
		expect(safe.userMessage).toBe("Project not found");

		const unsafe = toNotployError(
			{ code: "NOT_FOUND", message: "rejected api key sk_live_1234567890" },
			context,
		);
		expect(unsafe.userMessage).not.toContain("sk_live");
	});

	it("passes an existing NotployError through unchanged", () => {
		const original = new NotployError({
			code: "forbidden",
			userMessage: "denied",
		});
		expect(toNotployError(original, context)).toBe(original);
	});

	it("never leaks a token into the detail", () => {
		const error = toNotployError(
			new Error("x-api-key: npk_abcdefghijklmnopqrstuvwxyz012345 rejected"),
			context,
		);
		expect(error.detail).not.toContain("npk_abcdefghijklmnopqrstuvwxyz012345");
		expect(error.detail).toContain("[redacted]");
	});
});

describe("redact", () => {
	it("masks header-style secrets", () => {
		expect(redact("x-api-key: abc123")).toBe("x-api-key: [redacted]");
		expect(redact("Authorization: Bearer abc123")).toContain("[redacted]");
	});

	it("leaves short identifiers readable", () => {
		expect(redact("containerId abc123def")).toBe("containerId abc123def");
	});
});

describe("helpers", () => {
	it("describes a missing configuration clearly", () => {
		expect(notConfigured().code).toBe("not-configured");
		expect(notConfigured().userMessage).toContain("No Notploy instance");
	});

	it("states that a missing capability has no endpoint", () => {
		const error = unsupported("kubernetes");
		expect(error.code).toBe("unsupported");
		expect(error.userMessage).toContain("kubernetes");
	});
});
