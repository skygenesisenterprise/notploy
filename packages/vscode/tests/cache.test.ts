import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "../src/core/cache";

/** A promise whose resolution the test controls. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

describe("TtlCache", () => {
	it("loads once and then serves from the cache", async () => {
		const loader = vi.fn(async () => "value");
		const cache = new TtlCache(10_000, loader);

		expect(await cache.get()).toBe("value");
		expect(await cache.get()).toBe("value");
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it("reloads when forced", async () => {
		const loader = vi.fn(async () => "value");
		const cache = new TtlCache(10_000, loader);

		await cache.get();
		await cache.get(true);
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it("reloads once the entry expires", async () => {
		const loader = vi.fn(async () => "value");
		const cache = new TtlCache(0, loader);

		await cache.get();
		await cache.get();
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it("shares a single in-flight load between concurrent callers", async () => {
		const gate = deferred<string>();
		const loader = vi.fn(async () => await gate.promise);
		const cache = new TtlCache(10_000, loader);

		const first = cache.get();
		const second = cache.get();
		gate.resolve("value");

		expect(await Promise.all([first, second])).toEqual(["value", "value"]);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it("exposes the current value without loading", async () => {
		const loader = vi.fn(async () => "value");
		const cache = new TtlCache(10_000, loader);

		expect(cache.peek()).toBeUndefined();
		await cache.get();
		expect(cache.peek()).toBe("value");
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it("discards the value on invalidate", async () => {
		const loader = vi.fn(async () => "value");
		const cache = new TtlCache(10_000, loader);

		await cache.get();
		cache.invalidate();
		expect(cache.peek()).toBeUndefined();
		await cache.get();
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it("propagates a loader failure without caching it", async () => {
		const loader = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValueOnce("value");
		const cache = new TtlCache(10_000, loader);

		await expect(cache.get()).rejects.toThrow("boom");
		expect(await cache.get()).toBe("value");
	});
});
