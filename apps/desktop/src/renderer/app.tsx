/**
 * The application shell.
 *
 * Owns the pieces of state that are genuinely cross-page:
 *
 * - the **route** — a section plus an optional resource — so the sidebar, the
 *   native menu, a `notploy://` link and the command palette all navigate the
 *   same way;
 * - the **refresh token**, one counter every page watches, so "Refresh" means
 *   the same thing everywhere;
 * - the **connection list**, which only the main process mutates;
 * - the **command palette**, which is built from the same route and connection
 *   state so it can never offer a destination that does not exist.
 *
 * Auto-refresh, when enabled in Settings, simply bumps the refresh token on a
 * timer — the same mechanism as the menu item, so there is only one way for a
 * page to learn that its data is stale.
 */

import * as React from "react";
import { BrandMark } from "@/renderer/components/brand-mark";
import {
	CommandPalette,
	type PaletteCommand,
} from "@/renderer/components/command-palette";
import { ConnectionForm } from "@/renderer/components/connection-form";
import {
	CapabilityFooter,
	ConnectionGate,
} from "@/renderer/components/connection-gate";
import { Sidebar } from "@/renderer/components/sidebar";
import { StatusDot } from "@/renderer/components/ui/primitives";
import { useConnections } from "@/renderer/hooks/use-connections";
import { usePreferences } from "@/renderer/hooks/use-preferences";
import { hasBridge } from "@/renderer/lib/bridge";
import { connectionStatus } from "@/renderer/lib/format";
import {
	DEFAULT_ROUTE,
	FOOTER_NAV_ORDER,
	NAV_ORDER,
	type RouteState,
	SECTIONS,
} from "@/renderer/lib/routes";
import { ApplicationsPage } from "@/renderer/pages/applications-page";
import { ConnectionsPage } from "@/renderer/pages/connections-page";
import { DatabaseDetailPage } from "@/renderer/pages/database-detail";
import { DatabasesPage } from "@/renderer/pages/databases-page";
import { DeploymentsPage } from "@/renderer/pages/deployments-page";
import { InfrastructurePage } from "@/renderer/pages/infrastructure-page";
import { MonitoringPage } from "@/renderer/pages/monitoring-page";
import { NotificationsPage } from "@/renderer/pages/notifications-page";
import { OperationsPage } from "@/renderer/pages/operations-page";
import { OverviewPage } from "@/renderer/pages/overview-page";
import { ProjectsPage } from "@/renderer/pages/projects-page";
import { SettingsPage } from "@/renderer/pages/settings-page";
import type { ConnectionSummary } from "@/shared/domain";

