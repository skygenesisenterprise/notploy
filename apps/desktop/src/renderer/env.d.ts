/**
 * The single global the preload injects.
 *
 * Declared rather than imported so the renderer never pulls in a module from
 * the preload bundle — the two are separate worlds joined only by
 * `contextBridge`.
 */

import type { NotployBridge } from "@/shared/ipc";

declare global {
	interface Window {
		/** Present in the Electron window; absent when the bundle is opened in a
		 * plain browser, which `lib/bridge.ts` handles. */
		notploy?: NotployBridge;
	}
}
