import { createCleanup } from "../../server/wss/cleanup";
import { describe, expect, it } from "vitest";

describe("createCleanup", () => {
	it("runs every disposer exactly once across repeated close events", () => {
		const calls: string[] = [];
		const cleanup = createCleanup(
			() => calls.push("timer"),
			() => calls.push("stream"),
			() => calls.push("client"),
		);

		cleanup();
		cleanup();
		cleanup();

		expect(calls).toEqual(["timer", "stream", "client"]);
	});

	it("keeps disposing remaining resources when one disposer throws", () => {
		const calls: string[] = [];
		const cleanup = createCleanup(
			() => calls.push("timer"),
			() => {
				throw new Error("already closed");
			},
			() => calls.push("pty"),
		);

		expect(() => cleanup()).not.toThrow();
		expect(calls).toEqual(["timer", "pty"]);
	});
});