export function App() {
	const [route, setRoute] = React.useState<RouteState>(DEFAULT_ROUTE);
	const [refreshToken, setRefreshToken] = React.useState(0);
	const [addingConnection, setAddingConnection] = React.useState(false);
	const [paletteOpen, setPaletteOpen] = React.useState(false);

	const connections = useConnections();
	const { preferences, update: updatePreferences } = usePreferences();

	const refresh = React.useCallback(
		() => setRefreshToken((value) => value + 1),
		[],
	);

	const navigate = React.useCallback((next: RouteState) => {
		setRoute(next);
	}, []);

	const activeConnection = connections.active;

	// -------------------------------------------------------------------
	// Native integration: menu commands and deep links
	// -------------------------------------------------------------------

	React.useEffect(() => {
		if (!hasBridge()) return;
		return window.notploy?.onMenuCommand((command) => {
			switch (command.type) {
				case "navigate":
					navigate({
						section: command.target.section,
						resource: command.target.resource,
					});
					break;
				case "refresh":
					refresh();
					break;
				case "add-connection":
					navigate({ section: "connections" });
					setAddingConnection(true);
					break;
				case "command-palette":
					setPaletteOpen(true);
					break;
			}
		});
	}, [navigate, refresh]);

	// A `notploy://` link names the instance it wants, by id or by name. The
	// selection is applied first so the page it opens is scoped to the right
	// instance rather than to whatever happened to be active.
	React.useEffect(() => {
		if (!hasBridge()) return;
		return window.notploy?.onDeepLink((target) => {
			const reference = target.instance?.trim().toLowerCase();
			if (reference) {
				const match = connections.connections.find(
					(connection) =>
						connection.id.toLowerCase() === reference ||
						connection.name.trim().toLowerCase() === reference,
				);
				if (match && !match.active) {
					void window.notploy?.connections
						.setActive(match.id)
						.then(connections.reload);
				}
			}
			navigate({ section: target.section, resource: target.resource });
		});
	}, [connections, navigate]);

	// The menu carries the accelerator, but the window can also be focused
	// without the menu being reachable (Linux auto-hides it), so the shortcut is
	// handled here too. Chromium consumes an accelerator the menu owns, so the
	// two paths cannot both fire.
	React.useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				!(event.metaKey || event.ctrlKey) ||
				event.key.toLowerCase() !== "k"
			) {
				return;
			}
			event.preventDefault();
			setPaletteOpen((value) => !value);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	// Opt-in background refresh. 0 (the default) means nothing polls.
	React.useEffect(() => {
		if (preferences.autoRefreshSeconds <= 0) return;
		const timer = setInterval(refresh, preferences.autoRefreshSeconds * 1000);
		return () => clearInterval(timer);
	}, [preferences.autoRefreshSeconds, refresh]);

	// -------------------------------------------------------------------
	// Command palette
	// -------------------------------------------------------------------

	const commands = React.useMemo<PaletteCommand[]>(() => {
		return buildCommands({
			activeConnection,
			connections,
			navigate,
			refresh,
			addConnection: () => {
				navigate({ section: "connections" });
				setAddingConnection(true);
			},
		});
	}, [activeConnection, connections, navigate, refresh]);

	// -------------------------------------------------------------------
	// Render
	// -------------------------------------------------------------------

	const definition = SECTIONS[route.section];
	const activeStatus = connectionStatus(activeConnection?.status ?? "unknown");

	const pageProps = {
		connection: activeConnection,
		refreshToken,
		route,
		onNavigate: navigate,
	};

	const page = () => {
		switch (route.section) {
			case "overview":
				return <OverviewPage {...pageProps} />;
			case "databases":
				return route.resource?.kind === "database" ? (
					<DatabaseDetailPage {...pageProps} />
				) : (
					<DatabasesPage {...pageProps} />
				);
			case "projects":
				return <ProjectsPage {...pageProps} />;
			case "applications":
				return <ApplicationsPage {...pageProps} />;
			case "deployments":
				return <DeploymentsPage {...pageProps} />;
			case "infrastructure":
				return <InfrastructurePage {...pageProps} />;
			case "monitoring":
				return <MonitoringPage {...pageProps} />;
			case "notifications":
				return <NotificationsPage {...pageProps} />;
			// The five catalogs share one page; the section decides which.
			case "tags":
			case "certificates":
			case "ssh-keys":
			case "registries":
			case "destinations":
				return <OperationsPage kind={route.section} {...pageProps} />;
			default:
				return null;
		}
	};

	return (
		<div className="flex h-full">
			<Sidebar
				route={route}
				onNavigate={navigate}
				connections={connections.connections}
				active={activeConnection}
				onSelectConnection={(id) => {
					void window.notploy?.connections
						.setActive(id)
						.then(connections.reload);
				}}
				onAddConnection={() => {
					navigate({ section: "connections" });
					setAddingConnection(true);
				}}
			/>

			<div className="flex min-w-0 flex-1 flex-col">
				{/* The window has no title bar of its own: this strip carries the
				    product mark, the live state of the selected instance and the two
				    global controls an operator reaches for constantly. */}
				<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
					<span className="flex items-center gap-1.5 text-accent">
						<BrandMark className="size-4" />
					</span>
					<span className="text-sm font-semibold tracking-tight text-content">
						Notploy
					</span>
					<span className="text-xs text-content-subtle">Desktop</span>
					<span className="mx-2 h-4 w-px bg-border" />
					<StatusDot
						tone={activeStatus.tone}
						pulse={activeConnection?.status === "checking"}
					/>
					<span className="truncate text-xs text-content-muted">
						{activeConnection
							? `${activeConnection.name} — ${activeStatus.label}`
							: "No instance selected"}
					</span>
					<div className="ml-auto flex items-center gap-2">
						{connections.error ? (
							<span className="text-xs text-danger">
								{connections.error.message}
							</span>
						) : null}
						<button
							type="button"
							onClick={() => setPaletteOpen(true)}
							className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
						>
							<span>Commands</span>
							<kbd className="rounded bg-surface-hover px-1 font-sans text-[10px] text-content-subtle">
								{isMacPlatform() ? "⌘K" : "Ctrl+K"}
							</kbd>
						</button>
						<button
							type="button"
							onClick={refresh}
							className="rounded px-2 py-1 text-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
						>
							Refresh
						</button>
					</div>
				</div>

				<main className="min-h-0 flex-1 overflow-hidden">
					{!hasBridge() ? (
						<div className="p-6 text-sm text-warn">
							The Notploy desktop bridge is not available. Open this window
							through the Electron app.
						</div>
					) : route.section === "connections" ? (
						<ConnectionsPage
							connections={connections.connections}
							loading={connections.loading}
							onChanged={connections.reload}
						/>
					) : route.section === "settings" ? (
						<SettingsPage
							preferences={preferences}
							onUpdatePreferences={updatePreferences}
						/>
					) : (
						<ConnectionGate
							connection={activeConnection}
							route={definition}
							onOpenConnections={() => navigate({ section: "connections" })}
						>
							{page()}
							<CapabilityFooter connection={activeConnection} />
						</ConnectionGate>
					)}
				</main>
			</div>

			{addingConnection ? (
				<ConnectionForm
					onClose={() => setAddingConnection(false)}
					onSaved={connections.reload}
				/>
			) : null}

			<CommandPalette
				open={paletteOpen}
				commands={commands}
				onClose={() => setPaletteOpen(false)}
				emptyHint={
					activeConnection
						? undefined
						: "Select an instance to unlock the sections it exposes."
				}
			/>
		</div>
	);
}

