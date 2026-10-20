/**
 * Builds an idempotent cleanup callback from independent disposal actions.
 *
 * WebSocket lifecycle events race: `close`, `error`, a remote stream ending and
 * server shutdown can all fire for the same connection. The returned callback
 * runs the actions in order exactly once, and one failing disposer must not
 * prevent the following resources (SSH channel, client, PTY, timers) from
 * being released.
 */
export const createCleanup = (...actions: Array<() => void>) => {
	let cleanedUp = false;
	return () => {
		if (cleanedUp) {
			return;
		}
		cleanedUp = true;
		for (const action of actions) {
			try {
				action();
			} catch {
				// Disposal is best-effort: the resource may already be gone.
			}
		}
	};
};
