/**
 * MV3 service worker.
 *
 * Single responsibility: validate messages from popup / options pages and run
 * them through `BackgroundState`. It never fetches an origin that is not a
 * configured instance, never logs a token, and clears cached resources on
 * instance switch / logout (see `state.ts`).
 */

import { NotployError } from "../shared/errors.js";
import {
	isExtensionMessage,
	type MessageResponse,
} from "../shared/messages.js";
import { apiKeysUrl } from "../shared/url.js";
import { BackgroundState } from "./state.js";
import {
	chromeLocalStorage,
	InstanceStorage,
	MemoryStorage,
} from "./storage.js";

const storage = new InstanceStorage(
	chromeLocalStorage() ?? new MemoryStorage(),
);
const state = new BackgroundState(storage);

function toResponse(error: unknown, instanceUrl?: string): MessageResponse {
	if (error instanceof NotployError) {
		const withKeys = error as NotployError & { apiKeysUrl?: string };
		return {
			ok: false,
			message: error.userMessage,
			apiKeysUrl:
				withKeys.apiKeysUrl ??
				(instanceUrl ? apiKeysUrl(instanceUrl) : undefined),
		};
	}
	return { ok: false, message: "An unexpected error occurred." };
}

async function handleMessage(message: unknown): Promise<MessageResponse> {
	if (!isExtensionMessage(message)) {
		return { ok: false, message: "Unknown message." };
	}
	try {
		switch (message.kind) {
			case "getState": {
				return { ok: true, snapshot: await state.snapshot() };
			}
			case "addInstance": {
				if (
					typeof message.name !== "string" ||
					typeof message.url !== "string"
				) {
					return { ok: false, message: "Invalid instance payload." };
				}
				const allowed = ["cloud", "self-hosted", "local", "custom"] as const;
				const label = allowed.includes(message.label)
					? message.label
					: "custom";
				const instance = await state.addInstance(
					message.name.slice(0, 80),
					message.url.slice(0, 500),
					label,
				);
				return {
					ok: true,
					message: `Instance "${instance.name}" added.`,
					snapshot: await state.snapshot(),
				};
			}
			case "removeInstance": {
				await state.removeInstance(message.instanceId);
				return {
					ok: true,
					message: "Instance removed.",
					snapshot: await state.snapshot(),
				};
			}
			case "selectInstance": {
				await state.selectInstance(message.instanceId);
				return { ok: true, snapshot: await state.snapshot() };
			}
			case "login": {
				if (typeof message.token !== "string" || !message.token.trim()) {
					return { ok: false, message: "Paste an API key." };
				}
				try {
					await state.login(
						message.instanceId,
						message.token.trim().slice(0, 500),
					);
					return {
						ok: true,
						message: "Connected.",
						snapshot: await state.snapshot(),
					};
				} catch (error) {
					const instances = await storage.listInstances();
					const instance = instances.find(
						(entry) => entry.id === message.instanceId,
					);
					return toResponse(error, instance?.url);
				}
			}
			case "logout": {
				await state.logout(message.instanceId);
				return {
					ok: true,
					message: "Signed out.",
					snapshot: await state.snapshot(),
				};
			}
			case "refresh": {
				try {
					const snapshot = await state.refresh();
					return { ok: true, snapshot };
				} catch (error) {
					return { ...toResponse(error), snapshot: await state.snapshot() };
				}
			}
			case "testConnection": {
				const connection = await state.testConnection(message.instanceId);
				return {
					ok: connection.status === "connected",
					message:
						connection.error ??
						(connection.status === "connected"
							? "Connected."
							: "Connection failed."),
					snapshot: await state.snapshot(),
				};
			}
		}
	} catch (error) {
		return toResponse(error);
	}
	return { ok: false, message: "Unhandled message." };
}

const runtime = (globalThis as unknown as { chrome?: typeof chrome }).chrome
	?.runtime;
if (runtime?.onMessage) {
	runtime.onMessage.addListener((message, _sender, sendResponse) => {
		void handleMessage(message).then(sendResponse);
		return true;
	});
}

export { handleMessage, state, storage };
