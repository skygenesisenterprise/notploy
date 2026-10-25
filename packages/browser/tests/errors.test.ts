import { describe, expect, it } from "vitest";
import {
	NotployError,
	notConfigured,
	redact,
	toNotployError,
} from "../src/shared/errors.js";

describe("redact", () => {
	it("redacts api keys", () => {
		expect(redact("x-api-key: npk_abcdef123456")).toBe("x-api-key: [redacted]");
	});

	it("keeps short ids readable", () => {
		expect(redact("project p1")).toBe("project p1");
	});
});

describe("toNotployError", () => {
	it("maps 401 to unauthorized", () => {
		const error = toNotployError({ status: 401 }, { operation: "project.all" });
		expect(error).toBeInstanceOf(NotployError);
		expect(error.code).toBe("unauthorized");
	});

	it("maps TypeError to connection", () => {
		const error = toNotployError(new TypeError("fetch failed"), {
			operation: "settings.health",
		});
		expect(error.code).toBe("connection");
		expect(error.isRetryable).toBe(true);
	});

	it("detects session expiry", () => {
		const error = toNotployError({ status: 401 }, { operation: "project.all" });
		expect(error.isSessionExpired).toBe(true);
	});

	it("creates not-configured", () => {
		expect(notConfigured().code).toBe("not-configured");
	});
});
