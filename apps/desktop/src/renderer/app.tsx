/**
 * The application shell.
 *
 * Owns the three pieces of state that are genuinely cross-page:
 *
 * - the **route**, so navigation and the native menu agree;
 * - the **refresh token**, one counter every page watches, so "Refresh" means
 *   the same thing everywhere;
 * - the **connection list**, which only the main process mutates.
 *
 * Auto-refresh, when enabled in Settings, simply bumps the refresh token on a
 * timer — the same mechanism as the menu item, so there is only one way for a
 * page to learn that its data is stale.
 */

import * as React from "react";
import { BrandMark } from "@/renderer/components/brand-mark";
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
import { ROUTES, type RouteId } from "@/renderer/lib/routes";
import { ApplicationsPage } from "@/renderer/pages/applications-page";
import { ConnectionsPage } from "@/renderer/pages/connections-page";
import { DeploymentsPage } from "@/renderer/pages/deployments-page";
import { InfrastructurePage } from "@/renderer/pages/infrastructure-page";
import { MonitoringPage } from "@/renderer/pages/monitoring-page";
import { NotificationsPage } from "@/renderer/pages/notifications-page";
import { OverviewPage } from "@/renderer/pages/overview-page";
import { ProjectsPage } from "@/renderer/pages/projects-page";
import { SettingsPage } from "@/renderer/pages/settings-page";

export function App() {
	const [route, setRoute] = React.useState<RouteId>("overview");
	const [refreshToken, setRefreshToken] = React.useState(0);
	const [addingConnection, setAddingConnection] = React.useState(false);

	const connections = useConnections();
	const { preferences, update: updatePreferences } = usePreferences();

	const refresh = React.useCallback(
		() => setRefreshToken((value) => value + 1),
		[],
	);

	// Native menu commands land here: navigation and refresh behave exactly like
	// their in-window equivalents.
	React.useEffect(() => {
		if (!hasBridge()) return;
		return window.notploy?.onMenuCommand((command) => {
			switch (command) {
				case "navigate:overview":
					setRoute("overview");
					break;
				case "navigate:connections":
					setRoute("connections");
					break;
				case "navigate:settings":
					setRoute("settings");
					break;
				case "add-connection":
					setRoute("connections");
					setAddingConnection(true);
					break;
				case "refresh":
					refresh();
					break;
			}
		});
	}, [refresh]);

	// Opt-in background refresh. 0 (the default) means nothing polls.
	React.useEffect(() => {
		if (preferences.autoRefreshSeconds <= 0) return;
		const timer = setInterval(refresh, preferences.autoRefreshSeconds * 1000);
		return () => clearInterval(timer);
	}, [preferences.autoRefreshSeconds, refresh]);

	const activeConnection = connections.active;
	const definition = ROUTES[route];
	const activeStatus = connectionStatus(activeConnection?.status ?? "unknown");

	const pageProps = {
		connection: activeConnection,
		refreshToken,
		onNavigate: setRoute,
	};

	return (
		<div className="flex h-full">
			<Sidebar
				route={route}
				onNavigate={setRoute}
				connections={connections.connections}
				active={activeConnection}
				onSelectConnection={(id) => {
					void window.notploy?.connections
						.setActive(id)
						.then(connections.reload);
				}}
				onAddConnection={() => {
					setRoute("connections");
					setAddingConnection(true);
				}}
			/>

			<div className="flex min-w-0 flex-1 flex-col">
				{/* The window has no title bar of its own: this strip carries the
				    product mark and the live state of the selected instance. */}
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
					<div className="ml-auto flex items-center gap-3">
						{connections.error ? (
							<span className="text-xs text-danger">
								{connections.error.message}
							</span>
						) : null}
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
					) : route === "connections" ? (
						<ConnectionsPage
							connections={connections.connections}
							loading={connections.loading}
							onChanged={connections.reload}
						/>
					) : route === "settings" ? (
						<SettingsPage
							preferences={preferences}
							onUpdatePreferences={updatePreferences}
						/>
					) : (
						<ConnectionGate
							connection={activeConnection}
							route={definition}
							onOpenConnections={() => setRoute("connections")}
						>
							{route === "overview" ? <OverviewPage {...pageProps} /> : null}
							{route === "infrastructure" ? (
								<InfrastructurePage {...pageProps} />
							) : null}
							{route === "projects" ? <ProjectsPage {...pageProps} /> : null}
							{route === "applications" ? (
								<ApplicationsPage {...pageProps} />
							) : null}
							{route === "deployments" ? (
								<DeploymentsPage {...pageProps} />
							) : null}
							{route === "monitoring" ? (
								<MonitoringPage {...pageProps} />
							) : null}
							{route === "notifications" ? (
								<NotificationsPage {...pageProps} />
							) : null}
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
		</div>
	);
}
