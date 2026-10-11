/**
 * The `fetch` every Notploy request goes through.
 *
 * Three guarantees the SDK does not provide on its own:
 *
 * - **A deadline.** A request that never answers must not hang the app, so the
 *   call is raced against a timer that rejects with a `TimeoutError` — the shape
 *   {@link toNotployError} already maps to a `timeout` code. Racing as well as
 *   aborting means a transport that ignores `AbortSignal` still cannot stall.
 * - **Immediate cancellation.** When the caller aborts, the call settles with the
 *   caller's own reason, without waiting for the transport to notice. Only
 *   racing gives that: `AbortSignal` alone leaves a promise pending against a
 *   transport that ignores it.
 * - **A bounded number of listeners.** The abort listener and the timer are
 *   always removed, so a long-lived signal reused across requests does not
 *   accumulate listeners.
 */

const TIMEOUT_MESSAGE = "The request exceeded its timeout";

function timeoutFailure(): Error {
	if (typeof DOMException === "function") {
		return new DOMException(TIMEOUT_MESSAGE, "TimeoutError");
	}
	const error = new Error(TIMEOUT_MESSAGE);
	error.name = "TimeoutError";
	return error;
}

function abortFailure(): Error {
	if (typeof DOMException === "function") {
		return new DOMException("The request was cancelled", "AbortError");
	}
	const error = new Error("The request was cancelled");
	error.name = "AbortError";
	return error;
}

export function createTimeoutFetch(
	baseFetch: typeof globalThis.fetch,
	timeoutMs: number,
): typeof globalThis.fetch {
	const timeout =
		Number.isFinite(timeoutMs) && timeoutMs >= 1_000 ? timeoutMs : 30_000;

	return async (input, init) => {
		const callerSignal = init?.signal ?? undefined;

		// A signal that was already aborted never reaches the transport.
		if (callerSignal?.aborted) {
			throw callerSignal.reason ?? abortFailure();
		}

		const controller = new AbortController();
		let timer: NodeJS.Timeout | undefined;
		let onCallerAbort: (() => void) | undefined;

		/** Rejects when either the deadline passes or the caller cancels. */
		const settled = new Promise<never>((_resolve, reject) => {
			timer = setTimeout(() => {
				const failure = timeoutFailure();
				controller.abort(failure);
				reject(failure);
			}, timeout);

			if (callerSignal) {
				onCallerAbort = () => {
					const reason = callerSignal.reason ?? abortFailure();
					controller.abort(reason);
					reject(reason);
				};
				callerSignal.addEventListener("abort", onCallerAbort, { once: true });
			}
		});

		try {
			return await Promise.race([
				baseFetch(input, { ...init, signal: controller.signal }),
				settled,
			]);
		} finally {
			if (timer) clearTimeout(timer);
			if (callerSignal && onCallerAbort) {
				callerSignal.removeEventListener("abort", onCallerAbort);
			}
		}
	};
}
