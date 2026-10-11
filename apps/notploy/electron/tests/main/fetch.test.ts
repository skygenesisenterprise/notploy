import { describe, expect, it, vi } from "vitest";
import { createTimeoutFetch } from "@/main/client/fetch";

describe("createTimeoutFetch", () => {
	it("forwards the response untouched", async () => {
		const expected = new Response("ok");
		const base = vi.fn(async () => expected);
		const fetchImpl = createTimeoutFetch(base as never, 30_000);
		expect(await fetchImpl("http://example.test")).toBe(expected);
	});

	it("passes an AbortSignal down to the transport", async () => {
		const base = vi.fn(async (_input: unknown, init?: RequestInit) => {
			expect(init?.signal).toBeInstanceOf(AbortSignal);
			return new Response("ok");
		});
		const fetchImpl = createTimeoutFetch(base as never, 30_000);
		await fetchImpl("http://example.test");
		expect(base).toHaveBeenCalledOnce();
	});

	it("rejects with a TimeoutError when the transport never answers", async () => {
		// A transport that ignores AbortSignal entirely: the race, not the
		// abort, is what guarantees a bounded call.
		const base = () => new Promise<Response>(() => {});
		const fetchImpl = createTimeoutFetch(base as never, 1_000);
		await expect(fetchImpl("http://example.test")).rejects.toMatchObject({
			name: "TimeoutError",
		});
	});

	it("propagates a caller cancellation with its own reason", async () => {
		const controller = new AbortController();
		const reason = new Error("user cancelled");
		const base = () => new Promise<Response>(() => {});
		const fetchImpl = createTimeoutFetch(base as never, 30_000);

		const pending = fetchImpl("http://example.test", {
			signal: controller.signal,
		});
		controller.abort(reason);

		await expect(pending).rejects.toBe(reason);
	});

	it("rejects immediately when the caller's signal is already aborted", async () => {
		const controller = new AbortController();
		const reason = new Error("already gone");
		controller.abort(reason);
		const base = () => new Promise<Response>(() => {});
		const fetchImpl = createTimeoutFetch(base as never, 30_000);
		await expect(
			fetchImpl("http://example.test", { signal: controller.signal }),
		).rejects.toBe(reason);
	});
});
