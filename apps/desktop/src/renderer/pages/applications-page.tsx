/**
 * Applications.
 *
 * The action set is exactly what `application.*` provides: deploy, redeploy,
 * restart (`application.reload`), start, stop, cancel and read logs. Nothing is
 * offered that the API cannot do.
 */

import { RefreshCw, Terminal } from "lucide-react";
import * as React from "react";
import {
	Button,
	CodeBlock,
	EmptyState,
	ErrorNote,
	Input,
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
	applicationStatus,
	relativeTime,
	shorten,
} from "@/renderer/lib/format";
import type { InstancePageProps } from "@/renderer/lib/page-props";
import type { ApplicationSummary } from "@/shared/domain";

type Action = "deploy" | "redeploy" | "restart" | "start" | "stop" | "cancel";

export function ApplicationsPage({
	connection,
	refreshToken,
}: InstancePageProps) {
	const [query, setQuery] = React.useState("");
	const [failure, setFailure] = React.useState<BridgeFailure | undefined>();
	const [busy, setBusy] = React.useState<string | undefined>();
	const [logTarget, setLogTarget] = React.useState<
		ApplicationSummary | undefined
	>();

	const { preferences } = usePreferences();
	const { confirm, dialog } = useConfirm();

	const applications = useAsync(
		() =>
			getBridge().applications.list(
				query.trim() ? { q: query.trim() } : undefined,
			),
		[connection?.id, refreshToken, query],
		{ enabled: Boolean(connection) },
	);

	const logs = useAsync(
		() =>
			logTarget
				? getBridge().applications.logs(
						logTarget.applicationId,
						preferences.logTailLines,
					)
				: Promise.resolve(""),
		[logTarget?.applicationId, preferences.logTailLines, refreshToken],
		{ enabled: Boolean(logTarget) },
	);

	const act = async (application: ApplicationSummary, action: Action) => {
		if (
			(action === "stop" || action === "cancel") &&
			preferences.confirmDestructiveActions
		) {
			const agreed = await confirm({
				title: `${action === "stop" ? "Stop" : "Cancel the deployment of"} ${application.name}?`,
				description:
					action === "stop"
						? "The application's containers are stopped. The workload goes down until it is started again."
						: "The running deployment is cancelled. A partially deployed revision may be left behind.",
				confirmLabel:
					action === "stop" ? "Stop application" : "Cancel deployment",
				destructive: true,
			});
			if (!agreed) return;
		}

		setBusy(application.applicationId);
		setFailure(undefined);
		try {
			await getBridge().applications.action({
				action,
				applicationId: application.applicationId,
				appName: application.appName,
			});
			applications.reload();
		} catch (caught) {
			setFailure(asFailure(caught));
		} finally {
			setBusy(undefined);
		}
	};

	return (
		<div className="flex h-full flex-col">
			<PageHeader
				title="Applications"
				description="Everything the API key can see. A search term is filtered by the instance through application.search; an empty field lists every page."
				actions={
					<Button onClick={applications.reload} busy={applications.loading}>
						<RefreshCw aria-hidden className="size-3.5" />
						Refresh
					</Button>
				}
			/>

			<div className="border-b border-border px-6 py-2.5">
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search applications…"
					className="max-w-sm"
					aria-label="Search applications"
				/>
			</div>

			<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				{failure ? <ErrorNote error={failure} /> : null}
				{applications.error ? (
					<ErrorNote error={applications.error} onRetry={applications.reload} />
				) : null}
				{applications.loading && !applications.data ? (
					<LoadingState label="Loading applications…" />
				) : null}

				{applications.data?.length === 0 ? (
					<EmptyState
						title={query ? "No match" : "No application"}
						description={
							query
								? "No application matched this search on the selected instance."
								: "This instance has no application yet."
						}
					/>
				) : null}

				{applications.data && applications.data.length > 0 ? (
					<Panel>
						<TableShell
							head={
								<>
									<Th>Name</Th>
									<Th>Status</Th>
									<Th>Created</Th>
									<Th className="text-right">Actions</Th>
								</>
							}
						>
							{applications.data.map((application) => {
								const status = applicationStatus(application.applicationStatus);
								return (
									<Tr key={application.applicationId}>
										<Td>
											<p className="text-content">{application.name}</p>
											<p className="font-mono text-xs text-content-subtle">
												{shorten(
													application.appName ?? application.applicationId,
													44,
												)}
											</p>
										</Td>
										<Td>
											<StatusBadge label={status.label} tone={status.tone} />
										</Td>
										<Td className="whitespace-nowrap text-content-muted">
											{relativeTime(application.createdAt)}
										</Td>
										<Td>
											<div className="flex flex-wrap justify-end gap-1">
												<Button
													size="sm"
													variant="default"
													busy={busy === application.applicationId}
													onClick={() => void act(application, "deploy")}
												>
													Deploy
												</Button>
												<Button
													size="sm"
													onClick={() => void act(application, "redeploy")}
												>
													Redeploy
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => void act(application, "restart")}
												>
													Restart
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => void act(application, "start")}
												>
													Start
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => void act(application, "stop")}
												>
													Stop
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => void act(application, "cancel")}
												>
													Cancel
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => setLogTarget(application)}
												>
													<Terminal aria-hidden className="size-3.5" />
													Logs
												</Button>
											</div>
										</Td>
									</Tr>
								);
							})}
						</TableShell>
					</Panel>
				) : null}

				{logTarget ? (
					<Panel>
						<PanelHeader
							title={`Logs — ${logTarget.name}`}
							description={`application.readLogs, tail ${preferences.logTailLines}. The API has no streaming endpoint, so this is a snapshot.`}
							actions={
								<>
									<Button size="sm" onClick={logs.reload} busy={logs.loading}>
										Reload
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => setLogTarget(undefined)}
									>
										Close
									</Button>
								</>
							}
						/>
						{logs.error ? (
							<ErrorNote
								error={logs.error}
								className="m-3"
								onRetry={logs.reload}
							/>
						) : (
							<CodeBlock
								content={logs.data ?? ""}
								emptyLabel={logs.loading ? "Loading…" : "No log line returned."}
							/>
						)}
					</Panel>
				) : null}
			</div>

			{dialog}
		</div>
	);
}
