/**
 * The system tray.
 *
 * A control centre should be reachable without finding its window, so the tray
 * carries the two things an operator checks without opening anything: which
 * instance is selected and whether it is reachable — plus the quick actions
 * that make sense from outside the window (switch instance, open, refresh).
 *
 * Everything shown here is derived from the same `ConnectionSummary[]` the
 * renderer renders, and both use the shared status vocabulary in
 * `@/shared/status`, so the tray and the window can never disagree.
 *
 * The tray is genuinely optional. On a Linux session without an
 * app-indicator host, `new Tray()` throws; that is caught and reported once, and
 * the app keeps working with its window alone — which is also why the caller
 * must not enable "close to tray" when {@link TrayService.create} returned false.
 */

import path from "node:path";
import {
	app,
	clipboard,
	Menu,
	type MenuItemConstructorOptions,
	nativeImage,
	Tray,
} from "electron";
import { formatDeepLink } from "@/shared/deep-link";
import type { ConnectionSummary } from "@/shared/domain";
import type { MenuCommand } from "@/shared/ipc";
import { connectionStatus } from "@/shared/status";

export interface TrayOptions {
	/** Absolute path of the app icon; a 16px variant is derived from it. */
	iconPath: string;
	/** The renderer commands the tray can issue. */
	sendCommand: (command: MenuCommand) => void;
	/** Opens or focuses the main window. */
	showWindow: () => void;
	/** Re-checks every configured connection. */
	checkAllConnections: () => void;
	/** Selects a connection; the renderer is told through `connectionsChanged`. */
	selectConnection: (id: string) => void;
	/** Quits for real, bypassing the close-to-tray behaviour. */
	quit: () => void;
	logger: { warn: (message: string, error?: unknown) => void };
}

export class TrayService {
	private tray: Tray | undefined;
	private summaries: ConnectionSummary[] = [];
	private available = false;

	constructor(private readonly options: TrayOptions) {}

	/** True when a tray icon is actually shown on this machine. */
	get isAvailable(): boolean {
		return this.available;
	}

	/**
	 * Creates the tray icon. Safe to call once; a second call is a no-op.
	 *
	 * Returns false when the platform has no tray host, which the caller uses to
	 * avoid trapping the window's close button behind a tray that is not there.
	 */
	create(): boolean {
		if (this.tray) return this.available;
		try {
			const image = nativeImage
				.createFromPath(this.options.iconPath)
				.resize({ width: 16, height: 16 });
			this.tray = new Tray(image);
			this.tray.setToolTip("Notploy");
			this.tray.on("click", () => this.options.showWindow());
			this.available = true;
			this.render();
			return true;
		} catch (error) {
			this.available = false;
			this.options.logger.warn(
				"System tray unavailable on this desktop session",
				error,
			);
			return false;
		}
	}

	/** The tray mirrors the connection list; called whenever it changes. */
	update(summaries: ConnectionSummary[]): void {
		this.summaries = summaries;
		this.render();
	}

	private render(): void {
		if (!this.tray) return;
		const active = this.summaries.find((connection) => connection.active);
		const status = connectionStatus(active?.status ?? "unknown");

		this.tray.setToolTip(
			active
				? `Notploy — ${active.name} · ${status.label}`
				: `Notploy ${app.getVersion()} — no instance selected`,
		);

		const connections: MenuItemConstructorOptions[] = this.summaries.map(
			(connection) => ({
				label: `${connection.name} — ${connectionStatus(connection.status).label}`,
				type: "radio",
				checked: connection.active,
				click: () => this.options.selectConnection(connection.id),
			}),
		);

		const template: MenuItemConstructorOptions[] = [
			{
				label: active
					? `${active.name} — ${status.label}`
					: "No instance selected",
				enabled: false,
			},
			{ type: "separator" },
			{ label: "Open Notploy", click: () => this.options.showWindow() },
			{
				label: "Command Palette…",
				click: () => this.options.sendCommand({ type: "command-palette" }),
			},
			{ type: "separator" },
			{
				label: "Instances",
				enabled: connections.length > 0,
				submenu:
					connections.length > 0
						? connections
						: [{ label: "No connection configured", enabled: false }],
			},
			{
				label: "Check all connections",
				click: () => this.options.checkAllConnections(),
			},
			{
				label: "Refresh active view",
				enabled: Boolean(active),
				click: () => this.options.sendCommand({ type: "refresh" }),
			},
			{ type: "separator" },
			{
				label: "Notifications",
				click: () =>
					this.options.sendCommand({
						type: "navigate",
						target: { section: "notifications" },
					}),
			},
			{
				label: "Copy a link to the active instance",
				enabled: Boolean(active),
				click: () => {
					if (!active) return;
					clipboard.writeText(
						formatDeepLink({ section: "overview", instance: active.id }),
					);
				},
			},
			{ type: "separator" },
			{ label: `Notploy ${app.getVersion()}`, enabled: false },
			{ label: "Quit Notploy", click: () => this.options.quit() },
		];

		this.tray.setContextMenu(Menu.buildFromTemplate(template));
	}

	destroy(): void {
		this.tray?.destroy();
		this.tray = undefined;
		this.available = false;
	}
}

/** Where the tray icon lives, beside the window icon. */
export function trayIconFor(appPath: string): string {
	return path.join(appPath, "assets", "icon.png");
}
