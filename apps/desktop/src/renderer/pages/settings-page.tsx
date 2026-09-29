/**
 * Settings.
 *
 * Everything here is local to this machine: the desktop client has no
 * instance-side settings of its own, and the Notploy API exposes server settings
 * through `settings.*` procedures the dashboard already manages. Duplicating
 * them here would create a second way to change production configuration.
 */

import { ExternalLink, ShieldCheck, ShieldOff } from "lucide-react";
import * as React from "react";
import {
	Button,
	Checkbox,
	Field,
	Input,
	KeyValue,
	LoadingState,
	PageHeader,
	Panel,
	PanelHeader,
	Select,
} from "@/renderer/components/ui/primitives";
import { getBridge } from "@/renderer/lib/bridge";
import type { AppInfo, DesktopPreferences } from "@/shared/ipc";

export interface SettingsPageProps {
	preferences: DesktopPreferences;
	onUpdatePreferences: (patch: Partial<DesktopPreferences>) => Promise<void>;
}

const LINKS = [
	{ label: "Documentation", url: "https://docs.notploy.com" },
	{ label: "Website", url: "https://notploy.com" },
	{
		label: "GitHub repository",
		url: "https://github.com/skygenesisenterprise/notploy",
	},
	{
		label: "Report an issue",
		url: "https://github.com/skygenesisenterprise/notploy/issues",
	},
];

export function SettingsPage({
	preferences,
	onUpdatePreferences,
}: SettingsPageProps) {
	const [info, setInfo] = React.useState<AppInfo | undefined>();
	const [error, setError] = React.useState<string | undefined>();

	React.useEffect(() => {
		let cancelled = false;
		void getBridge()
			.app.info()
			.then((value) => {
				if (!cancelled) setInfo(value);
			})
			.catch((caught: unknown) => {
				if (!cancelled) setError(String(caught));
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="flex h-full flex-col">
			<PageHeader
				title="Settings"
				description="Local preferences and runtime information. None of this is sent to an instance."
			/>

			<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				<Panel>
					<PanelHeader
						title="Safety"
						description="How the client behaves when an action cannot be undone."
					/>
					<div className="space-y-4 px-4 py-4">
						<Checkbox
							label="Confirm destructive actions"
							description="Ask before stopping or cancelling a deployment, and before stopping, killing or removing a container."
							checked={preferences.confirmDestructiveActions}
							onChange={(event) =>
								void onUpdatePreferences({
									confirmDestructiveActions: event.target.checked,
								})
							}
						/>
					</div>
				</Panel>

				<Panel>
					<PanelHeader
						title="Refresh and logs"
						description="How often the active view re-reads its data, and how much a log request asks for."
					/>
					<div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
						<Field
							label="Automatic refresh (seconds)"
							htmlFor="auto-refresh"
							hint="0 disables background refreshing. The Notploy API has no push endpoint, so this is polling."
						>
							<Input
								id="auto-refresh"
								type="number"
								min={0}
								max={3600}
								value={preferences.autoRefreshSeconds}
								onChange={(event) =>
									void onUpdatePreferences({
										autoRefreshSeconds: Number(event.target.value) || 0,
									})
								}
							/>
						</Field>

						<Field
							label="Log lines per request"
							htmlFor="log-tail"
							hint="Sent as the tail parameter of the log endpoints. Between 10 and 100000."
						>
							<Input
								id="log-tail"
								type="number"
								min={10}
								max={100_000}
								step={10}
								value={preferences.logTailLines}
								onChange={(event) =>
									void onUpdatePreferences({
										logTailLines: Number(event.target.value) || 300,
									})
								}
							/>
						</Field>

						<Field
							label="Default request timeout (ms)"
							htmlFor="request-timeout"
							hint="Used by connections that do not set their own. Between 1 and 10 minutes."
						>
							<Input
								id="request-timeout"
								type="number"
								min={1000}
								max={600_000}
								step={1000}
								value={preferences.requestTimeout}
								onChange={(event) =>
									void onUpdatePreferences({
										requestTimeout: Number(event.target.value) || 30_000,
									})
								}
							/>
						</Field>

						<Field
							label="Theme"
							htmlFor="theme"
							hint="The desktop client ships a single dark theme, matching the dashboard."
						>
							<Select id="theme" value="dark" disabled>
								<option value="dark">Dark</option>
							</Select>
						</Field>
					</div>
				</Panel>

				<Panel>
					<PanelHeader
						title="Credential storage"
						description="Where API keys are kept on this machine."
					/>
					<div className="space-y-4 px-4 py-4">
						{info ? (
							<div className="flex items-start gap-3">
								{info.secureStorage.available ? (
									<ShieldCheck aria-hidden className="mt-0.5 size-5 text-ok" />
								) : (
									<ShieldOff aria-hidden className="mt-0.5 size-5 text-warn" />
								)}
								<div>
									<p className="text-sm text-content">
										{info.secureStorage.available
											? `API keys are encrypted with ${backendLabel(info.secureStorage.backend)}.`
											: "API keys cannot be persisted on this machine."}
									</p>
									{info.secureStorage.reason ? (
										<p className="mt-1 text-xs text-content-muted">
											{info.secureStorage.reason}
										</p>
									) : null}
								</div>
							</div>
						) : (
							<LoadingState label="Reading the keychain state…" />
						)}

						{info ? (
							<KeyValue
								items={[
									{ label: "App version", value: info.version },
									{ label: "Electron", value: info.electron },
									{ label: "Chromium", value: info.chrome },
									{ label: "Node", value: info.node },
									{
										label: "Platform",
										value: `${info.platform} ${info.arch}`,
									},
								]}
							/>
						) : null}

						{error ? (
							<p className="text-xs text-danger">
								The runtime information could not be read: {error}
							</p>
						) : null}
					</div>
				</Panel>

				<Panel>
					<PanelHeader title="Links" />
					<ul className="divide-y divide-border">
						{LINKS.map((link) => (
							<li key={link.url}>
								<button
									type="button"
									onClick={() => void getBridge().app.openExternal(link.url)}
									className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
								>
									{link.label}
									<ExternalLink aria-hidden className="size-4" />
								</button>
							</li>
						))}
					</ul>
				</Panel>

				<Button
					variant="ghost"
					onClick={() =>
						void onUpdatePreferences({
							confirmDestructiveActions: true,
							autoRefreshSeconds: 0,
							logTailLines: 300,
							requestTimeout: 30_000,
						})
					}
				>
					Reset preferences to defaults
				</Button>
			</div>
		</div>
	);
}

function backendLabel(backend: AppInfo["secureStorage"]["backend"]): string {
	switch (backend) {
		case "dpapi":
			return "Windows DPAPI";
		case "keychain":
			return "the macOS Keychain";
		case "libsecret":
			return "the Linux Secret Service";
		default:
			return "in-memory storage";
	}
}
