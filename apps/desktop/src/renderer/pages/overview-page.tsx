/**
 * Overview: the answer to "what is this instance doing right now?".
 *
 * Everything is a real read. When a section could not be read, the reason is
 * listed under the counts rather than shown as a zero — an operator needs to
 * distinguish "no containers" from "containers are not readable with this key".
 */

import { RefreshCw } from "lucide-react";
import {
	Button,
	ErrorNote,
	KeyValue,
	LoadingState,
	PageHeader,
	Panel,
	PanelHeader,
	StatusBadge,
	TableShell,
	Td,
	Th,
	Tr,
} from "@/renderer/components/ui/primitives";
import { useAsync } from "@/renderer/hooks/use-async";
import { getBridge } from "@/renderer/lib/bridge";
import { deploymentStatus, relativeTime } from "@/renderer/lib/format";
import type { InstancePageProps } from "@/renderer/lib/page-props";

export function OverviewPage({
	connection,
	refreshToken,
	onNavigate,
}: InstancePageProps) {
	const state = useAsync(
		() => getBridge().overview.summary(connection?.id),
		[connection?.id, refreshToken],
		{ enabled: Boolean(connection) },
	);

	const summary = state.data;

	return (
		<div className="flex h-full flex-col">
			<PageHeader
				title="Overview"
				description={
					connection
						? `Snapshot of ${connection.name}${connection.version ? ` (v${connection.version})` : ""}.`
						: "Select an instance to see its state."
				}
				actions={
					<Button onClick={state.reload} busy={state.loading}>
						<RefreshCw aria-hidden className="size-3.5" />
						Refresh
					</Button>
				}
			/>

			<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				{state.error ? (
					<ErrorNote error={state.error} onRetry={state.reload} />
				) : null}

				{state.loading && !summary ? <LoadingState /> : null}

				{summary ? (
					<>
						<div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
							<Stat label="Projects" value={summary.counts.projects} />
							<Stat label="Applications" value={summary.counts.applications} />
							<Stat label="Compose" value={summary.counts.composes} />
							<Stat label="Deployments" value={summary.counts.deployments} />
							<Stat
								label="Running now"
								value={summary.counts.runningDeployments}
								highlight={summary.counts.runningDeployments > 0}
							/>
							<Stat label="Servers" value={summary.counts.servers} />
							<Stat label="Containers" value={summary.counts.containers} />
						</div>

						{summary.notes.length > 0 ? (
							<Panel className="border-warn/30 bg-warn/5">
								<div className="px-4 py-3">
									<h2 className="text-sm font-semibold text-content">
										Partially read
									</h2>
									<ul className="mt-1.5 space-y-1">
										{summary.notes.map((note) => (
											<li key={note} className="text-xs text-content-muted">
												{note}
											</li>
										))}
									</ul>
								</div>
							</Panel>
						) : null}

						<div className="grid gap-4 lg:grid-cols-3">
							<Panel className="lg:col-span-2">
								<PanelHeader
									title="Recent deployments"
									description="Newest first, from deployment.allCentralized."
									actions={
										<Button
											size="sm"
											variant="ghost"
											onClick={() => onNavigate({ section: "deployments" })}
										>
											All deployments
										</Button>
									}
								/>
								{summary.recentDeployments.length === 0 ? (
									<p className="px-4 py-6 text-xs text-content-subtle">
										No deployment has been recorded on this instance.
									</p>
								) : (
									<TableShell
										head={
											<>
												<Th>Application</Th>
												<Th>Status</Th>
												<Th>Started</Th>
											</>
										}
									>
										{summary.recentDeployments.map((deployment) => {
											const status = deploymentStatus(deployment.status);
											return (
												<Tr key={deployment.deploymentId}>
													<Td className="max-w-64 truncate">
														{deployment.application?.name ??
															deployment.compose?.name ??
															deployment.title}
													</Td>
													<Td>
														<StatusBadge
															label={status.label}
															tone={status.tone}
														/>
													</Td>
													<Td className="whitespace-nowrap text-content-muted">
														{relativeTime(
															deployment.startedAt ?? deployment.createdAt,
														)}
													</Td>
												</Tr>
											);
										})}
									</TableShell>
								)}
							</Panel>

							<Panel>
								<PanelHeader title="Instance" />
								<div className="px-4 py-4">
									<KeyValue
										items={[
											{ label: "Name", value: connection?.name },
											{ label: "URL", value: connection?.url },
											{
												label: "Version",
												value: summary.version ?? "not reported",
											},
											{
												label: "Cloud",
												value: summary.cloud
													? "yes"
													: summary.cloud === false
														? "no"
														: "unknown",
											},
											{
												label: "Checked",
												value: relativeTime(summary.checkedAt),
											},
										]}
									/>
								</div>
							</Panel>
						</div>

						{summary.services && summary.services.length > 0 ? (
							<Panel>
								<PanelHeader
									title="Services"
									description="Aggregate returned by overview.services."
								/>
								<TableShell
									head={
										<>
											<Th>Name</Th>
											<Th>Type</Th>
											<Th>Status</Th>
										</>
									}
								>
									{summary.services.map((service, index) => (
										<Tr key={`${service.appName ?? service.name ?? index}`}>
											<Td>{service.name ?? service.appName ?? "—"}</Td>
											<Td className="text-content-muted">
												{service.type ?? "—"}
											</Td>
											<Td className="text-content-muted">
												{service.status ?? "—"}
											</Td>
										</Tr>
									))}
								</TableShell>
							</Panel>
						) : null}
					</>
				) : null}
			</div>
		</div>
	);
}

function Stat({
	label,
	value,
	highlight = false,
}: {
	label: string;
	value: number;
	highlight?: boolean;
}) {
	return (
		<Panel
			className={
				highlight ? "border-accent/40 bg-accent-soft/40 px-4 py-3" : "px-4 py-3"
			}
		>
			<p className="text-xs text-content-subtle">{label}</p>
			<p className="mt-1 text-2xl font-semibold text-content">{value}</p>
		</Panel>
	);
}
