/**
 * Options page: instance management + API-key login.
 *
 * Network access per instance is granted through `chrome.permissions`
 * (optional host permissions), keeping the base manifest to `storage` only.
 */

import type { ExtensionSnapshot, MessageResponse } from "../shared/messages.js";
import type { NotployInstance } from "../shared/types.js";

function runtime(): typeof chrome.runtime | undefined {
	try {
		return (globalThis as unknown as { chrome?: typeof chrome }).chrome
			?.runtime;
	} catch {
		return undefined;
	}
}

async function send(message: unknown): Promise<MessageResponse> {
	const r = runtime();
	if (!r?.sendMessage) throw new Error("Extension runtime unavailable.");
	return await r.sendMessage(message);
}

function el<T extends HTMLElement>(id: string): T {
	const node = document.getElementById(id);
	if (!node) throw new Error(`Missing #${id}`);
	return node as T;
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => {
		switch (char) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			default:
				return "&#39;";
		}
	});
}

async function ensureHostPermission(origin: string): Promise<boolean> {
	try {
		const permissions = (globalThis as unknown as { chrome?: typeof chrome })
			.chrome?.permissions;
		if (!permissions?.request) return true;
		const pattern = `${origin}/*`;
		const has = await permissions.contains({ origins: [pattern] });
		if (has) return true;
		return await permissions.request({ origins: [pattern] });
	} catch {
		return true;
	}
}

function renderInstances(snapshot: ExtensionSnapshot): void {
	const root = el("instances");
	if (snapshot.instances.length === 0) {
		root.innerHTML = `<p class="muted">No instances yet.</p>`;
		return;
	}
	root.innerHTML = snapshot.instances
		.map((instance: NotployInstance) => {
			const active = instance.id === snapshot.activeId ? " · active" : "";
			return `<div class="row"><div><strong>${escapeHtml(instance.name)}</strong><div class="meta">${escapeHtml(instance.url)}${escapeHtml(active)}${instance.version ? ` · v${escapeHtml(instance.version)}` : ""}${instance.hasCredential ? " · signed in" : ""}</div></div>
      <div class="ops"><button class="link" data-select="${escapeHtml(instance.id)}" type="button">Select</button><button class="link" data-remove="${escapeHtml(instance.id)}" type="button">Remove</button></div></div>`;
		})
		.join("");
	for (const button of root.querySelectorAll<HTMLButtonElement>(
		"button[data-select]",
	)) {
		button.addEventListener("click", async () => {
			const id = button.getAttribute("data-select");
			if (!id) return;
			await send({ kind: "selectInstance", instanceId: id });
			await load();
		});
	}
	for (const button of root.querySelectorAll<HTMLButtonElement>(
		"button[data-remove]",
	)) {
		button.addEventListener("click", async () => {
			const id = button.getAttribute("data-remove");
			if (!id) return;
			if (!confirm("Remove this instance and its stored API key?")) return;
			await send({ kind: "removeInstance", instanceId: id });
			await load();
		});
	}
}

async function load(): Promise<void> {
	const response = await send({ kind: "getState" });
	if (!response.ok || !response.snapshot) {
		el("status").textContent = response.message ?? "Unable to load.";
		return;
	}
	renderInstances(response.snapshot);
	const active = response.snapshot.instances.find(
		(entry) => entry.id === response.snapshot?.activeId,
	);
	el("status").textContent = active
		? `${active.name}: ${response.snapshot.connection?.status ?? "not checked"}${response.snapshot.connection?.error ? ` — ${response.snapshot.connection.error}` : ""}`
		: "No active instance.";
}

function bind(): void {
	el<HTMLButtonElement>("addBtn").addEventListener("click", async () => {
		const error = el("addError");
		error.textContent = "";
		const name = el<HTMLInputElement>("name").value;
		const url = el<HTMLInputElement>("url").value;
		const kind = el<HTMLSelectElement>("kind")
			.value as NotployInstance["label"];
		const response = await send({
			kind: "addInstance",
			name,
			url,
			label: kind,
		});
		if (!response.ok || !response.snapshot) {
			error.textContent = response.message ?? "Could not add instance.";
			return;
		}
		const added =
			response.snapshot.instances.find(
				(entry) => entry.url && url.includes(entry.url),
			) ?? response.snapshot.instances[response.snapshot.instances.length - 1];
		if (added) await ensureHostPermission(added.url);
		el<HTMLInputElement>("name").value = "";
		el<HTMLInputElement>("url").value = "";
		await load();
	});
	el<HTMLButtonElement>("loginBtn").addEventListener("click", async () => {
		const error = el("loginError");
		error.textContent = "";
		const state = await send({ kind: "getState" });
		const activeId = state.snapshot?.activeId;
		if (!activeId) {
			error.textContent = "Add and select an instance first.";
			return;
		}
		const token = el<HTMLInputElement>("token").value;
		const response = await send({ kind: "login", instanceId: activeId, token });
		if (!response.ok) {
			error.textContent = response.message ?? "Login failed.";
			return;
		}
		el<HTMLInputElement>("token").value = "";
		await load();
	});
	el<HTMLButtonElement>("logoutBtn").addEventListener("click", async () => {
		const state = await send({ kind: "getState" });
		const activeId = state.snapshot?.activeId;
		if (!activeId) return;
		await send({ kind: "logout", instanceId: activeId });
		await load();
	});
	el<HTMLButtonElement>("testBtn").addEventListener("click", async () => {
		const status = el("status");
		status.textContent = "Checking…";
		const state = await send({ kind: "getState" });
		const activeId = state.snapshot?.activeId;
		if (!activeId) {
			status.textContent = "No active instance.";
			return;
		}
		const response = await send({
			kind: "testConnection",
			instanceId: activeId,
		});
		status.textContent =
			response.message ?? (response.ok ? "Connected." : "Connection failed.");
		await load();
	});
	el<HTMLButtonElement>("keysBtn").addEventListener("click", async () => {
		const state = await send({ kind: "getState" });
		const active = state.snapshot?.instances.find(
			(entry) => entry.id === state.snapshot?.activeId,
		);
		const tabs = (globalThis as unknown as { chrome?: typeof chrome }).chrome
			?.tabs;
		if (!active) return;
		const url = `${active.url}/dashboard/settings/api-keys`;
		if (tabs?.create) await tabs.create({ url });
		else window.open(url, "_blank", "noopener");
	});
}

bind();
void load();
