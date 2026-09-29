/**
 * Connections: the one page that works without any instance.
 *
 * Adding, editing, removing, testing, signing in and out, switching the active
 * instance, and reading the capability report the client derived from the
 * instance's own OpenAPI document.
 */

import {
	ExternalLink,
	Info,
	KeyRound,
	LogOut,
	Pencil,
	Plug,
	Plus,
	RefreshCw,
	Trash2,
} from "lucide-react";
import * as React from "react";
import { ConnectionForm } from "@/renderer/components/connection-form";
import {
	Button,
	EmptyState,
	ErrorNote,
	KeyValue,
	LoadingState,
	PageHeader,
	Panel,
	PanelHeader,
	StatusBadge,
} from "@/renderer/components/ui/primitives";
import {
	asFailure,
	type BridgeFailure,
	getBridge,
} from "@/renderer/lib/bridge";
import {
	absoluteTime,
	connectionStatus,
	dashboardUrl,
	relativeTime,
} from "@/renderer/lib/format";
import type { CapabilityReport, ConnectionSummary } from "@/shared/domain";

export interface ConnectionsPageProps {
	connections: ConnectionSummary[];
	loading: boolean;
	onChanged: () => Promise<void>;
}

export function ConnectionsPage({
	connections,
	loading,
	onChanged,
}: ConnectionsPageProps) {
	const [editing, setEditing] = React.useState<ConnectionSummary | undefined>();
	const [adding, setAdding] = React.useState(false);
	const [failure, setFailure] = React.useState<BridgeFailure | undefined>();
	const [busyId, setBusyId] = React.useState<string | undefined>();
	const [report, setReport] = React.useState<
		{ connection: ConnectionSummary; report: CapabilityReport } | undefined
	>();

	const run = async (
		id: string,
		action: () => Promise<unknown>,
	): Promise<void> => {
		setBusyId(id);
		setFailure(undefined);
		try {
			await action();
			await onChanged();
		} catch (caught) {
			setFailure(asFailure(caught));
		} finally {
			setBusyId(undefined);
		}
	};

	return (
		<div className="flex h-full flex-col">
			<PageHeader
				title="Connections"
				description="Every Notploy instance this app can talk to. API keys live in the operating system keychain; instance metadata lives in a local JSON file. Nothing is sent anywhere except the instance you select."
				actions={
					<>
						<Button
							onClick={() => {
								for (const connection of connections) {
									void run(connection.id, () =>
										getBridge().connections.test(connection.id),
									);
								}
							}}
							disabled={connections.length === 0}
						>
							<RefreshCw aria-hidden className="size-3.5" />
							Check all
						</Button>
						<Button variant="primary" onClick={() => setAdding(true)}>
							<Plus aria-hidden className="size-3.5" />
							Add connection
						</Button>
					</>
				}
			/>

			<div className="flex-1 overflow-y-auto px-6 py-4">
				{failure ? <ErrorNote error={failure} className="mb-4" /> : null}

				{loading ? (
					<LoadingState label="Loading connections…" />
				) : connections.length === 0 ? (
					<EmptyState
						icon={<Plug aria-hidden className="size-8" />}
						title="No connection yet"
						description="Add Notploy Cloud, a self-hosted instance or one running on localhost. You can keep as many as you like and switch between them at any time."
						action={
							<Button variant="primary" onClick={() => setAdding(true)}>
								Add connection
							</Button>
						}
					/>
				) : (
					<ul className="space-y-3">
						{connections.map((connection) => (
							<ConnectionRow
								key={connection.id}
								connection={connection}
								busy={busyId === connection.id}
								onSelect={() =>
									void run(connection.id, () =>
										getBridge().connections.setActive(connection.id),
									)
								}
								onTest={() =>
									void run(connection.id, () =>
										getBridge().connections.test(connection.id),
									)
								}
								onEdit={() => setEditing(connection)}
								onRemove={() =>
									void run(connection.id, () =>
										getBridge().connections.remove(connection.id),
									)
								}
								onLogout={() =>
									void run(connection.id, () =>
										getBridge().connections.logout(connection.id),
									)
								}
								onCapabilities={() =>
									void run(connection.id, async () => {
										const next = await getBridge().connections.capabilities(
											connection.id,
										);
										setReport({ connection, report: next });
									})
								}
								onOpenDashboard={() =>
									void getBridge().app.openExternal(
										dashboardUrl(connection.url),
									)
								}
							/>
						))}
					</ul>
				)}

				{report ? (
					<CapabilityPanel data={report} onClose={() => setReport(undefined)} />
				) : null}
			</div>

			{adding || editing ? (
				<ConnectionForm
					connection={editing}
					onClose={() => {
						setAdding(false);
						setEditing(undefined);
					}}
					onSaved={onChanged}
				/>
			) : null}
		</div>
	);
}

