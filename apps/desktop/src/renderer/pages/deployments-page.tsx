/**
 * Deployment history, the deploy queue, and build logs.
 *
 * "Follow" is polling, and says so: the Notploy API has no streaming route, so
 * the log view re-reads on an interval. The interval is client-side only — the
 * main process holds no timer, so closing the window is enough to stop it.
 */

import { ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import * as React from "react";
import {
	Button,
	CodeBlock,
	EmptyState,
	ErrorNote,
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
import { useConfirm } from "@/renderer/hooks/use-confirm";
import { usePreferences } from "@/renderer/hooks/use-preferences";
import {
	asFailure,
	type BridgeFailure,
	getBridge,
} from "@/renderer/lib/bridge";
import {
	dashboardUrl,
	deploymentStatus,
	duration,
	relativeTime,
} from "@/renderer/lib/format";
import type { InstancePageProps } from "@/renderer/lib/page-props";
import type { Deployment } from "@/shared/domain";

const FOLLOW_OPTIONS = [0, 5, 15, 30] as const;

export function DeploymentsPage({
	connection,
	refreshToken,
}: InstancePageProps) {
	const [selected, setSelected] = React.useState<Deployment | undefined>();
	const [followSeconds, setFollowSeconds] = React.useState<number>(0);
	const [failure, setFailure] = React.useState<BridgeFailure | undefined>();

	const { preferences } = usePreferences();
	const { confirm, dialog } = useConfirm();

	const deployments = useAsync(
		() => getBridge().deployments.list(),
		[connection?.id, refreshToken],
		{ enabled: Boolean(connection) },
	);

	const queue = useAsync(
		() => getBridge().deployments.queue(),
		[connection?.id, refreshToken],
	);

	const logs = useAsync(
		() =>
			selected
				? getBridge().deployments.logs(
						selected.deploymentId,
						preferences.logTailLines,
					)
				: Promise.resolve(""),
		[selected?.deploymentId, preferences.logTailLines, refreshToken],
		{ enabled: Boolean(selected) },
	);

	// Polling is opt-in and stops when the tab closes or the deployment is
	// cleared, because there is no server-side stream to subscribe to.
	React.useEffect(() => {
		if (!selected || followSeconds === 0) return;
		const timer = setInterval(() => logs.reload(), followSeconds * 1000);
		return () => clearInterval(timer);
	}, [selected, followSeconds, logs.reload]);

	const remove = async (deployment: Deployment) => {
		if (preferences.confirmDestructiveActions) {
			const agreed = await confirm({
				title: `Remove the record of "${deployment.title}"?`,
				description:
					"The deployment record is removed from the instance's history. The application itself is not affected.",
				confirmLabel: "Remove record",
				destructive: true,
			});
			if (!agreed) return;
		}
		setFailure(undefined);
		try {
			await getBridge().deployments.action({
				action: "remove",
				deploymentId: deployment.deploymentId,
			});
			if (selected?.deploymentId === deployment.deploymentId)
				setSelected(undefined);
			deployments.reload();
		} catch (caught) {
			setFailure(asFailure(caught));
		}
	};

	const rows = deployments.data ?? [];

	return (
		<div className="flex h-full flex-col">
			<PageHeader
				title="Deployments"
				description="deployment.allCentralized, newest first, plus the deploy queue from deployment.queueList."
				actions={
					<Button
						onClick={() => {
							deployments.reload();
							queue.reload();
							logs.reload();
						}}
						busy={deployments.loading}
					>
						<RefreshCw aria-hidden className="size-3.5" />
						Refresh
					</Button>
				}
			/>

			<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				{failure ? <ErrorNote error={failure} /> : null}
				{deployments.error ? (
					<ErrorNote error={deployments.error} onRetry={deployments.reload} />
				) : null}
				{deployments.loading && !deployments.data ? (
					<LoadingState label="Loading deployments…" />
				) : null}

				{queue.data && queue.data.length > 0 ? (
					<Panel>
						<PanelHeader
							title="Deploy queue"
							description="Jobs waiting to be processed by the instance."
						/>
						<ul className="divide-y divide-border">
							{queue.data.map((entry, index) => (
								<li
									key={String(entry.applicationId ?? entry.composeId ?? index)}
									className="flex items-center justify-between px-4 py-2 text-sm"
								>
									<span className="truncate text-content">
										{entry.name ??
											entry.applicationId ??
											entry.composeId ??
											"job"}
									</span>
									<span className="text-xs text-content-muted">
										{entry.status ?? "queued"}
									</span>
								</li>
							))}
						</ul>
					</Panel>
				) : null}

				{rows.length === 0 && !deployments.loading ? (
					<EmptyState
						title="No deployment"
						description="This instance has no deployment record yet."
					/>
				) : null}

				{rows.length > 0 ? (
					<Panel>
						<TableShell
							head={
								<>
									<Th>Title</Th>
									<Th>Target</Th>
									<Th>Status</Th>
									<Th>Duration</Th>
									<Th>Started</Th>
									<Th className="text-right">Actions</Th>
								</>
							}
						>
							{rows.map((deployment) => {
								const status = deploymentStatus(deployment.status);
								return (
									<Tr key={deployment.deploymentId}>
										<Td className="max-w-56 truncate">
											{deployment.title}
											{deployment.isPreviewDeployment ? (
												<span className="ml-1.5 text-xs text-content-subtle">
													preview
												</span>
											) : null}
										</Td>
										<Td className="max-w-48 truncate text-content-muted">
											{deployment.application?.name ??
												deployment.compose?.name ??
												deployment.server?.name ??
												"—"}
										</Td>
										<Td>
											<StatusBadge label={status.label} tone={status.tone} />
										</Td>
										<Td className="whitespace-nowrap text-content-muted">
											{duration(deployment.startedAt, deployment.finishedAt)}
										</Td>
										<Td className="whitespace-nowrap text-content-muted">
											{relativeTime(
												deployment.startedAt ?? deployment.createdAt,
											)}
										</Td>
										<Td>
											<div className="flex justify-end gap-1">
												<Button
													size="sm"
													onClick={() => setSelected(deployment)}
												>
													Logs
												</Button>
												{deployment.application?.applicationId &&
												deployment.application.environment?.environmentId ? (
													<Button
														size="sm"
														variant="ghost"
														onClick={() =>
															void getBridge().app.openExternal(
																dashboardUrl(
																	connection?.url ?? "",
																	`/project/${
																		deployment.application?.environment?.project
																			?.projectId ?? ""
																	}/environment/${
																		deployment.application?.environment
																			?.environmentId ?? ""
																	}/services/application/${
																		deployment.application?.applicationId ?? ""
																	}`,
																),
															)
														}
													>
														<ExternalLink aria-hidden className="size-3.5" />
													</Button>
												) : null}
												<Button
													size="sm"
													variant="danger"
													onClick={() => void remove(deployment)}
												>
													<Trash2 aria-hidden className="size-3.5" />
												</Button>
											</div>
										</Td>
									</Tr>
								);
							})}
						</TableShell>
					</Panel>
				) : null}

				{selected ? (
					<Panel>
						<PanelHeader
							title={`Build log — ${selected.title}`}
							description="deployment.readLogs. The Notploy API has no streaming endpoint, so following re-reads on an interval."
							actions={
								<>
									<label
										htmlFor="follow-interval"
										className="self-center text-xs text-content-muted"
									>
										Follow
									</label>
									<select
										id="follow-interval"
										value={followSeconds}
										onChange={(event) =>
											setFollowSeconds(Number(event.target.value))
										}
										className="rounded-md border border-border bg-canvas px-2 py-1 text-xs text-content"
									>
										{FOLLOW_OPTIONS.map((seconds) => (
											<option key={seconds} value={seconds}>
												{seconds === 0 ? "off" : `every ${seconds}s`}
											</option>
										))}
									</select>
									<Button size="sm" onClick={logs.reload} busy={logs.loading}>
										Reload
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => setSelected(undefined)}
									>
										Close
									</Button>
								</>
							}
						/>
						{selected.errorMessage ? (
							<p className="border-b border-border bg-danger-soft/40 px-4 py-2 text-xs text-danger">
								{selected.errorMessage}
							</p>
						) : null}
						{logs.error ? (
							<ErrorNote
								error={logs.error}
								className="m-3"
								onRetry={logs.reload}
							/>
						) : (
							<CodeBlock
								content={logs.data ?? ""}
								emptyLabel={
									logs.loading
										? "Loading…"
										: "No log file was written for this deployment."
								}
							/>
						)}
					</Panel>
				) : null}
			</div>

			{dialog}
		</div>
	);
}
