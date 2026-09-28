/** Small async utilities shared by the services and the tree providers. */

export class CancellationError extends Error {
	constructor(message = "Operation cancelled") {
		super(message);
		this.name = "CancellationError";
	}
}

export function isCancellationError(error: unknown): boolean {
	return error instanceof CancellationError;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new CancellationError());
			return;
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(new CancellationError());
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

/** Rejects with {@link CancellationError} as soon as the token is cancelled. */
export function raceCancellation<T>(
	promise: Promise<T>,
	signal?: AbortSignal,
): Promise<T> {
	if (!signal) return promise;
	if (signal.aborted) return Promise.reject(new CancellationError());
	return new Promise<T>((resolve, reject) => {
		const onAbort = () => reject(new CancellationError());
		signal.addEventListener("abort", onAbort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener("abort", onAbort);
				resolve(value);
			},
			(error) => {
				signal.removeEventListener("abort", onAbort);
				reject(error);
			},
		);
	});
}

/** Collapses bursts of calls (rapid refreshes, keystrokes) into one. */
export function debounce<Args extends unknown[]>(
	fn: (...args: Args) => void,
	delay: number,
): ((...args: Args) => void) & { cancel(): void } {
	let timer: NodeJS.Timeout | undefined;
	const wrapped = (...args: Args) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			fn(...args);
		}, delay);
	};
	wrapped.cancel = () => {
		if (timer) clearTimeout(timer);
		timer = undefined;
	};
	return wrapped;
}

/**
 * A promise that only ever resolves once, so overlapping refreshes cannot
 * resolve an older payload after a newer one.
 */
export class LatestOnly<T> {
	private sequence = 0;

	async run(task: () => Promise<T>): Promise<T | undefined> {
		const ticket = ++this.sequence;
		const value = await task();
		if (ticket !== this.sequence) return undefined;
		return value;
	}
}

/** Reads `n` values from an iterable into an array. */
export function take<T>(items: Iterable<T>, count: number): T[] {
	const result: T[] = [];
	for (const item of items) {
		if (result.length >= count) break;
		result.push(item);
	}
	return result;
}
