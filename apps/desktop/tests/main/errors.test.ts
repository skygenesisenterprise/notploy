import { describe, expect, it } from "vitest";
import {
	isNotployError,
	NotployError,
	redact,
	toNotployError,
} from "@/main/client/errors";

describe("redact", () => {
	it("masks key/value pairs that look like credentials", () => {
		expect(redact("x-api-key: npk_abcdef1234567890")).toBe(
			"x-api-key: [redacted]",
		);
		const bearer = redact("Authorization: Bearer abcdef");
		expect(bearer).toContain("[redacted]");
		expect(bearer).not.toContain("Bearer");
	});

	it("masks prefixed provider keys", () => {
		expect(redact("token ghp_0123456789abcdef")).toContain("[redacted]");
		expect(redact("glpat-aaaaaaaaaaaa")).toBe("glpat-aaaaaaaaaaaa");
	});

	it("keeps short, low-entropy identifiers readable", () => {
		// Deployment and container ids show up in messages and must stay useful.
		expect(redact("deployment abc123def")).toBe("deployment abc123def");
		expect(redact("container 9f8e7d6c5b4a")).toBe("container 9f8e7d6c5b4a");
	});

	it("masks long mixed-case or hex blobs", () => {
		expect(redact("value AAAAAAAAAAAAAAAAAAAAAAAA")).toContain("[redacted]");
		expect(redact("value 0123456789abcdef0123456789abcdef")).toBe(
			"value [redacted]",
		);
	});
});

describe("toNotployError", () => {
	const context = { operation: "project.all", connectionName: "Staging" };

	it("returns the same error when one is already a NotployError", () => {
		const original = new NotployError({ code: "timeout", userMessage: "slow" });
		expect(toNotployError(original, context)).toBe(original);
	});

	it("maps a TimeoutError to the timeout code", () => {
		const error = new DOMException("too slow", "TimeoutError");
		expect(toNotployError(error, context).code).toBe("timeout");
	});

	it("maps an abort to the cancelled code", () => {
		const error = new DOMException("stopped", "AbortError");
		expect(toNotployError(error, context).code).toBe("cancelled");
	});

	it("maps HTTP statuses to codes", () => {
		expect(toNotployError({ status: 401 }, context).code).toBe("unauthorized");
		expect(toNotployError({ status: 403 }, context).code).toBe("forbidden");
		expect(toNotployError({ status: 404 }, context).code).toBe("not-found");
		expect(toNotployError({ status: 422 }, context).code).toBe("bad-request");
		expect(toNotployError({ status: 504 }, context).code).toBe("timeout");
		expect(toNotployError({ status: 500 }, context).code).toBe("server-error");
	});

	it("maps tRPC error codes to codes", () => {
		expect(toNotployError({ code: "UNAUTHORIZED" }, context).code).toBe(
			"unauthorized",
		);
		expect(toNotployError({ code: "TOO_MANY_REQUESTS" }, context).code).toBe(
			"connection",
		);
	});

	it("maps a refused connection to the connection code", () => {
		const error = new TypeError("fetch failed");
		Object.assign(error, { cause: { code: "ECONNREFUSED" } });
		expect(toNotployError(error, context).code).toBe("connection");
	});

	it("names the connection in the user message", () => {
		expect(toNotployError(new TypeError("x"), context).userMessage).toContain(
			'"Staging"',
		);
	});

	it("never lets a credential reach the detail field", () => {
		const error = toNotployError(
			new Error("failed with x-api-key: npk_secretvalue123456"),
			context,
		);
		expect(error.detail).not.toContain("npk_secretvalue123456");
	});

	it("serializes to the shape the renderer receives", () => {
		const error = toNotployError({ status: 403 }, context);
		const serialized = error.toSerialized();
		expect(serialized.code).toBe("forbidden");
		expect(serialized.status).toBe(403);
		expect(isNotployError(error)).toBe(true);
	});
});
