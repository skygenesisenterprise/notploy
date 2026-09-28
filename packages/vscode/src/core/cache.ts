/**
 * A tiny time-to-live cache.
 *
 * The views are re-rendered often (selection changes, focus changes, manual
 * refreshes), so every read goes through this. It keeps the extension from
 * issuing a request per render while still letting an explicit refresh see new
 * data. Entries never hold credentials.
 */
export class TtlCache<T> {
	private value: T | undefined;
	private storedAt = 0;
	private inFlight: Promise<T> | undefined;

	constructor(
		private readonly ttlMs: number,
		private readonly loader: () => Promise<T>,
	) {}

	/** Returns the cached value, or loads it. Concurrent calls share one load. */
	async get(force = false): Promise<T> {
		const fresh = Date.now() - this.storedAt < this.ttlMs;
		if (!force && this.value !== undefined && fresh) {
			return this.value;
		}
		if (this.inFlight) {
			return this.inFlight;
		}
		const promise = this.loader()
			.then((value) => {
				this.value = value;
				this.storedAt = Date.now();
				return value;
			})
			.finally(() => {
				this.inFlight = undefined;
			});
		this.inFlight = promise;
		return promise;
	}

	/** Current value without triggering a load. */
	peek(): T | undefined {
		return this.value;
	}

	invalidate(): void {
		this.value = undefined;
		this.storedAt = 0;
	}
}
