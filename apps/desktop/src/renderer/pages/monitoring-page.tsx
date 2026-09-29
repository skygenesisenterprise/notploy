/**
 * Monitoring.
 *
 * Two real endpoints, and no invention: `docker.getServerHealth` for container
 * health per server, and `settings.getDockerDiskUsage` for Docker's own disk
 * report. The disk report is admin-only on the server, so "not permitted" is
 * rendered as its own state rather than as an empty report.
 */

import { Activity, RefreshCw } from "lucide-react";
import * as React from "react";
import {
	Button,
	EmptyState,
	ErrorNote,
	KeyValue,
	LoadingState,
	PageHeader,
	Panel,
	PanelHeader,
	Select,
	StatusBadge,
	TableShell,
	Td,
	Th,
	Tr,
} from "@/renderer/components/ui/primitives";
import { useAsync } from "@/renderer/hooks/use-async";
import { getBridge } from "@/renderer/lib/bridge";
import type { InstancePageProps } from "@/renderer/lib/page-props";

export function MonitoringPage({
	connection,
	refreshToken,
}: InstancePageProps) {
	const [serverId, setServerId] = React.useState("");
	const scope = serverId || undefined;

	const servers = useAsync(
		() => getBridge().infrastructure.servers(),
		[connection?.id, refreshToken],
		{ enabled: Boolean(connection?.capabilities?.servers) },
	);

	const health = useAsync(
		() => getBridge().monitoring.serverHealth(scope),
		[connection?.id, scope, refreshToken],
		{ enabled: Boolean(connection) },
	);

	const disk = useAsync(
		() => getBridge().monitoring.diskUsage(),
		[connection?.id, refreshToken],
		{ enabled: Boolean(connection) },
	);

	return (
		<div className="flex h-full flex-col">
			<PageHeader
				title="Monitoring"
				description="Container health per server, and Docker's own disk usage report."
				actions={
					<Button
						onClick={() => {
							health.reload();
							disk.reload();
						}}
						busy={health.loading || disk.loading}
					>
						<RefreshCw aria-hidden className="size-3.5" />
						Refresh
					</Button>
				}
			/>

			<div className="flex items-center gap-3 border-b border-border px-6 py-2.5">
				<span className="text-xs text-content-muted">Server</span>
				<div className="w-64">
					<Select
						value={serverId}
						onChange={(event) => setServerId(event.target.value)}
						aria-label="Server"
					>
						<option value="">Local server</option>
						{(servers.data ?? []).map((server) => (
							<option key={server.serverId} value={server.serverId}>
								{server.name}
							</option>
						))}
					</Select>
				</div>
			</div>

			<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				<Panel>
					<PanelHeader
						title="Container health"
						description="docker.getServerHealth — the Docker host's own health summary."
					/>
					{health.error ? (
						<ErrorNote
							error={health.error}
							className="m-3"
							onRetry={health.reload}
						/>
					) : health.loading && !health.data ? (
						<LoadingState />
					) : (health.data?.length ?? 0) === 0 ? (
						<EmptyState
							icon={<Activity aria-hidden className="size-8" />}
							title="Nothing reported"
							description="The instance returned no health entry for this server."
						/>
					) : (
						<TableShell
							head={
								<>
									<Th>Name</Th>
									<Th>Status</Th>
								</>
							}
						>
							{health.data?.map((entry, index) => (
								<Tr key={`${entry.Name ?? index}`}>
									<Td>{entry.Name ?? "—"}</Td>
									<Td>
										<StatusBadge
											label={entry.Status ?? "unknown"}
											tone={
												entry.Status === "healthy" || entry.Status === "running"
													? "ok"
													: entry.Status === "unhealthy"
														? "danger"
														: "muted"
											}
										/>
									</Td>
								</Tr>
							))}
						</TableShell>
					)}
				</Panel>

				<Panel>
					<PanelHeader
						title="Docker disk usage"
						description="settings.getDockerDiskUsage. Admin-only on the instance."
					/>
					{disk.error ? (
						<ErrorNote
							error={disk.error}
							className="m-3"
							onRetry={disk.reload}
						/>
					) : disk.loading && !disk.data ? (
						<LoadingState />
					) : disk.data?.restricted ? (
						<div className="px-4 py-4">
							<p className="text-sm text-content">
								This API key is not permitted to read the Docker disk report.
							</p>
							<p className="mt-1 text-xs text-content-muted">
								The procedure is restricted to administrators on the instance.
								An empty report here would be misleading, so it is reported as
								restricted instead.
							</p>
						</div>
					) : disk.data?.serviceUnavailable ? (
						<div className="px-4 py-4">
							<p className="text-sm text-content">
								This instance does not expose the Docker disk usage procedure.
							</p>
						</div>
					) : (
						<div className="space-y-4 px-4 py-4">
							<KeyValue
								items={[
									{
										label: "Total Docker disk usage",
										value:
											disk.data?.usage.humanDiskUsage ??
											disk.data?.usage.diskUsage ??
											"not reported",
									},
								]}
							/>
							<table className="w-full border-collapse text-sm">
								<thead>
									<tr className="border-b border-border text-left text-xs uppercase tracking-wide text-content-subtle">
										<th className="py-2 pr-4 font-medium">Type</th>
										<th className="py-2 pr-4 font-medium">Total</th>
										<th className="py-2 pr-4 font-medium">Active</th>
										<th className="py-2 pr-4 font-medium">Size</th>
										<th className="py-2 font-medium">Reclaimable</th>
									</tr>
								</thead>
								<tbody>
									{[
										["Containers", disk.data?.usage.containers],
										["Images", disk.data?.usage.images],
										["Volumes", disk.data?.usage.volumes],
										["Build cache", disk.data?.usage.buildCache],
									].map(([label, entries]) => {
										const first = Array.isArray(entries)
											? entries[0]
											: undefined;
										return (
											<tr
												key={String(label)}
												className="border-b border-border/60"
											>
												<td className="py-2 pr-4 text-content">
													{String(label)}
												</td>
												<td className="py-2 pr-4 text-content-muted">
													{first?.TotalCount ?? 0}
												</td>
												<td className="py-2 pr-4 text-content-muted">
													{first?.Active ?? 0}
												</td>
												<td className="py-2 pr-4 text-content-muted">
													{first?.Size ?? "—"}
												</td>
												<td className="py-2 text-content-muted">
													{first?.Reclaimable ?? "—"}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</Panel>
			</div>
		</div>
	);
}
