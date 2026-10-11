/**
 * Watches deployments and reports their outcome natively.
 *
 * This is the one thing the window genuinely cannot do: a build that takes ten
 * minutes finishes while the operator has moved on to another instance, another
 * app, or has the window behind an editor. The watcher polls the *active*
 * connection's deployment list and notifies only on a **transition** from
 * `running` to a terminal status, so:
 *
 * - the first poll of a session never notifies (there is no previous state);
 * - a deployment that was already finished when the app started never notifies;
 * - the queue being re-listed on every poll does not produce duplicate alerts.
 *
 * Polling, not streaming: the Notploy API has no WebSocket or server-sent-events
 * route. The interval is a preference, and `0` disables the watcher entirely.
 *
 * The notifier and the clock are injected, so the whole thing is unit-testable
 * without Electron.
 */

import type { Deployment, DeploymentStatus } from "@/shared/domain";
import type { ConnectionManager } from "./connection/connection-manager";
import type { Logger } from "./logging";

export interface DeploymentWatcherOptions {
	manager: ConnectionManager;
	logger: Logger;
	/** Shows an OS notification. Injected so tests can observe it. */
	notify: (title: string, body: string) => void;
	/** Seconds between polls. Read on every `apply()`, so 0 disables it. */
	intervalSeconds: () => number;
}

export class DeploymentWatcher {
	private timer: ReturnType<typeof setInterval> | undefined;
	/** Last observed status per deployment id, keyed by connection. */
	private readonly seen = new Map<string, DeploymentStatus>();

	constructor(private readonly options: DeploymentWatcherOptions) {}

	/**
	 * Applies the current preference: restarts the timer when the interval
	 * changed, stops it when it is 0.
	 */
	apply(): void {
		const seconds = this.options.intervalSeconds();
		this.clear();
		if (seconds <= 0) return;
		this.timer = setInterval(() => {
			void this.poll().catch((error) => {
				this.options.logger.warn("The deployment watcher failed", error);
			});
		}, seconds * 1000);
		// A poller must never keep the process alive on its own.
		this.timer.unref?.();
	}

	stop(): void {
		this.clear();
	}

	private clear(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
	}

	/**
	 * One poll. Returns the number of notifications emitted, which is what the
	 * tests assert on.
	 */
	async poll(): Promise<number> {
		const connection = this.options.manager.active();
		if (!connection) return 0;

		let deployments: Deployment[];
		try {
			const client = await this.options.manager.activeClient();
			deployments = await client.allDeployments();
		} catch {
			// A failed poll is not an event: connections are already watched by
			// `NotificationService`, and duplicating that here would double-alert.
			return 0;
		}

		let notified = 0;
		for (const deployment of deployments) {
			const id = deployment.deploymentId;
			const previous = this.seen.get(id);
			const current = deployment.status;
			this.seen.set(id, current ?? "running");

			if (previous !== "running" || !current || current === "running") continue;
			if (this.notifyOutcome(connection.name, deployment, current))
				notified += 1;
		}

		// Drop tracking for deployments the instance no longer lists, so the map
		// does not grow without bound on a long-running session.
		const live = new Set(
			deployments.map((deployment) => deployment.deploymentId),
		);
		for (const id of [...this.seen.keys()]) {
			if (!live.has(id)) this.seen.delete(id);
		}

		return notified;
	}

	/** True when something was actually shown, so the count stays meaningful. */
	private notifyOutcome(
		connectionName: string,
		deployment: Deployment,
		status: DeploymentStatus,
	): boolean {
		const label =
			deployment.title ||
			deployment.application?.name ||
			deployment.compose?.name ||
			`Deployment ${deployment.deploymentId}`;

		if (status === "done") {
			this.options.notify(
				`Deployment succeeded on ${connectionName}`,
				`${label} finished successfully.`,
			);
			return true;
		}
		if (status === "error") {
			const reason = deployment.errorMessage?.trim();
			this.options.notify(
				`Deployment failed on ${connectionName}`,
				reason
					? `${label}: ${reason}`
					: `${label} failed. Open Logs for the build output.`,
			);
			return true;
		}
		// `cancelled` is usually the operator's own doing, so it is not worth an
		// alert. The state is still tracked, so a later re-run is a fresh
		// transition and does notify.
		return false;
	}
}
