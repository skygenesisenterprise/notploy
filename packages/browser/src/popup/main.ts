/**
 * Popup: quick access to the active instance.
 *
 * States covered (acceptance criteria): unconfigured, disconnected, loading,
 * empty, error, session-expired, ready. Manual refresh only, 30s timeout
 * enforced in the background client, no background polling.
 */

import type { ExtensionSnapshot, MessageResponse } from "../shared/messages.js";
import type { Deployment, ProjectSummary } from "../shared/types.js";
import { dashboardUrl, projectDashboardUrl } from "../shared/url.js";

function chromeRuntime(): typeof chrome.runtime | undefined {
	try {
		return (globalThis as unknown as { chrome?: typeof chrome }).chrome
			?.runtime;
	} catch {
		return undefined;
	}
}

async function send(message: unknown): Promise<MessageResponse> {
	const runtime = chromeRuntime();
	if (!runtime?.sendMessage) throw new Error("Extension runtime unavailable.");
	return await runtime.sendMessage(message);
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

function statusClass(status: string | undefined): string {
	if (status === "running") return "status running";
	if (status === "done") return "status done";
	if (status === "error") return "status error";
	if (status === "cancelled") return "status cancelled";
	return "status";
}

function openUrl(url: string): void {
	const tabs = (globalThis as unknown as { chrome?: typeof chrome }).chrome
		?.tabs;
	if (tabs?.create) void tabs.create({ url });
	else window.open(url, "_blank", "noopener");
}

function projectLinks(origin: string, project: ProjectSummary): string {
	const url = projectDashboardUrl(origin, project.projectId);
	return `<div class="row"><button type="button" data-url="${escapeHtml(url)}">${escapeHtml(project.name)}</button><span class="muted">${escapeHtml(project.projectId.slice(0, 8))}</span></div>`;
}

function deploymentRow(origin: string, deployment: Deployment): string {
	const projectId = deployment.application?.environment?.project?.projectId;
	const envId = deployment.application?.environment?.environmentId;
	const appId = deployment.application?.applicationId;
	const url = projectId
		? projectDashboardUrl(origin, projectId, envId, appId)
		: dashboardUrl(origin);
	const label = deployment.title || deployment.deploymentId;
	const status = deployment.status ?? "unknown";
	return `<div class="row"><button type="button" data-url="${escapeHtml(url)}">${escapeHtml(label)}</button><span class="${statusClass(status)}">${escapeHtml(status)}</span></div>`;
}

function render(snapshot: SnapshotView): void {
	const content = el("content");
	const banner = el("banner");
	const select = el<HTMLSelectElement>("instanceSelect");
	const version = el("version");

	select.innerHTML = "";
	if (snapshot.instances.length === 0) {
		const option = document.createElement("option");
		option.value = "";
		option.textContent = "No instance";
		select.append(option);
	} else {
		for (const instance of snapshot.instances) {
			const option = document.createElement("option");
			option.value = instance.id;
			option.textContent = instance.name;
			if (instance.id === snapshot.activeId) option.selected = true;
			select.append(option);
		}
	}

	version.textContent = snapshot.connection?.version
		? `v${snapshot.connection.version}`
		: "";

	if (snapshot.state === "unconfigured") {
		banner.hidden = true;
		content.innerHTML = `<div class="card"><h2>Setup</h2><p class="muted">No Notploy instance configured.</p><div class="actions"><button class="btn" id="goOptions" type="button">Add instance</button></div></div>`;
		el<HTMLButtonElement>("goOptions").addEventListener("click", openOptions);
		bindLinks(content);
		return;
	}

	if (snapshot.state === "disconnected") {
		banner.hidden = false;
		banner.textContent =
			"Not signed in. Paste an API key in Settings to connect.";
		content.innerHTML = `<div class="card"><h2>Sign in</h2>
      <label class="label" for="token">API key (Settings → API Keys)</label>
      <input id="token" class="input" type="password" autocomplete="off" placeholder="npk_…" />
      <div class="actions" style="margin-top:8px"><button class="btn" id="loginBtn" type="button">Connect</button>
      <button class="btn secondary" id="openKeys" type="button">Open API keys page</button></div>
      <p class="muted" id="loginError"></p></div>`;
		el<HTMLButtonElement>("loginBtn").addEventListener("click", async () => {
			const token = el<HTMLInputElement>("token").value;
			const error = el("loginError");
			error.textContent = "Connecting…";
			const response = await send({
				kind: "login",
				instanceId: snapshot.activeId,
				token,
			});
			if (!response.ok) {
				error.textContent = response.message ?? "Login failed.";
				return;
			}
			await load("ready");
		});
		el<HTMLButtonElement>("openKeys").addEventListener("click", () => {
			if (snapshot.origin)
				openUrl(`${snapshot.origin}/dashboard/settings/api-keys`);
		});
		bindLinks(content);
		return;
	}

	if (snapshot.state === "loading") {
		banner.hidden = true;
		content.innerHTML = `<div class="card"><p class="muted">Loading projects and deployments…</p></div>`;
		return;
	}

	if (snapshot.state === "error" || snapshot.state === "session-expired") {
		banner.hidden = false;
		banner.textContent = snapshot.error ?? "Something went wrong.";
		content.innerHTML = `<div class="card"><div class="actions">
      <button class="btn" id="retryBtn" type="button">Retry</button>
      <button class="btn secondary" id="goOptions2" type="button">Settings</button></div></div>
      ${snapshot.projects.length > 0 || snapshot.deployments.length > 0 ? listsHtml(snapshot) : ""}`;
		el<HTMLButtonElement>("retryBtn").addEventListener(
			"click",
			() => void load("loading", true),
		);
		el<HTMLButtonElement>("goOptions2").addEventListener("click", openOptions);
		bindLinks(content);
		return;
	}

	banner.hidden = true;
	if (snapshot.projects.length === 0 && snapshot.deployments.length === 0) {
		content.innerHTML = `<div class="card"><h2>Projects</h2><p class="empty">No projects yet. Create one in the dashboard, then refresh.</p></div>
    <div class="card"><h2>Deployments</h2><p class="empty">No deployments yet.</p></div>
    ${snapshot.lastRefresh ? `<p class="muted">Updated ${escapeHtml(snapshot.lastRefresh)}</p>` : ""}`;
		bindLinks(content);
		return;
	}
	content.innerHTML = listsHtml(snapshot);
	bindLinks(content);
}

interface SnapshotView extends ExtensionSnapshot {
	state:
		| "unconfigured"
		| "disconnected"
		| "loading"
		| "ready"
		| "empty"
		| "error"
		| "session-expired";
	origin?: string;
	error?: string;
}

function listsHtml(snapshot: SnapshotView): string {
	const origin = snapshot.origin ?? "";
	const projects =
		snapshot.projects
			.map((project) => projectLinks(origin, project))
			.join("") || `<p class="empty">No projects.</p>`;
	const deployments =
		snapshot.deployments
			.map((deployment) => deploymentRow(origin, deployment))
			.join("") || `<p class="empty">No deployments.</p>`;
	return `<div class="card"><h2>Projects</h2>${projects}</div>
  <div class="card"><h2>Recent deployments</h2>${deployments}</div>
  ${snapshot.lastRefresh ? `<p class="muted">Updated ${escapeHtml(snapshot.lastRefresh)}</p>` : ""}`;
}

function bindLinks(root: HTMLElement): void {
	for (const button of root.querySelectorAll<HTMLButtonElement>(
		"button[data-url]",
	)) {
		button.addEventListener("click", () => {
			const url = button.getAttribute("data-url");
			if (url) openUrl(url);
		});
	}
}

function openOptions(): void {
	const runtime = chromeRuntime();
	if (runtime?.openOptionsPage) runtime.openOptionsPage();
}

function toView(
	snapshot: ExtensionSnapshot,
	forced?: SnapshotView["state"],
	error?: string,
): SnapshotView {
	if (snapshot.instances.length === 0 || !snapshot.activeId) {
		return { ...snapshot, state: "unconfigured" };
	}
	if (forced)
		return {
			...snapshot,
			state: forced,
			error,
			origin: activeOrigin(snapshot),
		};
	const status = snapshot.connection?.status;
	if (!status || status === "disconnected") {
		const active = snapshot.instances.find(
			(entry) => entry.id === snapshot.activeId,
		);
		if (active?.hasCredential === false)
			return { ...snapshot, state: "disconnected", origin: active.url };
		if (snapshot.connection?.error) {
			return {
				...snapshot,
				state: "session-expired",
				error: snapshot.connection.error,
				origin: active?.url,
			};
		}
		return { ...snapshot, state: "disconnected", origin: active?.url };
	}
	if (status === "unavailable") {
		const active = snapshot.instances.find(
			(entry) => entry.id === snapshot.activeId,
		);
		return {
			...snapshot,
			state: "error",
			error: snapshot.connection?.error,
			origin: active?.url,
		};
	}
	const active = snapshot.instances.find(
		(entry) => entry.id === snapshot.activeId,
	);
	if (snapshot.projects.length === 0 && snapshot.deployments.length === 0) {
		return { ...snapshot, state: "empty", origin: active?.url };
	}
	return { ...snapshot, state: "ready", origin: active?.url };
}

function activeOrigin(snapshot: ExtensionSnapshot): string | undefined {
	return snapshot.instances.find((entry) => entry.id === snapshot.activeId)
		?.url;
}

async function load(
	forced?: SnapshotView["state"],
	refresh = false,
): Promise<void> {
	try {
		if (refresh) {
			render({
				instances: [],
				activeId: undefined,
				connection: undefined,
				projects: [],
				deployments: [],
				state: "loading",
			});
			const refreshed = await send({ kind: "refresh" });
			if (!refreshed.ok && !refreshed.snapshot) {
				render({
					instances: [],
					activeId: undefined,
					connection: undefined,
					projects: [],
					deployments: [],
					state: "error",
					error: refreshed.message,
				});
				return;
			}
			const snapshot = refreshed.snapshot;
			if (!snapshot) return;
			if (!refreshed.ok) {
				render(
					toView(
						snapshot,
						snapshot.connection?.status === "disconnected"
							? "session-expired"
							: "error",
						refreshed.message,
					),
				);
				return;
			}
			render(toView(snapshot));
			return;
		}
		const response = await send({ kind: "getState" });
		if (!response.ok || !response.snapshot) {
			render({
				instances: [],
				activeId: undefined,
				connection: undefined,
				projects: [],
				deployments: [],
				state: "error",
				error: response.message,
			});
			return;
		}
		if (forced === "ready" || forced === "loading") {
			render(
				toView(
					response.snapshot,
					response.snapshot.connection ? undefined : "loading",
				),
			);
			if (!response.snapshot.connection) {
				await load(undefined, true);
				return;
			}
			render(toView(response.snapshot));
			return;
		}
		render(toView(response.snapshot, forced));
	} catch (error) {
		render({
			instances: [],
			activeId: undefined,
			connection: undefined,
			projects: [],
			deployments: [],
			state: "error",
			error: error instanceof Error ? error.message : "Unable to load.",
		});
	}
}

function bindChrome(): void {
	el<HTMLButtonElement>("refreshBtn").addEventListener(
		"click",
		() => void load("loading", true),
	);
	el<HTMLButtonElement>("optionsBtn").addEventListener("click", openOptions);
	el<HTMLSelectElement>("instanceSelect").addEventListener(
		"change",
		async (event) => {
			const select = event.target as HTMLSelectElement;
			if (!select.value) return;
			await send({ kind: "selectInstance", instanceId: select.value });
			await load("loading", true);
		},
	);
	el<HTMLButtonElement>("openDashboardBtn").addEventListener(
		"click",
		async () => {
			const response = await send({ kind: "getState" });
			const snapshot = response.snapshot;
			const active = snapshot?.instances.find(
				(entry) => entry.id === snapshot.activeId,
			);
			if (active) openUrl(dashboardUrl(active.url));
			else openOptions();
		},
	);
	document.addEventListener("keydown", (event) => {
		if (event.key === "r" && (event.ctrlKey || event.metaKey)) return;
		if (
			event.key.toLowerCase() === "r" &&
			!event.ctrlKey &&
			!event.metaKey &&
			(event.target as HTMLElement).tagName !== "INPUT"
		) {
			event.preventDefault();
			void load("loading", true);
		}
	});
}

bindChrome();
void load();
