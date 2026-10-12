import { createRateLimiter } from "@notploy/server/utils/rate-limit";
import {
	adminRole,
	memberRole,
	ownerRole,
	statements,
} from "@notploy/server/lib/access-control";
import { describe, expect, it } from "vitest";

describe("createRateLimiter", () => {
	it("allows a burst up to the limit then refuses until the window ends", async () => {
		let current = 1_000;
		const limiter = createRateLimiter({
			namespace: "test",
			now: () => current,
		});

		for (let index = 0; index < 3; index++) {
			const result = await limiter.consume("client", {
				limit: 3,
				windowSeconds: 60,
			});
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(2 - index);
		}

		const refused = await limiter.consume("client", {
			limit: 3,
			windowSeconds: 60,
		});
		expect(refused.allowed).toBe(false);
		expect(refused.retryAfterSeconds).toBeGreaterThan(0);

		// A different key has its own budget.
		expect(
			(await limiter.consume("other", { limit: 3, windowSeconds: 60 })).allowed,
		).toBe(true);

		// The window reopens after it elapses.
		current += 61_000;
		expect(
			(await limiter.consume("client", { limit: 3, windowSeconds: 60 })).allowed,
		).toBe(true);
	});
});

describe("traffic permission resource", () => {
	it("is declared with read and write actions", () => {
		expect(statements.traffic).toEqual(["read", "write"]);
	});

	it("grants read and write to owner and admin", () => {
		for (const role of [ownerRole, adminRole]) {
			expect(role.authorize({ traffic: ["read"] } as never).success).toBe(true);
			expect(role.authorize({ traffic: ["write"] } as never).success).toBe(true);
		}
	});

	it("only lets a member read the reports", () => {
		expect(memberRole.authorize({ traffic: ["read"] } as never).success).toBe(
			true,
		);
		expect(memberRole.authorize({ traffic: ["write"] } as never).success).toBe(
			false,
		);
	});
});
