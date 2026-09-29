/**
 * The native application menu.
 *
 * Two rules:
 *
 * - **Edit and Window use built-in roles.** Re-implementing copy/paste or
 *   minimise would break platform conventions (and, on macOS, the services and
 *   text-editing shortcuts users expect).
 * - **"Refresh" is not a reload.** Reloading a web app's window throws away all
 *   in-memory state; in an operational client that means losing which instance
 *   you were looking at. `Refresh` therefore sends a command to the renderer,
 *   which re-reads its data, and reload stays in the View menu as an explicit
 *   developer action.
 */

import {
	app,
	type BrowserWindow,
	Menu,
	type MenuItemConstructorOptions,
	shell,
} from "electron";
import type { MenuCommand } from "@/shared/ipc";

export interface BuildMenuOptions {
	/** Sends a command to the renderer (navigation, refresh, …). */
	sendCommand: (command: MenuCommand) => void;
	/** Opens the active instance's dashboard in the system browser. */
	openActiveDashboard: () => void;
	/** Re-checks every configured connection. */
	checkAllConnections: () => void;
	/** Opens a documentation, website or issue URL. */
	openExternal: (url: string) => void;
	/** The window the menu acts on, for window-scoped roles. */
	getWindow: () => BrowserWindow | null;
	/** True in development, where the developer tools are meaningful. */
	isDev: boolean;
}

const LINKS = {
	docs: "https://docs.notploy.com",
	website: "https://notploy.com",
	repository: "https://github.com/skygenesisenterprise/notploy",
	issues: "https://github.com/skygenesisenterprise/notploy/issues",
} as const;

export function buildApplicationMenu(options: BuildMenuOptions): Menu {
	const isMac = process.platform === "darwin";

	const appMenu: MenuItemConstructorOptions[] = isMac
		? [
				{
					label: app.name,
					submenu: [
						{ role: "about" },
						{ type: "separator" },
						{
							label: "Settings…",
							accelerator: "CmdOrCtrl+,",
							click: () => options.sendCommand("navigate:settings"),
						},
						{ type: "separator" },
						{ role: "services" },
						{ type: "separator" },
						{ role: "hide" },
						{ role: "hideOthers" },
						{ role: "unhide" },
						{ type: "separator" },
						{ role: "quit" },
					],
				},
			]
		: [];

	const template: MenuItemConstructorOptions[] = [
		...appMenu,
		{
			label: "File",
			submenu: [
				{
					label: "Add Connection…",
					accelerator: "CmdOrCtrl+N",
					click: () => options.sendCommand("add-connection"),
				},
				{ type: "separator" },
				{
					label: "Settings…",
					accelerator: isMac ? undefined : "Ctrl+,",
					click: () => options.sendCommand("navigate:settings"),
				},
				{ type: "separator" },
				isMac ? { role: "close" } : { role: "quit" },
			],
		},
		{
			label: "Edit",
			submenu: [
				{ role: "undo" },
				{ role: "redo" },
				{ type: "separator" },
				{ role: "cut" },
				{ role: "copy" },
				{ role: "paste" },
				...(isMac
					? [
							{ role: "pasteAndMatchStyle" as const },
							{ role: "delete" as const },
							{ role: "selectAll" as const },
						]
					: [{ role: "delete" as const }, { role: "selectAll" as const }]),
			],
		},
		{
			label: "View",
			submenu: [
				{
					label: "Overview",
					accelerator: "CmdOrCtrl+1",
					click: () => options.sendCommand("navigate:overview"),
				},
				{
					label: "Connections",
					accelerator: "CmdOrCtrl+2",
					click: () => options.sendCommand("navigate:connections"),
				},
				{ type: "separator" },
				{
					label: "Refresh",
					accelerator: "CmdOrCtrl+R",
					click: () => options.sendCommand("refresh"),
				},
				{ type: "separator" },
				{ type: "separator" },
				{ role: "resetZoom" },
				{ role: "zoomIn" },
				{ role: "zoomOut" },
				{ type: "separator" },
				{ role: "togglefullscreen" },
				...(options.isDev
					? [
							{ type: "separator" as const },
							{
								label: "Reload Window",
								accelerator: "CmdOrCtrl+Shift+R",
								click: () => options.getWindow()?.webContents.reload(),
							},
							{ role: "toggleDevTools" as const },
						]
					: []),
			],
		},
		{
			label: "Instance",
			submenu: [
				{
					label: "Check All Connections",
					accelerator: "CmdOrCtrl+Shift+C",
					click: () => options.checkAllConnections(),
				},
				{
					label: "Open Instance Dashboard",
					accelerator: "CmdOrCtrl+Shift+D",
					click: () => options.openActiveDashboard(),
				},
			],
		},
		{
			label: "Window",
			submenu: isMac
				? [
						{ role: "minimize" },
						{ role: "zoom" },
						{ type: "separator" },
						{ role: "front" },
					]
				: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
		},
		{
			role: "help",
			submenu: [
				{
					label: "Documentation",
					click: () => options.openExternal(LINKS.docs),
				},
				{ label: "Website", click: () => options.openExternal(LINKS.website) },
				{ type: "separator" },
				{
					label: "Notploy on GitHub",
					click: () => options.openExternal(LINKS.repository),
				},
				{
					label: "Report an Issue",
					click: () => options.openExternal(LINKS.issues),
				},
			],
		},
	];

	return Menu.buildFromTemplate(template);
}

/** Installs the menu as the application menu. */
export function installApplicationMenu(options: BuildMenuOptions): void {
	Menu.setApplicationMenu(buildApplicationMenu(options));
}

/** Opens a URL in the system browser, refusing anything but http(s). */
export async function openExternalUrl(url: string): Promise<void> {
	if (!url.startsWith("http://") && !url.startsWith("https://")) return;
	await shell.openExternal(url);
}