function ConnectionRow({
	connection,
	busy,
	onSelect,
	onTest,
	onEdit,
	onRemove,
	onLogout,
	onCapabilities,
	onOpenDashboard,
}: {
	connection: ConnectionSummary;
	busy: boolean;
	onSelect: () => void;
	onTest: () => void;
	onEdit: () => void;
	onRemove: () => void;
	onLogout: () => void;
	onCapabilities: () => void;
	onOpenDashboard: () => void;
}) {
	const status = connectionStatus(connection.status);
	return (
		<li>
			<Panel className={connection.active ? "border-accent/50" : undefined}>
				<div className="flex items-start justify-between gap-4 px-4 py-3">
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<h2 className="truncate text-sm font-semibold text-content">
								{connection.name}
							</h2>
							<StatusBadge label={status.label} tone={status.tone} />
							{connection.active ? (
								<span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-xs text-accent">
									Active
								</span>
							) : null}
							{connection.cloud ? (
								<span className="text-xs text-content-subtle">Cloud</span>
							) : null}
						</div>
						<p className="mt-1 truncate font-mono text-xs text-content-muted">
							{connection.url}
						</p>
						<p className="mt-1 text-xs text-content-subtle">
							{connection.hasCredential
								? "API key stored in the OS keychain"
								: "No API key stored"}
							{connection.version ? ` · v${connection.version}` : ""}
							{connection.lastCheckedAt
								? ` · checked ${relativeTime(connection.lastCheckedAt)}`
								: ""}
							{connection.allowInsecureTls
								? " · TLS verification disabled"
								: ""}
						</p>
						{connection.error ? (
							<p className="mt-1 text-xs text-warn">{connection.error}</p>
						) : null}
					</div>

					<div className="flex shrink-0 flex-wrap justify-end gap-1.5">
						{connection.active ? null : (
							<Button size="sm" onClick={onSelect} disabled={busy}>
								Use
							</Button>
						)}
						<Button size="sm" onClick={onTest} busy={busy}>
							Test
						</Button>
						<Button size="sm" variant="ghost" onClick={onEdit}>
							<Pencil aria-hidden className="size-3.5" />
							Edit
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={onCapabilities}
							disabled={!connection.hasCredential}
						>
							<Info aria-hidden className="size-3.5" />
							Capabilities
						</Button>
						<Button size="sm" variant="ghost" onClick={onOpenDashboard}>
							<ExternalLink aria-hidden className="size-3.5" />
							Dashboard
						</Button>
						{connection.hasCredential ? (
							<Button
								size="sm"
								variant="ghost"
								onClick={onLogout}
								disabled={busy}
							>
								<LogOut aria-hidden className="size-3.5" />
								Remove API key
							</Button>
						) : (
							<Button size="sm" variant="ghost" onClick={onEdit}>
								<KeyRound aria-hidden className="size-3.5" />
								Add API key
							</Button>
						)}
						<Button
							size="sm"
							variant="danger"
							onClick={onRemove}
							disabled={busy}
						>
							<Trash2 aria-hidden className="size-3.5" />
							Remove
						</Button>
					</div>
				</div>

				{connection.capabilities ? (
					<div className="border-t border-border px-4 py-2.5">
						<CapabilityChips report={connection.capabilities} />
					</div>
				) : null}
			</Panel>
		</li>
	);
}

function CapabilityChips({
	report,
}: {
	report: NonNullable<ConnectionSummary["capabilities"]>;
}) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{Object.entries(report).map(([name, enabled]) => (
				<span
					key={name}
					className={
						enabled
							? "rounded border border-border bg-surface-hover px-1.5 py-0.5 text-xs text-content-muted"
							: "rounded border border-border/60 px-1.5 py-0.5 text-xs text-content-subtle line-through"
					}
				>
					{name}
				</span>
			))}
		</div>
	);
}

function CapabilityPanel({
	data,
	onClose,
}: {
	data: { connection: ConnectionSummary; report: CapabilityReport };
	onClose: () => void;
}) {
	const { connection, report } = data;
	return (
		<Panel className="mt-4">
			<PanelHeader
				title={`Capabilities of ${connection.name}`}
				description="Read from the instance's own OpenAPI document, which is the authoritative list of routers it exposes. A trimmed-down self-hosted install reports fewer routers, and the pages say so instead of failing."
				actions={
					<Button size="sm" variant="ghost" onClick={onClose}>
						Close
					</Button>
				}
			/>
			<div className="space-y-4 px-4 py-4">
				<KeyValue
					items={[
						{ label: "Source", value: report.source },
						{ label: "Version", value: report.version ?? "not reported" },
						{ label: "Cloud", value: report.capabilities.cloud ? "yes" : "no" },
						{
							label: "Routers",
							value:
								report.routers.length > 0
									? report.routers.join(", ")
									: "none reported",
						},
					]}
				/>

				{report.restricted.length > 0 ? (
					<p className="text-xs text-warn">
						Restricted for this API key: {report.restricted.join(", ")}
					</p>
				) : null}

				{report.notes.length > 0 ? (
					<ul className="space-y-1">
						{report.notes.map((note) => (
							<li key={note} className="text-xs text-content-muted">
								{note}
							</li>
						))}
					</ul>
				) : null}

				{!report.capabilities.kubernetes ? (
					<p className="text-xs text-content-subtle">
						Kubernetes: the Notploy API has no Kubernetes router, so no
						Kubernetes resources are listed anywhere in this app.
					</p>
				) : null}

				<p className="text-xs text-content-subtle">
					Last checked {absoluteTime(connection.lastCheckedAt)}.
				</p>
			</div>
		</Panel>
	);
}
