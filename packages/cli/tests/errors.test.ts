import { describe, expect, it } from "vitest";
import {
	CliError,
	ExitCode,
	normalizeError,
	redactSecrets,
	usageError,
} from "../src/errors.js";

function fakeAxiosError(options: {
	status?: number;
	data?: unknown;
	code?: string;
	timeout?: number;
	baseURL?: string;
}): Error {
	const error = new Error("Request failed with status code") as Error & {
		isAxiosError?: boolean;
		code?: string;
		config?: { timeout?: number; baseURL?: string };
		response?: { status: number; statusText: string; data: unknown };
	};
	error.isAxiosError = true;
	error.code = options.code;
	error.config = {
		timeout: options.timeout ?? 30_000,
		baseURL: options.baseURL ?? "https://panel.notploy.com/api",
	};
	if (options.status) {
		error.response = {
			status: options.status,
			statusText: "",
			data: options.data,
		};
	}
	return error;
}

describe("normalizeError", () => {
	it("maps authentication failures to exit code 3", () => {
		const error = normalizeError(
			fakeAxiosError({
				status: 401,
				data: { error: { json: { message: "UNAUTHORIZED" } } },
			}),
		);
		expect(error.code).toBe(ExitCode.Auth);
		expect(error.message).toContain("UNAUTHORIZED");
		expect(error.message).toContain("HTTP 401");
	});

	it("maps invalid input and server failures to distinct codes", () => {
		expect(
			normalizeError(
				fakeAxiosError({
					status: 400,
					data: { message: "Bad input" },
				}),
			).code,
		).toBe(ExitCode.Usage);
		expect(
			normalizeError(
				fakeAxiosError({
					status: 500,
					data: { message: "Server exploded" },
				}),
			).code,
		).toBe(ExitCode.Api);
	});

	it("maps timeouts to exit code 5", () => {
		const error = normalizeError(
			fakeAxiosError({ code: "ECONNABORTED", timeout: 1500 }),
		);
		expect(error.code).toBe(ExitCode.Timeout);
		expect(error.message).toContain("1500ms");
	});

	it("maps network failures without exposing request headers", () => {
		const error = normalizeError(fakeAxiosError({ code: "ENOTFOUND" }));
		expect(error.code).toBe(ExitCode.Api);
		expect(error.message).toContain("Cannot reach");
		expect(error.message).not.toContain("x-api-key");
	});

	it("preserves and redacts CliError values", () => {
		const original = new CliError("failed with token abcdef123456", {
			code: ExitCode.Auth,
			hint: "use abcdef123456",
		});
		const error = normalizeError(original, ["abcdef123456"]);
		expect(error.code).toBe(ExitCode.Auth);
		expect(error.message).not.toContain("abcdef123456");
		expect(error.hint).not.toContain("abcdef123456");
	});

	it("redacts secrets from server-provided messages", () => {
		const error = normalizeError(
			fakeAxiosError({
				status: 500,
				data: { message: "Key sk_live_1234567890 is invalid" },
			}),
			["sk_live_1234567890"],
		);
		expect(error.message).not.toContain("sk_live_1234567890");
		expect(error.message).toContain("[REDACTED]");
	});

	it("keeps usage errors at exit code 2", () => {
		expect(normalizeError(usageError("bad option")).code).toBe(ExitCode.Usage);
	});
});

describe("redactSecrets", () => {
	it("redacts common credential formats", () => {
		const input = [
			"x-api-key: abc123def456",
			"Authorization: Bearer eyJhbGciOi.payload.signature",
			"NOTPLOY_API_KEY=super-secret-value",
			"password: hunter2",
		].join("\n");
		const output = redactSecrets(input);
		expect(output).not.toContain("abc123def456");
		expect(output).not.toContain("eyJhbGciOi");
		expect(output).not.toContain("super-secret-value");
		expect(output).not.toContain("hunter2");
		expect(output).toContain("[REDACTED]");
	});

	it("replaces known secret values", () => {
		expect(redactSecrets("value=secret-123", ["secret-123"])).toBe(
			"value=[REDACTED]",
		);
	});
});