function isMacPlatform(): boolean {
	return typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
}

/**
 * Builds the palette from what actually exists.
 *
 * A section is offered only when the active instance exposes its router, and the
 * instance entries only for configured connections — so every entry either
 * navigates somewhere real or is not shown at all.
 */
function buildCommands({
	activeConnection,
	connections,
	navigate,
	refresh,
	addConnection,
}: {
	activeConnection: ConnectionSummary | undefined;
	connections: ReturnType<typeof useConnections>;
	navigate: (route: RouteState) => void;
	refresh: () => void;
	addConnection: () => void;
}): PaletteCommand[] {
	const commands: PaletteCommand[] = [];

	const sectionAvailable = (
		section: (typeof NAV_ORDER)[number] | (typeof FOOTER_NAV_ORDER)[number],
	) => {
		const definition = SECTIONS[section];
		if (!definition.requiresConnection) return true;
		if (!activeConnection) return false;
		const capability = definition.capability;
		if (!capability) return true;
		// Capabilities are unknown until the first check completes; offering the
		// section then is better than hiding it, since the page explains itself.
		if (!activeConnection.capabilities) return true;
		return activeConnection.capabilities[capability];
	};

	for (const section of [...NAV_ORDER, ...FOOTER_NAV_ORDER]) {
		if (!sectionAvailable(section)) continue;
		commands.push({
			id: `go:${section}`,
			group: "Go to",
			label: SECTIONS[section].title,
			keywords: SECTIONS[section].description,
			run: () => navigate({ section }),
		});
	}

	for (const connection of connections.connections) {
		commands.push({
			id: `instance:${connection.id}`,
			group: "Instances",
			label: connection.name,
			hint: connection.active
				? "current"
				: connectionStatus(connection.status).label,
			keywords: connection.url,
			run: () => {
				void window.notploy?.connections
					.setActive(connection.id)
					.then(connections.reload);
			},
		});
	}

	if (activeConnection) {
		commands.push({
			id: "action:refresh",
			group: "Actions",
			label: "Refresh the current view",
			run: refresh,
		});
		commands.push({
			id: "action:dashboard",
			group: "Actions",
			label: `Open ${activeConnection.name} in the browser`,
			hint: "dashboard",
			run: () =>
				void window.notploy?.app.openExternal(
					`${activeConnection.url}/dashboard`,
				),
		});
		if (activeConnection.capabilities?.deployments) {
			commands.push({
				id: "action:deploy",
				group: "Actions",
				label: "Deploy an application",
				hint: "open Applications",
				run: () => navigate({ section: "applications" }),
			});
		}
		if (activeConnection.capabilities?.logs) {
			commands.push({
				id: "action:logs",
				group: "Actions",
				label: "View deployment logs",
				run: () => navigate({ section: "deployments" }),
			});
		}
		if (activeConnection.capabilities?.databases) {
			commands.push({
				id: "action:databases",
				group: "Actions",
				label: "Open a database",
				run: () => navigate({ section: "databases" }),
			});
		}
		if (activeConnection.capabilities?.docker) {
			commands.push({
				id: "action:servers",
				group: "Actions",
				label: "Open a server",
				run: () => navigate({ section: "infrastructure" }),
			});
		}
	}

	commands.push({
		id: "action:add-connection",
		group: "Actions",
		label: "Add a connection…",
		run: addConnection,
	});

	return commands;
}
