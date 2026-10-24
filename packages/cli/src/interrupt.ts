/**
 * Synchronous interrupt hook.
 *
 * The process-wide SIGINT handler in index.ts calls the registered hook before
 * exiting, so a maintenance operation can persist "interrupted" and release its
 * lock. The hook must not return a promise: the process exits immediately
 * afterwards and an un-awaited write would be lost.
 */
let handler: (() => void) | undefined;

export function setInterruptHandler(next: () => void): void {
	handler = next;
}

export function clearInterruptHandler(): void {
	handler = undefined;
}

export function runInterruptHandler(): void {
	const current = handler;
	handler = undefined;
	if (!current) return;
	try {
		current();
	} catch {
		// An interruption must never mask the original signal handling.
	}
}
