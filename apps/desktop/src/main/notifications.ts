/**
 * OS notifications.
 *
 * Deliberately narrow. The app only notifies about things the user asked to be
 * told about and cannot see: a connection that was healthy and stops answering
 * while the app is running. Everything the user initiated — a deploy, a restart
 * — reports its result in the window they are already looking at, and turning
 * that into a notification would train them to ignore notifications.
 *
 * `Notification.isSupported()` is false on some Linux sessions without a
 * notification daemon, so the platform decides; a missing notification never
 * fails the operation that triggered it.
 */

import { Notification } from "electron";
import type { ConnectionSummary } from "@/shared/domain";
import type { Logger } from "./logging";

export class NotificationService {
	constructor(private readonly logger: Logger) {}

	get supported(): boolean {
		return Notification.isSupported();
	}

	notify(title: string, body: string): void {
		if (!this.supported) return;
		try {
			new Notification({ title, body, silent: false }).show();
		} catch (error) {
			// A notification failure is never worth surfacing as an error.
			this.logger.warn("Could not show a notification", error);
		}
	}

	/**
	 * Compares a previous connection list with a new one and notifies only about
	 * a *transition* to a bad state: an instance that was connected and became
	 * unavailable or disconnected. The first check of a session never notifies,
	 * because there is no previous state to compare with.
	 */
	notifyLosingConnections(
		previous: readonly ConnectionSummary[],
		next: readonly ConnectionSummary[],
	): number {
		const byId = new Map(
			previous.map((connection) => [connection.id, connection]),
		);
		let notified = 0;

		for (const connection of next) {
			const before = byId.get(connection.id);
			if (!before) continue;
			const wasHealthy = before.status === "connected";
			const isBad =
				connection.status === "unavailable" ||
				connection.status === "disconnected";
			if (!wasHealthy || !isBad) continue;

			this.notify(
				`Notploy: ${connection.name} is no longer reachable`,
				connection.error ??
					`The last check could not reach ${connection.url}. Open the Connections page for details.`,
			);
			notified += 1;
		}

		return notified;
	}
}
